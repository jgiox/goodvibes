"""Data-driven runner for tests/hooks/<id>.cases.json; hook-cases.integration.test.ts runs the same files."""
from __future__ import annotations

import json
import os
import pathlib
import re
import subprocess

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[3]
CASES_DIR = ROOT / "tests" / "hooks"
SETTINGS = json.loads((ROOT / "templates" / ".claude" / "settings.json").read_text(encoding="utf-8"))


def _hook_command(hook_id: str, tool: str) -> str:
    marker = f": goodvibes-{hook_id};"
    for group in (SETTINGS.get("hooks") or {}).get("PreToolUse") or []:
        if not re.fullmatch(group["matcher"], tool):
            continue
        for h in group["hooks"]:
            if h.get("command", "").startswith(marker):
                return h["command"]
    raise AssertionError(f'no PreToolUse hook marked "{marker}" is registered for the {tool} tool')


def _git(cwd: pathlib.Path, *args: str) -> None:
    subprocess.run(["git", "-c", "commit.gpgsign=false", *args], cwd=cwd, check=True, capture_output=True)


def _repo(path: pathlib.Path, journal: str) -> None:
    path.mkdir(parents=True, exist_ok=True)
    _git(path, "init")
    _git(path, "config", "user.email", "test@example.com")
    _git(path, "config", "user.name", "Test")
    if journal == "none":
        return
    (path / "JOURNAL.md").write_text("# journal\n")
    if journal == "untracked":
        return
    _git(path, "add", "JOURNAL.md")
    if journal == "staged":
        return
    _git(path, "commit", "-m", "init")
    if journal == "committed-modified":
        (path / "JOURNAL.md").write_text("# journal\n- entry\n")


def _write_at(path: pathlib.Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def _in_progress(d: pathlib.Path, marker: str) -> None:
    _repo(d, "untracked")
    if marker == "MERGE_HEAD":
        (d / ".git" / marker).write_text("abc123\n")
    else:
        (d / ".git" / marker).mkdir()


FIXTURES = {
    "no-journal": lambda d: _repo(d, "none"),
    "journal-untracked": lambda d: _repo(d, "untracked"),
    "journal-staged": lambda d: _repo(d, "staged"),
    "journal-committed-clean": lambda d: _repo(d, "committed-clean"),
    "journal-committed-modified": lambda d: _repo(d, "committed-modified"),
    "merge-in-progress": lambda d: _in_progress(d, "MERGE_HEAD"),
    "rebase-merge-in-progress": lambda d: _in_progress(d, "rebase-merge"),
    "rebase-apply-in-progress": lambda d: _in_progress(d, "rebase-apply"),
    "repo": lambda d, sub, journal: _repo(d / sub, journal),
    "file": lambda d, name, lines, width=None: _write_at(
        d / name, "".join(("x" * int(width) if width else f"line {i + 1}") + "\n" for i in range(int(lines)))
    ),
    "secret-file": lambda d, name: _write_at(d / name, "SECRET=do-not-read\n"),
    "dir": lambda d, name: (d / name).mkdir(parents=True, exist_ok=True),
}


def _fill(v, d: pathlib.Path):
    if isinstance(v, str):
        return v.replace("{dir}", str(d))
    if isinstance(v, list):
        return [_fill(x, d) for x in v]
    if isinstance(v, dict):
        return {k: _fill(x, d) for k, x in v.items()}
    return v


CASES = [
    pytest.param(f.name.removesuffix(".cases.json"), c, id=f"{f.name.removesuffix('.cases.json')}: {c['name']}")
    for f in sorted(CASES_DIR.glob("*.cases.json"))
    for c in json.loads(f.read_text(encoding="utf-8"))
]


@pytest.mark.parametrize("hook_id,case", CASES)
def test_hook_case(tmp_path, hook_id, case):
    setup = case.get("setup") or []
    for step in [setup] if isinstance(setup, str) else setup:
        name, *args = step.split(":")
        assert name in FIXTURES, f'unknown fixture "{name}"'
        FIXTURES[name](tmp_path, *args)
    env = {k: v for k, v in os.environ.items() if not k.startswith("GOODVIBES_READ_GUARD")}
    env.update(_fill(case.get("env") or {}, tmp_path))
    payload = json.dumps({"tool_name": case["tool"], "tool_input": _fill(case["input"], tmp_path)})
    r = subprocess.run(
        ["sh", "-c", _hook_command(hook_id, case["tool"])], input=payload, cwd=tmp_path, capture_output=True, text=True, env=env
    )
    assert r.returncode == case["expect"], r.stderr
    if "stderr_contains" in case:
        assert _fill(case["stderr_contains"], tmp_path) in r.stderr
