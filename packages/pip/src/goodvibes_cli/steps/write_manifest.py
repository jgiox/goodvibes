from __future__ import annotations

import hashlib
import json
import pathlib

MANIFEST_PATH = ".goodvibes.json"


def write_manifest(dest_dir: pathlib.Path, written_files: list[str], version: str) -> None:
    files: dict[str, str] = {}
    for rel in written_files:
        content = (dest_dir / rel).read_bytes()
        files[rel] = hashlib.sha256(content).hexdigest()
    manifest = {"version": version, "files": files}
    (dest_dir / MANIFEST_PATH).write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


def read_manifest(dest_dir: pathlib.Path) -> dict | None:
    p = dest_dir / MANIFEST_PATH
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None  # ponytail: malformed JSON must not crash the CLI
