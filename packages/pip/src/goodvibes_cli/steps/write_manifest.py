from __future__ import annotations

import hashlib
import json
import pathlib

MANIFEST_PATH = ".goodvibes.json"


def write_manifest(
    dest_dir: pathlib.Path,
    written_files: list[str],
    version: str,
    preserved: dict[str, str] | None = None,
    managed: dict[str, list[str]] | None = None,
) -> None:
    # Preserved hashes come only from the prior manifest, never re-read from dest,
    # so a skipped (user-modified) file can't be silently reclassified as unmodified.
    files: dict[str, str] = dict(preserved or {})
    for rel in written_files:
        content = (dest_dir / rel).read_bytes()
        files[rel] = hashlib.sha256(content).hexdigest()
    manifest: dict = {"version": version, "files": files}
    if managed is not None:
        manifest["managed"] = managed
    (dest_dir / MANIFEST_PATH).write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


def read_manifest(dest_dir: pathlib.Path) -> dict | None:
    p = dest_dir / MANIFEST_PATH
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, ValueError):
        return None  # malformed JSON must not crash the CLI
    # PermissionError, OSError, etc. propagate — fail loud per project rules
