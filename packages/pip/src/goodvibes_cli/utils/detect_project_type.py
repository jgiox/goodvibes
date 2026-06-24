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
