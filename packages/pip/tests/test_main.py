"""CLI integration tests via typer.testing.CliRunner — RED phase."""
from unittest.mock import patch

import pytest
from typer.testing import CliRunner

from goodvibes_cli.main import app

runner = CliRunner()


def test_help_exits_zero():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0


def test_help_contains_goodvibes():
    result = runner.invoke(app, ["--help"])
    assert "goodvibes" in result.output


def test_init_help_has_dry_run():
    result = runner.invoke(app, ["init", "--help"])
    assert result.exit_code == 0
    assert "dry-run" in result.output


def test_init_help_has_minimal():
    result = runner.invoke(app, ["init", "--help"])
    assert "minimal" in result.output


def test_dry_run_no_files_written(tmp_path, mocker):
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.resolve_templates_dir",
        return_value=tmp_path,
    )
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.list_template_files",
        return_value=["CONTRIBUTING.md", "CLAUDE.md"],
    )
    result = runner.invoke(app, ["init", "--dry-run"])
    assert result.exit_code == 0
    assert "CONTRIBUTING.md" in result.output or "Dry run" in result.output
    # No real files written to tmp_path
    assert list(tmp_path.iterdir()) == []


def test_init_calls_copy_templates(mocker):
    mock_copy = mocker.patch(
        "goodvibes_cli.commands.init_cmd.copy_templates",
        return_value=[],
    )
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=None)
    mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom")
    mocker.patch("goodvibes_cli.commands.init_cmd.configure_mcp")
    result = runner.invoke(app, ["init"])
    assert mock_copy.call_count == 1


def test_minimal_skips_headroom(mocker):
    mocker.patch("goodvibes_cli.commands.init_cmd.copy_templates", return_value=[])
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=None)
    mock_headroom = mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom")
    mocker.patch("goodvibes_cli.commands.init_cmd.configure_mcp")
    result = runner.invoke(app, ["init", "--minimal"])
    assert mock_headroom.call_count == 0


def test_next_steps_in_output(mocker):
    mocker.patch("goodvibes_cli.commands.init_cmd.copy_templates", return_value=["CLAUDE.md"])
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=None)
    mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom")
    mocker.patch("goodvibes_cli.commands.init_cmd.configure_mcp")
    result = runner.invoke(app, ["init"])
    assert "ponytail" in result.output
