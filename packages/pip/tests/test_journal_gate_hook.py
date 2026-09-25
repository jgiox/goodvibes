"""Real-subprocess integration tests for the journal-gate PreToolUse hook (mirrors the npm test)."""
from __future__ import annotations

import json
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


def test_blocks_non_amend_commit_with_amend_text_in_message(repo_dir):
    result = _run_hook('git commit -am "note about --amend flag"', repo_dir)
    assert result.returncode == 2
    assert result.stderr.strip() == "BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md"


def test_allows_non_commit_command_with_commit_substring_in_args(repo_dir):
    result = _run_hook('git log --grep="please git commit later"', repo_dir)
    assert result.returncode == 0


def test_blocks_non_amend_commit_with_single_quoted_amend_text_in_message(repo_dir):
    result = _run_hook("git commit -am 'note about --amend flag'", repo_dir)
    assert result.returncode == 2
    assert result.stderr.strip() == "BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md"


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


def test_blocks_commit_whose_message_merely_resembles_dash_c_flag_when_real_target_unstaged(repo_dir):
    other_repo = repo_dir / "other-repo"
    other_repo.mkdir()
    subprocess.run(["git", "init"], cwd=other_repo, check=True, capture_output=True)
    (other_repo / "JOURNAL.md").write_text("# journal\n")
    subprocess.run(["git", "add", "JOURNAL.md"], cwd=other_repo, check=True, capture_output=True)
    result = _run_hook(f'git commit -am "see -C {other_repo} for details"', repo_dir)
    assert result.returncode == 2


def test_allows_commit_whose_message_merely_resembles_dash_c_flag_when_real_target_staged(repo_dir):
    subprocess.run(["git", "add", "JOURNAL.md"], cwd=repo_dir, check=True, capture_output=True)
    result = _run_hook('git commit -am "notes -C /tmp for later"', repo_dir)
    assert result.returncode == 0


def test_blocks_commit_from_unstaged_cwd_whose_message_merely_contains_adjacent_git_dash_c_phrase(repo_dir):
    other_repo = repo_dir / "other-repo"
    other_repo.mkdir()
    subprocess.run(["git", "init"], cwd=other_repo, check=True, capture_output=True)
    (other_repo / "JOURNAL.md").write_text("# journal\n")
    subprocess.run(["git", "add", "JOURNAL.md"], cwd=other_repo, check=True, capture_output=True)
    result = _run_hook(f'git commit -am "see git -C {other_repo} for the fix"', repo_dir)
    assert result.returncode == 2


def test_allows_commit_from_staged_cwd_whose_message_merely_contains_adjacent_git_dash_c_phrase(repo_dir):
    subprocess.run(["git", "add", "JOURNAL.md"], cwd=repo_dir, check=True, capture_output=True)
    result = _run_hook('git commit -am "fix: git -C anchor bypass in journal-gate hook"', repo_dir)
    assert result.returncode == 0


def test_allows_commit_in_repo_without_journal_which_is_not_a_goodvibes_project(repo_dir):
    (repo_dir / "JOURNAL.md").unlink()
    assert _run_hook('git commit -am "fix"', repo_dir).returncode == 0


def _commit_journal(repo_dir):
    subprocess.run(["git", "add", "JOURNAL.md"], cwd=repo_dir, check=True, capture_output=True)
    subprocess.run(["git", "-c", "commit.gpgsign=false", "commit", "-m", "init"], cwd=repo_dir, check=True, capture_output=True)
    (repo_dir / "JOURNAL.md").write_text("# journal\n- entry\n")


def test_allows_add_journal_and_commit_in_one_command_when_journal_has_changes(repo_dir):
    assert _run_hook('git add JOURNAL.md && git commit -m "log"', repo_dir).returncode == 0


def test_allows_add_of_exact_paths_including_journal_and_commit(repo_dir):
    assert _run_hook('git add src.txt JOURNAL.md && git commit -m "log"', repo_dir).returncode == 0


def test_allows_add_all_and_commit_when_journal_has_changes(repo_dir):
    assert _run_hook('git add -A && git commit -m "log"', repo_dir).returncode == 0


def test_blocks_add_of_other_paths_and_commit_when_journal_not_in_add_list(repo_dir):
    assert _run_hook('git add src.txt && git commit -m "log"', repo_dir).returncode == 2


def test_blocks_when_add_journal_runs_only_after_the_commit(repo_dir):
    assert _run_hook('git commit -m "log" && git add JOURNAL.md', repo_dir).returncode == 2


def test_blocks_add_journal_and_commit_when_journal_has_no_changes(repo_dir):
    _commit_journal(repo_dir)
    subprocess.run(["git", "checkout", "--", "JOURNAL.md"], cwd=repo_dir, check=True, capture_output=True)
    assert _run_hook('git add JOURNAL.md && git commit -m "log"', repo_dir).returncode == 2


def test_allows_commit_all_when_tracked_journal_modified_in_working_tree(repo_dir):
    _commit_journal(repo_dir)
    assert _run_hook('git commit -am "log"', repo_dir).returncode == 0


def test_blocks_commit_without_all_when_tracked_journal_modified_but_unstaged(repo_dir):
    _commit_journal(repo_dir)
    assert _run_hook('git commit -m "log"', repo_dir).returncode == 2


