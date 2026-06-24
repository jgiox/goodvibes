"""Register headroom as a global MCP server in Claude Code."""
import shutil
import subprocess
from typing import Callable


def configure_mcp(log: Callable[[str], None]) -> None:
    """Register headroom as a global MCP server via claude mcp add (primary) or headroom mcp install (fallback).

    Strategy:
    1. Idempotency: headroom mcp status (exit 0 → already registered)
    2. Primary: claude mcp add -s user headroom <absolute-path>
    3. Fallback: headroom mcp install (when claude CLI not on PATH)

    Never writes to ~/.claude/ directly. Never uses shell=True.
    """
    # Step 1: idempotency check
    try:
        subprocess.run(
            ["headroom", "mcp", "status"],
            capture_output=True,
            text=True,
            check=True,
        )
        log("headroom MCP already configured — skipping")
        return
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass

    # Step 2: primary — claude mcp add -s user (handles CLAUDE_CONFIG_DIR correctly)
    try:
        list_result = subprocess.run(
            ["claude", "mcp", "list"],
            capture_output=True,
            text=True,
            check=True,
        )
        if "headroom" in list_result.stdout:
            log("headroom already registered in claude MCP — skipping")
            return

        absolute_path = shutil.which("headroom")
        if not absolute_path:
            log(
                "headroom binary not found on PATH — MCP registration skipped. "
                'Run `uv tool install "headroom-ai[all]"` then re-run `goodvibes init`.'
            )
            return

        subprocess.run(
            ["claude", "mcp", "add", "-s", "user", "headroom", absolute_path],
            capture_output=True,
            text=True,
            check=True,
        )
        log("headroom registered as global MCP server")
        return
    except FileNotFoundError:
        # claude CLI not on PATH — fall back to headroom mcp install
        log("claude CLI not found — falling back to headroom mcp install")
        log(
            "Warning: if you use CLAUDE_CONFIG_DIR, you may need to run "
            "`headroom mcp install` manually"
        )
    except subprocess.CalledProcessError as e:
        lines = (e.stderr or "").splitlines()
        log(f"claude mcp add failed: {lines[0] if lines else 'unknown error'}")
        log("Run `headroom mcp install` manually.")
        return

    # Step 3: fallback — headroom mcp install
    try:
        subprocess.run(
            ["headroom", "mcp", "install"],
            capture_output=True,
            text=True,
            check=True,
        )
    except FileNotFoundError:
        log(
            "headroom binary not found — MCP registration skipped. "
            "Install headroom and run `headroom mcp install` manually."
        )
    except subprocess.CalledProcessError as e:
        lines = (e.stderr or "").splitlines()
        first_line = lines[0] if lines else "unknown error"
        log(
            f"headroom MCP install failed: {first_line}. "
            "Run `headroom mcp install` manually to complete MCP setup."
        )
        return
