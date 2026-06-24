"""Install headroom-ai via uv → pipx → pip fallback chain."""
import subprocess
from typing import Callable

from goodvibes_cli.utils.detect_python import detect_python


def install_headroom(log: Callable[[str], None]) -> None:
    """Install headroom-ai[all] using the first available installer.

    Order: uv tool install → pipx install → pip install --user.

    Never raises. Never uses shell=True. Soft-fails on CalledProcessError.
    """
    python_cmd = detect_python()
    if python_cmd is None:
        log(
            "Python 3.10+ not found — skipping headroom install. "
            "Install Python 3.10+ and run `goodvibes init` again."
        )
        return

    # HDR-03: ONNX warning BEFORE any subprocess call — shows even if installer is slow
    log(
        "Note: headroom will download its compression model on first use"
        " — this may take 1–3 minutes on a slow connection."
    )

    installers: list[list[str]] = [
        ["uv", "tool", "install", "headroom-ai[all]"],
        ["pipx", "install", "headroom-ai[all]"],
        [python_cmd, "-m", "pip", "install", "--user", "headroom-ai[all]"],
    ]

    for cmd_list in installers:
        try:
            subprocess.run(cmd_list, capture_output=True, text=True, check=True)
            return
        except FileNotFoundError:
            continue
        except subprocess.CalledProcessError as e:
            lines = (e.stderr or "").splitlines()
            first_line = lines[0] if lines else "unknown error"
            log(f"headroom install failed: {first_line}")
            log('You can install headroom manually later: uv tool install "headroom-ai[all]"')
            return

    # All three installers were FileNotFoundError
    log(
        "No package installer found (uv, pipx, pip). "
        "Install Python 3.10+ with uv or pipx and run `goodvibes init` again."
    )
