"""Tests for init_cmd — Phase 6 UX hardening."""
import pathlib
import pytest
import typer
from typer.testing import CliRunner


@pytest.fixture
def runner():
    return CliRunner()


@pytest.fixture
def app():
    from goodvibes_cli.commands.init_cmd import init_cmd
    _app = typer.Typer()
    _app.command()(init_cmd)
    return _app


def test_non_empty_dir_prints_notice_before_tasks(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.init_cmd.copy_templates", return_value=(["CLAUDE.md"], []))
    mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom", return_value={"status": "installed", "reason": ""})
    mocker.patch("goodvibes_cli.commands.init_cmd.configure_mcp", return_value={"status": "registered", "reason": ""})
    # Simulate non-empty cwd
    mocker.patch("pathlib.Path.iterdir", return_value=iter([pathlib.Path("existing.txt")]))
    result = runner.invoke(app, ["--minimal"])
    assert result.exit_code == 0
    assert "non-empty" in result.output.lower() or "existing" in result.output.lower()


def test_completion_shows_files_written_and_skipped_panels(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.copy_templates",
        return_value=(["CLAUDE.md"], ["JOURNAL.md"]),
    )
    mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom", return_value={"status": "installed", "reason": ""})
    mocker.patch("goodvibes_cli.commands.init_cmd.configure_mcp", return_value={"status": "registered", "reason": ""})
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    result = runner.invoke(app, ["--minimal"])
    assert result.exit_code == 0
    assert "written" in result.output.lower()
    assert "skipped" in result.output.lower()
    assert "CLAUDE.md" in result.output
    assert "JOURNAL.md" in result.output


def test_permission_error_prints_plain_english_and_exits_1(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.copy_templates",
        side_effect=PermissionError("Permission denied"),
    )
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    result = runner.invoke(app, ["--minimal"])
    assert result.exit_code == 1
    assert "permission" in result.output.lower() or "error" in result.output.lower()


def test_normal_run_shows_headroom_panel(runner, app, mocker, tmp_path):
    """goodvibes init (non-minimal) shows Headroom Panel with actual install and MCP status."""
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.init_cmd.copy_templates", return_value=(["CLAUDE.md"], []))
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.install_headroom",
        return_value={"status": "installed", "reason": ""}
    )
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.configure_mcp",
        return_value={"status": "registered", "reason": ""}
    )
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    result = runner.invoke(app, [])
    assert result.exit_code == 0
    assert "Headroom" in result.output
    assert "headroom: installed" in result.output
    assert "MCP: registered" in result.output


def test_dry_run_minimal_excludes_github_and_docs(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.list_template_files",
        return_value=[
            "CLAUDE.md",
            ".github/workflows/ci.yml",
            "docs/onboarding.md",
            ".claude/skills/caveman/SKILL.md",
        ],
    )
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    result = runner.invoke(app, ["--dry-run", "--minimal"])
    assert result.exit_code == 0
    assert "CLAUDE.md" in result.output
    assert ".github" not in result.output
    assert "docs/onboarding.md" not in result.output
