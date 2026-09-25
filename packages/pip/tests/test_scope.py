"""Tests for utils/scope (mirror of npm utils/scope.test.ts)."""
import pytest

from goodvibes_cli.utils.scope import minimal_skipped, same_path


@pytest.mark.parametrize("rel", ["docs", "docs/onboarding.md", ".github/workflows/ci.yml", ".github/dependabot.yml", ".github/ISSUE_TEMPLATE/bug_report.yml", ".github/scripts/check-file-sizes.mjs"])
def test_minimal_skipped_skips_docs_and_the_ci_side_of_github(rel):
    assert minimal_skipped(rel) is True


@pytest.mark.parametrize("rel", [".github/copilot-instructions.md", ".github/hooks", ".github/hooks/goodvibes.json", "AGENTS.md", ".claude/settings.json", "documents/x.md"])
def test_minimal_skipped_keeps_copilots_rules_and_hooks_and_every_file_outside_docs_and_github(rel):
    assert minimal_skipped(rel) is False


def test_minimal_skipped_treats_windows_backslash_paths_the_same_as_forward_slashes():
    assert minimal_skipped(".github\\workflows\\ci.yml") is True
    assert minimal_skipped(".github\\hooks\\goodvibes.json") is False


def test_same_path_is_true_for_a_folder_and_a_symlink_to_it(tmp_path):
    (tmp_path / "real").mkdir()
    (tmp_path / "link").symlink_to(tmp_path / "real")
    assert same_path(tmp_path / "link", tmp_path / "real")


def test_same_path_compares_folders_that_do_not_exist_by_their_plain_path(tmp_path):
    assert same_path(tmp_path / "missing" / ".." / "missing", tmp_path / "missing")
    assert not same_path(tmp_path / "missing", tmp_path / "other")
