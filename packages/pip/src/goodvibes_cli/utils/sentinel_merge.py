"""CLAUDE.md sentinel block merge — stdlib only port of sentinel-merge.ts."""
from __future__ import annotations

import re
import pathlib

SENTINEL_START = "<!-- goodvibes:start -->"
SENTINEL_END = "<!-- goodvibes:end -->"


_VERSION = r"\d+(?:\.\d+)*(?:[-.]?(?:alpha|beta|a|b|rc)\.?\d*)?(?:\.post\d+)?"
_PARTS = re.compile(r"v?(\d+(?:\.\d+)*)(?:[-.]?(alpha|beta|a|b|rc)\.?(\d*))?(?:\.post(\d+))?\.?", re.I)
_PRE_RANK = {"alpha": 0, "a": 0, "beta": 1, "b": 1, "rc": 2}


def extract_version(block: str) -> str | None:
    """Return version string from a sentinel block or version stamp line, or None."""
    m = re.search(rf"# goodvibes: v({_VERSION})", block)
    return m.group(1) if m else None


def _version_key(v: str) -> tuple | None:
    m = _PARTS.fullmatch(v.strip())
    if not m:
        return None
    release = [int(x) for x in m.group(1).split(".")]
    while len(release) > 1 and release[-1] == 0:
        release.pop()
    # A release sorts above its pre-releases (rank 3) and below its .postN releases.
    pre = (_PRE_RANK[m.group(2).lower()], int(m.group(3) or 0)) if m.group(2) else (3, 0)
    post = int(m.group(4)) + 1 if m.group(4) is not None else 0
    return (release, pre, post)


def version_gte(a: str, b: str) -> bool:
    """Return True if version a >= version b; False when either cannot be parsed."""
    ka, kb = _version_key(a or ""), _version_key(b or "")
    if ka is None or kb is None:
        return False
    return ka >= kb


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
    if end_idx == -1:
        # Malformed: start marker present but end marker absent — treat as Case B.
        dest_path.write_text(existing[:start_idx].rstrip() + "\n\n" + template_block + "\n", encoding="utf-8")
        return
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
