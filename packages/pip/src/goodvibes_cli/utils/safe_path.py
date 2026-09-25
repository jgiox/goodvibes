"""Refuse project writes that would follow a symlink (mirror of npm utils/safe-path.ts)."""
from __future__ import annotations

import os
import pathlib
import re


class SymlinkError(OSError):
    pass


def printable(text: str) -> str:
    # Repo files arrive with any clone; raw escape codes in them could rewrite what the terminal shows.
    return re.sub(r"[\x00-\x1f\x7f-\x9f]", "?", text)


def check_writable(root: pathlib.Path, dest: pathlib.Path) -> None:
    """Raise SymlinkError when dest, or any existing folder between root and dest, is a symlink or resolves outside root."""
    rel = dest.relative_to(root)
    cur = root
    for part in rel.parts:
        cur = cur / part
        # islink is also true for a dangling link, which exists() and is_file() report as absent.
        if os.path.islink(cur):
            raise SymlinkError(f"{rel.as_posix()}: symlink, not written")
    if not dest.resolve().is_relative_to(root.resolve()):
        raise SymlinkError(f"{rel.as_posix()}: outside the project, not written")


def remove_retired(root: pathlib.Path, rel: str, stop: str) -> None:
    """Delete root/rel, then every folder above it left empty, stopping at stop (e.g. ".claude/skills")."""
    (root / rel).unlink(missing_ok=True)
    parent = pathlib.PurePosixPath(rel).parent
    while str(parent).startswith(stop + "/"):
        folder = root / parent
        if any(folder.iterdir()):
            break
        folder.rmdir()
        parent = parent.parent
