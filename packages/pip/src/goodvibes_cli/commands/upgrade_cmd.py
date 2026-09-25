"""goodvibes upgrade command — port of upgrade.ts."""
from __future__ import annotations

import importlib.metadata
import json
import os
import pathlib
import shlex
import subprocess
import sys
import urllib.request
from typing import Annotated

import typer
from rich.console import Console
from rich.panel import Panel

from goodvibes_cli.commands.update_cmd import update_cmd
from goodvibes_cli.steps.global_setup import claude_config_dir
from goodvibes_cli.steps.write_manifest import ManifestError, read_manifest
from goodvibes_cli.utils.proc import NO_CWD, run
from goodvibes_cli.utils.sentinel_merge import version_gte

console = Console()

_PYPI_URL = "https://pypi.org/pypi/goodvibes-cli/json"
_UPGRADING_ENV = "_GV_UPGRADING"


def _get_package_version() -> str | None:
    try:
        return importlib.metadata.version("goodvibes-cli")
    except importlib.metadata.PackageNotFoundError:
        return None


def _check_pypi_version() -> str:
    with urllib.request.urlopen(_PYPI_URL, timeout=5) as resp:  # noqa: S310
        return json.loads(resp.read())["info"]["version"]


def _running_under_uvx() -> bool:
    # uvx runs from a throwaway environment in uv's cache (…/uv/archive-v0/<hash>); installing there is pointless.
    return any(part.startswith("archive-v") for part in pathlib.Path(sys.prefix).parts)


def _self_update_pip(latest: str) -> None:
    """Upgrade the installation that is running, not some other copy."""
    req = f"goodvibes-cli>={latest}"
    if (pathlib.Path(sys.prefix) / "uv-receipt.toml").exists():
        # `uv tool upgrade` keeps a pinned requirement (init pinned ==version before 1.9.2); install replaces it.
        attempts = [["uv", "tool", "install", req]]
    else:
        # uv-made venvs usually have no pip, so fall back to uv pip for this same interpreter.
        attempts = [[sys.executable, "-m", "pip", "install", "--upgrade", req],
                    ["uv", "pip", "install", "--python", sys.executable, "--upgrade", req]]
    for cmd in attempts:
        try:
            run(cmd, check=True)
            return
        except (subprocess.CalledProcessError, FileNotFoundError):
            continue
    console.print(f"[red]Could not upgrade goodvibes.[/red] Run: {shlex.join(attempts[0])}")
    raise typer.Exit(1)


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
    if not target and _running_under_uvx():
        console.print("You are running goodvibes through uvx, and uvx always runs the newest version, so there is nothing to install.")
    elif not target:
        try:
            latest = _check_pypi_version()
        except (OSError, ValueError, KeyError) as e:
            console.print(f"Could not check PyPI for a newer version ({getattr(e, 'reason', e)}); updating with the installed version", markup=False)
            latest = None
        if latest and current and not version_gte(current, latest):
            if dry_run:
                console.print(f"goodvibes {latest} is available (installed: {current}). The preview below uses {current}.")
            else:
                console.print(f"New version available: [bold]{latest}[/bold] (installed: {current})")
                with console.status(f"Updating goodvibes {current} → {latest}…"):
                    _self_update_pip(latest)
                # Re-run on the new version so the project gets its templates, not this process's.
                # argv[0] is not executable under `python -m goodvibes_cli`, so always go through the interpreter.
                os.execve(sys.executable, [sys.executable, "-m", "goodvibes_cli", *sys.argv[1:]], {**os.environ, **NO_CWD, _UPGRADING_ENV: latest})

    # In a folder goodvibes never set up, update's "not set up here" reads like a failed upgrade.
    try:
        set_up = bool(read_manifest(pathlib.Path.cwd()) or read_manifest(claude_config_dir()))
    except ManifestError:
        set_up = True
    if not set_up:
        console.print(Panel(
            f"goodvibes {current} is installed. This folder has no goodvibes setup, so there is nothing to update here.\n"
            "To update a project, go into its folder and run: goodvibes update\n"
            "To set up a new project, go into its folder and run: goodvibes init",
            title="Nothing to update here",
        ))
        return
    update_cmd(dry_run=dry_run, force=False)