def test_allows_heredoc_whose_body_mentions_git_commit(repo_dir):
    assert _run_hook("cat > notes.md <<'EOF'\nremember to git commit later\nEOF", repo_dir).returncode == 0


def test_allows_multi_line_command_with_git_and_commit_on_different_lines(repo_dir):
    assert _run_hook("git status\necho commit", repo_dir).returncode == 0


def test_still_blocks_commit_fed_to_a_shell_through_a_heredoc(repo_dir):
    assert _run_hook("bash <<'EOF'\ngit commit -m x\nEOF", repo_dir).returncode == 2


def test_still_blocks_commit_on_the_line_after_a_here_string(repo_dir):
    assert _run_hook("cat <<< hi\ngit commit -m x", repo_dir).returncode == 2


def test_still_blocks_commit_on_the_line_after_a_heredoc_ends(repo_dir):
    assert _run_hook("cat > n.md <<'EOF'\nhi\nEOF\ngit commit -m x", repo_dir).returncode == 2


def test_still_blocks_commit_dash_f_with_message_from_heredoc(repo_dir):
    assert _run_hook("git commit -F - <<'EOF'\nmsg\nEOF", repo_dir).returncode == 2


def test_still_blocks_commit_whose_multi_line_message_mentions_commit_dash_a(repo_dir):
    _commit_journal(repo_dir)
    assert _run_hook('git commit -m "x\nuse commit -a next time"', repo_dir).returncode == 2


def test_still_blocks_commit_after_heredoc_with_punctuated_delimiter(repo_dir):
    assert _run_hook('cat <<END-MARK\ntext\nEND-MARK\ngit commit -m x', repo_dir).returncode == 2


def test_still_blocks_commit_inside_unterminated_heredoc(repo_dir):
    assert _run_hook('cat <<EOF\ngit commit -m x', repo_dir).returncode == 2


def test_allows_heredoc_piped_to_grep_bash_whose_body_mentions_git_commit(repo_dir):
    assert _run_hook('cat <<EOF | grep bash\nremember to git commit\nEOF', repo_dir).returncode == 0


def test_still_blocks_commit_in_heredoc_piped_to_bash(repo_dir):
    assert _run_hook('cat <<EOF | bash\ngit commit -m x\nEOF', repo_dir).returncode == 2


def test_still_blocks_commit_in_heredoc_fed_to_sudo_bash(repo_dir):
    assert _run_hook('sudo -u me bash <<EOF\ngit commit -m x\nEOF', repo_dir).returncode == 2


def test_still_blocks_commit_in_heredoc_fed_to_bash_without_space(repo_dir):
    assert _run_hook('bash<<EOF\ngit commit -m x\nEOF', repo_dir).returncode == 2


def test_does_not_run_fsmonitor_command_of_bare_repo_that_command_text_only_mentions(repo_dir):
    marker = repo_dir / "fsmonitor-ran"
    evil = repo_dir / "vendor" / "evil"
    subprocess.run(["git", "init", "--bare", str(evil)], check=True, capture_output=True)
    for key, value in [("core.bare", "false"), ("core.worktree", "../.."), ("core.fsmonitor", f"touch '{marker}' #")]:
        subprocess.run(["git", "config", "-f", str(evil / "config"), key, value], check=True, capture_output=True)
    _run_hook("# git -C vendor/evil commit", repo_dir)
    _run_hook("echo git -C vendor/evil commit -m wip", repo_dir)
    assert not marker.exists()


@pytest.mark.parametrize(
    "command",
    ["npm test&&git commit -m x", "true|git commit -m x", "echo $(git commit -m x)", "(git commit -m x)", "a;git commit -m x"],
)
def test_blocks_commit_whose_git_is_glued_to_a_shell_operator(repo_dir, command):
    assert _run_hook(command, repo_dir).returncode == 2


@pytest.mark.parametrize(
    "command",
    ["git log --oneline | grep commit", "git help commit", "git cat-file commit HEAD", "git log -1 && echo last commit"],
)
def test_allows_git_command_whose_subcommand_is_not_commit(repo_dir, command):
    assert _run_hook(command, repo_dir).returncode == 0


def test_blocks_commit_split_across_lines_with_backslash_newline_continuation(repo_dir):
    assert _run_hook("git \\\n  commit -m x", repo_dir).returncode == 2


def test_blocks_commit_that_follows_full_line_comment_containing_an_apostrophe(repo_dir):
    assert _run_hook("# don't forget the journal\ngit commit -m x\necho 'done'", repo_dir).returncode == 2


def test_blocks_commit_when_only_a_later_commit_in_the_same_command_uses_amend(repo_dir):
    assert _run_hook("git commit -m x && git commit --amend --no-edit", repo_dir).returncode == 2


def test_blocks_commit_whose_amend_appears_only_in_a_trailing_comment(repo_dir):
    assert _run_hook("git commit -m x # --amend", repo_dir).returncode == 2


def test_allows_command_in_which_every_commit_uses_amend(repo_dir):
    assert _run_hook("git commit --amend -m x && git commit --amend --no-edit", repo_dir).returncode == 0
