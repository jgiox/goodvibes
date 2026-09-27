"""Merge goodvibes-managed keys into user-modified settings.json and MCP config files."""
from __future__ import annotations

import copy
import hashlib
import json
import os
import pathlib
import re
import shutil

# MCP files and the key each tool keeps its servers under.
_MCP_KEY = {".mcp.json": "mcpServers", ".cursor/mcp.json": "mcpServers", ".vscode/mcp.json": "servers"}

# Gemini CLI and Codex keep hooks in Claude Code's shape, so their files merge like settings.json.
MANAGED_JSON = [".claude/settings.json", ".gemini/settings.json", ".codex/hooks.json", *_MCP_KEY]

_MARKER = re.compile(r"^: (goodvibes-[a-z0-9-]+);")


def _marked_hook(group: dict) -> tuple[int, str] | None:
    hooks = group.get("hooks") if isinstance(group, dict) else None
    for i, h in enumerate(hooks if isinstance(hooks, list) else []):
        cmd = h.get("command") if isinstance(h, dict) else None
        m = _MARKER.match(cmd) if isinstance(cmd, str) else None
        if m:
            return i, m.group(1)
    return None


# Digests of every hook, hook-group matcher and MCP server entry goodvibes has shipped; any other value was edited by the user.
SHIPPED_ENTRIES = frozenset({
    "07ab8d4151c71094a0713819d20c474c17d69a1be69f86bd930c3b020c55a129",
    "15ca4680e3633f97be4b79b1d1f9f03dbb8ce23e7f157d7234f28d27d5a28973",
    "29e142751f67aabb111d16c54933f5de593a3da5dd8cccb8528b080d13bfa675",
    "355685ca1c5ecbef258a972af10bd7f62d0bc82f7b7f20a0fb6bf49e12df129a",
    "38499f51ea9e5db9fd288047d3d94537ad86332e934be44bc92500181fffc7c7",
    "3d2fef907d65b791db2b34bc44f3f763d71aef49d23c9a9fcc64aea3918fa00c",
    "4870f6822b5b0622280382f92407ef51c3e28e4c165de9080cabf6dcb9e77946",
    "4a14049dc6fe432dff19455280545d2993d3b427ad66018921abba5c5fd26cd4",
    "513d492a798fdad21df076514038d36d19320e7be0c22ea82e9461e8cd12b9c7",
    "514f0478b7929a7b0c8f9965cb4b6e4987b6b854b04ab8a37c0755bec3ca9422",
    "5620af91925e35657bc43edc25782882b6f47608be013d1f7ea02590a67f4956",
    "5d736d56765c96ab251f03eef0033764730a77be1fd1282ccef92fe773f462dc",
    "5dbe89b48ee16b703d6a90996cc5d574fa52611723b9cf9c2d93faaaf2837d0c",
    "696a825876303895d5c01d2f82ea3b21be4d811b91a6b3b121ec5e1b44e7b1f7",
    "6a60486c00339810681cc24613cba330865dc845fb94b7e303872343c47e42a1",
    "6b2a26ef7f68288fc685e339af165bf3ea9193a74141c35db2ad78ab71ca6ccd",
    "6ca21b376c998611ac4a0ceae8d5132d314e1a256ee6b7774b2ea119316bcf6a",
    "6db7e8d06e41d8fb58975a9885b2995efacd7b2af153d68469d3125ca2a977b3",
    "750487d85c49212e0325ccb583e70acb3070822f29253a3ed9ec713881da8fa0",
    "768abd9c5a63b1517771db946f02bb2a0d7daf7f447775912ce65337a9636b4c",
    "84c0f35b4614d6f223c2db287caf52a812e1b7b9e12143ef7c5fd5796fb60ab5",
    "88a4bb9377426dce7572122fa1bde7cec7c94267eb29785ddcd9f116573fc2b6",
    "9f5d1d46d4e4ae3932ef2bd7386d99ac1e66d6147b56e383c9b282c1664e2191",
    "a31cbd927309a6087af5a2bb85a538888d608449069b3c48a80b2bf046e459b9",
    "d0c317fcbac4471e46d4d50a2213193931bc101ff1baea9cdfab73d6c5f72163",
    "d1f9101f73f9958aed58e7a2ee3b4a2df2f44bfd7cb9730d4b659e5adf256873",
    "d54d982f1d2d8cf260069e9dddbcac6496f53da232cd0891944b20706af8dd00",
    "d8355cdcaf5a6c4bc55aa8c84ed2353c7f021b388c819493dafe1e5a8dcfa94e",
    "d90897636c480130f19e9607cb2cc9c999ac63bbea7ab6c4790d4ed88c52e753",
    "f5a0ab2a50489f49d6ced155fbb730b852e2bcbb7c658ac159dc6a03bb1ac600",
    "f810397e8272a05ae195fe415b293da87057cf6eb918ee797d616407be9826de",
})


