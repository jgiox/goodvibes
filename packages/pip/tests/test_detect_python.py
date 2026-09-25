"""Unit tests for detect_python (subprocess is mocked)."""
import subprocess

from goodvibes_cli.utils.detect_python import detect_python


def _version(text):
    return lambda cmd, **kwargs: subprocess.CompletedProcess(args=cmd, returncode=0, stdout=text, stderr="")


def test_returns_python3_when_it_is_python_3_12(mocker):
    mocker.patch("goodvibes_cli.utils.proc.subprocess.run", side_effect=_version("Python 3.12.3"))
    assert detect_python() == "python3"


def test_returns_none_when_every_python_is_below_3_10(mocker):
    mocker.patch("goodvibes_cli.utils.proc.subprocess.run", side_effect=_version("Python 3.9.18"))
    assert detect_python() is None


def test_probes_python_without_searching_the_project_folder_for_it(mocker):
    run = mocker.patch("goodvibes_cli.utils.proc.subprocess.run", side_effect=FileNotFoundError())
    detect_python()
    assert [c.args[0][0] for c in run.call_args_list] == ["python3", "python", "py"]
    assert all(c.kwargs["env"]["NoDefaultCurrentDirectoryInExePath"] == "1" for c in run.call_args_list)
