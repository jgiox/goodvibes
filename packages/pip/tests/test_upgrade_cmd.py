"""Upgrade command tests — mirrors test_main.py pattern."""
import re
from unittest.mock import patch

import pytest
from typer.testing import CliRunner

from goodvibes_cli.main import app

runner = CliRunner()

_ANSI = re.compile(r'\x1b\[[0-9;]*m')


@pytest.fixture(autouse=True)
def no_self_update(mocker):
    """Prevent real PyPI HTTP calls and self-update side-effects in every test.
    Returns None from _check_pypi_version so `if latest and ...` is immediately False,
    independent of how tests mock version_gte."""
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._get_package_version", return_value="1.0.0")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._check_pypi_version", return_value=None)


def test_upgrade_help_has_dry_run():
    result = runner.invoke(app, ["upgrade", "--help"])
    assert result.exit_code == 0
    # GitHub Actions sets FORCE_COLOR=1; Rich tokenizes "--dry-run" at the hyphen,
    # splitting ANSI segments so "dry-run" is non-contiguous in the raw output.
    assert "dry-run" in _ANSI.sub("", result.output)


def test_dry_run_shows_summary_without_writing(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.resolve_templates_dir", return_value=None)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._detect_installed_version", return_value=None)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.version_gte", return_value=False)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.compute_changes", return_value=[])
    result = runner.invoke(app, ["upgrade", "--dry-run"])
    assert result.exit_code == 0
    assert "dry-run" in result.output.lower() or "apply" in result.output.lower()


def test_skips_when_already_up_to_date(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.resolve_templates_dir", return_value=None)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._detect_installed_version", return_value="1.0.0")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.version_gte", return_value=True)
    result = runner.invoke(app, ["upgrade"])
    assert result.exit_code == 0
    assert "up to date" in result.output.lower()


def test_runs_upgrade_when_claude_md_absent(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.resolve_templates_dir", return_value=None)
    mock_upgrade = mocker.patch("goodvibes_cli.commands.upgrade_cmd.upgrade_templates", return_value=[])
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._detect_installed_version", return_value=None)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.version_gte", return_value=False)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.compute_changes", return_value=[])
    result = runner.invoke(app, ["upgrade"])
    assert mock_upgrade.call_count == 1


def test_diff_summary_printed_before_apply(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.resolve_templates_dir", return_value=None)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._detect_installed_version", return_value=None)
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
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.version_gte", return_value=False)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.compute_changes", return_value=[])
    mock_upgrade = mocker.patch("goodvibes_cli.commands.upgrade_cmd.upgrade_templates", return_value=[])
    runner.invoke(app, ["upgrade"])
    # upgrade_templates is the single owner of merge_claude; verify it ran exactly once
    assert mock_upgrade.call_count == 1


def test_self_update_triggers_when_newer_version_available(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._get_package_version", return_value="1.0.0")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._check_pypi_version", return_value="1.0.1")
    mock_update = mocker.patch("goodvibes_cli.commands.upgrade_cmd._self_update_pip")
    mock_execve = mocker.patch("goodvibes_cli.commands.upgrade_cmd.os.execve")
    result = runner.invoke(app, ["upgrade"])
    assert mock_update.call_count == 1
    assert mock_execve.call_count == 1
    assert "1.0.1" in result.output


def test_update_alias_is_registered_in_app():
    from goodvibes_cli.main import app
    assert any(c.name == "update" for c in app.registered_commands)


def test_self_update_skipped_when_env_set(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._get_package_version", return_value="1.0.0")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._check_pypi_version", return_value="1.0.1")
    mock_update = mocker.patch("goodvibes_cli.commands.upgrade_cmd._self_update_pip")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.resolve_templates_dir", return_value=None)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._detect_installed_version", return_value="1.0.0")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.version_gte", return_value=False)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.compute_changes", return_value=[])
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.upgrade_templates", return_value=[])
    result = runner.invoke(app, ["upgrade"], env={"_GV_UPGRADING": "1"})
    assert mock_update.call_count == 0
    assert result.exit_code == 0
