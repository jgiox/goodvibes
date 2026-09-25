"""Tests for configure_mcp — Wave 1b (03-03-PLAN.md).

All subprocess calls and shutil.which are mocked; no real claude/headroom runs during the suite.
"""
import subprocess

import pytest


def test_already_registered_via_mcp_status(mocker):
    """configure_mcp returns early when headroom mcp status exits 0 (already configured)."""
    def side_effect(cmd_list, **kwargs):
        if cmd_list[:3] == ["claude", "mcp", "get"]:
            return subprocess.CompletedProcess(args=cmd_list, returncode=1, stdout="", stderr="No MCP server found")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="configured", stderr="")

    run = mocker.patch("goodvibes_cli.steps.configure_mcp.subprocess.run", side_effect=side_effect)
    from goodvibes_cli.steps.configure_mcp import configure_mcp

    log_calls: list[str] = []
    result = configure_mcp(log_calls.append)

    assert any("already" in m for m in log_calls)
    # Must not proceed past the idempotency check
    assert [c.args[0] for c in run.call_args_list] == [["claude", "mcp", "get", "headroom"], ["headroom", "mcp", "status"]]
    assert result == {"status": "already-registered", "reason": ""}


def test_already_in_claude_mcp_list(mocker):
    """configure_mcp returns early when 'headroom' appears in claude mcp list output."""

    def side_effect(cmd_list, **kwargs):
        if cmd_list[:3] == ["claude", "mcp", "get"]:
            return subprocess.CompletedProcess(args=cmd_list, returncode=1, stdout="", stderr="No MCP server found")
        if cmd_list == ["headroom", "mcp", "status"]:
            raise subprocess.CalledProcessError(1, cmd_list)
        if cmd_list == ["claude", "mcp", "list"]:
            return subprocess.CompletedProcess(
                args=cmd_list, returncode=0, stdout="headroom: /usr/local/bin/headroom", stderr=""
            )
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

    run = mocker.patch(
        "goodvibes_cli.steps.configure_mcp.subprocess.run",
        side_effect=side_effect,
    )
    from goodvibes_cli.steps.configure_mcp import configure_mcp

    log_calls: list[str] = []
    result = configure_mcp(log_calls.append)

    assert any("already registered" in m for m in log_calls)
    # Must not call claude mcp add
    called_cmds = [c[0][0] for c in run.call_args_list]
    assert not any(c[:3] == ["claude", "mcp", "add"] for c in called_cmds)
    assert result == {"status": "already-registered", "reason": ""}


def test_claude_mcp_add_primary(mocker):
    """configure_mcp registers headroom via 'claude mcp add -s user headroom <path>' as primary."""

    def side_effect(cmd_list, **kwargs):
        if cmd_list[:3] == ["claude", "mcp", "get"]:
            return subprocess.CompletedProcess(args=cmd_list, returncode=1, stdout="", stderr="No MCP server found")
        if cmd_list == ["headroom", "mcp", "status"]:
            raise subprocess.CalledProcessError(1, cmd_list)
        if cmd_list == ["claude", "mcp", "list"]:
            return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

    run = mocker.patch(
        "goodvibes_cli.steps.configure_mcp.subprocess.run",
        side_effect=side_effect,
    )
    mocker.patch(
        "goodvibes_cli.steps.configure_mcp.shutil.which",
        return_value="/usr/local/bin/headroom",
    )
    from goodvibes_cli.steps.configure_mcp import configure_mcp

    log_calls: list[str] = []
    result = configure_mcp(log_calls.append)

    # claude mcp add must have been called with correct args
    called_cmds = [c[0][0] for c in run.call_args_list]
    mcp_add_calls = [c for c in called_cmds if c[:3] == ["claude", "mcp", "add"]]
    assert mcp_add_calls, "Expected 'claude mcp add' call"
    assert mcp_add_calls[0] == ["claude", "mcp", "add", "-s", "user", "headroom", "--", "/usr/local/bin/headroom", "mcp", "serve"]
    assert any("registered" in m for m in log_calls)
    assert result["status"] == "registered"


