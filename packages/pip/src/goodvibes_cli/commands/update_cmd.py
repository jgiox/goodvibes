"""goodvibes update command — manifest-based file update."""
from __future__ import annotations

import hashlib
import importlib.metadata
import json
import pathlib
import shutil
import sys
from typing import Annotated

import typer
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from goodvibes_cli.steps.copy_templates import DEPENDABOT, FILE_SIZE_WORKFLOW, list_template_files, resolve_templates_dir
from goodvibes_cli.steps.project_copies import EDITED, STRIP_PLAN, STRIPPED, old_skill_copies, removed_line
from goodvibes_cli.steps.git_hook import KEEPS, REMOVED_LINE, hook_line, install_git_hook
from goodvibes_cli.steps.write_manifest import USER_OWNED, USER_REMOVED, ManifestError, read_manifest, write_manifest
from goodvibes_cli.utils.detect_project_type import dependabot_yml, detect_project_type
from goodvibes_cli.utils.json_merge import MANAGED_JSON, managed_record, merge_managed_json, shape_error, write_json
from goodvibes_cli.steps.global_setup import apply_global_config, claude_config_dir, format_global
from goodvibes_cli.utils.safe_path import SymlinkError, check_writable, printable, remove_retired
from goodvibes_cli.utils.scope import global_owned, minimal_skipped, same_path
from goodvibes_cli.utils.sentinel_merge import ClaudeMdError, merge_claude, strip_block

console = Console()

REMOVED = "removed by you, not re-added (run goodvibes init to restore)"
# The npm CLI prints these exact strings; change both together.
DRY_RUN_END = "Run without --dry-run to apply changes."
CANCELLED = "Update cancelled. Nothing was changed."
DONE = "Done!"


def _shown(lines: list[str]) -> Text:
    # Keys and JSON errors come from repo files: keep our own line breaks, replace other control characters, and never parse Rich markup.
    return Text("\n".join(printable(line) for line in "\n".join(lines).split("\n")))


def _group(rel: str) -> str | None:
    # file-size.yml travels with its script in .github/scripts, so it is in the .github group
    if rel.startswith(".github/workflows/") and rel != FILE_SIZE_WORKFLOW:
        return "workflows"
    if not minimal_skipped(rel):
        return None
    return ".github" if rel.startswith(".github/") else "docs"


def _assert_safe(base: pathlib.Path, rel: str) -> None:
    root = base.resolve()
    resolved = (base / rel).resolve()
    if resolved == root or not resolved.is_relative_to(root):
        raise ValueError(f"Unsafe manifest key rejected: {rel}")


def _ask(question: str) -> bool:
    try:
        return typer.confirm(question)
    except typer.Abort:
        # Ctrl-C at a terminal still aborts; closed input (a script or CI) gets a clear message.
        if sys.stdin.isatty():
            raise
        console.print("No answer (the input ended). Nothing was changed.", markup=False)
        raise typer.Exit(1)


def update_cmd(
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Preview what would change without writing")] = False,
    force: Annotated[bool, typer.Option("--force", help="Skip the confirmation prompt (files you edited are still kept)")] = False,
) -> None:
    """Update goodvibes-managed files using the manifest"""
    console.rule("[bold]goodvibes update[/bold]")
    run_update(dry_run=dry_run, force=force)


