"""Tests for install_headroom — Wave 1b (03-03-PLAN.md).

All subprocess calls are mocked; no real uv/pipx/pip/python runs during the suite.
detect_python is mocked at the install_headroom module boundary.
"""
import subprocess

import pytest


def test_uv_found_and_succeeds(mocker):
    """install_headroom calls uv tool install when uv is available and logs ONNX warning."""
    mocker.patch(
        "goodvibes_cli.steps.install_headroom.detect_python",
        return_value="python3",
    )
    # probe raises FileNotFoundError → fall through to installer loop
    def side_effect(cmd_list, **kwargs):
        if cmd_list == ["headroom", "compress", "--help"]:
            raise FileNotFoundError("headroom not found")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")
    run = mocker.patch(
        "goodvibes_cli.steps.install_headroom.subprocess.run",
        side_effect=side_effect,
    )
    from goodvibes_cli.steps.install_headroom import install_headroom

    log_calls: list[str] = []
    result = install_headroom(log_calls.append)

    # ONNX / compression model warning must be logged
    assert any("ONNX" in m or "compression model" in m for m in log_calls)
    # call_args_list[0] is probe; call_args_list[1] is uv installer
    first_call_args = run.call_args_list[1][0][0]
    assert first_call_args[0] == "uv"
    assert first_call_args == ["uv", "tool", "install", "headroom-ai[all]"]
    assert result["status"] == "installed"


def test_pipx_fallback_when_uv_enoent(mocker):
    """install_headroom falls back to pipx when uv raises FileNotFoundError."""
    mocker.patch(
        "goodvibes_cli.steps.install_headroom.detect_python",
        return_value="python3",
    )

    def side_effect(cmd_list, **kwargs):
        if cmd_list == ["headroom", "compress", "--help"]:
            raise FileNotFoundError("headroom not found")
        if cmd_list[0] == "uv":
            raise FileNotFoundError("uv not found")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

    run = mocker.patch(
        "goodvibes_cli.steps.install_headroom.subprocess.run",
        side_effect=side_effect,
    )
    from goodvibes_cli.steps.install_headroom import install_headroom

    log_calls: list[str] = []
    result = install_headroom(log_calls.append)

    called_cmds = [c[0][0][0] for c in run.call_args_list]
    assert "pipx" in called_cmds
    assert result["status"] == "installed"


def test_pip_fallback_when_uv_and_pipx_enoent(mocker):
    """install_headroom falls back to pip --user when uv and pipx both raise FileNotFoundError."""
    mocker.patch(
        "goodvibes_cli.steps.install_headroom.detect_python",
        return_value="python3",
    )

    def side_effect(cmd_list, **kwargs):
        if cmd_list == ["headroom", "compress", "--help"]:
            raise FileNotFoundError("headroom not found")
        if cmd_list[0] in ("uv", "pipx"):
            raise FileNotFoundError(f"{cmd_list[0]} not found")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

    run = mocker.patch(
        "goodvibes_cli.steps.install_headroom.subprocess.run",
        side_effect=side_effect,
    )
    from goodvibes_cli.steps.install_headroom import install_headroom

    log_calls: list[str] = []
    result = install_headroom(log_calls.append)

    pip_calls = [c[0][0] for c in run.call_args_list if c[0][0][0] == "python3"]
    assert pip_calls, "Expected python3 -m pip call"
    assert pip_calls[0][1:3] == ["-m", "pip"]
    assert result["status"] == "installed"


def test_all_enoent_logs_warning(mocker):
    """install_headroom logs 'could not be installed' when all three raise FileNotFoundError."""
    mocker.patch(
        "goodvibes_cli.steps.install_headroom.detect_python",
        return_value="python3",
    )
    # global FileNotFoundError applies to probe and all 3 installers
    mocker.patch(
        "goodvibes_cli.steps.install_headroom.subprocess.run",
        side_effect=FileNotFoundError("not found"),
    )
    from goodvibes_cli.steps.install_headroom import install_headroom

    log_calls: list[str] = []
    result = install_headroom(log_calls.append)

    assert any("could not be installed" in m for m in log_calls)
    assert result["status"] == "failed"


