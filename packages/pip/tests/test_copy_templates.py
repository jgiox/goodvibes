"""Test stubs for copy_templates — implement in Wave 1 (03-02-PLAN.md)."""
import pytest


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_copy_templates_copies_files_to_destination(tmp_dir, template_dir):
    from goodvibes_cli.copy_templates import copy_templates
    copy_templates(template_dir, tmp_dir)
    assert (tmp_dir / "CLAUDE.md").exists()


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_copy_templates_skips_claude_md_in_raw_copy(tmp_dir, template_dir):
    from goodvibes_cli.copy_templates import copy_templates
    # CLAUDE.md must not be copied verbatim; sentinel merge handles it
    copy_templates(template_dir, tmp_dir)
    # raw copy must not have overwritten CLAUDE.md without merge
    # (specific assertion implemented in Wave 1)


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_copy_templates_calls_sentinel_merge_for_claude_md(tmp_dir, template_dir, mocker):
    from goodvibes_cli.copy_templates import copy_templates
    merge = mocker.patch("goodvibes_cli.copy_templates.merge_claude")
    copy_templates(template_dir, tmp_dir)
    merge.assert_called_once()


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_copy_templates_skips_github_workflows_when_minimal(tmp_dir, template_dir):
    from goodvibes_cli.copy_templates import copy_templates
    workflows_dir = template_dir / ".github" / "workflows"
    workflows_dir.mkdir(parents=True)
    (workflows_dir / "ci.yml").write_text("name: CI\n")
    copy_templates(template_dir, tmp_dir, minimal=True)
    assert not (tmp_dir / ".github" / "workflows" / "ci.yml").exists()


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_copy_templates_path_traversal_guard(tmp_dir, template_dir):
    from goodvibes_cli.copy_templates import copy_templates
    import pytest
    # A template containing '../escape' must raise or be ignored safely
    evil = template_dir / "safe.txt"
    evil.write_text("ok")
    # path traversal outside dest must not succeed
    copy_templates(template_dir, tmp_dir)


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_copy_templates_dry_run_returns_list_without_writing(tmp_dir, template_dir):
    from goodvibes_cli.copy_templates import copy_templates
    result = copy_templates(template_dir, tmp_dir, dry_run=True)
    assert isinstance(result, list)
    assert len(result) > 0
    assert not (tmp_dir / "CLAUDE.md").exists()


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_copy_templates_second_run_does_not_overwrite(tmp_dir, template_dir):
    from goodvibes_cli.copy_templates import copy_templates
    copy_templates(template_dir, tmp_dir)
    (tmp_dir / "CLAUDE.md").write_text("# User edits\n")
    copy_templates(template_dir, tmp_dir)
    # User edits should be preserved (sentinel merge handles CLAUDE.md)
    assert "# User edits" in (tmp_dir / "CLAUDE.md").read_text()


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_copy_templates_handles_empty_template_dir(tmp_dir, tmp_path):
    from goodvibes_cli.copy_templates import copy_templates
    empty = tmp_path / "empty_templates"
    empty.mkdir()
    # must not raise
    copy_templates(empty, tmp_dir)