def entry_digest(value: object) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")).hexdigest()


def _edited_hook(group: dict, hid: str) -> bool:
    """The user changed goodvibes' hook, or the matcher of a group holding only goodvibes hooks."""
    hook = group["hooks"][_marked_hook(group)[0]]
    ours = all(_marked_hook({"hooks": [h]}) for h in group["hooks"])
    return entry_digest(hook) not in SHIPPED_ENTRIES or (ours and entry_digest({"hook": hid, "matcher": group.get("matcher")}) not in SHIPPED_ENTRIES)


def _edited_server(name: str, current: object, server: dict) -> bool:
    # An empty entry holds nothing of the user's; goodvibes fills it.
    return bool(current) and current != server and entry_digest({"server": name, "value": current}) not in SHIPPED_ENTRIES


def kept_entry_lines(label: str, tpl: dict, user: object) -> list[str]:
    """One line per goodvibes hook or MCP server entry the user edited, which merge_managed_json keeps as it is."""
    if not isinstance(user, dict):
        return []
    lines = []
    for key in ("mcpServers", "servers"):
        for name, server in (tpl.get(key) or {}).items():
            current = user.get(key).get(name) if isinstance(user.get(key), dict) else None
            if isinstance(current, dict) and _edited_server(name, current, server):
                lines.append(f"{label}: kept your edited {key}.{name} entry; goodvibes did not replace it with its new version")
    for event, groups in (tpl.get("hooks") or {}).items():
        user_groups = (user.get("hooks") or {}).get(event) if isinstance(user.get("hooks"), dict) else None
        for g in groups:
            hid = _hook_id(g)
            ug = next((u for u in user_groups if _hook_id(u) == hid), None) if hid and isinstance(user_groups, list) else None
            if ug is not None and _edited_hook(ug, hid):
                lines.append(f"{label}: kept your edited hook {hid} ({event}); goodvibes did not replace it with its new version")
    return lines


def _hook_id(group: dict) -> str | None:
    found = _marked_hook(group)
    return found[1] if found else None


def write_json(path: pathlib.Path, data: object) -> None:
    """Write via a temp file in the same folder so a crash never leaves a half-written settings file."""
    # A symlinked config file (dotfiles repo) stays a symlink: its target is replaced, not the link.
    path = pathlib.Path(os.path.realpath(path))
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        with open(tmp, "x", encoding="utf-8", newline="\n") as f:
            f.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        if path.exists():
            shutil.copymode(path, tmp)
        os.replace(tmp, path)
    except BaseException:
        tmp.unlink(missing_ok=True)
        raise


def shape_error(rel: str, content: dict) -> str | None:
    """The merge reads and extends these containers, so a wrong type would crash it or corrupt the file."""

    def obj(v, path: str) -> str | None:
        return None if v is None or isinstance(v, dict) else f'"{path}" is not a JSON object'

    def arr(v, path: str) -> str | None:
        return None if v is None or isinstance(v, list) else f'"{path}" is not a JSON array'

    key = _MCP_KEY.get(rel)
    if key:
        servers = content.get(key)
        return obj(servers, key) or next((e for n, v in (servers or {}).items() if (e := obj(v, f"{key}.{n}"))), None)
    perms, hooks = content.get("permissions"), content.get("hooks")
    problems = [obj(perms, "permissions"), obj(hooks, "hooks")]
    problems += [arr((perms if isinstance(perms, dict) else {}).get(lst), f"permissions.{lst}") for lst in ("allow", "ask", "deny")]
    for event, groups in (hooks if isinstance(hooks, dict) else {}).items():
        problems.append(arr(groups, f"hooks.{event}"))
        for i, g in enumerate(groups if isinstance(groups, list) else []):
            problems.append(obj(g, f"hooks.{event}[{i}]") or arr(g.get("hooks") if isinstance(g, dict) else None, f"hooks.{event}[{i}].hooks"))
    return next((p for p in problems if p), None)


