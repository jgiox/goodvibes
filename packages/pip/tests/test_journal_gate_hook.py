"""Real-subprocess integration tests for the journal-gate PreToolUse hook (mirrors the npm test).

Most journal-gate cases live in tests/hooks/journal-gate.cases.json; these need setup that data cannot express.
"""
from __future__ import annotations

import json
import os
import pathlib
import shutil
import subprocess
import tempfile

import pytest


def _repo_root_templates_dir() -> pathlib.Path:
    # packages/pip/tests/test_journal_gate_hook.py -> parents[3] is the repo root.
    # resolve_templates_dir() resolves an installed wheel's bundled templates and raises
    # FileNotFoundError in dev/test mode, so we read the canonical repo-root templates/ dir directly.
    return pathlib.Path(__file__).resolve().parents[3] / "templates"


def _get_hook_command() -> str:
    settings_path = _repo_root_templates_dir() / ".claude" / "settings.json"
    data = json.loads(settings_path.read_text())
    return data["hooks"]["PreToolUse"][0]["hooks"][0]["command"]


def _run_hook(command: str, cwd: pathlib.Path, env: dict[str, str] | None = None) -> subprocess.CompletedProcess:
    hook_cmd = _get_hook_command()
    payload = json.dumps({"tool_name": "Bash", "tool_input": {"command": command}})
    return subprocess.run(
        ["sh", "-c", hook_cmd], input=payload, cwd=cwd, capture_output=True, text=True,
        env={**os.environ, **(env or {})},
    )


@pytest.fixture
def repo_dir(tmp_path):
    subprocess.run(["git", "init"], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=tmp_path, check=True, capture_output=True)
    (tmp_path / "JOURNAL.md").write_text("# journal\n")
    return tmp_path


def test_blocks_dash_c_commit_targeting_different_unstaged_repo_when_cwd_staged(repo_dir):
    subprocess.run(["git", "add", "JOURNAL.md"], cwd=repo_dir, check=True, capture_output=True)
    other_repo = repo_dir / "other-repo"
    other_repo.mkdir()
    subprocess.run(["git", "init"], cwd=other_repo, check=True, capture_output=True)
    (other_repo / "JOURNAL.md").write_text("# journal\n")
    result = _run_hook(f'git -C {other_repo} commit -am "fix"', repo_dir)
    assert result.returncode == 2
    assert result.stderr.strip() == "BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md"


def test_allows_dash_c_commit_targeting_different_staged_repo_when_cwd_unstaged(repo_dir):
    other_repo = repo_dir / "other-repo"
    other_repo.mkdir()
    subprocess.run(["git", "init"], cwd=other_repo, check=True, capture_output=True)
    (other_repo / "JOURNAL.md").write_text("# journal\n")
    subprocess.run(["git", "add", "JOURNAL.md"], cwd=other_repo, check=True, capture_output=True)
    result = _run_hook(f'git -C {other_repo} commit -am "fix"', repo_dir)
    assert result.returncode == 0


def test_allows_dash_c_commit_targeting_different_mid_merge_repo_when_cwd_not_mid_merge(repo_dir):
    other_repo = repo_dir / "other-repo"
    other_repo.mkdir()
    subprocess.run(["git", "init"], cwd=other_repo, check=True, capture_output=True)
    (other_repo / "JOURNAL.md").write_text("# journal\n")
    (other_repo / ".git" / "MERGE_HEAD").write_text("abc123\n")
    result = _run_hook(f'git -C {other_repo} commit -am "fix"', repo_dir)
    assert result.returncode == 0


def test_does_not_allow_commit_via_dash_c_target_that_is_not_a_git_repository(repo_dir):
    not_a_repo = pathlib.Path(tempfile.mkdtemp(prefix="gv-not-a-repo-"))
    try:
        result = _run_hook(f'git -C {not_a_repo} commit -am "fix"', repo_dir)
        assert result.returncode != 0
        assert "BLOCKED" in result.stderr
    finally:
        shutil.rmtree(not_a_repo, ignore_errors=True)


def test_does_not_let_unrelated_dash_c_invocation_in_chained_command_override_routing(repo_dir):
    other_repo = repo_dir / "other-repo"
    other_repo.mkdir()
    subprocess.run(["git", "init"], cwd=other_repo, check=True, capture_output=True)
    (other_repo / "JOURNAL.md").write_text("# journal\n")
    subprocess.run(["git", "add", "JOURNAL.md"], cwd=other_repo, check=True, capture_output=True)
    result = _run_hook(f'git commit -am "fix" && git -C {other_repo} status', repo_dir)
    assert result.returncode == 2


def test_does_not_fall_back_to_cwd_when_quoted_dash_c_path_contains_a_space(repo_dir):
    subprocess.run(["git", "add", "JOURNAL.md"], cwd=repo_dir, check=True, capture_output=True)
    spaced_parent = repo_dir / "path with a space"
    repo_b = spaced_parent / "repoB"
    repo_b.mkdir(parents=True)
    subprocess.run(["git", "init"], cwd=repo_b, check=True, capture_output=True)
    (repo_b / "JOURNAL.md").write_text("# journal\n")
    result = _run_hook(f'git -C "{repo_b}" commit -am "fix"', repo_dir)
    assert result.returncode == 2
    assert result.stderr.strip() == "BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md"


def test_does_not_run_fsmonitor_command_of_bare_repo_that_command_text_only_mentions(repo_dir):
    marker = repo_dir / "fsmonitor-ran"
    evil = repo_dir / "vendor" / "evil"
    subprocess.run(["git", "init", "--bare", str(evil)], check=True, capture_output=True)
    for key, value in [("core.bare", "false"), ("core.worktree", "../.."), ("core.fsmonitor", f"touch '{marker}' #")]:
        subprocess.run(["git", "config", "-f", str(evil / "config"), key, value], check=True, capture_output=True)
    _run_hook("# git -C vendor/evil commit", repo_dir)
    _run_hook("echo git -C vendor/evil commit -m wip", repo_dir)
    assert not marker.exists()


def _init_repo_with_journal(path, staged):
    path.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "init"], cwd=path, check=True, capture_output=True)
    (path / "JOURNAL.md").write_text("# journal\n")
    if staged:
        subprocess.run(["git", "add", "JOURNAL.md"], cwd=path, check=True, capture_output=True)


@pytest.mark.parametrize("command", ["git -C ~/p commit -m x", "git -C $HOME/p commit -m x"])
def test_expands_leading_tilde_or_home_to_the_home_folder(repo_dir, command):
    home = repo_dir / "home"
    _init_repo_with_journal(home / "p", staged=True)
    assert _run_hook(command, repo_dir, env={"HOME": str(home)}).returncode == 0
