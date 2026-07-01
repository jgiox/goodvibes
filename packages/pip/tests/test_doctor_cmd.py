"""Unit tests for doctor_cmd — VCC-02 Python parity test coverage."""
from __future__ import annotations

import pathlib
import subprocess
from unittest.mock import MagicMock, patch

import pytest
import typer
from typer.testing import CliRunner

from goodvibes_cli.commands.doctor_cmd import (
    CheckResult,
    _check_claude_md,
    _check_git_config,
    _check_headroom,
    _check_sentinel,
    doctor_cmd,
)

runner = CliRunner()


def test_check_headroom_returns_pass_when_headroom_on_path(mocker):
    mocker.patch("goodvibes_cli.commands.doctor_cmd.shutil.which", return_value="/usr/bin/headroom")
    result = _check_headroom()
    assert result.passed is True


def test_check_headroom_returns_fail_with_remedy_when_not_on_path(mocker):
    mocker.patch("goodvibes_cli.commands.doctor_cmd.shutil.which", return_value=None)
    result = _check_headroom()
    assert result.passed is False
    assert "uv tool install" in result.remedy


def test_check_git_config_returns_pass_when_name_set(mocker):
    mock_result = MagicMock()
    mock_result.stdout = "Jane Doe"
    mock_result.returncode = 0
    mocker.patch("goodvibes_cli.commands.doctor_cmd.subprocess.run", return_value=mock_result)
    result = _check_git_config("user.name")
    assert result.passed is True


def test_check_git_config_returns_fail_with_remedy_when_not_set(mocker):
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        side_effect=subprocess.CalledProcessError(1, ["git", "config", "user.name"]),
    )
    result = _check_git_config("user.name")
    assert result.passed is False
    assert "git config --global user.name" in result.remedy


def test_check_claude_md_returns_pass_when_file_exists(tmp_path):
    (tmp_path / "CLAUDE.md").write_text("# goodvibes")
    assert _check_claude_md(tmp_path).passed is True


def test_check_claude_md_returns_fail_when_file_absent(tmp_path):
    assert _check_claude_md(tmp_path).passed is False


def test_check_sentinel_returns_pass_when_both_markers_present(tmp_path):
    (tmp_path / "CLAUDE.md").write_text("<!-- goodvibes:start -->\ncontent\n<!-- goodvibes:end -->")
    assert _check_sentinel(tmp_path).passed is True


def test_check_sentinel_returns_fail_when_sentinel_missing(tmp_path):
    (tmp_path / "CLAUDE.md").write_text("# just a header, no sentinel")
    assert _check_sentinel(tmp_path).passed is False


def test_doctor_cmd_raises_exit_1_when_any_check_fails(mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_headroom", return_value=CheckResult(label="headroom on PATH", passed=False, remedy="Run: uv tool install"))
    # _check_git_config is called twice (user.name, user.email); return pass for both
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_git_config", return_value=CheckResult(label="git user.name", passed=True))
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_claude_md", return_value=CheckResult(label="CLAUDE.md present", passed=True))
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_sentinel", return_value=CheckResult(label="goodvibes sentinel block", passed=True))
    mocker.patch("goodvibes_cli.commands.doctor_cmd.pathlib.Path.cwd", return_value=tmp_path)
    with pytest.raises(typer.Exit) as exc:
        doctor_cmd()
    assert exc.value.exit_code == 1


def test_doctor_cmd_does_not_raise_when_all_checks_pass(mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_headroom", return_value=CheckResult(label="headroom on PATH", passed=True))
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_git_config", return_value=CheckResult(label="git user.name", passed=True))
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_claude_md", return_value=CheckResult(label="CLAUDE.md present", passed=True))
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_sentinel", return_value=CheckResult(label="goodvibes sentinel block", passed=True))
    mocker.patch("goodvibes_cli.commands.doctor_cmd.pathlib.Path.cwd", return_value=tmp_path)
    # Should complete without raising typer.Exit
    doctor_cmd()


def test_doctor_cmd_collects_all_failures_before_exiting(mocker, tmp_path):
    from goodvibes_cli.main import app

    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_headroom", return_value=CheckResult(label="headroom on PATH", passed=False, remedy="Run: uv tool install"))
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_git_config", side_effect=[
        CheckResult(label="git user.name", passed=False, remedy='Run: git config --global user.name "Your Value"'),
        CheckResult(label="git user.email", passed=True),
    ])
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_claude_md", return_value=CheckResult(label="CLAUDE.md present", passed=True))
    mocker.patch("goodvibes_cli.commands.doctor_cmd._check_sentinel", return_value=CheckResult(label="goodvibes sentinel block", passed=True))
    mocker.patch("goodvibes_cli.commands.doctor_cmd.pathlib.Path.cwd", return_value=tmp_path)

    result = runner.invoke(app, ["doctor"])

    assert result.exit_code == 1
    # Both failure labels must appear in output before exit — collect-all behavior
    assert "headroom" in result.output
    assert "user.name" in result.output
