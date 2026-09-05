"""Real-subprocess integration tests for the journal-gate PreToolUse hook (mirrors the npm test)."""
from __future__ import annotations

import json
import pathlib
import subprocess

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


def _run_hook(command: str, cwd: pathlib.Path) -> subprocess.CompletedProcess:
    hook_cmd = _get_hook_command()
    payload = json.dumps({"tool_name": "Bash", "tool_input": {"command": command}})
    return subprocess.run(
        ["sh", "-c", hook_cmd], input=payload, cwd=cwd, capture_output=True, text=True
    )


@pytest.fixture
def repo_dir(tmp_path):
    subprocess.run(["git", "init"], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=tmp_path, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=tmp_path, check=True, capture_output=True)
    (tmp_path / "JOURNAL.md").write_text("# journal\n")
    return tmp_path


def test_blocks_commit_when_journal_not_staged(repo_dir):
    result = _run_hook('git commit -am "fix"', repo_dir)
    assert result.returncode == 2
    assert result.stderr.strip() == "BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md"


def test_allows_commit_when_journal_staged_first(repo_dir):
    subprocess.run(["git", "add", "JOURNAL.md"], cwd=repo_dir, check=True, capture_output=True)
    result = _run_hook('git commit -am "fix"', repo_dir)
    assert result.returncode == 0


def test_allows_amend_even_when_journal_unstaged(repo_dir):
    result = _run_hook("git commit --amend --no-edit", repo_dir)
    assert result.returncode == 0


def test_allows_non_commit_git_status(repo_dir):
    result = _run_hook("git status", repo_dir)
    assert result.returncode == 0


def test_allows_commit_during_merge_in_progress(repo_dir):
    (repo_dir / ".git" / "MERGE_HEAD").write_text("abc123\n")
    result = _run_hook('git commit -am "m"', repo_dir)
    assert result.returncode == 0


def test_allows_commit_during_rebase_merge_in_progress(repo_dir):
    (repo_dir / ".git" / "rebase-merge").mkdir()
    result = _run_hook('git commit -am "m"', repo_dir)
    assert result.returncode == 0


def test_allows_commit_during_rebase_apply_in_progress(repo_dir):
    (repo_dir / ".git" / "rebase-apply").mkdir()
    result = _run_hook('git commit -am "m"', repo_dir)
    assert result.returncode == 0


def test_blocks_commit_with_dash_c_variant_when_journal_unstaged(repo_dir):
    result = _run_hook(f'git -C {repo_dir} commit -am "x"', repo_dir)
    assert result.returncode == 2


def test_does_not_false_positive_on_commit_tree_subcommand(repo_dir):
    result = _run_hook("git commit-tree abc123 -m x", repo_dir)
    assert result.returncode == 0
