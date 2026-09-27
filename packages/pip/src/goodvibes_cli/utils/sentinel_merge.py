"""CLAUDE.md sentinel block merge — stdlib only port of sentinel-merge.ts."""
from __future__ import annotations

import hashlib
import re
import pathlib

from goodvibes_cli.utils.safe_path import check_writable

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


# Digests of every rules block goodvibes has published; a block not listed here was edited by the user.
SHIPPED_BLOCKS = frozenset({
    "0d887c3842418ef5a417d9ec18a91f274cb4ae808bd0d1f91157c801afb919c7",
    "1e6b00dac9e88bd6e984fccfbacef584a5137d7abc707a33833007e6edff1d7a",
    "1ff1d2a91e7f376164d3a2ff451569e5431e018d6da0005ae6af8fb61b863237",
    "48364721665cb43051d76317f021906df462a4c696deec73c7e6f81972fa622e",
    "4ecc5d68f0970080604203112f923eea348d55d8ea59fbe60eb0d2f8df38a008",
    "55501c618426b57d89d1b8ca4061a1784b5ecb01c92a4a9aa380352790231c78",
    "6ca859260cc84a3915cf8e449f048fa7f063376fbf650c22621f7b84543a4014",
    "8d3586de652f6ae7b49c9f075c49ada163b8de2ca66816a9a9e124fe1a870f8a",
    "91f9f6b05431236c5d1a52233d5c453bc853ef34ce23318a6b87e9463bddd99d",
    "9491213ecbedc61603bf0f8ed93bebfd75c3e886d5d464fb7fd30c1bdaef7939",
    "9d25f80c10fe897455dd1f80fd475b27a59b2685e2fbe249948b1f7e4d533b8b",
    "bdbeae34881ffa876186783b976ee0981839290b4c47249c9a06d6fcfaf7108d",
    "c46d22fd4681f0ec81504f16d264272b72b546bd35f9e6bcc8ec2b79438a5979",
    "d446f3bb30074bcaa01b0b599fd4b34c19458d3d4c3fa877306df996ac6a759c",
    "d78a43cd2f9be1bf0a25a7883cf18913a9a36d734f73e606dd1da7ec03411751",
    "e7aac90e824c715b5bbc9242ffcb3c13e27c6d73982436a62ab463f1308d1013",
    "ec5b5b2dd558567437de928ecf053799c26f9a63a5d275b734054a5930875523",
})


def block_digest(text: str) -> str:
    """sha256 of the goodvibes block in text, ignoring line endings and trailing spaces."""
    block = _extract_sentinel_block(text).replace("\r\n", "\n")
    return hashlib.sha256("\n".join(line.rstrip() for line in block.split("\n")).encode("utf-8")).hexdigest()


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


def _markers(path: pathlib.Path, text: str) -> tuple[list, list]:
    starts, ends = list(_START_LINE.finditer(text)), list(_END_LINE.finditer(text))
    problem = _marker_problem(starts, ends) if starts or ends else None
    if problem:
        raise ClaudeMdError(
            f"{path.name}: {problem}; goodvibes left it unchanged. Please fix CLAUDE.md by hand: keep exactly one "
            f"{SENTINEL_START} line followed later by one {SENTINEL_END} line (or delete both), then re-run."
        )
    return starts, ends


def strip_block(path: pathlib.Path, dry_run: bool = False) -> str:
    """Remove an unedited goodvibes block from path, keeping the text around it.

    Returns "removed", "kept" when the user edited the block, or "" when there is no block.
    """
    check_writable(path.parent, path)
    if not path.is_file():
        return ""
    existing = _read_text(path)
    starts, ends = _markers(path, existing)
    if not starts:
        return ""
    if block_digest(existing[starts[0].start():ends[0].end()]) not in SHIPPED_BLOCKS:
        return "kept"
    if not dry_run:
        nl = "\r\n" if "\r\n" in existing else "\n"
        after = re.sub(r"^(?:[ \t]*\r?\n)+", "", existing[ends[0].end():])
        parts = [p for p in (existing[:starts[0].start()].rstrip(), after.rstrip()) if p]
        _write_text(path, (nl + nl).join(parts) + (nl if parts else ""))
    return "removed"


def merge_claude(dest_path: pathlib.Path, template_content: str, dry_run: bool = False) -> str:
    """Merge goodvibes sentinel block into dest_path from template_content.

    Case A: dest absent → write template verbatim.
    Case B: dest exists, no marker lines → append sentinel block.
    Case C: dest exists, one start line then one end line, older version → replace between them,
    unless the user edited the block: then keep it and write the new block to CLAUDE.md.goodvibes-new.
    Case D: dest exists, sentinel same or newer → no write.
    Any other marker layout raises ClaudeMdError without writing.
    Returns "written", "kept" or "unchanged"; dry_run reports without writing.
    """
    template_block = _extract_sentinel_block(template_content)
    check_writable(dest_path.parent, dest_path)

    if not dest_path.exists():
        # Case A
        if not dry_run:
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            _write_text(dest_path, template_content)
        return "written"

    existing = _read_text(dest_path)
    nl = "\r\n" if "\r\n" in existing else "\n"
    block = template_block.replace("\r\n", "\n").replace("\n", nl)
    starts, ends = _markers(dest_path, existing)

    if not starts:
        # Case B: no sentinel — append block
        if not dry_run:
            _write_text(dest_path, existing.rstrip() + nl + nl + block + nl)
        return "written"

    start_idx, end_idx = starts[0].start(), ends[0].end()
    existing_version = extract_version(existing[start_idx:end_idx])
    template_version = extract_version(template_block)

    if existing_version and template_version and version_gte(existing_version, template_version):
        # Case D: existing version >= template — skip
        return "unchanged"

    if block_digest(existing[start_idx:end_idx]) not in SHIPPED_BLOCKS:
        sidecar = dest_path.with_name(dest_path.name + ".goodvibes-new")
        check_writable(dest_path.parent, sidecar)
        if not dry_run:
            _write_text(sidecar, block + nl)
        return "kept"

    # Case C: replace only sentinel block
    if not dry_run:
        _write_text(dest_path, existing[:start_idx] + block + existing[end_idx:])
    return "written"
