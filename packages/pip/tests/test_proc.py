"""Unit tests for proc: tools run from PATH only, never from the project folder (subprocess is mocked)."""
import os

import pytest

from goodvibes_cli.utils import proc


def test_run_tells_the_child_not_to_search_the_current_folder_for_programs(mocker, monkeypatch):
    monkeypatch.setenv("GV_TEST_KEPT", "yes")
    run = mocker.patch("goodvibes_cli.utils.proc.subprocess.run")
    proc.run(["git", "status"], capture_output=True)
    assert run.call_args.args[0] == ["git", "status"]
    assert run.call_args.kwargs["env"]["NoDefaultCurrentDirectoryInExePath"] == "1"
    assert run.call_args.kwargs["env"]["GV_TEST_KEPT"] == "yes"
    assert run.call_args.kwargs["capture_output"] is True


def test_which_off_windows_is_shutil_which(mocker):
    mocker.patch("goodvibes_cli.utils.proc.WINDOWS", False)
    mocker.patch("goodvibes_cli.utils.proc.shutil.which", return_value="/usr/bin/git")
    assert proc.which("git") == "/usr/bin/git"


@pytest.fixture
def windows(mocker, tmp_path, monkeypatch):
    mocker.patch("goodvibes_cli.utils.proc.WINDOWS", True)
    project = tmp_path / "project"
    project.mkdir()
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    monkeypatch.chdir(project)
    monkeypatch.setenv("PATHEXT", ".exe;.cmd")
    return project, bin_dir


def test_run_on_windows_calls_claude_cmd_by_its_full_path_from_path(mocker, windows, monkeypatch):
    _, bin_dir = windows
    (bin_dir / "claude.cmd").write_text("")
    monkeypatch.setenv("PATH", str(bin_dir))
    run = mocker.patch("goodvibes_cli.utils.proc.subprocess.run")
    proc.run(["claude", "mcp", "list"])
    assert run.call_args.args[0] == [str(bin_dir / "claude.cmd"), "mcp", "list"]


def test_run_on_windows_never_runs_a_git_cmd_shipped_in_the_project_folder(mocker, windows, monkeypatch):
    project, bin_dir = windows
    (project / "git.cmd").write_text("")
    (bin_dir / "git.exe").write_text("")
    monkeypatch.setenv("PATH", os.pathsep.join(["", ".", str(bin_dir)]))
    run = mocker.patch("goodvibes_cli.utils.proc.subprocess.run")
    proc.run(["git", "status"])
    assert run.call_args.args[0] == [str(bin_dir / "git.exe"), "status"]


def test_run_on_windows_reports_a_program_found_only_in_the_project_folder_as_missing(mocker, windows, monkeypatch):
    project, _ = windows
    (project / "git.cmd").write_text("")
    monkeypatch.setenv("PATH", ".")
    run = mocker.patch("goodvibes_cli.utils.proc.subprocess.run")
    with pytest.raises(FileNotFoundError):
        proc.run(["git", "status"])
    run.assert_not_called()


def test_run_on_windows_keeps_an_absolute_program_path(mocker, windows):
    _, bin_dir = windows
    python = str(bin_dir / "python.exe")
    run = mocker.patch("goodvibes_cli.utils.proc.subprocess.run")
    proc.run([python, "-m", "pip"])
    assert run.call_args.args[0] == [python, "-m", "pip"]


def test_run_off_windows_gives_the_child_a_path_without_dot_empty_relative_or_project_folders(mocker, tmp_path, monkeypatch):
    mocker.patch("goodvibes_cli.utils.proc.WINDOWS", False)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PATH", os.pathsep.join([".", "", "bin", str(tmp_path / "bin"), str(tmp_path), "/usr/bin", "/bin"]))
    run = mocker.patch("goodvibes_cli.utils.proc.subprocess.run")
    proc.run(["headroom", "mcp", "status"])
    assert run.call_args.args[0] == ["headroom", "mcp", "status"]
    assert run.call_args.kwargs["env"]["PATH"] == os.pathsep.join(["/usr/bin", "/bin"])


def test_which_off_windows_ignores_a_program_that_only_dot_or_the_project_folder_on_path_would_find(mocker, tmp_path, monkeypatch):
    mocker.patch("goodvibes_cli.utils.proc.WINDOWS", False)
    tool = tmp_path / "headroom"
    tool.write_text("#!/bin/sh\n")
    tool.chmod(0o755)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PATH", os.pathsep.join([".", str(tmp_path)]))
    assert proc.which("headroom") is None
