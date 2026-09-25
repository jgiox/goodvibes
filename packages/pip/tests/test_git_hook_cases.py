"""Runs tests/hooks/git-pre-commit.cases.json against the hook the real installer writes."""
from __future__ import annotations

import json
import pathlib
import subprocess

import pytest

from goodvibes_cli.steps.git_hook import install_git_hook

CASES = json.loads((pathlib.Path(__file__).resolve().parents[3] / "tests" / "hooks" / "git-pre-commit.cases.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_git_pre_commit_case(case, tmp_path, git_env):
    repo = tmp_path / "repo"
    repo.mkdir()

    def git(*args):
        subprocess.run(["git", *args], cwd=repo, env=git_env, check=True, capture_output=True)

    git("init", "-q", "-b", "main")
    (repo / "a.txt").write_text("a\n", encoding="utf-8")
    (repo / "JOURNAL.md").write_text("# J\n", encoding="utf-8")
    git("add", "a.txt", "JOURNAL.md")
    git("commit", "-q", "-m", "base")
    assert install_git_hook(repo, False)["status"] == "installed"

    p = subprocess.run(["sh", "-c", case["script"]], cwd=repo, env=git_env, capture_output=True, text=True)

    assert p.returncode == case["expect"], p.stderr
    assert case.get("stderr_contains", "") in p.stderr
