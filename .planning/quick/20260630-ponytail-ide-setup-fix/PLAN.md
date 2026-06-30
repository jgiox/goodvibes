---
quick_id: 260630-6l9
slug: ponytail-ide-setup-fix
date: 2026-06-30
status: in-progress
---

# Fix: ponytail setup instructions for non-Claude-Code IDEs

## Problem

`templates/.claude/skills/goodvibes-hygiene/SKILL.md` `## Setup` section gives users
`/plugin marketplace add DietrichGebert/ponytail` and `/plugin install ponytail@ponytail`.
These are Claude Code CLI terminal-only commands — they do not work in the VS Code extension
or any other IDE (Cursor, Windsurf, Kiro, Copilot, etc.). Users on other IDEs follow the
instructions and get nowhere (JOURNAL 2026-06-24, line 93-95).

## Fix

### File 1: templates/.claude/skills/goodvibes-hygiene/SKILL.md

Add a "Using another IDE?" callout under `## Setup` before the code block. Clarify:
- The two `/plugin` commands are Claude Code CLI terminal only
- For Cursor/Windsurf/Kiro/Copilot users: the minimalism rules are already in their IDE rule
  file — no plugin setup needed. The on-demand audit commands are not available.

### File 2: README.md

After the IDE compatibility table in `## IDE compatibility`, add a one-line note:
- The minimalism rules (ponytail ladder) are embedded in all IDE rule files and active
  automatically. On-demand audit commands (`/ponytail-review`, `/ponytail-audit`) require
  the Claude Code CLI terminal — they are not available in other IDEs.

## Files touched

- `templates/.claude/skills/goodvibes-hygiene/SKILL.md`
- `README.md`

## Tests

No test changes — docs only.
