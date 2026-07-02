"""goodvibes upgrade command — port of upgrade.ts."""
from __future__ import annotations

import importlib.metadata
import json
import os
import pathlib
import shutil
import subprocess
import sys
import urllib.request
from typing import Annotated

import typer
from rich.console import Console
from rich.panel import Panel

from goodvibes_cli.steps.copy_templates import list_template_files, resolve_templates_dir
from goodvibes_cli.utils.detect_project_type import detect_project_type
from goodvibes_cli.utils.sentinel_merge import (
    SENTINEL_END,
    SENTINEL_START,
    extract_version,
    merge_claude,
    version_gte,
)

console = Console()

_PYPI_URL = "https://pypi.org/pypi/goodvibes-cli/json"
_UPGRADING_ENV = "_GV_UPGRADING"


def _get_package_version() -> str | None:
    try:
        return importlib.metadata.version("goodvibes-cli")
    except importlib.metadata.PackageNotFoundError:
        return None


def _check_pypi_version() -> str | None:
    try:
        with urllib.request.urlopen(_PYPI_URL, timeout=5) as resp:  # noqa: S310
            return json.loads(resp.read())["info"]["version"]
    except Exception:
        return None


def _self_update_pip() -> None:
    # try uv tool upgrade first; fall back to pip install --upgrade
    try:
        subprocess.run(["uv", "tool", "upgrade", "goodvibes-cli"], check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--upgrade", "goodvibes-cli"],
            check=True,
        )

_MANAGED_FIXED = {
    "CLAUDE.md",
    ".github/workflows/ci.yml",
    ".github/workflows/security.yml",
    ".github/workflows/dependency-review.yml",
    ".github/dependabot.yml",
}


def _detect_installed_version(cwd: pathlib.Path) -> str | None:
    claude_path = cwd / "CLAUDE.md"
    if not claude_path.exists():
        return None
    return extract_version(claude_path.read_text(encoding="utf-8"))


def compute_changes(
    template_dir: pathlib.Path,
    dest_dir: pathlib.Path,
    project_type: str,
) -> list[tuple[str, str]]:
    """Return list of (relative_path, status) for managed files."""
    if not template_dir:
        return []
    all_files = list_template_files(template_dir)
    ci_variant = f".github/workflows/ci-{project_type}.yml"
    managed = [
        f for f in all_files
        if f.startswith(".claude/skills/")
        or f in _MANAGED_FIXED
        or f == ci_variant
    ]

    results: list[tuple[str, str]] = []
    for rel in managed:
        # Map CI variant to its destination path
        dest_rel = ".github/workflows/ci.yml" if rel == ci_variant else rel
        dest_path = dest_dir / dest_rel
        src_path = template_dir / rel

        if not dest_path.exists():
            results.append((dest_rel, "new"))
            continue

        src_content = src_path.read_text(encoding="utf-8")
        dest_content = dest_path.read_text(encoding="utf-8")
        status = "unchanged" if src_content == dest_content else "changed"
        results.append((dest_rel, status))

    return sorted(results, key=lambda t: t[0])


def format_change_summary(changes: list[tuple[str, str]]) -> str:
    if not changes:
        return "(no managed files found)"
    symbol = {"changed": "~", "unchanged": "=", "new": "+"}
    return "\n".join(f"{symbol.get(s, '?')} {p}" for p, s in changes)


