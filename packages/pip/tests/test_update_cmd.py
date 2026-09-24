"""Tests for update_cmd."""
import hashlib
import json
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
    # template_dir is a MagicMock so template_src.exists() is truthy; mock merge_claude to avoid real I/O
    mocker.patch("goodvibes_cli.commands.update_cmd.merge_claude")
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
    # template_dir is a MagicMock so template_src.exists() is truthy; mock merge_claude to avoid real I/O
    mocker.patch("goodvibes_cli.commands.update_cmd.merge_claude")
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
    # template_dir is a MagicMock so template_src.exists() is truthy; mock copy2 to avoid real I/O
    mocker.patch("goodvibes_cli.commands.update_cmd.shutil.copy2")
    mock_write = mocker.patch("goodvibes_cli.commands.update_cmd.write_manifest")
    result = runner.invoke(app, ["update", "--force"])
    assert result.exit_code == 0
    mock_write.assert_called_once()


def test_update_skips_user_modified_files(mocker):
    """Files with a different SHA than the manifest are categorised as skip and excluded from write_manifest.

    Uses a non-CLAUDE.md fixture — CLAUDE.md is always routed to overwrite via
    merge_claude regardless of whole-file hash; see test_update_refreshes_claude_block_*.
    """
    manifest = {"version": "1.0.0", "files": {"docs/onboarding.md": "expectedsha"}}
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
    assert "docs/onboarding.md" not in written_files


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


def test_update_keeps_user_modified_file_across_two_runs(mocker, tmp_path):
    """A file skipped as user-modified on run 1 must not be reclassified as net-new (and overwritten) on run 2."""
    template_dir = tmp_path / "templates"
    template_dir.mkdir()
    original_content = "template content v1\n"
    (template_dir / "tracked.md").write_text(original_content, encoding="utf-8")

    project_dir = tmp_path / "project"
    project_dir.mkdir()
    user_content = "user edited this file\n"
    (project_dir / "tracked.md").write_text(user_content, encoding="utf-8")
    (project_dir / ".goodvibes.json").write_text(
        json.dumps(
            {
                "version": "1.0.0",
                "files": {"tracked.md": hashlib.sha256(original_content.encode("utf-8")).hexdigest()},
            }
        ),
        encoding="utf-8",
    )

    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=template_dir)
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("pathlib.Path.cwd", return_value=project_dir)

    result = runner.invoke(app, ["update", "--force"])
    assert result.exit_code == 0
    assert (project_dir / "tracked.md").read_text(encoding="utf-8") == user_content

    result2 = runner.invoke(app, ["update", "--force"])
    assert result2.exit_code == 0
    assert (project_dir / "tracked.md").read_text(encoding="utf-8") == user_content


def test_update_refreshes_claude_block_and_preserves_outside_content(mocker, tmp_path):
    """CLAUDE.md's sentinel block refreshes via update even when the whole-file hash never matches."""
    template_dir = tmp_path / "templates"
    template_dir.mkdir()
    template_claude_md = (
        "<!-- goodvibes:start -->\n# goodvibes: v2.0.0\n\nnew rules\n<!-- goodvibes:end -->\n"
    )
    (template_dir / "CLAUDE.md").write_text(template_claude_md, encoding="utf-8")

    project_dir = tmp_path / "project"
    project_dir.mkdir()
    # Manifest records the hash as written by init (block only, no custom prose yet).
    initial_claude_md = (
        "<!-- goodvibes:start -->\n# goodvibes: v1.0.0\n\nold rules\n<!-- goodvibes:end -->\n"
    )
    # The user then appended custom prose outside the block — the whole-file hash no
    # longer matches the manifest even though the sentinel block itself is untouched.
    existing_claude_md = "# My Project\n\nCustom prose that must survive.\n\n" + initial_claude_md
    (project_dir / "CLAUDE.md").write_text(existing_claude_md, encoding="utf-8")
    (project_dir / ".goodvibes.json").write_text(
        json.dumps(
            {
                "version": "1.0.0",
                "files": {"CLAUDE.md": hashlib.sha256(initial_claude_md.encode("utf-8")).hexdigest()},
            }
        ),
        encoding="utf-8",
    )

    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=template_dir)
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch("pathlib.Path.cwd", return_value=project_dir)

    result = runner.invoke(app, ["update", "--force"])
    assert result.exit_code == 0
    updated = (project_dir / "CLAUDE.md").read_text(encoding="utf-8")
    assert "Custom prose that must survive." in updated
    assert "new rules" in updated
    assert "old rules" not in updated
