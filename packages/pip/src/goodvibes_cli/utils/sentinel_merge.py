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


class ClaudeMdError(ValueError):
    pass


# A marker counts only alone on its line, so prose that mentions a marker is never treated as one.
_START_LINE = re.compile(rf"^{re.escape(SENTINEL_START)}[ \t]*(?=\r?$)", re.M)
_END_LINE = re.compile(rf"^{re.escape(SENTINEL_END)}[ \t]*(?=\r?$)", re.M)


def _read_text(path: pathlib.Path) -> str:
    try:
        with open(path, encoding="utf-8", newline="") as f:
            return f.read()
    except UnicodeDecodeError as e:
        raise ClaudeMdError(f"{path.name}: not UTF-8 text (byte {e.start}); goodvibes left it unchanged. Save it as UTF-8 and re-run.") from e


def _write_text(path: pathlib.Path, text: str) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


def _marker_problem(starts: list, ends: list) -> str | None:
    if len(starts) > 1:
        return f"it has {len(starts)} {SENTINEL_START} lines"
    if len(ends) > 1:
        return f"it has {len(ends)} {SENTINEL_END} lines"
    if starts and not ends:
        return f"it has a {SENTINEL_START} line but no {SENTINEL_END} line"
    if ends and not starts:
        return f"it has a {SENTINEL_END} line but no {SENTINEL_START} line"
    if ends[0].start() < starts[0].start():
        return f"its {SENTINEL_END} line comes before its {SENTINEL_START} line"
    return None


def merge_claude(dest_path: pathlib.Path, template_content: str) -> None:
    """Merge goodvibes sentinel block into dest_path from template_content.

    Case A: dest absent → write template verbatim.
    Case B: dest exists, no marker lines → append sentinel block.
    Case C: dest exists, one start line then one end line, older version → replace between them.
    Case D: dest exists, sentinel same or newer → no write.
    Any other marker layout raises ClaudeMdError without writing.
    """
    template_block = _extract_sentinel_block(template_content)

    if not dest_path.exists():
        # Case A
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        _write_text(dest_path, template_content)
        return

    existing = _read_text(dest_path)
    nl = "\r\n" if "\r\n" in existing else "\n"
    block = template_block.replace("\r\n", "\n").replace("\n", nl)
    starts, ends = list(_START_LINE.finditer(existing)), list(_END_LINE.finditer(existing))

    if not starts and not ends:
        # Case B: no sentinel — append block
        _write_text(dest_path, existing.rstrip() + nl + nl + block + nl)
        return

    problem = _marker_problem(starts, ends)
    if problem:
        raise ClaudeMdError(
            f"{dest_path.name}: {problem}; goodvibes left it unchanged. Please fix CLAUDE.md by hand: keep exactly one "
            f"{SENTINEL_START} line followed later by one {SENTINEL_END} line (or delete both), then re-run."
        )

    start_idx, end_idx = starts[0].start(), ends[0].end()
    existing_version = extract_version(existing[start_idx:end_idx])
    template_version = extract_version(template_block)

    if existing_version and template_version and version_gte(existing_version, template_version):
        # Case D: existing version >= template — skip
        return

    # Case C: replace only sentinel block
    _write_text(dest_path, existing[:start_idx] + block + existing[end_idx:])
