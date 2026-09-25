from __future__ import annotations

import hashlib
import json
import pathlib
import re

from goodvibes_cli.utils.json_merge import write_json
from goodvibes_cli.utils.safe_path import check_writable, printable

MANIFEST_PATH = ".goodvibes.json"
# Not hex digests: "user-owned" never matches a file's hash, "user-removed" marks a file the user deleted.
USER_OWNED = "user-owned"
USER_REMOVED = "user-removed"


def posix_key(rel: str) -> str:
    # Windows runs used to write backslash keys; one spelling keeps every comparison exact.
    return rel.replace("\\", "/")


def write_manifest(
    dest_dir: pathlib.Path,
    written_files: list[str],
    version: str,
    preserved: dict[str, str] | None = None,
    managed: dict[str, list[str]] | None = None,
    scope: str | None = None,
    git_hook: str | None = None,
) -> None:
    # Preserved hashes come only from the prior manifest, never re-read from dest,
    # so a skipped (user-modified) file can't be silently reclassified as unmodified.
    files: dict[str, str] = {posix_key(k): v for k, v in (preserved or {}).items()}
    for rel in written_files:
        content = (dest_dir / rel).read_bytes()
        files[posix_key(rel)] = hashlib.sha256(content).hexdigest()
    manifest: dict = {"version": version, "files": files}
    if managed is not None:
        manifest["managed"] = managed
    if scope is not None:
        manifest["scope"] = scope
    if git_hook is not None:
        manifest["gitHook"] = git_hook
    check_writable(dest_dir, dest_dir / MANIFEST_PATH)
    write_json(dest_dir / MANIFEST_PATH, manifest)


class ManifestError(ValueError):
    pass


def _unsafe_key(k: str) -> bool:
    # Keys reach delete and write calls, and a cloned repo can ship its own manifest: "a/../../.git/HEAD" must never pass a prefix check.
    return bool(re.search(r"[\x00-\x1f\x7f-\x9f]", k) or re.match(r"[A-Za-z]:", k)) or any(s in ("", ".", "..") for s in k.split("/"))


def _map_of(v: object, ok) -> bool:
    return isinstance(v, dict) and all(ok(x) for x in v.values())


def _manifest_problem(m: dict) -> str | None:
    if "files" in m and not _map_of(m["files"], lambda v: isinstance(v, str)):
        return '"files" is not a JSON object of file paths to hashes'
    if "managed" in m and not _map_of(m["managed"], lambda v: isinstance(v, list) and all(isinstance(s, str) for s in v)):
        return '"managed" is not a JSON object of file paths to lists of text'
    if "scope" in m and m["scope"] not in ("global", "project"):
        return '"scope" is not "global" or "project"'
    if "gitHook" in m and m["gitHook"] not in ("installed", USER_REMOVED):
        return '"gitHook" is not "installed" or "user-removed"'
    bad = next((k for k in map(posix_key, [*m.get("files", {}), *m.get("managed", {})]) if _unsafe_key(k)), None)
    return None if bad is None else f'"{bad}" is not a safe relative path'


def read_manifest(dest_dir: pathlib.Path) -> dict | None:
    p = dest_dir / MANIFEST_PATH
    if not p.exists():
        return None

    def fail(why: str) -> ManifestError:
        return ManifestError(printable(f"{p} {why}; fix it or delete it and run goodvibes init"))

    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except ValueError as e:
        raise fail(f"is not valid JSON ({e})") from e
    if not isinstance(data, dict):
        raise fail("is not valid JSON (not a JSON object)")
    problem = _manifest_problem(data)
    if problem:
        raise fail(f"is not a valid goodvibes manifest ({problem})")
    data["files"] = {posix_key(k): v for k, v in data.get("files", {}).items()}
    if "managed" in data:
        data["managed"] = {posix_key(k): v for k, v in data["managed"].items()}
    return data
