"""Global (user-level) Claude Code setup (mirror of npm steps/global-setup.ts)."""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys

from goodvibes_cli.steps.copy_templates import list_template_files
from goodvibes_cli.steps.write_manifest import MANIFEST_PATH, USER_OWNED, USER_REMOVED, read_manifest
from goodvibes_cli.utils.json_merge import merge_managed_json, present_ids, shape_error, write_json
from goodvibes_cli.utils.proc import run
from goodvibes_cli.utils.scope import goodvibes_block
from goodvibes_cli.utils.safe_path import remove_retired

CONTEXT7_URL = "https://mcp.context7.com/mcp"


def claude_config_dir() -> pathlib.Path:
    return pathlib.Path(os.environ.get("CLAUDE_CONFIG_DIR") or pathlib.Path.home() / ".claude")


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def register_context7(dry_run: bool) -> dict[str, str]:
    try:
        listed = subprocess.run(["claude", "mcp", "list"], capture_output=True, text=True, timeout=10)
        if re.search(r"^context7\b", listed.stdout, re.M):
            return {"status": "already-registered"}
        if dry_run:
            return {"status": "skipped", "reason": "dry run"}
        subprocess.run(
            ["claude", "mcp", "add", "--transport", "http", "--scope", "user", "context7", CONTEXT7_URL],
            capture_output=True, text=True, timeout=10, check=True,
        )
        return {"status": "registered"}
    except FileNotFoundError:
        return {"status": "skipped", "reason": f"claude CLI not found; run: claude mcp add --transport http --scope user context7 {CONTEXT7_URL}"}
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        return {"status": "failed", "reason": str(e).splitlines()[0]}


def ensure_global_cli(version: str, dry_run: bool) -> dict[str, str]:
    """A plain `pip install` already puts goodvibes on PATH; `uvx`/`pipx run` do not, so install it as a uv tool."""
    found = shutil.which("goodvibes")
    # A goodvibes inside the active virtualenv is on PATH only while that venv is active.
    in_venv = found and sys.prefix != sys.base_prefix and pathlib.Path(found).resolve().is_relative_to(pathlib.Path(sys.prefix).resolve())
    if found and not in_venv:
        return {"status": "already-installed"}
    # >= not ==: uv stores the requirement, and a pin makes every later `uv tool upgrade` a no-op.
    manual = f'Install manually: uv tool install "goodvibes-cli>={version}"'
    if dry_run:
        return {"status": "skipped", "reason": f'dry run; would run uv tool install "goodvibes-cli>={version}"'}
    try:
        run(["uv", "tool", "install", f"goodvibes-cli>={version}"], capture_output=True, text=True, timeout=120, check=True)
        if shutil.which("goodvibes") is None:
            return {"status": "installed", "reason": "goodvibes is not on your PATH yet: run uv tool update-shell, then open a new terminal"}
        return {"status": "installed"}
    except FileNotFoundError:
        return {"status": "failed", "reason": f"uv not found. {manual} (or pip install goodvibes-cli)"}
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        return {"status": "failed", "reason": f"{str(e).splitlines()[0]}. {manual}"}


