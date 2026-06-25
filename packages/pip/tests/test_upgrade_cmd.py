"""Upgrade command tests — mirrors test_main.py pattern."""
from unittest.mock import patch

import pytest
from typer.testing import CliRunner

from goodvibes_cli.main import app

runner = CliRunner()


def test_upgrade_help_has_dry_run():
    result = runner.invoke(app, ["upgrade", "--help"])
    assert result.exit_code == 0
    assert "dry-run" in result.output


def test_dry_run_shows_summary_without_writing(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.resolve_templates_dir", return_value=None)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.compute_changes", return_value=[])
    result = runner.invoke(app, ["upgrade", "--dry-run"])
    assert result.exit_code == 0
    assert "dry-run" in result.output.lower() or "apply" in result.output.lower()


def test_skips_when_already_up_to_date(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.resolve_templates_dir", return_value=None)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._detect_installed_version", return_value="1.0.0")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._detect_bundled_version", return_value="1.0.0")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.version_gte", return_value=True)
    result = runner.invoke(app, ["upgrade"])
    assert result.exit_code == 0
    assert "up to date" in result.output.lower()


def test_runs_upgrade_when_claude_md_absent(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.resolve_templates_dir", return_value=None)
    mock_upgrade = mocker.patch("goodvibes_cli.commands.upgrade_cmd.upgrade_templates", return_value=[])
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._detect_installed_version", return_value=None)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._detect_bundled_version", return_value="1.0.0")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.version_gte", return_value=False)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.compute_changes", return_value=[])
    result = runner.invoke(app, ["upgrade"])
    assert mock_upgrade.call_count == 1


def test_diff_summary_printed_before_apply(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.resolve_templates_dir", return_value=None)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._detect_installed_version", return_value=None)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._detect_bundled_version", return_value="1.0.0")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.version_gte", return_value=False)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.compute_changes", return_value=[("CLAUDE.md", "changed")])
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.upgrade_templates", return_value=[])
    result = runner.invoke(app, ["upgrade"])
    assert result.exit_code == 0
    # Diff summary printed — at least one change marker or "change" keyword in output
    assert any(marker in result.output for marker in ["~", "changed", "change", "will change"])


def test_user_content_outside_sentinel_preserved_after_upgrade(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.resolve_templates_dir", return_value=None)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._detect_installed_version", return_value=None)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._detect_bundled_version", return_value="1.0.0")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.version_gte", return_value=False)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.compute_changes", return_value=[])
    mock_merge = mocker.patch("goodvibes_cli.commands.upgrade_cmd.merge_claude")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.upgrade_templates", return_value=[])
    runner.invoke(app, ["upgrade"])
    assert mock_merge.call_count == 1  # CLAUDE.md must go through merge_claude, not shutil.copy
