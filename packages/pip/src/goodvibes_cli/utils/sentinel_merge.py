"""CLAUDE.md sentinel block merge — stdlib only port of sentinel-merge.ts."""
from __future__ import annotations

import re
import pathlib

SENTINEL_START = "<!-- goodvibes:start -->"
SENTINEL_END = "<!-- goodvibes:end -->"


def extract_version(block: str) -> str | None:
    """Return version string from a sentinel block or version stamp line, or None."""
    m = re.search(r"# goodvibes: v([\d.]+)", block)
    return m.group(1) if m else None


def version_gte(a: str, b: str) -> bool:
    """Return True if version a >= version b (integer component comparison)."""
    pa = [int(x) for x in a.split(".")]
    pb = [int(x) for x in b.split(".")]
    length = max(len(pa), len(pb))
    for i in range(length):
        va = pa[i] if i < len(pa) else 0
        vb = pb[i] if i < len(pb) else 0
        if va > vb:
            return True
        if va < vb:
            return False
    return True  # equal


def _extract_sentinel_block(content: str) -> str:
    start = content.find(SENTINEL_START)
    end = content.find(SENTINEL_END)
    if start == -1 or end == -1:
        return ""
    return content[start : end + len(SENTINEL_END)]


def merge_claude(dest_path: pathlib.Path, template_content: str) -> None:
    """Merge goodvibes sentinel block into dest_path from template_content.

    Case A: dest absent → write template verbatim.
    Case B: dest exists, no sentinel → append sentinel block.
    Case C: dest exists, sentinel older → replace sentinel block only.
    Case D: dest exists, sentinel same or newer → no write.
    """
    template_block = _extract_sentinel_block(template_content)

    if not dest_path.exists():
        # Case A
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_text(template_content, encoding="utf-8")
        return

    existing = dest_path.read_text(encoding="utf-8")
    start_idx = existing.find(SENTINEL_START)

    if start_idx == -1:
        # Case B: no sentinel — append block
        dest_path.write_text(existing.rstrip() + "\n\n" + template_block + "\n", encoding="utf-8")
        return

    end_idx = existing.find(SENTINEL_END)
    existing_block = existing[start_idx : end_idx + len(SENTINEL_END)]
    existing_version = extract_version(existing_block)
    template_version = extract_version(template_block)

    if existing_version and template_version and version_gte(existing_version, template_version):
        # Case D: existing version >= template — skip
        return

    # Case C: replace only sentinel block
    before = existing[:start_idx]
    after = existing[end_idx + len(SENTINEL_END) :]
    dest_path.write_text(before + template_block + after, encoding="utf-8")