def apply_global_config(template_dir: pathlib.Path, version: str, dry_run: bool, restore: bool = True) -> dict:
    """Write goodvibes-owned files into the Claude Code user config; a file the user edited since is kept.

    restore=False (update) leaves a recorded file the user deleted deleted; init passes True to bring it back.
    """
    cfg = claude_config_dir()
    prev = read_manifest(cfg) or {}
    prev_files = prev.get("files") or {}
    owned = [("rules/goodvibes.md", goodvibes_block((template_dir / "CLAUDE.md").read_text(encoding="utf-8")))]
    for rel in list_template_files(template_dir):
        rel = rel.replace("\\", "/")
        if rel.startswith(".claude/skills/"):
            owned.append((rel[len(".claude/"):], (template_dir / rel).read_text(encoding="utf-8")))

    result: dict = {"config_dir": str(cfg), "written": [], "kept": [], "removed": [], "retired": [], "settings_changes": [], "settings_error": None}
    files: dict[str, str] = {}
    for rel, content in owned:
        dest = cfg / rel
        recorded = prev_files.get(rel)
        if recorded == USER_REMOVED and dest.exists():
            # The user recreated it: theirs now, never overwritten (not even by init).
            result["kept"].append(rel)
            files[rel] = USER_OWNED
            continue
        if not restore and recorded == USER_REMOVED:
            files[rel] = USER_REMOVED
            continue
        if not restore and recorded and not dest.exists():
            result["removed"].append(rel)
            files[rel] = USER_REMOVED
            continue
        current = _sha(dest.read_text(encoding="utf-8")) if dest.exists() else None
        if current == _sha(content):
            files[rel] = current
            continue
        if current and current != recorded:
            result["kept"].append(rel)
            if recorded:
                files[rel] = recorded
            continue
        result["written"].append(rel)
        files[rel] = _sha(content)
        if not dry_run:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(content, encoding="utf-8")

    # Skills goodvibes no longer ships: delete the copy it wrote; an edited copy is the user's and stays (untracked).
    owned_paths = {rel for rel, _ in owned}
    for rel, recorded in prev_files.items():
        if rel in owned_paths or not rel.startswith("skills/") or recorded in (USER_OWNED, USER_REMOVED):
            continue
        dest = cfg / rel
        if not dest.exists() or _sha(dest.read_text(encoding="utf-8")) != recorded:
            continue
        result["retired"].append(rel)
        if not dry_run:
            remove_retired(cfg, rel, "skills")

    tpl = json.loads((template_dir / ".claude" / "settings.json").read_text(encoding="utf-8"))
    settings_path = cfg / "settings.json"
    managed = dict(prev.get("managed") or {})
    try:
        user = json.loads(settings_path.read_text(encoding="utf-8")) if settings_path.exists() else {}
    except ValueError as e:
        user = None
        result["settings_error"] = f"{settings_path}: not valid JSON ({e}); left unchanged, fix it and re-run"
    shape = shape_error(".claude/settings.json", user) if isinstance(user, dict) else None
    if user is not None and not isinstance(user, dict):
        result["settings_error"] = f"{settings_path}: not a JSON object; left unchanged, fix it and re-run"
    elif shape:
        result["settings_error"] = f"{settings_path}: {shape}; left unchanged, fix it and re-run"
    elif user is not None:
        merged, changes = merge_managed_json(".claude/settings.json", tpl, user, managed.get("settings.json"))
        result["settings_changes"] = changes
        if not dry_run and changes:
            cfg.mkdir(parents=True, exist_ok=True)
            write_json(settings_path, merged)
        managed["settings.json"] = list(dict.fromkeys([*managed.get("settings.json", []), *present_ids(".claude/settings.json", tpl, merged)]))

    if not dry_run:
        cfg.mkdir(parents=True, exist_ok=True)
        write_json(cfg / MANIFEST_PATH, {"version": version, "scope": "global", "files": files, "managed": managed})
    return result


def format_global(g: dict, cli: dict | None, c7: dict | None) -> str:
    lines = [f"written: {f}" for f in g["written"]]
    lines += [f"kept (you edited it): {f}" for f in g["kept"]]
    lines += [f"{f}: removed by you, not re-added (run goodvibes init to restore)" for f in g.get("removed", [])]
    lines += [f"{f}: removed, no longer shipped by goodvibes" for f in g.get("retired", [])]
    lines += [f"settings.json {c}" for c in g["settings_changes"]]
    if g.get("settings_error"):
        lines.append(f"settings.json not changed: {g['settings_error']}")
    if c7:
        lines.append(f"context7 MCP: {c7['status']}" + (f" ({c7['reason']})" if c7.get("reason") else ""))
    if cli:
        lines.append(f"goodvibes CLI: {cli['status']}" + (f" ({cli['reason']})" if cli.get("reason") else ""))
    return "\n".join(lines) or "already up to date"