def test_called_process_error_soft_fail(mocker):
    """install_headroom tries all three installers when every one raises CalledProcessError (CR-03)."""
    mocker.patch(
        "goodvibes_cli.steps.install_headroom.detect_python",
        return_value="python3",
    )
    run = mocker.patch(
        "goodvibes_cli.steps.install_headroom.subprocess.run",
        side_effect=subprocess.CalledProcessError(
            returncode=1,
            cmd=["uv", "tool", "install", "headroom-ai[all]"],
            stderr="build failed: no C++ compiler",
        ),
    )
    from goodvibes_cli.steps.install_headroom import install_headroom

    log_calls: list[str] = []
    # must not raise — soft-fail
    result = install_headroom(log_calls.append)

    # probe (1) + 3 installers (3) = 4 total calls
    assert run.call_count == 4
    assert any("install failed" in m for m in log_calls)
    assert result["status"] == "failed"


def test_pipx_fallback_when_uv_called_process_error(mocker):
    """install_headroom continues to pipx when uv raises CalledProcessError (CR-03 chain)."""
    mocker.patch(
        "goodvibes_cli.steps.install_headroom.detect_python",
        return_value="python3",
    )

    def side_effect(cmd_list, **kwargs):
        if cmd_list == ["headroom", "compress", "--help"]:
            raise FileNotFoundError("headroom not found")
        if cmd_list[0] == "uv":
            raise subprocess.CalledProcessError(1, cmd_list, stderr="network timeout")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

    run = mocker.patch(
        "goodvibes_cli.steps.install_headroom.subprocess.run",
        side_effect=side_effect,
    )
    from goodvibes_cli.steps.install_headroom import install_headroom

    log_calls: list[str] = []
    result = install_headroom(log_calls.append)

    called_cmds = [c[0][0][0] for c in run.call_args_list]
    assert "pipx" in called_cmds
    assert result["status"] == "installed"


def test_python_absent_skips(mocker):
    """install_headroom logs skip message and returns immediately when Python 3.10+ not found."""
    mocker.patch(
        "goodvibes_cli.steps.install_headroom.detect_python",
        return_value=None,
    )
    run = mocker.patch("goodvibes_cli.steps.install_headroom.subprocess.run")
    from goodvibes_cli.steps.install_headroom import install_headroom

    log_calls: list[str] = []
    result = install_headroom(log_calls.append)

    assert any("Python 3.10+ not found" in m for m in log_calls)
    # no installer subprocess should be called
    run.assert_not_called()
    assert result["status"] == "skipped"


def test_onnx_warning_logged_before_subprocess(mocker):
    """ONNX warning must be logged before the first installer subprocess.run call."""
    mocker.patch(
        "goodvibes_cli.steps.install_headroom.detect_python",
        return_value="python3",
    )
    event_log: list[str] = []

    def recording_run(cmd_list, **kwargs):
        event_log.append(f"subprocess:{cmd_list[0]}")
        if cmd_list == ["headroom", "compress", "--help"]:
            raise FileNotFoundError("headroom not found")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

    mocker.patch(
        "goodvibes_cli.steps.install_headroom.subprocess.run",
        side_effect=recording_run,
    )

    def recording_log(msg: str) -> None:
        event_log.append(f"log:{msg}")

    from goodvibes_cli.steps.install_headroom import install_headroom

    install_headroom(recording_log)

    onnx_idx = next(
        (i for i, e in enumerate(event_log) if e.startswith("log:") and ("ONNX" in e or "compression model" in e)),
        None,
    )
    installer_idx = next(
        (i for i, e in enumerate(event_log)
         if e.startswith("subprocess:") and e != "subprocess:headroom"),
        None,
    )
    assert onnx_idx is not None, "ONNX warning must be logged"
    assert installer_idx is not None, "installer subprocess.run must be called"
    assert onnx_idx < installer_idx, "ONNX warning must appear before the first installer subprocess call"