def managed_ids(rel: str, tpl: dict) -> list[str]:
    if rel in _MCP_KEY:
        return [f"mcp:{name}" for name in (tpl.get(_MCP_KEY[rel]) or {})]
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
    if not isinstance(content, dict):
        return []

    def present(mid: str) -> bool:
        kind, rest = mid.split(":", 1)
        if kind == "mcp":
            return rest in (content.get(_MCP_KEY[rel]) or {})
        if kind == "hook":
            event, hid = rest.split(":", 1)
            return any(_hook_id(g) == hid for g in (content.get("hooks") or {}).get(event) or [])
        return rest in ((content.get("permissions") or {}).get(kind) or [])

    return [mid for mid in managed_ids(rel, tpl) if present(mid)]


# Allow rules goodvibes shipped earlier: up to 1.9.1 they auto-approved running arbitrary code; Write(**) did nothing and made Claude Code warn.
# Deny rules goodvibes shipped up to 1.10.0: they prefix-match --force-with-lease, so its ask rule never applied.
RETIRED_DENY = ["Bash(git push --force*)", "Bash(git push * --force*)"]

RETIRED_ALLOW = ['Bash(npm install*)', 'Bash(npm run*)', 'Bash(npx*)', 'Bash(pip install*)', 'Bash(uv*)', 'Bash(python*)', 'Bash(node*)', 'Bash(git restore *)', 'Write(**)']


_RULE = re.compile(r"^([A-Za-z]+)(?:\((.*)\))?$", re.S)


def _rule(rule: object) -> tuple[str, str | None] | None:
    m = _RULE.match(rule.strip()) if isinstance(rule, str) else None
    return (m.group(1), m.group(2)) if m else None


def _head(spec: str) -> tuple[str, str]:
    """A Bash rule's literal text before its first wildcard, and whether it is "exact", "prefix" (one trailing wildcard) or "glob"."""
    body = spec[:-2] if spec.endswith(":*") else spec  # the older prefix syntax, `git push:*`
    i = body.find("*")
    if spec.endswith(":*") and i == -1:
        return body.rstrip(), "prefix"
    if i == -1:
        return body, "exact"
    # The space in `git push *` only marks a word boundary; it does not narrow what the rule means here.
    return body[:i].rstrip(), "prefix" if i == len(body) - 1 else "glob"


def _matches(spec: str, command: str) -> bool:
    if spec.endswith(":*"):
        return command.startswith(spec[:-2])
    return re.fullmatch(".*".join(map(re.escape, spec.split("*"))), command, re.S) is not None


def _path_matches(spec: str, path: str) -> bool:
    # Claude Code path rules follow gitignore: `**` crosses folders, `*` stays inside one.
    rx = "".join(".*" if t == "**" else "[^/]*" if t == "*" else re.escape(t) for t in re.split(r"(\*\*|\*)", spec))
    return re.fullmatch(rx, path, re.S) is not None


def _parts(allow: str, rule: str) -> tuple[str | None, str | None, str | None] | None:
    a, r = _rule(allow), _rule(rule)
    if not a or not r or a[0] != r[0]:
        return None
    return a[0], a[1], r[1]


def covers(allow: str, rule: str) -> bool:
    """True when every command `rule` matches is also matched by `allow`."""
    parts = _parts(allow, rule)
    if not parts:
        return False
    tool, a, r = parts
    if a is None or a in ("*", "**"):
        return True
    if r is None:
        return False
    if tool != "Bash":
        if "*" not in r:
            return _path_matches(a, r)
        return a == r or (a.endswith("**") and "*" not in a[:-2] and r.startswith(a[:-2]))
    (ah, ak), (rh, rk) = _head(a), _head(r)
    if rk == "exact":
        return _matches(a, r)
    if ak == "prefix":
        return rh.startswith(ah)
    return a == r


