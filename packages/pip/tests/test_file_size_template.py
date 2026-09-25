"""The file-size ratchet ships as template files; its behaviour is tested once, in the npm package."""
from __future__ import annotations

import pathlib
import shutil
import subprocess

import pytest

GITHUB = pathlib.Path(__file__).resolve().parents[3] / "templates" / ".github"
SCRIPT = GITHUB / "scripts" / "check-file-sizes.mjs"
WORKFLOW = GITHUB / "workflows" / "file-size.yml"


def test_file_size_workflow_runs_the_shipped_script_on_pull_requests_and_pushes():
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "\n  pull_request:\n" in text
    assert "\n  push:\n    branches: [main]\n" in text
    assert "\npermissions:\n  contents: read\n" in text
    assert "fetch-depth: 0" in text
    assert "run: node .github/scripts/check-file-sizes.mjs" in text


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed")
def test_file_size_script_is_valid_javascript():
    result = subprocess.run(["node", "--check", str(SCRIPT)], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