def upgrade_templates(
    template_dir: pathlib.Path,
    dest_dir: pathlib.Path,
    project_type: str,
) -> list[str]:
    """Overwrite managed files from template_dir into dest_dir."""
    ci_variants = {"ci-node.yml", "ci-python.yml", "ci-both.yml"}
    selected_variant = f"ci-{project_type}.yml"
    claude_dest = dest_dir / "CLAUDE.md"

    if template_dir:
        def ignore_fn(directory: str, contents: list[str]) -> set[str]:
            ignored: set[str] = set()
            for name in contents:
                full = pathlib.Path(directory) / name
                try:
                    full.resolve().relative_to(template_dir.resolve())  # raises if symlink escapes
                except ValueError:
                    ignored.add(name)
                    continue
                try:
                    rel = full.relative_to(template_dir)
                except ValueError:
                    ignored.add(name)
                    continue
                if name == "CLAUDE.md":
                    ignored.add(name)  # handled by merge_claude
                rel_str = str(rel)
                # Skip files outside the managed set
                if not any(
                    [".claude/skills" in rel_str, ".github/workflows" in rel_str]
                ) and name not in {"CLAUDE.md"}:
                    ignored.add(name)
                # Skip non-selected CI variants
                if name in ci_variants and name != selected_variant:
                    ignored.add(name)
            return ignored

        shutil.copytree(str(template_dir), str(dest_dir), ignore=ignore_fn, dirs_exist_ok=True)

        # Rename selected CI variant to ci.yml
        variant_path = dest_dir / ".github" / "workflows" / selected_variant
        ci_path = dest_dir / ".github" / "workflows" / "ci.yml"
        if variant_path.exists():
            variant_path.rename(ci_path)

        template_content = (template_dir / "CLAUDE.md").read_text(encoding="utf-8")
        merge_claude(claude_dest, template_content)
    else:
        # template_dir unavailable — still call merge_claude so CLAUDE.md update path is exercised
        if claude_dest.exists():
            merge_claude(claude_dest, claude_dest.read_text(encoding="utf-8"))

    # Return relative paths written — only managed prefixes
    if not dest_dir.exists():
        return []
    return sorted(
        str(f.relative_to(dest_dir))
        for f in dest_dir.rglob("*")
        if f.is_file()
        and (
            str(f.relative_to(dest_dir)).startswith(".claude/skills/")
            or str(f.relative_to(dest_dir)).startswith(".github/workflows/")
            or str(f.relative_to(dest_dir)) == "CLAUDE.md"
        )
    )


def upgrade_cmd(
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Preview changes without writing")] = False,
) -> None:
    """Re-sync goodvibes-managed files to the latest version."""
    console.rule("[bold]goodvibes upgrade[/bold]")

    # Self-update: check PyPI for a newer package version and re-exec if found.
    # _GV_UPGRADING prevents infinite re-exec if the new binary still sees itself as outdated.
    if not os.environ.get(_UPGRADING_ENV):
        current = _get_package_version()
        latest = _check_pypi_version()
        if latest and current and not version_gte(current, latest):
            console.print(f"New version available: [bold]{latest}[/bold] (installed: {current})")
            with console.status(f"Updating goodvibes {current} → {latest}…"):
                _self_update_pip()
            console.print(f"[green]✓ Updated to {latest}[/green] — re-applying templates…")
            os.execve(sys.argv[0], sys.argv, {**os.environ, _UPGRADING_ENV: "1"})
            return  # unreachable; satisfies type checker

    template_dir = resolve_templates_dir()
    cwd = pathlib.Path.cwd()
    project_type = detect_project_type(cwd)

    installed_version = _detect_installed_version(cwd)
    bundled_version = _get_package_version()

    if installed_version and bundled_version and version_gte(installed_version, bundled_version):
        console.rule(f"[green]Already up to date (v{installed_version})[/green]")
        return

    changes = compute_changes(template_dir, cwd, project_type)
    console.print(Panel(format_change_summary(changes), title="What will change"))

    if dry_run:
        console.rule("Run without --dry-run to apply these changes.")
        return

    updated: list[str] = []
    with console.status("Upgrading managed files"):
        updated = upgrade_templates(template_dir, cwd, project_type)

    file_list = "\n".join(updated) if updated else "(no files changed)"
    console.print(Panel(file_list, title="Files updated"))
    console.rule("[green]Upgrade complete![/green]")
