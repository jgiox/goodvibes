"""goodvibes update command — manifest-based file update."""
from __future__ import annotations

import hashlib
import importlib.metadata
import json
import pathlib
import shutil
from typing import Annotated

import typer
from rich.console import Console
from rich.panel import Panel

from goodvibes_cli.steps.copy_templates import list_template_files, resolve_templates_dir
from goodvibes_cli.steps.write_manifest import ManifestError, read_manifest, write_manifest
from goodvibes_cli.utils.detect_project_type import detect_project_type
from goodvibes_cli.utils.json_merge import MANAGED_JSON, managed_record, merge_managed_json
from goodvibes_cli.steps.global_setup import apply_global_config, claude_config_dir, format_global
from goodvibes_cli.utils.scope import global_owned
from goodvibes_cli.utils.sentinel_merge import ClaudeMdError, merge_claude

console = Console()

# Not a hex digest, so the file always classifies as user-modified on later runs.
USER_OWNED = "user-owned"


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
    try:
        manifest = read_manifest(cwd)
        global_manifest = read_manifest(claude_config_dir())
    except ManifestError as e:
        console.print(str(e), style="red", markup=False)
        raise typer.Exit(1)
    if manifest is None and global_manifest is None:
        console.print(Panel(
            "No .goodvibes.json in this folder or in your Claude Code settings, so goodvibes is not set up here yet.\n"
            "Run 'goodvibes init' (files you already have are kept), then 'goodvibes update' keeps them current.",
            title="No manifest",
        ))
        console.rule("Nothing updated.")
        return  # exit 0 — UPD-05: no typer.Exit(), returning yields exit code 0

    template_dir = resolve_templates_dir()
    if global_manifest is not None or (manifest or {}).get("scope") == "global":
        g = apply_global_config(template_dir, importlib.metadata.version("goodvibes-cli"), dry_run=dry_run)
        console.print(Panel(format_global(g, None, None), title=f"{'Dry run — ' if dry_run else ''}Global setup ({g['config_dir']})"))
    if manifest is None:
        console.rule("Run without --dry-run to apply." if dry_run else "[green]Update complete![/green]")
        return
    project_type = detect_project_type(cwd)
    scope = manifest.get("scope") or "project"

    def excluded(rel: str) -> bool:
        # In global scope the rules block, skills and context7 live in the user config, never in the project.
        return scope == "global" and (rel == "CLAUDE.md" or global_owned(rel))

    # Categorise managed files into overwrite / skip / net_new
    overwrite: list[str] = []
    skip: list[str] = []
    net_new: list[str] = []
    kept: list[str] = []
    ci_variants = {"ci-node.yml", "ci-python.yml", "ci-both.yml"}
    selected_variant_src = f"ci-{project_type}.yml"

    # First pass: manifest files → overwrite (SHA unchanged or absent) / skip (user-modified)
    for rel, manifest_sha in manifest["files"].items():
        if excluded(rel):
            continue
        _assert_safe(cwd, rel)
        dest_path = cwd / rel
        if not dest_path.exists():
            overwrite.append(rel)
            continue
        if rel == "CLAUDE.md":
            # merge_claude only ever replaces the sentinel block, so it's always safe
            # to run even when custom prose outside the block changes the whole-file hash.
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
        if dest_rel in managed_keys or excluded(dest_rel):
            continue
        # init only records files it wrote; a file already on disk is the user's own.
        if dest_rel != "CLAUDE.md" and (cwd / dest_rel).exists():
            kept.append(dest_rel)
        else:
            net_new.append(dest_rel)

    # User-modified settings.json / .mcp.json still receive goodvibes-managed keys.
    merges: list[tuple[str, dict, list[str]]] = []
    merge_errors: list[str] = []
    for rel in [r for r in skip + kept if r in MANAGED_JSON]:
        tpl_path = template_dir / rel
        if not tpl_path.exists():
            continue
        try:
            user = json.loads((cwd / rel).read_text(encoding="utf-8"))
        except ValueError as e:
            merge_errors.append(f"{rel}: not valid JSON ({e}); left unchanged, fix it and re-run update")
            continue
        tpl = json.loads(tpl_path.read_text(encoding="utf-8"))
        merged, changes = merge_managed_json(rel, tpl, user, (manifest.get("managed") or {}).get(rel))
        if changes:
            merges.append((rel, merged, changes))
    merge_lines = [f"Will merge goodvibes keys into {rel}:\n  " + "\n  ".join(ch) for rel, _, ch in merges]
    merge_lines += [f"Cannot merge {e}" for e in merge_errors]

    if dry_run:
        lines = [
            f"Will overwrite ({len(overwrite)}): {', '.join(overwrite)}" if overwrite else "Will overwrite (0): (none)",
            f"Will skip — user-modified ({len(skip)}): {', '.join(skip)}" if skip else "Will skip — user-modified (0): (none)",
            f"Will add net-new ({len(net_new)}): {', '.join(net_new)}" if net_new else "Will add net-new (0): (none)",
        ]
        if kept:
            lines.append(f"Will keep — already yours, not written by goodvibes ({len(kept)}): {', '.join(kept)}")
        lines += merge_lines
        console.print(Panel("\n".join(lines), title="Dry run — no files written"))
        console.rule("Run without --dry-run to apply.")
        return

    if not force and (overwrite or merges):
        confirmed = typer.confirm(
            f"Overwrite {len(overwrite)} managed file(s) and merge goodvibes keys into {len(merges)} file(s)?"
        )
        if not confirmed:
            console.rule("Update cancelled.")
            return

    # Apply: overwrite managed files and copy net-new files
    applied: list[str] = []
    problems: list[str] = []
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
            try:
                merge_claude(cwd / rel, template_content)
            except ClaudeMdError as e:
                problems.append(str(e))
                if rel in manifest["files"]:
                    skip.append(rel)
                continue
        else:
            dest = cwd / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(str(template_src), str(dest))

        applied.append(rel)

    for rel, merged, _ in merges:
        (cwd / rel).write_text(json.dumps(merged, indent=2) + "\n", encoding="utf-8")

    # Preserve skipped (user-modified) files' prior hashes so they stay
    # protected on every later run instead of dropping out of the manifest.
    preserved = {rel: manifest["files"][rel] for rel in skip}
    preserved.update({rel: USER_OWNED for rel in kept})

    _version = importlib.metadata.version("goodvibes-cli")
    write_manifest(
        cwd, applied, _version, preserved=preserved,
        managed=managed_record(cwd, template_dir, manifest.get("managed")),
        scope=scope,
    )

    summary = applied + [f"{rel} (merged {len(ch)} goodvibes key(s))" for rel, _, ch in merges]
    summary += [f"Not merged: {e}" for e in merge_errors]
    console.print(Panel("\n".join(summary) or "(none)", title="Updated"))
    if problems:
        console.print(Panel("\n".join(problems), title="Not updated — needs your attention"))
        console.rule("[red]Update finished with problems.[/red]")
        raise typer.Exit(1)
    console.rule("[green]Update complete![/green]")