def overlaps(allow: str, rule: str) -> bool:
    """True when at least one command could match both rules (an approximation for wildcards after the first)."""
    parts = _parts(allow, rule)
    if not parts:
        return False
    tool, a, r = parts
    if a is None or r is None or a in ("*", "**"):
        return True
    if tool != "Bash":
        if "*" not in a:
            return _path_matches(r, a)
        if "*" not in r:
            return _path_matches(a, r)
        ah, rh = a[:a.index("*")], r[:r.index("*")]
        return ah.startswith(rh) or rh.startswith(ah)
    (ah, ak), (rh, rk) = _head(a), _head(r)
    if ak == "exact":
        return _matches(r, a)
    if rk == "exact":
        return _matches(a, r)
    return ah.startswith(rh) or rh.startswith(ah)


def user_allow_rules(content: object, tpl: dict) -> list[str]:
    """Allow rules in a settings file that the user wrote: goodvibes' own, current or retired, never count."""
    perms = content.get("permissions") if isinstance(content, dict) else None
    allow = perms.get("allow") if isinstance(perms, dict) else None
    ours = {*((tpl.get("permissions") or {}).get("allow") or []), *RETIRED_ALLOW}
    return [r for r in (allow if isinstance(allow, list) else []) if isinstance(r, str) and r not in ours]


def file_allow_rules(path: pathlib.Path, tpl: dict) -> list[str]:
    try:
        content = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []  # Claude Code cannot apply rules from a missing or broken file either
    return user_allow_rules(content, tpl)


def overridden_lines(label: str, allows: list[str], content: object, tpl: dict) -> list[str]:
    """One line per user allow rule that a goodvibes deny or ask rule in `content` still beats."""
    perms = content.get("permissions") if isinstance(content, dict) else None
    perms = perms if isinstance(perms, dict) else {}
    ours = tpl.get("permissions") or {}
    lines = []
    for a in dict.fromkeys(allows):
        for kind, verb in (("deny", "refuses"), ("ask", "asks before")):
            have = perms.get(kind) if isinstance(perms.get(kind), list) else []
            # A deny rule is only news when the user allowed something inside it, not when their broad rule merely includes it.
            r = next((r for r in have if r in (ours.get(kind) or []) and overlaps(a, r) and not (kind == "deny" and covers(a, r) and not covers(r, a))), None)
            if r:
                lines.append(
                    f"{label}: Claude Code still {verb} commands your allow rule {a} matches, because goodvibes' {kind} rule {r} "
                    f"is checked first. To change that, delete {r} from {label}; goodvibes will not add it back."
                )
                break
    return lines


