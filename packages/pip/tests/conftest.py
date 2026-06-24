"""Shared pytest fixtures for goodvibes_cli tests."""
import pytest

SENTINEL_START = "<!-- goodvibes:start -->"
SENTINEL_END = "<!-- goodvibes:end -->"

# Matches Phase 2 sentinel-merge.test.ts TEMPLATE_CONTENT (same markers, v1.0.0)
TEMPLATE_CONTENT = f"""# CLAUDE.md

{SENTINEL_START}
# goodvibes: v1.0.0

## Engineering Rules

Some rule here.
{SENTINEL_END}
"""


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
    (workflows / "ci.yml").write_text("name: CI\n")
    return d


@pytest.fixture
def sample_template_content():
    """Returns the canonical template content constant."""
    return TEMPLATE_CONTENT
