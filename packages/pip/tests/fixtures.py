"""Shared test constants — import from here, not conftest.py, to avoid double-import."""

SENTINEL_START = "<!-- goodvibes:start -->"
SENTINEL_END = "<!-- goodvibes:end -->"

# v1.0.0 template content — used for Case A (fresh install) and Case C (upgrade) tests
TEMPLATE_CONTENT = f"""# CLAUDE.md

{SENTINEL_START}
# goodvibes: v1.0.0

## Engineering Rules

Some rule here.
{SENTINEL_END}
"""

# v1.3.0 variant — covers Case D (same-version skip) for current production template
TEMPLATE_CONTENT_V130 = f"""# CLAUDE.md

{SENTINEL_START}
# goodvibes: v1.3.0

## Engineering Rules

Some rule here.
{SENTINEL_END}
"""