def merge_managed_json(
    rel: str, tpl: dict, user: dict, installed: list[str] | None = None, retire_allow: bool = False,
    extra_allow: list[str] | None = None,
) -> tuple[dict, list[str]]:
    """An id in `installed` but absent from `user` was removed by the user and stays removed.

    A goodvibes ask rule that a user allow rule (in `user` or `extra_allow`) covers is not added, and removed if goodvibes installed it:
    Claude Code checks ask before allow, so it would silently override the user's choice.
    """
    merged = copy.deepcopy(user)
    changes: list[str] = []
    installed = installed or []

    key = _MCP_KEY.get(rel)
    if key:
        for name, server in (tpl.get(key) or {}).items():
            current = (merged.get(key) or {}).get(name)
            if isinstance(current, dict) and _edited_server(name, current, server):
                continue  # the user's own version
            if isinstance(current, dict):
                nxt = {**current, **server}
                if nxt != current:
                    merged[key][name] = nxt
                    changes.append(f"~ {key}.{name}")
            elif f"mcp:{name}" not in installed:
                merged[key] = {**(merged.get(key) or {}), name: server}
                changes.append(f"+ {key}.{name}")
        return merged, changes

    allow = (merged.get("permissions") or {}).get("allow")
    if retire_allow and isinstance(allow, list):
        changes.extend(f"- permissions.allow: {p}" for p in allow if p in RETIRED_ALLOW)
        merged["permissions"]["allow"] = [p for p in allow if p not in RETIRED_ALLOW]

    deny = (merged.get("permissions") or {}).get("deny")
    if isinstance(deny, list):
        # Only rules goodvibes installed are retired; a copy the user wrote stays.
        drop = [p for p in deny if p in RETIRED_DENY and f"deny:{p}" in installed]
        changes.extend(f"- permissions.deny: {p}" for p in drop)
        merged["permissions"]["deny"] = [p for p in deny if p not in drop]

    allows = [*user_allow_rules(merged, tpl), *(extra_allow or [])]
    covered = {p: by for p in (tpl.get("permissions") or {}).get("ask") or [] if (by := next((a for a in allows if covers(a, p)), None))}
    ask = (merged.get("permissions") or {}).get("ask")
    if isinstance(ask, list):
        # Only rules goodvibes installed are dropped; an ask rule the user wrote stays.
        drop = {p: covered[p] for p in ask if p in covered and f"ask:{p}" in installed}
        changes.extend(f"- permissions.ask: {p} (your allow rule {by} covers it)" for p, by in drop.items())
        merged["permissions"]["ask"] = [p for p in ask if p not in drop]

    for lst in ("ask", "deny"):
        for p in (tpl.get("permissions") or {}).get(lst) or []:
            have = (merged.get("permissions") or {}).get(lst) or []
            if p in have or f"{lst}:{p}" in installed or (lst == "ask" and p in covered):
                continue
            merged["permissions"] = {**(merged.get("permissions") or {}), lst: [*have, p]}
            changes.append(f"+ permissions.{lst}: {p}")

    for event, groups in (tpl.get("hooks") or {}).items():
        for g in groups:
            hid = _hook_id(g)
            if not hid:
                continue
            user_groups = (merged.get("hooks") or {}).get(event) or []
            idx = next((i for i, ug in enumerate(user_groups) if _hook_id(ug) == hid), -1)
            if idx >= 0 and _edited_hook(user_groups[idx], hid):
                continue  # the user's own version
            if idx >= 0:
                # Only the marked hook is goodvibes'; the user's other hooks and fields in that group stay.
                user_hooks = user_groups[idx]["hooks"]
                j = _marked_hook(user_groups[idx])[0]
                tpl_hook = g["hooks"][_marked_hook(g)[0]]
                # The matcher is refreshed only in a group holding nothing but our hook; the user's own hooks keep their routing.
                ours = "matcher" in g and all(_marked_hook({"hooks": [h]}) for h in user_hooks)
                refreshed = ours and user_groups[idx].get("matcher") != g["matcher"]
                if refreshed:
                    user_groups[idx]["matcher"] = g["matcher"]
                if user_hooks[j] != tpl_hook:
                    user_hooks[j] = copy.deepcopy(tpl_hook)
                    refreshed = True
                if refreshed:
                    changes.append(f"~ hooks.{event}: {hid}")
            elif f"hook:{event}:{hid}" not in installed:
                merged["hooks"] = {**(merged.get("hooks") or {}), event: [*user_groups, g]}
                changes.append(f"+ hooks.{event}: {hid}")
    return merged, changes


def yielded_ids(tpl: dict, content: object, allows: list[str]) -> set[str]:
    """Ask rules left out for a covering user allow rule; forgotten, so they come back once that allow rule is gone."""
    perms = content.get("permissions") if isinstance(content, dict) else None
    have = perms.get("ask") if isinstance(perms, dict) and isinstance(perms.get("ask"), list) else []
    return {f"ask:{p}" for p in (tpl.get("permissions") or {}).get("ask") or [] if p not in have and any(covers(a, p) for a in allows)}


def managed_record(cwd: pathlib.Path, template_dir: pathlib.Path, prev: dict | None = None, cfg: pathlib.Path | None = None) -> dict[str, list[str]]:
    """Keeps previously installed ids so a user's deliberate removal survives later updates.

    cfg: the Claude Code settings folder, whose allow rules count for the project settings too.
    """
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
        if not isinstance(content, dict) or shape_error(rel, content):
            continue
        tpl = json.loads(tpl_path.read_text(encoding="utf-8"))
        forget: set[str] = set()
        if rel == ".claude/settings.json":
            allows = [*user_allow_rules(content, tpl), *file_allow_rules(cwd / ".claude" / "settings.local.json", tpl)]
            allows += file_allow_rules(cfg / "settings.json", tpl) if cfg else []
            forget = yielded_ids(tpl, content, allows)
        record[rel] = [i for i in dict.fromkeys([*prev.get(rel, []), *present_ids(rel, tpl, content)]) if i not in forget]
    return record
