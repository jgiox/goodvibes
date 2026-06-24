"""Test stubs for install_headroom — implement in Wave 1 (03-03-PLAN.md)."""
import pytest


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_install_headroom_uses_uv_when_found(mocker):
    from goodvibes_cli.install_headroom import install_headroom
    run = mocker.patch("goodvibes_cli.install_headroom.subprocess.run")
    mocker.patch("goodvibes_cli.install_headroom.shutil.which", return_value="/usr/bin/uv")
    install_headroom()
    args = run.call_args[0][0]
    assert args[0] == "uv"
    # must never use shell=True
    assert run.call_args[1].get("shell") is not True


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_install_headroom_falls_back_to_pipx_when_uv_absent(mocker):
    from goodvibes_cli.install_headroom import install_headroom
    run = mocker.patch("goodvibes_cli.install_headroom.subprocess.run")
    mocker.patch(
        "goodvibes_cli.install_headroom.shutil.which",
        side_effect=lambda cmd: "/usr/bin/pipx" if cmd == "pipx" else None,
    )
    install_headroom()
    args = run.call_args[0][0]
    assert args[0] == "pipx"


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_install_headroom_falls_back_to_pip_when_uv_pipx_absent(mocker):
    from goodvibes_cli.install_headroom import install_headroom
    run = mocker.patch("goodvibes_cli.install_headroom.subprocess.run")
    mocker.patch(
        "goodvibes_cli.install_headroom.shutil.which",
        side_effect=lambda cmd: "/usr/bin/pip3" if cmd == "pip3" else None,
    )
    install_headroom()
    args = run.call_args[0][0]
    assert args[0] == "pip3"


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_install_headroom_raises_or_warns_when_all_absent(mocker):
    from goodvibes_cli.install_headroom import install_headroom
    mocker.patch("goodvibes_cli.install_headroom.shutil.which", return_value=None)
    # must not raise unhandled exception; logs warning or raises InstallError
    with pytest.raises(Exception):
        install_headroom()


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_install_headroom_soft_fails_on_called_process_error(mocker):
    import subprocess
    from goodvibes_cli.install_headroom import install_headroom
    mocker.patch("goodvibes_cli.install_headroom.shutil.which", return_value="/usr/bin/uv")
    mocker.patch(
        "goodvibes_cli.install_headroom.subprocess.run",
        side_effect=subprocess.CalledProcessError(1, "uv"),
    )
    # CalledProcessError on headroom install must not crash the entire init
    install_headroom()  # must return (soft-fail), not raise


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_install_headroom_skips_when_python_absent(mocker):
    from goodvibes_cli.install_headroom import install_headroom
    mocker.patch("goodvibes_cli.install_headroom.shutil.which", return_value=None)
    # must not raise — just warn and return
    install_headroom()


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_install_headroom_logs_onnx_warning(mocker, capfd):
    from goodvibes_cli.install_headroom import install_headroom
    mocker.patch("goodvibes_cli.install_headroom.shutil.which", return_value="/usr/bin/uv")
    mocker.patch("goodvibes_cli.install_headroom.subprocess.run")
    install_headroom()
    # ONNX model download warning must appear in output
    captured = capfd.readouterr()
    assert "ONNX" in captured.out or "onnx" in captured.out.lower() or True  # stub


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_install_headroom_never_uses_shell_true(mocker):
    from goodvibes_cli.install_headroom import install_headroom
    run = mocker.patch("goodvibes_cli.install_headroom.subprocess.run")
    mocker.patch("goodvibes_cli.install_headroom.shutil.which", return_value="/usr/bin/uv")
    install_headroom()
    for call in run.call_args_list:
        assert call[1].get("shell") is not True
