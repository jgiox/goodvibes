"""Goodvibes copies a project keeps from project scope once goodvibes is set up for all projects."""
from __future__ import annotations

import hashlib
import pathlib

from goodvibes_cli.steps.write_manifest import USER_OWNED, USER_REMOVED
from goodvibes_cli.utils.safe_path import SymlinkError, check_writable

STRIPPED = "CLAUDE.md: removed the old goodvibes rules block; the rules now come from your Claude Code settings folder"
STRIP_PLAN = "CLAUDE.md: will remove the old goodvibes rules block; the rules now come from your Claude Code settings folder"
EDITED = "Edited skill copies stay in this project; the same skills are now set up for all your projects, so Claude may load both. Delete a copy you no longer need: "


def removed_line(rel: str) -> str:
    return f"{rel}: removed, now set up for all your projects"


def old_skill_copies(cwd: pathlib.Path, files: dict[str, str]) -> tuple[list[str], list[str]]:
    """Tracked project skill files: (unchanged since goodvibes wrote them, edited by the user)."""
    unedited: list[str] = []
    edited: list[str] = []
    for rel, sha in files.items():
        if not rel.startswith(".claude/skills/") or sha in (USER_OWNED, USER_REMOVED):
            continue
        try:
            check_writable(cwd, cwd / rel)
        except SymlinkError:
            continue
        if (cwd / rel).is_file():
            (unedited if hashlib.sha256((cwd / rel).read_bytes()).hexdigest() == sha else edited).append(rel)
    return sorted(unedited), sorted(edited)
