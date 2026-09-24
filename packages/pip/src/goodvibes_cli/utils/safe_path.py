"""Refuse project writes that would follow a symlink (mirror of npm utils/safe-path.ts)."""
from __future__ import annotations

import os
import pathlib


class SymlinkError(OSError):
    pass


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