def test_headroom_not_on_path(mocker):
    """configure_mcp logs 'not found on PATH' and returns when shutil.which returns None."""

    def side_effect(cmd_list, **kwargs):
        if cmd_list[:3] == ["claude", "mcp", "get"]:
            return subprocess.CompletedProcess(args=cmd_list, returncode=1, stdout="", stderr="No MCP server found")
        if cmd_list == ["headroom", "mcp", "status"]:
            raise subprocess.CalledProcessError(1, cmd_list)
        if cmd_list == ["claude", "mcp", "list"]:
            return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

    mocker.patch(
        "goodvibes_cli.steps.configure_mcp.subprocess.run",
        side_effect=side_effect,
    )
    mocker.patch(
        "goodvibes_cli.steps.configure_mcp.shutil.which",
        return_value=None,
    )
    from goodvibes_cli.steps.configure_mcp import configure_mcp

    log_calls: list[str] = []
    result = configure_mcp(log_calls.append)

    assert any("not found on PATH" in m or "not found" in m for m in log_calls)
    assert result["status"] == "skipped"


def test_claude_not_found_fallback(mocker):
    """configure_mcp falls back to 'headroom mcp install' and logs CLAUDE_CONFIG_DIR warning when claude is ENOENT."""

    def side_effect(cmd_list, **kwargs):
        if cmd_list[:3] == ["claude", "mcp", "get"]:
            return subprocess.CompletedProcess(args=cmd_list, returncode=1, stdout="", stderr="No MCP server found")
        if cmd_list == ["headroom", "mcp", "status"]:
            raise subprocess.CalledProcessError(1, cmd_list)
        if cmd_list[0] == "claude":
            raise FileNotFoundError("claude not found")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

    run = mocker.patch(
        "goodvibes_cli.steps.configure_mcp.subprocess.run",
        side_effect=side_effect,
    )
    mocker.patch(
        "goodvibes_cli.steps.configure_mcp.shutil.which",
        return_value="/usr/local/bin/headroom",
    )
    from goodvibes_cli.steps.configure_mcp import configure_mcp

    log_calls: list[str] = []
    result = configure_mcp(log_calls.append)

    # CLAUDE_CONFIG_DIR warning must be logged
    assert any("CLAUDE_CONFIG_DIR" in m for m in log_calls)
    # headroom mcp install must have been called
    called_cmds = [c[0][0] for c in run.call_args_list]
    assert any(c == ["headroom", "mcp", "install"] for c in called_cmds)
    assert result["status"] == "registered"


def test_headroom_enoent_in_fallback(mocker):
    """configure_mcp logs 'not found' and returns when both claude and headroom are ENOENT."""

    def side_effect(cmd_list, **kwargs):
        if cmd_list[:3] == ["claude", "mcp", "get"]:
            return subprocess.CompletedProcess(args=cmd_list, returncode=1, stdout="", stderr="No MCP server found")
        if cmd_list == ["headroom", "mcp", "status"]:
            raise subprocess.CalledProcessError(1, cmd_list)
        if cmd_list[0] == "claude":
            raise FileNotFoundError("claude not found")
        if cmd_list == ["headroom", "mcp", "install"]:
            raise FileNotFoundError("headroom not found")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

    mocker.patch(
        "goodvibes_cli.steps.configure_mcp.subprocess.run",
        side_effect=side_effect,
    )
    mocker.patch(
        "goodvibes_cli.steps.configure_mcp.shutil.which",
        return_value="/usr/local/bin/headroom",
    )
    from goodvibes_cli.steps.configure_mcp import configure_mcp

    log_calls: list[str] = []
    result = configure_mcp(log_calls.append)

    # Must not raise; must log that headroom is not found
    assert any("not found" in m for m in log_calls)
    assert result["status"] == "skipped"


