"""Test stubs for configure_mcp — implement in Wave 1 (03-03-PLAN.md)."""
import pytest


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_configure_mcp_is_idempotent_when_already_registered(mocker):
    from goodvibes_cli.configure_mcp import configure_mcp
    run = mocker.patch("goodvibes_cli.configure_mcp.subprocess.run")
    # Simulate already-registered state; second call must not re-register
    configure_mcp()
    configure_mcp()
    # headroom mcp registration must not be called twice
    assert run.call_count <= 1


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_configure_mcp_uses_claude_mcp_add_as_primary(mocker):
    from goodvibes_cli.configure_mcp import configure_mcp
    run = mocker.patch("goodvibes_cli.configure_mcp.subprocess.run")
    mocker.patch("goodvibes_cli.configure_mcp.shutil.which", return_value="/usr/bin/claude")
    configure_mcp()
    args = run.call_args[0][0]
    assert "claude" in args[0] or "mcp" in " ".join(args)


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_configure_mcp_falls_back_to_headroom_mcp_install(mocker):
    from goodvibes_cli.configure_mcp import configure_mcp
    run = mocker.patch("goodvibes_cli.configure_mcp.subprocess.run")
    mocker.patch(
        "goodvibes_cli.configure_mcp.shutil.which",
        side_effect=lambda cmd: None if cmd == "claude" else "/usr/bin/headroom",
    )
    configure_mcp()
    args = run.call_args[0][0]
    assert "headroom" in args[0] or "mcp" in " ".join(args)


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_configure_mcp_is_safe_when_headroom_not_found(mocker):
    from goodvibes_cli.configure_mcp import configure_mcp
    mocker.patch("goodvibes_cli.configure_mcp.shutil.which", return_value=None)
    # FileNotFoundError / ENOENT must not crash; must warn and return
    configure_mcp()  # must not raise


@pytest.mark.skip(reason="stub — implement in Wave 1")
def test_configure_mcp_warns_when_claude_config_dir_missing(mocker, capfd):
    from goodvibes_cli.configure_mcp import configure_mcp
    mocker.patch("goodvibes_cli.configure_mcp.shutil.which", return_value=None)
    configure_mcp()
    captured = capfd.readouterr()
    # warning about CLAUDE_CONFIG_DIR or MCP config must appear
    assert "CLAUDE_CONFIG_DIR" in captured.out or True  # stub
