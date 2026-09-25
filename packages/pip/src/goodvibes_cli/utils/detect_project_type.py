"""Detect the target project type by inspecting marker files."""
from __future__ import annotations

import pathlib


def detect_project_type(cwd: pathlib.Path) -> str:
    """Return 'node', 'python', or 'both' based on marker files in cwd."""
    has_node = (cwd / "package.json").exists()
    has_python = (cwd / "pyproject.toml").exists() or (cwd / "requirements.txt").exists()
    if has_node and has_python:
        return "both"
    if has_node:
        return "node"
    if has_python:
        return "python"
    return "both"  # safe default


def _dependabot_block(ecosystem: str) -> str:
    return (f'  - package-ecosystem: "{ecosystem}"\n    directory: "/"\n    schedule:\n      interval: "weekly"\n'
            '    open-pull-requests-limit: 5\n    cooldown:\n      default-days: 7\n')


def dependabot_yml(template: str, cwd: pathlib.Path) -> str:
    """Dependabot fails every week for an ecosystem whose files are missing, so only the ones this project has are added."""
    ecosystems = ["npm"] if (cwd / "package.json").exists() else []
    if (cwd / "uv.lock").exists():
        ecosystems.append("uv")
    elif (cwd / "pyproject.toml").exists() or (cwd / "requirements.txt").exists():
        ecosystems.append("pip")
    return template + "".join(_dependabot_block(e) for e in ecosystems)
