"""Global vs project scope helpers (mirror of npm utils/scope.ts)."""
from __future__ import annotations

SENTINEL_START = "<!-- goodvibes:start -->"
SENTINEL_END = "<!-- goodvibes:end -->"


def global_owned(rel: str) -> bool:
    """Rules, skills and context7 live in the user config in global scope; a project copy would load twice."""
    p = rel.replace("\\", "/")
    return p == ".mcp.json" or p == ".claude/skills" or p.startswith(".claude/skills/")


def minimal_skipped(rel: str) -> bool:
    """--minimal skips docs and the CI side of .github, but Copilot reads its rules and hooks only from .github."""
    p = rel.replace("\\", "/")
    if p == "docs" or p.startswith("docs/"):
        return True
    return p.startswith(".github/") and p != ".github/copilot-instructions.md" and p != ".github/hooks" and not p.startswith(".github/hooks/")


def goodvibes_block(claude_template: str) -> str:
    start = claude_template.find(SENTINEL_START)
    end = claude_template.find(SENTINEL_END)
    if start == -1 or end == -1:
        raise ValueError("templates/CLAUDE.md has no goodvibes block")
    return claude_template[start:end + len(SENTINEL_END)] + "\n"


def project_stub(claude_template: str) -> str:
    return claude_template[:claude_template.find(SENTINEL_START)].rstrip() + "\n"
