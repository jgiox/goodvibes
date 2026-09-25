"""Install the goodvibes git pre-commit journal check into .git/hooks (mirror of npm steps/git-hook.ts)."""
from __future__ import annotations

import os
import pathlib
import subprocess

from goodvibes_cli.steps.copy_templates import resolve_hooks_dir
from goodvibes_cli.utils.proc import run

MARKER = b"# goodvibes-pre-commit"
# A cloned repo can point core.fsmonitor at a script, or be a bare repo hidden in a subfolder.
GIT = ["git", "-c", "core.fsmonitor=false", "-c", "safe.bareRepository=explicit"]
KEEPS = ("installed", "updated", "current")

LINES = {
    "installed": "Git commit check installed: commits that leave out JOURNAL.md are blocked in every tool (.git/hooks/pre-commit)",
    "updated": "Git commit check updated (.git/hooks/pre-commit)",
    "not-a-repo": "Git commit check skipped: this folder is not a git repository yet. Run git init, then goodvibes update.",
    "custom-path": "Git commit check skipped: git uses its own hooks folder here (core.hooksPath = {detail}), so goodvibes left your hooks alone.",
    "existing-hook": "Git commit check skipped: .git/hooks/pre-commit already exists and is not from goodvibes, so it was left alone.",
    "linked-hooks": "Git commit check skipped: .git/hooks is a link or points outside this repository's git folder, so goodvibes left it alone.",
}
REMOVED_LINE = ".git/hooks/pre-commit: removed by you, not re-added (run goodvibes init to restore)"


def hook_line(result: dict, dry_run: bool) -> str | None:
    line = LINES.get(result["status"])
    if line is None:
        return None
    line = line.format(detail=result.get("detail", ""))
    return f"Would: {line}" if dry_run and result["status"] in ("installed", "updated") else line


def _git(cwd: pathlib.Path, *args: str) -> str | None:
    try:
        p = run([*GIT, "-C", str(cwd), *args], capture_output=True, text=True)
    except FileNotFoundError:
        return None
    return p.stdout.strip() if p.returncode == 0 else None


def install_git_hook(cwd: pathlib.Path, dry_run: bool) -> dict:
    if _git(cwd, "rev-parse", "--show-toplevel") is None:
        return {"status": "not-a-repo", "path": ""}
    custom = _git(cwd, "config", "--get", "core.hooksPath")
    if custom:
        return {"status": "custom-path", "path": "", "detail": custom}
    common = _git(cwd, "rev-parse", "--git-common-dir")
    if not common:
        return {"status": "not-a-repo", "path": ""}
    git_dir = pathlib.Path(os.path.abspath(os.path.join(cwd, common)))
    hooks = git_dir / "hooks"
    # A repo can ship .git/hooks as a link (or a Windows junction); writing through it would drop an executable wherever it points.
    if os.path.lexists(hooks):
        real = pathlib.Path(os.path.realpath(hooks))
        if hooks.is_symlink() or real == pathlib.Path(os.path.realpath(git_dir)) or not real.is_relative_to(os.path.realpath(git_dir)):
            return {"status": "linked-hooks", "path": ""}
    target = hooks / "pre-commit"
    packaged = (resolve_hooks_dir() / "pre-commit").read_bytes()
    result = {"path": str(target)}
    if os.path.lexists(target):
        if target.is_symlink() or not target.is_file() or MARKER not in target.read_bytes():
            return {"status": "existing-hook", **result}
        if target.read_bytes() == packaged:
            return {"status": "current", **result}
        status = "updated"
    else:
        status = "installed"
    if not dry_run:
        hooks.mkdir(parents=True, exist_ok=True)
        tmp = hooks / f".pre-commit.{os.getpid()}.tmp"
        # O_EXCL refuses an existing path, a planted symlink included.
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o755)
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(packaged)
            os.chmod(tmp, 0o755)
            os.replace(tmp, target)
        except BaseException:
            tmp.unlink(missing_ok=True)
            raise
    return {"status": status, **result}
