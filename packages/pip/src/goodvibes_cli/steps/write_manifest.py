from __future__ import annotations

import hashlib
import json
import pathlib

from goodvibes_cli.utils.json_merge import write_json
from goodvibes_cli.utils.safe_path import check_writable

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


def read_manifest(dest_dir: pathlib.Path) -> dict | None:
    p = dest_dir / MANIFEST_PATH
    if not p.exists():
        return None
    fix = "fix it or delete it and run goodvibes init"
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except ValueError as e:
        raise ManifestError(f"{p} is not valid JSON ({e}); {fix}") from e
    if not isinstance(data, dict):
        raise ManifestError(f"{p} is not valid JSON (expected an object, found {type(data).__name__}); {fix}")
    if isinstance(data.get("files"), dict):
        data["files"] = {posix_key(k): v for k, v in data["files"].items()}
    return data
