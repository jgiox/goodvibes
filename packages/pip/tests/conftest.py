"""Shared pytest fixtures for goodvibes_cli tests."""
import pytest

# Re-export from fixtures.py so conftest fixtures can use them without double-import
from .fixtures import SENTINEL_START, SENTINEL_END, TEMPLATE_CONTENT, TEMPLATE_CONTENT_V130


@pytest.fixture
def tmp_dir(tmp_path):
    """Temporary directory for file operation tests."""
    return tmp_path


@pytest.fixture
def template_dir(tmp_path):
    """Temporary directory pre-populated with a minimal template structure."""
    d = tmp_path / "templates"
    d.mkdir()
    (d / "CLAUDE.md").write_text(TEMPLATE_CONTENT)
    (d / "CONTRIBUTING.md").write_text("# Contributing\n")
    workflows = d / ".github" / "workflows"
    workflows.mkdir(parents=True)
    (workflows / "ci-node.yml").write_text("name: CI\n")
    (workflows / "ci-python.yml").write_text("name: CI\n")
    (workflows / "ci-both.yml").write_text("name: CI\n")
    issue_template = d / ".github" / "ISSUE_TEMPLATE"
    issue_template.mkdir(parents=True)
    (issue_template / "bug_report.md").write_text("# Bug\n")
    docs = d / "docs"
    docs.mkdir()
    (docs / "onboarding.md").write_text("# Onboarding\n")
    # IDE rule file stubs (Phase 8 — IDE-01 through IDE-04)
    cursor_rules = d / ".cursor" / "rules"
    cursor_rules.mkdir(parents=True)
    (cursor_rules / "goodvibes.mdc").write_text("---\nalwaysApply: true\n---\n# Rules\n")
    (d / ".github" / "copilot-instructions.md").write_text("# Copilot\n")
    (d / ".windsurfrules").write_text("# Rules\n")
    (d / "GEMINI.md").write_text("# Rules\n")
    kiro_steering = d / ".kiro" / "steering"
    kiro_steering.mkdir(parents=True)
    (kiro_steering / "goodvibes.md").write_text("---\ninclusion: always\n---\n# Rules\n")
    return d


@pytest.fixture
def sample_template_content():
    """Returns the canonical template content constant."""
    return TEMPLATE_CONTENT
