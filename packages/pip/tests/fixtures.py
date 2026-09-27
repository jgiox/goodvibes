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

# The CLAUDE.md template goodvibes 1.7.0 shipped: its block is a real released block, so goodvibes treats it as unedited.
import pathlib as _pathlib

SHIPPED_170 = (_pathlib.Path(__file__).resolve().parents[3] / "tests" / "blocks" / "CLAUDE-1.7.0.md").read_text(encoding="utf-8")
SHIPPED_170_BLOCK = SHIPPED_170[SHIPPED_170.index(SENTINEL_START):SHIPPED_170.index(SENTINEL_END) + len(SENTINEL_END)]
EDITED_170_BLOCK = SHIPPED_170_BLOCK.replace("## Engineering Rules", "## Engineering Rules\n\n- My own rule: pushing to my fork needs no confirmation.", 1)
NEWER_TEMPLATE = f"# CLAUDE.md\n\n{SENTINEL_START}\n# goodvibes: v9.9.9\n\nnew rules\n{SENTINEL_END}\n"