def run_update(dry_run: bool, force: bool) -> None:
    cwd = pathlib.Path.cwd()
    try:
        # In the Claude Code settings folder the manifest there is the global one: update only the global part.
        manifest = None if same_path(cwd, claude_config_dir()) else read_manifest(cwd)
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
    version = importlib.metadata.version("goodvibes-cli")
    # Plan the Claude config changes first; nothing is written there until the user has said yes.
    g_plan = None
    if global_manifest is not None or (manifest or {}).get("scope") == "global":
        g_plan = apply_global_config(template_dir, version, dry_run=True, restore=False)
        console.print(Panel(Text(format_global(g_plan, None, None)), title=f"{'Dry run — ' if dry_run else 'Plan — '}Global setup ({g_plan['config_dir']})"))
    global_changes = len(g_plan["written"]) + len(g_plan["retired"]) + len(g_plan["settings_changes"]) if g_plan else 0

    def apply_global() -> None:
        if g_plan is not None:
            g = apply_global_config(template_dir, version, dry_run=False, restore=False)
            console.print(Panel(Text(format_global(g, None, None)), title=f"Global setup ({g['config_dir']})"))

    if manifest is None:
        if dry_run:
            console.print(DRY_RUN_END)
            return
        if not force and global_changes and not _ask(f"Apply {global_changes} change(s) to your Claude Code settings?"):
            console.print(CANCELLED)
            return
        apply_global()
        console.print(DONE, style="green")
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
    not_written: list[str] = []
    blocked: list[str] = []
    removed: list[str] = []
    still_removed: list[str] = []
    retired: list[str] = []

    def symlinked(rel: str) -> bool:
        try:
            check_writable(cwd, cwd / rel)
            return False
        except SymlinkError as e:
            not_written.append(str(e))
            return True

    # First pass: manifest files → overwrite (SHA unchanged or absent) / skip (user-modified)
    for rel, manifest_sha in manifest["files"].items():
        if excluded(rel):
            continue
        if symlinked(rel):
            blocked.append(rel)
            continue
        _assert_safe(cwd, rel)
        dest_path = cwd / rel
        if manifest_sha == USER_REMOVED:
            # Recreated after the user deleted it: the file is theirs now and is never overwritten.
            (kept if dest_path.exists() else still_removed).append(rel)
            continue
        if not dest_path.exists():
            removed.append(rel)
            continue
        if rel == "CLAUDE.md":
            # merge_claude only ever replaces the sentinel block, so it's always safe
            # to run even when custom prose outside the block changes the whole-file hash.
            overwrite.append(rel)
            continue
        dest_sha = hashlib.sha256(dest_path.read_bytes()).hexdigest()
        if dest_sha == manifest_sha and rel.startswith(".claude/skills/") and not (template_dir / rel).exists():
            retired.append(rel)  # unmodified skill goodvibes no longer ships
        elif dest_sha == manifest_sha:
            overwrite.append(rel)
        else:
            skip.append(rel)

    # Second pass: template files not yet in manifest → net_new
    all_template_files = list_template_files(template_dir)
    managed_keys = set(manifest["files"].keys())
    # init --minimal, or a project that already had CI, skips whole groups; update must not add them later.
    tracked_groups = {_group(k) for k, v in manifest["files"].items() if k not in removed and v != USER_REMOVED}
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
        if dest_rel in managed_keys or excluded(dest_rel) or symlinked(dest_rel):
            continue
        # init only records files it wrote; a file already on disk is the user's own.
        if dest_rel != "CLAUDE.md" and (cwd / dest_rel).exists():
            kept.append(dest_rel)
        elif _group(dest_rel) is None or _group(dest_rel) in tracked_groups:
            net_new.append(dest_rel)

    # A project set up in project scope keeps its old rules block and skill copies; Claude would load both versions.
    moved: list[str] = []
    edited: list[str] = []
    strip = False
    strip_error: str | None = None
    if scope == "global":
        moved, edited = old_skill_copies(cwd, manifest["files"])
        skip += edited
        try:
            strip = strip_block(cwd / "CLAUDE.md", dry_run=True)
        except SymlinkError as e:
            not_written.append(str(e))
        except ClaudeMdError as e:
            strip_error = str(e)

    # User-modified settings.json and MCP files still receive goodvibes-managed keys.
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
        if not isinstance(user, dict):
            merge_errors.append(f"{rel}: not a JSON object; left unchanged, fix it and re-run update")
            continue
        shape = shape_error(rel, user)
        if shape:
            merge_errors.append(f"{rel}: {shape}; left unchanged, fix it and re-run update")
            continue
        tpl = json.loads(tpl_path.read_text(encoding="utf-8"))
        merged, changes = merge_managed_json(rel, tpl, user, (manifest.get("managed") or {}).get(rel), retire_allow=rel == ".claude/settings.json")
        if changes:
            merges.append((rel, merged, changes))
    merge_lines = [f"Will merge goodvibes keys into {rel}:\n  " + "\n  ".join(ch) for rel, _, ch in merges]
    merge_lines += [f"Cannot merge {e}" for e in merge_errors]

    lines = []
    if overwrite:
        lines.append(f"Will overwrite ({len(overwrite)}): {', '.join(overwrite)}")
    if skip:
        lines.append(f"Will skip — user-modified ({len(skip)}): {', '.join(skip)}")
    if net_new:
        lines.append(f"Will add net-new ({len(net_new)}): {', '.join(net_new)}")
    if kept:
        lines.append(f"Will keep — already yours, not written by goodvibes ({len(kept)}): {', '.join(kept)}")
    if retired:
        lines.append(f"Will remove — no longer shipped by goodvibes ({len(retired)}): {', '.join(retired)}")
    if moved:
        lines.append(f"Will remove, now set up for all your projects ({len(moved)}): {', '.join(moved)}")
    lines += ([STRIP_PLAN] if strip else []) + ([strip_error] if strip_error else []) + ([EDITED + ", ".join(edited)] if edited else [])
    lines += merge_lines
    lines += [f"{rel}: {REMOVED}" for rel in removed]
    lines += not_written

    git_hook = manifest.get("gitHook")
    hook_plan: dict | None = None
    hook_removed = False
    hook_notes: list[str] = []
    if git_hook != USER_REMOVED:
        hook_plan = install_git_hook(cwd, True)
        # "installed" means the target is missing: the user deleted the hook goodvibes wrote.
        if git_hook == "installed" and hook_plan["status"] == "installed":
            hook_plan, hook_removed = None, True
            hook_notes.append(REMOVED_LINE)
        elif hook_line(hook_plan, True):
            hook_notes.append(hook_line(hook_plan, True))
    hook_changes = hook_plan is not None and hook_plan["status"] in ("installed", "updated")
    console.print(Panel(_shown(lines + hook_notes or ["Nothing to change in this project."]), title="Dry run — no files written" if dry_run else "Plan"))
    if dry_run:
        console.print(DRY_RUN_END)
        return

    cleanup_count = len(moved) + strip
    if not force and (overwrite or net_new or merges or retired or cleanup_count or global_changes or hook_changes):
        also_cleanup = f" and remove {cleanup_count} old project copies" if cleanup_count else ""
        also_global = f" and apply {global_changes} change(s) to your Claude Code settings" if global_changes else ""
        confirmed = _ask(
            f"Overwrite {len(overwrite)} managed file(s), add {len(net_new)}, merge goodvibes keys into {len(merges)} file(s){also_cleanup}{also_global}?"
        )
        if not confirmed:
            console.print(CANCELLED)
            return

    apply_global()

    # Counted before the loop: a CLAUDE.md that could not be merged is reported on its own, not as user-modified.
    skipped_count = len(skip) + len(kept)
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
            except SymlinkError as e:
                not_written.append(str(e))
                if rel in manifest["files"]:
                    skip.append(rel)
                continue
            except ClaudeMdError as e:
                problems.append(str(e))
                if rel in manifest["files"]:
                    skip.append(rel)
                continue
        else:
            dest = cwd / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(str(template_src), str(dest))
            if rel == DEPENDABOT:
                dest.write_bytes(dependabot_yml(template_src.read_bytes().decode("utf-8"), cwd).encode("utf-8"))

        applied.append(rel)

    for rel, merged, _ in merges:
        write_json(cwd / rel, merged)

    for rel in retired + moved:
        remove_retired(cwd, rel, ".claude/skills")
    stripped = False
    if strip_error:
        problems.append(strip_error)
    elif strip:
        try:
            stripped = strip_block(cwd / "CLAUDE.md")
        except SymlinkError as e:
            not_written.append(str(e))
        except ClaudeMdError as e:
            problems.append(str(e))

    hook_result = install_git_hook(cwd, False) if hook_plan is not None else None
    if hook_removed:
        git_hook = USER_REMOVED
    elif hook_result and hook_result["status"] in KEEPS:
        git_hook = "installed"

    # Preserve skipped (user-modified) files' prior hashes so they stay
    # protected on every later run instead of dropping out of the manifest.
    preserved = {rel: manifest["files"][rel] for rel in skip + blocked}
    preserved.update({rel: USER_OWNED for rel in kept})
    # Recorded, not dropped: a dropped entry would look net-new on the next update and come back.
    preserved.update({rel: USER_REMOVED for rel in removed + still_removed})

    try:
        write_manifest(
            cwd, applied, version, preserved=preserved,
            managed=managed_record(cwd, template_dir, manifest.get("managed")),
            scope=scope,
            git_hook=git_hook,
        )
    except SymlinkError as e:
        not_written.append(str(e))

    hook_msg = REMOVED_LINE if hook_removed else hook_line(hook_result, False) if hook_result else None
    summary = [f"Applied {len(applied)} file(s). Skipped {skipped_count} user-modified file(s)."]
    summary += [f"Merged {len(ch)} goodvibes key(s) into {rel}." for rel, _, ch in merges]
    summary += [f"{rel}: removed, no longer shipped by goodvibes" for rel in retired]
    summary += ([STRIPPED] if stripped else []) + [removed_line(rel) for rel in moved]
    summary += [f"Not merged: {e}" for e in merge_errors]
    summary += [f"{rel}: {REMOVED}" for rel in removed]
    summary += not_written + problems + ([hook_msg] if hook_msg else [])
    console.print(Panel(_shown(summary), title="Update complete"))
    if problems:
        console.print("CLAUDE.md was not updated; fix it by hand as described above, then run goodvibes update again.", style="red")
        raise typer.Exit(1)
    console.print(DONE, style="green")
