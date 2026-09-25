"""Register headroom as a global MCP server in Claude Code."""
import pathlib
import subprocess
from typing import Callable

from goodvibes_cli.utils.proc import run, which

IN_PROJECT = (
    "headroom was found only inside this project folder, where a cloned repo could plant it, so it was not registered as an MCP server. "
    'Run `uv tool install "headroom-ai[all]"` then re-run `goodvibes init`.'
)


def _add_cmd(headroom_path: str) -> list[str]:
    return ["claude", "mcp", "add", "-s", "user", "headroom", "--", headroom_path, "mcp", "serve"]


def _inside_project(path: str) -> bool:
    # A cloned repo could ship its own headroom; a user-scope MCP server runs in every project, so never register one from inside this one.
    return pathlib.Path(path).absolute().is_relative_to(pathlib.Path.cwd().absolute())


def _in_project_skip(log: Callable[[str], None]) -> dict[str, str]:
    log(IN_PROJECT)
    return {"status": "skipped", "reason": "headroom found only inside the project folder"}


def _repair(log: Callable[[str], None]) -> dict[str, str]:
    absolute_path = which("headroom")
    if absolute_path and _inside_project(absolute_path):
        return _in_project_skip(log)
    if not absolute_path:
        log("headroom MCP registration is missing `mcp serve`, but headroom is not on PATH to repair it.")
        return {"status": "skipped", "reason": "headroom binary not found on PATH"}
    try:
        run(["claude", "mcp", "remove", "headroom", "-s", "user"], capture_output=True, text=True, check=True, timeout=10)
        run(_add_cmd(absolute_path), capture_output=True, text=True, check=True, timeout=10)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        lines = (getattr(e, "stderr", "") or "").splitlines()
        reason = lines[0] if lines else str(e).splitlines()[0]
        log(f"headroom MCP repair failed: {reason}")
        return {"status": "failed", "reason": reason}
    log("headroom MCP registration repaired (now runs headroom mcp serve)")
    return {"status": "repaired", "reason": ""}


def configure_mcp(log: Callable[[str], None]) -> dict[str, str]:
    """Register headroom as a global MCP server via claude mcp add (primary) or headroom mcp install (fallback).

    Strategy:
    1. Idempotency: headroom mcp status (exit 0 → already registered)
    2. Primary: claude mcp add -s user headroom -- <absolute-path> mcp serve
    3. Fallback: headroom mcp install (when claude CLI not on PATH)

    Never writes to ~/.claude/ directly. Never uses shell=True.
    """
    # Registrations made without `mcp serve` start headroom's CLI instead of its MCP server.
    try:
        got = run(["claude", "mcp", "get", "headroom"], capture_output=True, text=True, timeout=10)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        got = None
    if got is not None and got.returncode == 0:
        if "mcp serve" in got.stdout:
            log("headroom MCP already configured — skipping")
            return {"status": "already-registered", "reason": ""}
        return _repair(log)

    # Step 1: idempotency check
    try:
        run(
            ["headroom", "mcp", "status"],
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
        )
        log("headroom MCP already configured — skipping")
        return {"status": "already-registered", "reason": ""}
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        pass

    # Step 2: primary — claude mcp add -s user (handles CLAUDE_CONFIG_DIR correctly)
    try:
        list_result = run(
            ["claude", "mcp", "list"],
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
        )
        if "headroom" in list_result.stdout:
            log("headroom already registered in claude MCP — skipping")
            return {"status": "already-registered", "reason": ""}

        absolute_path = which("headroom")
        if absolute_path and _inside_project(absolute_path):
            return _in_project_skip(log)
        if not absolute_path:
            log(
                "headroom binary not found on PATH — MCP registration skipped. "
                'Run `uv tool install "headroom-ai[all]"` then re-run `goodvibes init`.'
            )
            return {"status": "skipped", "reason": "headroom binary not found on PATH"}

        run(_add_cmd(absolute_path), capture_output=True, text=True, check=True, timeout=10)
        log("headroom registered as global MCP server")
        return {"status": "registered", "reason": ""}
    except FileNotFoundError:
        # claude CLI not on PATH — fall back to headroom mcp install
        log("claude CLI not found — falling back to headroom mcp install")
        log(
            "Warning: if you use CLAUDE_CONFIG_DIR, you may need to run "
            "`headroom mcp install` manually"
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        lines = (getattr(e, "stderr", "") or "").splitlines()
        log(f"claude mcp add failed: {lines[0] if lines else 'unknown error'}")
        return {"status": "failed", "reason": lines[0] if lines else "unknown error"}

    # Step 3: fallback — headroom mcp install
    try:
        run(
            ["headroom", "mcp", "install"],
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
        )
        return {"status": "registered", "reason": ""}
    except FileNotFoundError:
        log(
            "headroom binary not found — MCP registration skipped. "
            "Install headroom and run `headroom mcp install` manually."
        )
        return {"status": "skipped", "reason": "headroom binary not found"}
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        lines = (getattr(e, 'stderr', '') or "").splitlines()
        first_line = lines[0] if lines else "unknown error"
        log(
            f"headroom MCP install failed: {first_line}. "
            "Run `headroom mcp install` manually to complete MCP setup."
        )
        return {"status": "failed", "reason": first_line}
