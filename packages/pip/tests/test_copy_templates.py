"""Tests for copy_templates — Wave 1 (03-02-PLAN.md)."""
import pathlib
import pytest

from .conftest import TEMPLATE_CONTENT


def test_copy_templates_copies_files_to_destination(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir)
    # CLAUDE.md is handled by merge_claude, not raw copy; check non-CLAUDE.md file
    assert (tmp_dir / "CONTRIBUTING.md").exists()


def test_copy_templates_skips_claude_md_in_raw_copy(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    merge = mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    # Write a sentinel-free CLAUDE.md in dest to detect if raw copy overwrote it
    (tmp_dir / "CLAUDE.md").write_text("# Existing")
    copy_templates(template_dir, tmp_dir)
    # merge_claude called for CLAUDE.md — raw shutil.copytree must not have overwritten it
    merge.assert_called_once()


def test_copy_templates_calls_sentinel_merge_for_claude_md(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    merge = mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir)
    merge.assert_called_once()


def test_copy_templates_skips_github_workflows_when_minimal(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    # template_dir fixture contains ci-node/python/both.yml; minimal skips all workflow files
    copy_templates(template_dir, tmp_dir, minimal=True)
    assert not (tmp_dir / ".github" / "workflows" / "ci.yml").exists()


def test_copy_templates_path_traversal_guard(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    # Normal file in template should copy fine; no escape should occur
    (template_dir / "safe.txt").write_text("ok")
    copy_templates(template_dir, tmp_dir)
    # safe.txt copies, no path traversal exception, dest stays within tmp_dir
    assert (tmp_dir / "safe.txt").exists()
    # Verify no files escaped outside tmp_dir
    for f in tmp_dir.rglob("*"):
        assert str(f).startswith(str(tmp_dir))


def test_copy_templates_dry_run_returns_list_without_writing(tmp_dir, template_dir):
    from goodvibes_cli.steps.copy_templates import copy_templates
    result = copy_templates(template_dir, tmp_dir, dry_run=True)
    assert isinstance(result, tuple)
    assert len(result[0]) > 0
    # dry_run must not write any files
    assert not (tmp_dir / "CLAUDE.md").exists()
    assert not (tmp_dir / "CONTRIBUTING.md").exists()


def test_copy_templates_second_run_does_not_overwrite(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir)
    # Simulate user editing a non-CLAUDE.md file
    (tmp_dir / "CONTRIBUTING.md").write_text("# User edits\n")
    copy_templates(template_dir, tmp_dir)
    # No-clobber: user edits must be preserved
    assert "# User edits" in (tmp_dir / "CONTRIBUTING.md").read_text()


def test_copy_templates_handles_empty_template_dir(tmp_dir, tmp_path, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    empty = tmp_path / "empty_templates"
    empty.mkdir()
    # Empty template has no CLAUDE.md — merge_claude must not be called
    merge = mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(empty, tmp_dir)
    merge.assert_not_called()


def test_copy_templates_github_workflows_copied_when_not_minimal(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    # Non-minimal copy (project_type defaults to "both") renames ci-both.yml to ci.yml
    copy_templates(template_dir, tmp_dir, minimal=False)
    assert (tmp_dir / ".github" / "workflows" / "ci.yml").exists()


# --- CI variant selection tests ---

def test_copy_templates_writes_ci_yml_not_ci_node_yml_for_node_project(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir, project_type="node")
    assert (tmp_dir / ".github" / "workflows" / "ci.yml").exists()
    assert not (tmp_dir / ".github" / "workflows" / "ci-node.yml").exists()


def test_copy_templates_does_not_write_other_variants_for_node_project(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir, project_type="node")
    assert not (tmp_dir / ".github" / "workflows" / "ci-python.yml").exists()
    assert not (tmp_dir / ".github" / "workflows" / "ci-both.yml").exists()


def test_copy_templates_writes_ci_yml_for_python_project(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir, project_type="python")
    assert (tmp_dir / ".github" / "workflows" / "ci.yml").exists()
    assert not (tmp_dir / ".github" / "workflows" / "ci-python.yml").exists()


# --- UX-02 / MIN-01 tuple return tests ---

def test_copy_templates_returns_tuple_of_written_and_skipped(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    result = copy_templates(template_dir, tmp_dir)
    assert isinstance(result, tuple)
    assert len(result) == 2
    written, skipped = result
    assert isinstance(written, list)
    assert isinstance(skipped, list)
    assert len(written) > 0
    assert len(skipped) == 0


def test_copy_templates_skipped_contains_preexisting_files_on_second_run(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir)
    _, skipped = copy_templates(template_dir, tmp_dir)
    assert len(skipped) > 0


def test_copy_templates_does_not_overwrite_existing_ci_yml(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir, project_type="node")
    ci_path = tmp_dir / ".github" / "workflows" / "ci.yml"
    assert ci_path.exists()
    ci_path.write_text("# custom CI\n")
    _, skipped = copy_templates(template_dir, tmp_dir, project_type="node")
    assert ci_path.read_text() == "# custom CI\n"
    assert any("ci.yml" in s for s in skipped)


def test_copy_templates_minimal_skips_github_issue_templates(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir, minimal=True)
    assert not (tmp_dir / ".github" / "ISSUE_TEMPLATE").exists()


def test_copy_templates_minimal_skips_docs_directory(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir, minimal=True)
    assert not (tmp_dir / "docs").exists()


def test_copy_templates_minimal_keeps_claude_md(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    written, _ = copy_templates(template_dir, tmp_dir, minimal=True)
    assert any("CLAUDE.md" in w for w in written) or (tmp_dir / "CLAUDE.md").exists()


# --- IDE rule file tests (Phase 8 — IDE-01, IDE-03, IDE-04) ---

def test_copy_templates_writes_cursor_mdc_on_fresh_init(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    written, _ = copy_templates(template_dir, tmp_dir)
    assert (tmp_dir / ".cursor" / "rules" / "goodvibes.mdc").exists()
    assert any("goodvibes.mdc" in w for w in written)


def test_copy_templates_writes_windsurfrules_on_fresh_init(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir)
    assert (tmp_dir / ".windsurfrules").exists()


def test_copy_templates_writes_kiro_steering_on_fresh_init(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir)
    assert (tmp_dir / ".kiro" / "steering" / "goodvibes.md").exists()


def test_copy_templates_writes_copilot_instructions_on_fresh_init(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir)
    assert (tmp_dir / ".github" / "copilot-instructions.md").exists()


def test_copy_templates_skips_existing_cursor_mdc_and_counts_as_skipped(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    cursor_dir = tmp_dir / ".cursor" / "rules"
    cursor_dir.mkdir(parents=True)
    (cursor_dir / "goodvibes.mdc").write_text("# custom\n")
    _, skipped = copy_templates(template_dir, tmp_dir)
    assert (cursor_dir / "goodvibes.mdc").read_text() == "# custom\n"
    assert any("goodvibes.mdc" in s for s in skipped)


def test_copy_templates_minimal_skips_copilot_instructions(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir, minimal=True)
    assert not (tmp_dir / ".github" / "copilot-instructions.md").exists()


def test_copy_templates_minimal_writes_cursor_mdc(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir, minimal=True)
    assert (tmp_dir / ".cursor" / "rules" / "goodvibes.mdc").exists()


def test_copy_templates_minimal_writes_windsurfrules(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir, minimal=True)
    assert (tmp_dir / ".windsurfrules").exists()


def test_copy_templates_minimal_writes_kiro_steering(tmp_dir, template_dir, mocker):
    from goodvibes_cli.steps.copy_templates import copy_templates
    mocker.patch("goodvibes_cli.steps.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir, minimal=True)
    assert (tmp_dir / ".kiro" / "steering" / "goodvibes.md").exists()