def test_headroom_mcp_install_called_process_error_soft_fails(mocker):
    """configure_mcp does not raise when headroom mcp install exits non-zero (CR-02)."""

    def side_effect(cmd_list, **kwargs):
        if cmd_list[:3] == ["claude", "mcp", "get"]:
            return subprocess.CompletedProcess(args=cmd_list, returncode=1, stdout="", stderr="No MCP server found")
        if cmd_list == ["headroom", "mcp", "status"]:
            raise subprocess.CalledProcessError(1, cmd_list)
        if cmd_list[0] == "claude":
            raise FileNotFoundError("claude not found")
        if cmd_list == ["headroom", "mcp", "install"]:
            raise subprocess.CalledProcessError(1, cmd_list, stderr="install failed")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

    mocker.patch(
        "goodvibes_cli.steps.configure_mcp.subprocess.run",
        side_effect=side_effect,
    )
    from goodvibes_cli.steps.configure_mcp import configure_mcp

    log_calls: list[str] = []
    result = configure_mcp(log_calls.append)  # must not raise

    assert any("failed" in m or "manually" in m for m in log_calls)
    assert result["status"] == "failed"


def test_claude_mcp_add_called_process_error_soft_fails(mocker):
    """configure_mcp does not raise when claude mcp add exits non-zero (WR-01)."""

    def side_effect(cmd_list, **kwargs):
        if cmd_list[:3] == ["claude", "mcp", "get"]:
            return subprocess.CompletedProcess(args=cmd_list, returncode=1, stdout="", stderr="No MCP server found")
        if cmd_list == ["headroom", "mcp", "status"]:
            raise subprocess.CalledProcessError(1, cmd_list)
        if cmd_list == ["claude", "mcp", "list"]:
            return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")
        if cmd_list[:3] == ["claude", "mcp", "add"]:
            raise subprocess.CalledProcessError(1, cmd_list, stderr="permission denied")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

    mocker.patch(
        "goodvibes_cli.steps.configure_mcp.subprocess.run",
        side_effect=side_effect,
    )
    mocker.patch(
        "goodvibes_cli.steps.configure_mcp.shutil.which",
        return_value="/usr/bin/headroom",
    )
    from goodvibes_cli.steps.configure_mcp import configure_mcp

    log_calls: list[str] = []
    result = configure_mcp(log_calls.append)  # must not raise

    assert len(log_calls) > 0
    assert result["status"] == "failed"


def _registered_as(get_stdout):
    def side_effect(cmd_list, **kwargs):
        if cmd_list == ["claude", "mcp", "get", "headroom"]:
            return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout=get_stdout, stderr="")
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")
    return side_effect


def test_repairs_a_headroom_registration_that_has_no_mcp_serve_arguments(mocker):
    broken = "headroom:\n  Scope: User config\n  Type: stdio\n  Command: /usr/local/bin/headroom\n  Args: \n"
    run = mocker.patch("goodvibes_cli.steps.configure_mcp.subprocess.run", side_effect=_registered_as(broken))
    mocker.patch("goodvibes_cli.steps.configure_mcp.shutil.which", return_value="/usr/local/bin/headroom")
    from goodvibes_cli.steps.configure_mcp import configure_mcp

    log_calls: list[str] = []
    result = configure_mcp(log_calls.append)

    cmds = [c.args[0] for c in run.call_args_list]
    remove = ["claude", "mcp", "remove", "headroom", "-s", "user"]
    add = ["claude", "mcp", "add", "-s", "user", "headroom", "--", "/usr/local/bin/headroom", "mcp", "serve"]
    assert remove in cmds and add in cmds
    assert cmds.index(remove) < cmds.index(add)
    assert result["status"] == "repaired"
    assert any("repaired" in m for m in log_calls)


def test_leaves_a_headroom_registration_with_mcp_serve_alone(mocker):
    ok = "headroom:\n  Command: /usr/local/bin/headroom\n  Args: mcp serve\n"
    run = mocker.patch("goodvibes_cli.steps.configure_mcp.subprocess.run", side_effect=_registered_as(ok))
    mocker.patch("goodvibes_cli.steps.configure_mcp.shutil.which", return_value="/usr/local/bin/headroom")
    from goodvibes_cli.steps.configure_mcp import configure_mcp

    result = configure_mcp(lambda m: None)

    cmds = [c.args[0] for c in run.call_args_list]
    assert not any(c[:3] in (["claude", "mcp", "add"], ["claude", "mcp", "remove"]) for c in cmds)
    assert result["status"] == "already-registered"
