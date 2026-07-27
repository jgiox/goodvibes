"""goodvibes update command — manifest-based file update."""
from __future__ import annotations

import hashlib
import importlib.metadata
import pathlib
import shutil
from typing import Annotated

import typer
from rich.console import Console
from rich.panel import Panel

from goodvibes_cli.steps.copy_templates import list_template_files, resolve_templates_dir
from goodvibes_cli.steps.write_manifest import read_manifest, write_manifest
from goodvibes_cli.utils.detect_project_type import detect_project_type
from goodvibes_cli.utils.sentinel_merge import merge_claude

console = Console()


def _assert_safe(base: pathlib.Path, rel: str) -> None:
    resolved = (base / rel).resolve()
    if not str(resolved).startswith(str(base.resolve()) + "/"):
        raise ValueError(f"Unsafe manifest key rejected: {rel}")


def update_cmd(
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Preview changes without writing")] = False,
    force: Annotated[bool, typer.Option("--force", help="Skip confirmation and overwrite")] = False,
) -> None:
    """Update goodvibes-managed files using the manifest."""
    console.rule("[bold]goodvibes update[/bold]")
    cwd = pathlib.Path.cwd()
    manifest = read_manifest(cwd)
    if manifest is None:
        console.print(Panel(
            "No .goodvibes.json found. This project was initialised before v1.2.0.\n"
            "Run 'goodvibes init' once to create the manifest, then use 'goodvibes update' to keep files current.",
            title="No manifest",
        ))
        console.rule("Nothing updated.")
        return  # exit 0 — UPD-05: no typer.Exit(), returning yields exit code 0

    template_dir = resolve_templates_dir()
    project_type = detect_project_type(cwd)

    # Categorise managed files into overwrite / skip / net_new
    overwrite: list[str] = []
    skip: list[str] = []
    net_new: list[str] = []
    ci_variants = {"ci-node.yml", "ci-python.yml", "ci-both.yml"}
    selected_variant_src = f"ci-{project_type}.yml"

    # First pass: manifest files → overwrite (SHA unchanged or absent) / skip (user-modified)
    for rel, manifest_sha in manifest["files"].items():
        _assert_safe(cwd, rel)
        dest_path = cwd / rel
        if not dest_path.exists():
            overwrite.append(rel)
            continue
        dest_sha = hashlib.sha256(dest_path.read_bytes()).hexdigest()
        if dest_sha == manifest_sha:
            overwrite.append(rel)
        else:
            skip.append(rel)

    # Second pass: template files not yet in manifest → net_new
    all_template_files = list_template_files(template_dir)
    managed_keys = set(manifest["files"].keys())
    for tf in all_template_files:
        if tf == ".goodvibes.json":
            continue
        is_variant = any(tf.endswith(v) for v in ci_variants)
        if is_variant:
            if not tf.endswith(selected_variant_src):
                continue  # skip unselected variants
            dest_rel = ".github/workflows/ci.yml"  # map selected variant to dest name
        else:
            dest_rel = tf
        if dest_rel not in managed_keys:
            net_new.append(dest_rel)

    if dry_run:
        lines = [
            f"Will overwrite ({len(overwrite)}): {', '.join(overwrite)}" if overwrite else "Will overwrite (0): (none)",
            f"Will skip — user-modified ({len(skip)}): {', '.join(skip)}" if skip else "Will skip — user-modified (0): (none)",
            f"Will add net-new ({len(net_new)}): {', '.join(net_new)}" if net_new else "Will add net-new (0): (none)",
        ]
        console.print(Panel("\n".join(lines), title="Dry run — no files written"))
        console.rule("Run without --dry-run to apply.")
        return

    if not force and overwrite:
        confirmed = typer.confirm(f"Overwrite {len(overwrite)} managed file(s)?")
        if not confirmed:
            console.rule("Update cancelled.")
            return

    # Apply: overwrite managed files and copy net-new files
    applied: list[str] = []
    for rel in overwrite + net_new:
        _assert_safe(cwd, rel)
        if rel == "CLAUDE.md":
            template_src = template_dir / "CLAUDE.md"
        elif rel == ".github/workflows/ci.yml":
            template_src = template_dir / ".github" / "workflows" / f"ci-{project_type}.yml"
        else:
            template_src = template_dir / rel

        if not template_src.exists():
            continue

        if rel == "CLAUDE.md":
            # ponytail: CLAUDE.md must go through merge_claude — sentinel block preservation
            template_content = template_src.read_text(encoding="utf-8")
            merge_claude(cwd / rel, template_content)
        else:
            dest = cwd / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(str(template_src), str(dest))

        applied.append(rel)

    _version = importlib.metadata.version("goodvibes-cli")
    write_manifest(cwd, applied, _version)

    console.print(Panel("\n".join(applied) or "(none)", title="Updated"))
    console.rule("[green]Update complete![/green]")
