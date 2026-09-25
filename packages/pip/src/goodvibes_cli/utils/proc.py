"""Run tools found on PATH only, never a program shipped in the project folder (mirror of npm utils/exec-env.ts)."""
from __future__ import annotations

import errno
import os
import shutil
import subprocess
import sys

WINDOWS = sys.platform == "win32"
# cmd.exe and other Windows programs skip the current folder when looking up a program while this is set.
NO_CWD = {"NoDefaultCurrentDirectoryInExePath": "1"}


def _safe_path() -> str:
    """PATH without ".", empty or relative entries or folders inside the project, which would let a cloned repo pick the program."""
    cwd = os.path.realpath(os.getcwd())

    def within(path: str) -> bool:
        return path == cwd or path.startswith(cwd.rstrip(os.sep) + os.sep)

    # The home folder and the folders above it hold the user's own bin folders (~/.local/bin), so they never count as a project.
    project = not within(os.path.realpath(os.path.expanduser("~")))

    def inside(d: str) -> bool:
        return project and within(os.path.realpath(d))

    dirs = (d.strip('"') for d in os.environ.get("PATH", "").split(os.pathsep))
    return os.pathsep.join(d for d in dirs if os.path.isabs(d) and not inside(d))


def which(cmd: str) -> str | None:
    if not WINDOWS:
        return shutil.which(cmd, path=_safe_path())
    # shutil.which on Windows searches the current folder first (always, before Python 3.12), so search PATH by hand.
    exts = [e for e in os.environ.get("PATHEXT", ".COM;.EXE;.BAT;.CMD").split(";") if e]
    names = [cmd] if os.path.splitext(cmd)[1].lower() in (e.lower() for e in exts) else [cmd + e for e in exts]
    for d in _safe_path().split(os.pathsep):
        if not d:
            continue
        for name in names:
            if os.path.isfile(os.path.join(d, name)):
                return os.path.join(d, name)
    return None


def run(args: list[str], **kwargs) -> subprocess.CompletedProcess:
    """subprocess.run, with the program resolved from PATH on Windows so claude.cmd works and a repo's git.cmd never runs."""
    exe = which(args[0]) if WINDOWS and not os.path.isabs(args[0]) else args[0]
    if exe is None:
        raise FileNotFoundError(errno.ENOENT, f"{args[0]} is not on PATH", args[0])
    return subprocess.run([exe, *args[1:]], env={**os.environ, **NO_CWD, **({} if WINDOWS else {"PATH": _safe_path()})}, **kwargs)