def test_no_shell_true(mocker):
    """subprocess.run must never be called with shell=True in install_headroom."""
    mocker.patch(
        "goodvibes_cli.steps.install_headroom.detect_python",
        return_value="python3",
    )
    def side_effect(cmd_list, **kwargs):
        if cmd_list == ["headroom", "compress", "--help"]:
            raise FileNotFoundError("headroom not found")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")
    run = mocker.patch(
        "goodvibes_cli.steps.install_headroom.subprocess.run",
        side_effect=side_effect,
    )
    from goodvibes_cli.steps.install_headroom import install_headroom

    install_headroom(lambda _: None)

    for call in run.call_args_list:
        assert call.kwargs.get("shell") is not True


def test_already_installed_skips_installer(mocker):
    """install_headroom logs 'already installed' and returns after probe exits 0 — no installer called."""
    mocker.patch(
        "goodvibes_cli.steps.install_headroom.detect_python",
        return_value="python3",
    )
    # probe returns exit 0 → already installed
    def side_effect(cmd_list, **kwargs):
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")
    run = mocker.patch(
        "goodvibes_cli.steps.install_headroom.subprocess.run",
        side_effect=side_effect,
    )

    from goodvibes_cli.steps.install_headroom import install_headroom

    log_calls: list[str] = []
    result = install_headroom(log_calls.append)

    assert any("already installed" in m for m in log_calls)
    assert run.call_count == 1  # probe IS a subprocess call; no installer calls
    assert result["status"] == "already-installed"


def test_probe_timeout_falls_through_to_installer(mocker):
    """install_headroom falls through to installer when compress --help times out."""
    mocker.patch("goodvibes_cli.steps.install_headroom.detect_python", return_value="python3")

    def side_effect(cmd_list, **kwargs):
        if cmd_list == ["headroom", "compress", "--help"]:
            raise subprocess.TimeoutExpired(cmd=cmd_list, timeout=10)
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

    run = mocker.patch("goodvibes_cli.steps.install_headroom.subprocess.run", side_effect=side_effect)
    from goodvibes_cli.steps.install_headroom import install_headroom
    log_calls: list[str] = []
    result = install_headroom(log_calls.append)
    assert result["status"] == "installed"
    called_cmds = [c[0][0][0] for c in run.call_args_list]
    assert "uv" in called_cmds


def test_description_logged_before_idempotency_check(mocker):
    """Description message is logged before any subprocess.run call."""
    mocker.patch(
        "goodvibes_cli.steps.install_headroom.detect_python",
        return_value="python3",
    )
    event_log: list[str] = []

    def recording_run(cmd_list, **kwargs):
        event_log.append(f"subprocess:{cmd_list[0]}")
        if cmd_list == ["headroom", "compress", "--help"]:
            raise FileNotFoundError("headroom not found")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

    mocker.patch("goodvibes_cli.steps.install_headroom.subprocess.run", side_effect=recording_run)

    def recording_log(msg: str) -> None:
        event_log.append(f"log:{msg}")

    from goodvibes_cli.steps.install_headroom import install_headroom

    install_headroom(recording_log)

    desc_idx = next(
        (i for i, e in enumerate(event_log) if e.startswith("log:") and "headroom compresses" in e),
        None,
    )
    subprocess_idx = next((i for i, e in enumerate(event_log) if e.startswith("subprocess:")), None)
    assert desc_idx is not None, "Description must be logged"
    assert subprocess_idx is not None, "subprocess.run must be called"
    assert desc_idx < subprocess_idx, "Description must appear before the idempotency check"
