"""Tests for update_cmd."""
import re
import pathlib

import pytest
from typer.testing import CliRunner

from goodvibes_cli.main import app

runner = CliRunner()
_ANSI = re.compile(r'\x1b\[[0-9;]*m')


def test_update_shows_no_manifest_message_and_exits_0_when_goodvibes_json_absent(mocker):
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=None)
    result = runner.invoke(app, ["update"])
    assert result.exit_code == 0
    output = _ANSI.sub("", result.output)
    assert "manifest" in output.lower() or "v1.2.0" in output


def test_update_dry_run_prints_three_categories_without_writing(mocker):
    manifest = {"version": "1.0.0", "files": {"CLAUDE.md": "abc123"}}
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir")
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.update_cmd.list_template_files", return_value=[])
    mocker.patch("pathlib.Path.exists", return_value=False)
    mock_write = mocker.patch("goodvibes_cli.commands.update_cmd.write_manifest")
    mock_copy = mocker.patch("goodvibes_cli.commands.update_cmd.shutil.copy2")
    result = runner.invoke(app, ["update", "--dry-run"])
    assert result.exit_code == 0
    output = _ANSI.sub("", result.output)
    assert "dry run" in output.lower()
    mock_write.assert_not_called()
    mock_copy.assert_not_called()


def test_update_force_skips_confirm_prompt(mocker):
    manifest = {"version": "1.0.0", "files": {"CLAUDE.md": "abc123"}}
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir")
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.update_cmd.list_template_files", return_value=[])
    mocker.patch("pathlib.Path.exists", return_value=False)
    mock_confirm = mocker.patch("goodvibes_cli.commands.update_cmd.typer.confirm")
    mocker.patch("goodvibes_cli.commands.update_cmd.write_manifest")
    result = runner.invoke(app, ["update", "--force"])
    assert result.exit_code == 0
    mock_confirm.assert_not_called()


def test_update_prompts_confirm_before_overwriting_without_force(mocker):
    manifest = {"version": "1.0.0", "files": {"CLAUDE.md": "abc123"}}
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir")
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.update_cmd.list_template_files", return_value=[])
    mocker.patch("pathlib.Path.exists", return_value=False)
    mock_confirm = mocker.patch("goodvibes_cli.commands.update_cmd.typer.confirm", return_value=True)
    mocker.patch("goodvibes_cli.commands.update_cmd.write_manifest")
    result = runner.invoke(app, ["update"])
    mock_confirm.assert_called_once()


def test_update_calls_write_manifest_after_applying_changes(mocker):
    manifest = {"version": "1.0.0", "files": {"README.md": "abc123"}}
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir")
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.update_cmd.list_template_files", return_value=[])
    mocker.patch("pathlib.Path.exists", return_value=False)
    mock_write = mocker.patch("goodvibes_cli.commands.update_cmd.write_manifest")
    result = runner.invoke(app, ["update", "--force"])
    assert result.exit_code == 0
    mock_write.assert_called_once()


def test_update_skips_user_modified_files(mocker):
    """Files with a different SHA than the manifest are categorised as skip and excluded from write_manifest."""
    manifest = {"version": "1.0.0", "files": {"CLAUDE.md": "expectedsha"}}
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir")
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.update_cmd.list_template_files", return_value=[])
    # File exists with different content → real sha256 ≠ "expectedsha" → skip
    mocker.patch("pathlib.Path.exists", return_value=True)
    mocker.patch("pathlib.Path.read_bytes", return_value=b"user-modified content")
    mock_write = mocker.patch("goodvibes_cli.commands.update_cmd.write_manifest")
    result = runner.invoke(app, ["update", "--force"])
    assert result.exit_code == 0
    assert mock_write.called
    written_files = mock_write.call_args[0][1]
    assert "CLAUDE.md" not in written_files


def test_update_uses_merge_claude_for_claude_md(mocker, tmp_path):
    """CLAUDE.md is updated via merge_claude, never via shutil.copy2."""
    template_dir = tmp_path / "templates"
    template_dir.mkdir()
    (template_dir / "CLAUDE.md").write_text("# Template\n", encoding="utf-8")
    project_dir = tmp_path / "project"
    project_dir.mkdir()

    manifest = {"version": "1.0.0", "files": {"CLAUDE.md": "abc123"}}
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=template_dir)
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.update_cmd.list_template_files", return_value=[])
    # cwd → project_dir (no CLAUDE.md) so dest doesn't exist → overwrite
    mocker.patch("pathlib.Path.cwd", return_value=project_dir)
    mock_copy = mocker.patch("goodvibes_cli.commands.update_cmd.shutil.copy2")
    mock_merge = mocker.patch("goodvibes_cli.commands.update_cmd.merge_claude")
    mocker.patch("goodvibes_cli.commands.update_cmd.write_manifest")
    result = runner.invoke(app, ["update", "--force"])
    assert result.exit_code == 0
    mock_merge.assert_called_once()
    mock_copy.assert_not_called()
