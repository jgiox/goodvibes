"""Upgrade command tests — mirrors test_main.py pattern."""
import hashlib
import json
import re
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
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.read_manifest", return_value={"version": "1.0.0", "files": {}})


def test_upgrade_help_has_dry_run():
    result = runner.invoke(app, ["upgrade", "--help"])
    assert result.exit_code == 0
    # GitHub Actions sets FORCE_COLOR=1; Rich tokenizes "--dry-run" at the hyphen,
    # splitting ANSI segments so "dry-run" is non-contiguous in the raw output.
    assert "dry-run" in _ANSI.sub("", result.output)


def test_self_update_triggers_when_newer_version_available(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._check_pypi_version", return_value="1.0.1")
    mock_update = mocker.patch("goodvibes_cli.commands.upgrade_cmd._self_update_pip")
    mock_execve = mocker.patch("goodvibes_cli.commands.upgrade_cmd.os.execve")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.update_cmd")
    result = runner.invoke(app, ["upgrade"])
    assert mock_update.call_count == 1
    assert mock_execve.call_count == 1
    assert "1.0.1" in result.output


def test_dry_run_does_not_install_and_previews_the_update(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._check_pypi_version", return_value="1.0.1")
    mock_self = mocker.patch("goodvibes_cli.commands.upgrade_cmd._self_update_pip")
    mock_update = mocker.patch("goodvibes_cli.commands.upgrade_cmd.update_cmd")
    result = runner.invoke(app, ["upgrade", "--dry-run"])
    assert result.exit_code == 0
    assert mock_self.call_count == 0
    mock_update.assert_called_once_with(dry_run=True, force=False)


def test_hands_project_files_to_update_when_already_newest(mocker):
    mock_update = mocker.patch("goodvibes_cli.commands.upgrade_cmd.update_cmd")
    result = runner.invoke(app, ["upgrade"])
    assert result.exit_code == 0
    mock_update.assert_called_once_with(dry_run=False, force=False)


def test_update_alias_is_registered_in_app():
    assert any(c.name == "update" for c in app.registered_commands)


def test_self_update_skipped_when_env_set(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._check_pypi_version", return_value="1.0.1")
    mock_self = mocker.patch("goodvibes_cli.commands.upgrade_cmd._self_update_pip")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.update_cmd")
    result = runner.invoke(app, ["upgrade"], env={"_GV_UPGRADING": "1"})
    assert mock_self.call_count == 0
    assert result.exit_code == 0


@pytest.fixture
def upgrade_dirs(mocker, tmp_path, monkeypatch):
    tpl = tmp_path / "tpl"
    (tpl / ".claude" / "skills" / "caveman").mkdir(parents=True)
    (tpl / "CLAUDE.md").write_text("# CLAUDE.md\n\n<!-- goodvibes:start -->\n# goodvibes: v9.9.9\nrules\n<!-- goodvibes:end -->\n")
    (tpl / ".claude" / "skills" / "caveman" / "SKILL.md").write_text("skill v2\n")
    proj = tmp_path / "proj"
    proj.mkdir()
    monkeypatch.chdir(proj)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir", return_value=tpl)
    return proj


def test_upgrade_does_not_copy_skills_into_a_global_scope_project(upgrade_dirs):
    (upgrade_dirs / "CLAUDE.md").write_text("# CLAUDE.md\n\n## Project\n")
    (upgrade_dirs / ".goodvibes.json").write_text(json.dumps({"version": "1.8.0", "files": {"CLAUDE.md": "x"}, "scope": "global"}))
    runner.invoke(app, ["upgrade"])
    assert not (upgrade_dirs / ".claude" / "skills").exists()
    assert (upgrade_dirs / "CLAUDE.md").read_text() == "# CLAUDE.md\n\n## Project\n"


def test_upgrade_does_not_overwrite_a_skill_file_the_user_edited(upgrade_dirs):
    skill = upgrade_dirs / ".claude" / "skills" / "caveman" / "SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text("my own edits\n")
    sha = hashlib.sha256(b"skill v1\n").hexdigest()
    (upgrade_dirs / ".goodvibes.json").write_text(json.dumps({"version": "1.0.0", "files": {".claude/skills/caveman/SKILL.md": sha}}))
    runner.invoke(app, ["upgrade"])
    assert skill.read_text() == "my own edits\n"


def _prefix(mocker, tmp_path, uv_tool):
    prefix = tmp_path / "env"
    prefix.mkdir()
    if uv_tool:
        (prefix / "uv-receipt.toml").write_text("[tool]\n")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.sys.prefix", str(prefix))


def test_self_update_installs_at_least_the_latest_version_so_a_pinned_uv_tool_is_replaced(mocker, tmp_path):
    from goodvibes_cli.commands.upgrade_cmd import _self_update_pip
    _prefix(mocker, tmp_path, uv_tool=True)
    run = mocker.patch("goodvibes_cli.commands.upgrade_cmd.subprocess.run")
    _self_update_pip("1.0.1")
    assert run.call_args_list[0].args[0] == ["uv", "tool", "install", "goodvibes-cli>=1.0.1"]


def test_self_update_upgrades_the_running_pip_install_instead_of_adding_a_separate_uv_tool(mocker, tmp_path):
    import sys
    from goodvibes_cli.commands.upgrade_cmd import _self_update_pip
    _prefix(mocker, tmp_path, uv_tool=False)
    run = mocker.patch("goodvibes_cli.commands.upgrade_cmd.subprocess.run")
    _self_update_pip("1.0.1")
    assert run.call_args_list[0].args[0] == [sys.executable, "-m", "pip", "install", "--upgrade", "goodvibes-cli>=1.0.1"]
    assert all(c.args[0][:3] != ["uv", "tool", "install"] for c in run.call_args_list)


def test_self_update_uses_uv_pip_for_the_running_interpreter_when_it_has_no_pip(mocker, tmp_path):
    import subprocess
    import sys
    from goodvibes_cli.commands.upgrade_cmd import _self_update_pip
    _prefix(mocker, tmp_path, uv_tool=False)
    run = mocker.patch("goodvibes_cli.commands.upgrade_cmd.subprocess.run",
                       side_effect=[subprocess.CalledProcessError(1, "pip"), None])
    _self_update_pip("1.0.1")
    assert run.call_args_list[1].args[0] == ["uv", "pip", "install", "--python", sys.executable, "--upgrade", "goodvibes-cli>=1.0.1"]


def test_self_update_stops_with_the_manual_command_when_every_installer_fails(mocker, tmp_path):
    import subprocess
    import typer
    from goodvibes_cli.commands.upgrade_cmd import _self_update_pip
    _prefix(mocker, tmp_path, uv_tool=False)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.subprocess.run", side_effect=subprocess.CalledProcessError(1, "x"))
    with pytest.raises(typer.Exit) as e:
        _self_update_pip("1.0.1")
    assert e.value.exit_code == 1


def test_self_update_failure_remedy_quotes_the_requirement_so_the_shell_does_not_treat_greater_than_as_a_redirect(mocker, tmp_path):
    import subprocess
    import typer
    from goodvibes_cli.commands.upgrade_cmd import _self_update_pip
    _prefix(mocker, tmp_path, uv_tool=True)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.subprocess.run", side_effect=subprocess.CalledProcessError(1, "uv"))
    printed = mocker.patch("goodvibes_cli.commands.upgrade_cmd.console.print")
    with pytest.raises(typer.Exit):
        _self_update_pip("1.0.1")
    assert "Run: uv tool install 'goodvibes-cli>=1.0.1'" in printed.call_args.args[0]


def test_upgrade_fails_loudly_instead_of_claiming_success_when_still_on_the_old_version(mocker):
    mock_update = mocker.patch("goodvibes_cli.commands.upgrade_cmd.update_cmd")
    result = runner.invoke(app, ["upgrade"], env={"_GV_UPGRADING": "1.0.1"})
    assert result.exit_code == 1
    mock_update.assert_not_called()
    assert "goodvibes-cli@latest" in _ANSI.sub("", result.output)


def test_self_update_re_runs_with_the_target_version_in_the_environment(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._check_pypi_version", return_value="1.0.1")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._self_update_pip")
    execve = mocker.patch("goodvibes_cli.commands.upgrade_cmd.os.execve")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.update_cmd")
    runner.invoke(app, ["upgrade"])
    assert execve.call_args.args[2]["_GV_UPGRADING"] == "1.0.1"


from goodvibes_cli.commands import upgrade_cmd as _upgrade_module  # noqa: E402

_REAL_CHECK_PYPI = _upgrade_module._check_pypi_version


@pytest.mark.parametrize("argv0", ["/home/u/.local/bin/goodvibes", "/src/goodvibes_cli/__main__.py"])
def test_self_update_re_runs_through_the_running_interpreter_as_python_m_goodvibes_cli(mocker, argv0):
    import sys
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._check_pypi_version", return_value="1.0.1")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._self_update_pip")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.sys.argv", [argv0, "upgrade"])
    execve = mocker.patch("goodvibes_cli.commands.upgrade_cmd.os.execve")
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.update_cmd")
    runner.invoke(app, ["upgrade"])
    assert execve.call_args.args[0] == sys.executable
    assert execve.call_args.args[1] == [sys.executable, "-m", "goodvibes_cli", "upgrade"]
    assert execve.call_args.args[2]["_GV_UPGRADING"] == "1.0.1"


def test_upgrade_under_uvx_installs_nothing_and_goes_straight_to_update(mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.sys.prefix", str(tmp_path / ".cache" / "uv" / "archive-v0" / "Ab12Cd"))
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._check_pypi_version", return_value="1.0.1")
    mock_self = mocker.patch("goodvibes_cli.commands.upgrade_cmd._self_update_pip")
    execve = mocker.patch("goodvibes_cli.commands.upgrade_cmd.os.execve")
    mock_update = mocker.patch("goodvibes_cli.commands.upgrade_cmd.update_cmd")
    result = runner.invoke(app, ["upgrade"])
    assert result.exit_code == 0
    mock_self.assert_not_called()
    execve.assert_not_called()
    mock_update.assert_called_once_with(dry_run=False, force=False)
    assert "uvx always runs the newest version" in _ANSI.sub("", result.output)


def test_upgrade_says_it_could_not_reach_pypi_instead_of_silently_continuing(mocker):
    import urllib.error
    mocker.patch("goodvibes_cli.commands.upgrade_cmd._check_pypi_version", _REAL_CHECK_PYPI)
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.urllib.request.urlopen", side_effect=urllib.error.URLError("no network"))
    mock_update = mocker.patch("goodvibes_cli.commands.upgrade_cmd.update_cmd")
    result = runner.invoke(app, ["upgrade"])
    out = " ".join(_ANSI.sub("", result.output).split())
    assert result.exit_code == 0
    assert "Could not check PyPI for a newer version (no network); updating with the installed version" in out
    mock_update.assert_called_once_with(dry_run=False, force=False)


def test_upgrade_says_the_install_worked_and_how_to_update_a_project_instead_of_the_no_manifest_error_when_this_folder_has_no_goodvibes_setup(mocker):
    mocker.patch("goodvibes_cli.commands.upgrade_cmd.read_manifest", return_value=None)
    mock_update = mocker.patch("goodvibes_cli.commands.upgrade_cmd.update_cmd")
    result = runner.invoke(app, ["upgrade"])
    assert result.exit_code == 0, result.output
    assert mock_update.call_count == 0
    out = " ".join(_ANSI.sub("", result.output).replace("│", " ").split())
    assert "Nothing to update here" in out
    assert (
        "goodvibes 1.0.0 is installed. This folder has no goodvibes setup, so there is nothing to update here. "
        "To update a project, go into its folder and run: goodvibes update "
        "To set up a new project, go into its folder and run: goodvibes init"
    ) in out


def test_self_update_runs_uv_without_searching_the_project_folder_for_it(mocker, tmp_path):
    from goodvibes_cli.commands.upgrade_cmd import _self_update_pip
    _prefix(mocker, tmp_path, uv_tool=True)
    run = mocker.patch("goodvibes_cli.commands.upgrade_cmd.subprocess.run")
    _self_update_pip("1.0.1")
    assert run.call_args.kwargs["env"]["NoDefaultCurrentDirectoryInExePath"] == "1"
