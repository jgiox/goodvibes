"""goodvibes reset: put back goodvibes' version of the files and settings entries it manages."""
from __future__ import annotations

import hashlib
import importlib.metadata
import json
import os
import pathlib
import shutil
from typing import Annotated

import typer
from rich.console import Console
from rich.panel import Panel

from goodvibes_cli.commands.update_cmd import _ask, _shown
from goodvibes_cli.steps.copy_templates import DEPENDABOT, list_template_files, resolve_templates_dir
from goodvibes_cli.steps.global_setup import claude_config_dir
from goodvibes_cli.steps.write_manifest import MANIFEST_PATH, USER_OWNED, ManifestError, read_manifest, write_manifest
from goodvibes_cli.utils.detect_project_type import dependabot_yml, detect_project_type
from goodvibes_cli.utils.json_merge import (
    MANAGED_JSON, covers, file_allow_rules, managed_ids, managed_record, merge_managed_json, present_ids, shape_error, user_allow_rules,
    write_json, yielded_ids,
)
from goodvibes_cli.utils.safe_path import SymlinkError, check_writable
from goodvibes_cli.utils.scope import global_owned, goodvibes_block, same_path
from goodvibes_cli.utils.sentinel_merge import ClaudeMdError, merge_claude

console = Console()

# The npm CLI prints these exact strings; change both together.
NO_MANIFEST = "No .goodvibes.json in this folder, so goodvibes manages no files here. To reset goodvibes' files in your Claude Code settings folder, run goodvibes reset --global."
NOTHING = "Nothing to reset: everything goodvibes manages here already matches goodvibes' version."
BACKUPS = "Each changed file is copied to <file>.goodvibes-backup first."
BLOCK_ONLY = "CLAUDE.md: only goodvibes' rules block is replaced; your text outside it stays"
CANCELLED = "Reset cancelled. Nothing was changed."
SETTINGS = ".claude/settings.json"


def reset_cmd(
    files: Annotated[list[str] | None, typer.Argument(help="Only these files (default: every file goodvibes wrote here)", show_default=False)] = None,
    global_: Annotated[bool, typer.Option("--global", help="Reset goodvibes' files in your Claude Code settings folder instead of this project")] = False,
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Preview what would change without writing")] = False,
    yes: Annotated[bool, typer.Option("--yes", "-y", help="Skip the confirmation prompt")] = False,
) -> None:
    """Put back goodvibes' version of files and settings you edited or deleted (your copies are backed up)"""
    console.rule("[bold]goodvibes reset[/bold]")
    run_reset(files or [], global_, dry_run, yes)


def backup(path: pathlib.Path) -> pathlib.Path:
    """Copy path beside itself under a name no earlier backup uses."""
    dest, n = path.with_name(f"{path.name}.goodvibes-backup"), 1
    while os.path.lexists(dest):
        n += 1
        dest = path.with_name(f"{path.name}.goodvibes-backup-{n}")
    shutil.copy2(path, dest)
    return dest


def _fail(lines: list[str]) -> None:
    console.print(_shown(lines), style="red")
    raise typer.Exit(1)


def _covered_lines(label: str, tpl: dict, merged: dict, allows: list[str]) -> list[str]:
    have = (merged.get("permissions") or {}).get("ask") or []
    lines = []
    for p in (tpl.get("permissions") or {}).get("ask") or []:
        by = next((a for a in allows if covers(a, p)), None)
        if by and p not in have:
            lines.append(f"{label}: goodvibes' ask rule {p} stays out because your allow rule {by} covers it; delete {by}, then run goodvibes reset again to have Claude Code ask first")
    return lines


