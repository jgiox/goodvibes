"""Probe for a Python 3.10+ interpreter on the current PATH."""
import re
import subprocess


def detect_python() -> str | None:
    """Return the first python3/python/py command that resolves to Python 3.10+, or None.

    Handles:
    - ENOENT: command not on PATH → continue to next probe
    - Windows Store guard: output not matching /Python \\d+\\.\\d+/ → skip
    - Python < 3.4 printed version to stderr → check both stdout and stderr
    - Python < 3.10 → continue to next probe
    """
    for cmd in ["python3", "python", "py"]:
        try:
            result = subprocess.run(
                [cmd, "--version"],
                capture_output=True,
                text=True,
                check=False,
            )
            # Python <3.4 wrote version to stderr; check both
            output = result.stdout or result.stderr
            match = re.search(r"Python (\d+)\.(\d+)", output)
            if not match:
                # Windows Store stub or unexpected output — treat as not found
                continue
            major, minor = int(match.group(1)), int(match.group(2))
            if major > 3 or (major == 3 and minor >= 10):
                return cmd
            # version too old — try next probe
        except FileNotFoundError:
            continue
        except Exception:
            continue
    return None
