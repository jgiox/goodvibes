"""Merge goodvibes-managed keys into user-modified settings.json / .mcp.json."""
from __future__ import annotations

import copy
import json
import pathlib
import re

MANAGED_JSON = [".claude/settings.json", ".mcp.json"]

_MARKER = re.compile(r"^: (goodvibes-[a-z0-9-]+);")


def _hook_id(group: dict) -> str | None:
    for h in (group or {}).get("hooks") or []:
        cmd = h.get("command") if isinstance(h, dict) else None
        m = _MARKER.match(cmd) if isinstance(cmd, str) else None
        if m:
            return m.group(1)
    return None


def managed_ids(rel: str, tpl: dict) -> list[str]:
    if rel == ".mcp.json":
        return [f"mcp:{name}" for name in (tpl.get("mcpServers") or {})]
    ids = []
    for lst in ("ask", "deny"):
        ids += [f"{lst}:{p}" for p in (tpl.get("permissions") or {}).get(lst) or []]
    for event, groups in (tpl.get("hooks") or {}).items():
        for g in groups:
            hid = _hook_id(g)
            if hid:
                ids.append(f"hook:{event}:{hid}")
    return ids


def present_ids(rel: str, tpl: dict, content: dict) -> list[str]:
    def present(mid: str) -> bool:
        kind, rest = mid.split(":", 1)
        if kind == "mcp":
            return rest in (content.get("mcpServers") or {})
        if kind == "hook":
            event, hid = rest.split(":", 1)
            return any(_hook_id(g) == hid for g in (content.get("hooks") or {}).get(event) or [])
        return rest in ((content.get("permissions") or {}).get(kind) or [])

    return [mid for mid in managed_ids(rel, tpl) if present(mid)]


def merge_managed_json(rel: str, tpl: dict, user: dict, installed: list[str] | None = None) -> tuple[dict, list[str]]:
    """An id in `installed` but absent from `user` was removed by the user and stays removed."""
    merged = copy.deepcopy(user)
    changes: list[str] = []
    installed = installed or []

    if rel == ".mcp.json":
        for name, server in (tpl.get("mcpServers") or {}).items():
            current = (merged.get("mcpServers") or {}).get(name)
            if current:
                nxt = {**current, **server}
                if nxt != current:
                    merged["mcpServers"][name] = nxt
                    changes.append(f"~ mcpServers.{name}")
            elif f"mcp:{name}" not in installed:
                merged.setdefault("mcpServers", {})[name] = server
                changes.append(f"+ mcpServers.{name}")
        return merged, changes

    for lst in ("ask", "deny"):
        for p in (tpl.get("permissions") or {}).get(lst) or []:
            have = (merged.get("permissions") or {}).get(lst) or []
            if p in have or f"{lst}:{p}" in installed:
                continue
            merged.setdefault("permissions", {})[lst] = [*have, p]
            changes.append(f"+ permissions.{lst}: {p}")

    for event, groups in (tpl.get("hooks") or {}).items():
        for g in groups:
            hid = _hook_id(g)
            if not hid:
                continue
            user_groups = (merged.get("hooks") or {}).get(event) or []
            idx = next((i for i, ug in enumerate(user_groups) if _hook_id(ug) == hid), -1)
            if idx >= 0:
                if user_groups[idx] != g:
                    user_groups[idx] = g
                    changes.append(f"~ hooks.{event}: {hid}")
            elif f"hook:{event}:{hid}" not in installed:
                merged.setdefault("hooks", {})[event] = [*user_groups, g]
                changes.append(f"+ hooks.{event}: {hid}")
    return merged, changes


def managed_record(cwd: pathlib.Path, template_dir: pathlib.Path, prev: dict | None = None) -> dict[str, list[str]]:
    """Keeps previously installed ids so a user's deliberate removal survives later updates."""
    prev = prev or {}
    record = dict(prev)
    for rel in MANAGED_JSON:
        tpl_path, dest_path = template_dir / rel, cwd / rel
        if not tpl_path.exists() or not dest_path.exists():
            continue
        try:
            content = json.loads(dest_path.read_text(encoding="utf-8"))
        except ValueError:
            continue  # unparseable user file: keep the previous record rather than guess
        tpl = json.loads(tpl_path.read_text(encoding="utf-8"))
        record[rel] = list(dict.fromkeys([*prev.get(rel, []), *present_ids(rel, tpl, content)]))
    return record