def run_reset(files: list[str], global_: bool, dry_run: bool, yes: bool) -> None:
    cwd = pathlib.Path.cwd()
    cfg = claude_config_dir()
    # In the Claude Code settings folder the manifest there is the global one.
    global_ = global_ or same_path(cwd, cfg)
    root = cfg if global_ else cwd
    try:
        manifest = read_manifest(root)
    except ManifestError as e:
        _fail([str(e)])
    if manifest is None:
        _fail([f"goodvibes is not set up in your Claude Code settings folder ({cfg}), so there is nothing to reset there." if global_ else NO_MANIFEST])
    template_dir = resolve_templates_dir()
    tpl_settings = json.loads((template_dir / SETTINGS).read_text(encoding="utf-8"))
    recorded = manifest.get("files") or {}

    # What goodvibes would write for each file it manages here; None: no longer shipped.
    sources: dict[str, bytes | None] = {}
    if global_:
        sources["rules/goodvibes.md"] = goodvibes_block((template_dir / "CLAUDE.md").read_text(encoding="utf-8")).encode("utf-8")
        for rel in list_template_files(template_dir):
            rel = rel.replace("\\", "/")
            if rel.startswith(".claude/skills/"):
                sources[rel[len(".claude/"):]] = (template_dir / rel).read_bytes()
        sources["settings.json"] = b""
    else:
        scope = manifest.get("scope") or "project"
        project_type = detect_project_type(cwd)
        for rel in recorded:
            if scope == "global" and (rel == "CLAUDE.md" or global_owned(rel)):
                continue
            src = template_dir / ".github" / "workflows" / f"ci-{project_type}.yml" if rel == ".github/workflows/ci.yml" else template_dir / rel
            data = src.read_bytes() if src.is_file() else None
            sources[rel] = dependabot_yml(data.decode("utf-8"), cwd).encode("utf-8") if data is not None and rel == DEPENDABOT else data

    wanted = [pathlib.Path(os.path.relpath(os.path.abspath(root / f), os.path.abspath(root))).as_posix() for f in files]
    unknown = [f"{f}: goodvibes does not manage this file here, so reset cannot restore it. Nothing was changed." for f, rel in zip(files, wanted) if rel not in sources]
    if unknown:
        _fail(unknown)

    extra_allow = [] if global_ else [*file_allow_rules(cwd / ".claude" / "settings.local.json", tpl_settings), *file_allow_rules(cfg / "settings.json", tpl_settings)]
    items: list[tuple[str, str, object]] = []
    replace: list[str] = []
    restore: list[str] = []
    merges: list[str] = []
    notes: list[str] = []
    problems: list[str] = []
    for rel in dict.fromkeys(wanted) if wanted else [r for r in sources if recorded.get(r) != USER_OWNED]:
        data, dest = sources[rel], root / rel
        if data is None:
            if wanted:
                notes.append(f"{rel}: goodvibes no longer ships this file, so there is nothing to reset it to")
            continue
        if not global_:
            try:
                check_writable(cwd, dest)
            except SymlinkError as e:
                notes.append(str(e))
                continue
        exists = dest.exists()
        if rel == "CLAUDE.md" and not global_:
            try:
                if merge_claude(dest, data.decode("utf-8"), dry_run=True, force=True) == "unchanged":
                    continue
            except ClaudeMdError as e:
                problems.append(str(e))
                continue
            items.append((rel, "claude", data.decode("utf-8")))
        elif rel in MANAGED_JSON or (global_ and rel == "settings.json"):
            tpl_rel = SETTINGS if global_ else rel
            tpl = tpl_settings if global_ else json.loads(data)
            try:
                user = json.loads(dest.read_text(encoding="utf-8")) if exists else None
            except ValueError as e:
                problems.append(f"{rel}: not valid JSON ({e}); left unchanged, fix it and re-run reset")
                continue
            problem = "not a JSON object" if exists and not isinstance(user, dict) else shape_error(tpl_rel, user) if user else None
            if problem:
                problems.append(f"{rel}: {problem}; left unchanged, fix it and re-run reset")
                continue
            # A missing project file is written as the template; its ask rules count as installed, so covered ones drop out.
            base, installed = (user, []) if exists else ({}, []) if global_ else (tpl, managed_ids(rel, tpl))
            allow = extra_allow if tpl_rel == SETTINGS else []
            merged, changes = merge_managed_json(tpl_rel, tpl, base, installed, extra_allow=allow, force=True)
            notes += _covered_lines(rel, tpl, merged, [*user_allow_rules(merged, tpl), *allow])
            if exists and merged == user:
                continue
            items.append((rel, "json", merged))
            if exists:
                merges.append(f"Will reset goodvibes entries in {rel}:\n  " + "\n  ".join(changes))
        else:
            if exists and dest.read_bytes() == data:
                continue
            items.append((rel, "file", data))
        if not exists:
            restore.append(rel)
        elif items[-1][1] != "json":
            replace.append(rel)

    lines = [f"Will replace with goodvibes' version ({len(replace)}): {', '.join(replace)}"] if replace else []
    lines += [BLOCK_ONLY] if "CLAUDE.md" in replace and not global_ else []
    lines += [f"Will restore, deleted ({len(restore)}): {', '.join(restore)}"] if restore else []
    lines += merges + notes + problems + ([BACKUPS] if items else [NOTHING])
    title = "Dry run: no files written" if dry_run else "Plan"
    console.print(Panel(_shown(lines), title=f"{title} ({cfg})" if global_ else title))
    if not items:
        if problems:
            raise typer.Exit(1)
        console.print("Nothing reset.")
        return
    if dry_run:
        console.print("Run without --dry-run to reset these files.")
        return
    if not yes and not _ask(f"Reset {len(items)} file(s) to goodvibes' version? Your copies are backed up first."):
        console.print(CANCELLED)
        return

    done: list[str] = []
    written: list[str] = []
    for rel, kind, payload in items:
        dest = root / rel
        try:
            if not global_:
                # Checked again after the question: the folder may have become a symlink while reset waited.
                check_writable(cwd, dest)
            saved = backup(dest) if dest.exists() else None
            if kind == "claude":
                merge_claude(dest, payload, force=True)
            else:
                dest.parent.mkdir(parents=True, exist_ok=True)
                write_json(dest, payload) if kind == "json" else dest.write_bytes(payload)
        except (SymlinkError, ClaudeMdError) as e:
            problems.append(str(e))
            continue
        written.append(rel)
        done.append(f"{rel}: reset to goodvibes' version; your copy is in {saved.relative_to(root).as_posix()}" if saved else f"{rel}: restored goodvibes' version")

    version = importlib.metadata.version("goodvibes-cli")
    if global_:
        files_rec = {**recorded, **{rel: hashlib.sha256((cfg / rel).read_bytes()).hexdigest() for rel in written if rel != "settings.json"}}
        managed = dict(manifest.get("managed") or {})
        if "settings.json" in written:
            merged = next(p for r, _, p in items if r == "settings.json")
            forget = yielded_ids(tpl_settings, merged, user_allow_rules(merged, tpl_settings))
            present = present_ids(SETTINGS, tpl_settings, merged)
            managed["settings.json"] = [i for i in dict.fromkeys([*managed.get("settings.json", []), *present]) if i not in forget]
        write_json(cfg / MANIFEST_PATH, {**manifest, "version": version, "files": files_rec, "managed": managed})
    else:
        try:
            write_manifest(
                cwd, written, version, preserved={k: v for k, v in recorded.items() if k not in written},
                managed=managed_record(cwd, template_dir, manifest.get("managed"), cfg), scope=manifest.get("scope"), git_hook=manifest.get("gitHook"),
            )
        except SymlinkError as e:
            problems.append(str(e))

    console.print(Panel(_shown(done + problems), title="Reset complete"))
    if problems:
        raise typer.Exit(1)
    console.print("Done!", style="green")
