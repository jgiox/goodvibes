"""goodvibes upgrade command — port of upgrade.ts."""
from __future__ import annotations

import importlib.metadata
import json
import os
import subprocess
import sys
import urllib.request
from typing import Annotated

import typer
from rich.console import Console

from goodvibes_cli.commands.update_cmd import update_cmd
from goodvibes_cli.utils.sentinel_merge import version_gte

console = Console()

_PYPI_URL = "https://pypi.org/pypi/goodvibes-cli/json"
_UPGRADING_ENV = "_GV_UPGRADING"


def _get_package_version() -> str | None:
    try:
        return importlib.metadata.version("goodvibes-cli")
    except importlib.metadata.PackageNotFoundError:
        return None


def _check_pypi_version() -> str | None:
    try:
        with urllib.request.urlopen(_PYPI_URL, timeout=5) as resp:  # noqa: S310
            return json.loads(resp.read())["info"]["version"]
    except Exception:
        return None


def _self_update_pip(latest: str) -> None:
    # `uv tool upgrade` keeps a pinned requirement (init pinned ==version before 1.9.2); install replaces it.
    try:
        subprocess.run(["uv", "tool", "install", f"goodvibes-cli>={latest}"], check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "--upgrade", f"goodvibes-cli>={latest}"],
            check=True,
        )


def upgrade_cmd(
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Preview changes without writing")] = False,
) -> None:
    """Install the newest goodvibes, then update this project with it."""
    console.rule("[bold]goodvibes upgrade[/bold]")

    # The re-run carries the version it should now be; if it is not, the install did not take effect.
    target = os.environ.get(_UPGRADING_ENV)
    current = _get_package_version()
    if target and current and not version_gte(current, target):
        console.print(
            f"[red]Still running goodvibes {current} after installing {target}.[/red] The goodvibes on your PATH is not the one "
            "that was upgraded. Run: uv tool install goodvibes-cli@latest (or pip install --upgrade goodvibes-cli), then goodvibes --version."
        )
        raise typer.Exit(1)
    if not target:
        latest = _check_pypi_version()
        if latest and current and not version_gte(current, latest):
            if dry_run:
                console.print(f"goodvibes {latest} is available (installed: {current}). The preview below uses {current}.")
            else:
                console.print(f"New version available: [bold]{latest}[/bold] (installed: {current})")
                with console.status(f"Updating goodvibes {current} → {latest}…"):
                    _self_update_pip(latest)
                # Re-run on the new version so the project gets its templates, not this process's.
                os.execve(sys.argv[0], sys.argv, {**os.environ, _UPGRADING_ENV: latest})

    update_cmd(dry_run=dry_run, force=False)
