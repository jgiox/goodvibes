---
phase: quick/260924-q1-journal-gate-staging-ask-gaps
plan: 260924-q1
subsystem: templates
tags: [journal-gate, claude-settings, permissions, onboarding]
requires:
  - phase: .planning/research/2026-09-24-cross-repo-gap-review.md
  - phase: .planning/phases/15-journal-gate-hook-context7-mcp/15-VERIFICATION.md (follow_ups)
affects: [phase-16-json-aware-update, v1.8.0-release]
completed: 2026-09-24
---

# Quick Task 260924-q1: journal-gate staging, ask-list gaps, onboarding

## Why

Assessment of the cross-repo gap review (2026-09-24) found three problems in what had shipped:

1. The new "stage exact paths, never `git add -A`" rule makes `git add <paths> JOURNAL.md && git commit` the normal agent pattern, and the journal gate blocked that whole command because it reads the index before `git add` runs.
2. `permissions.ask` (D2) matches by prefix, so `npx -y wrangler deploy`, `npx wrangler@3 deploy`, `uv run twine upload`, `npm run deploy` and `node node_modules/.bin/...` still auto-ran under `Bash(npx*)`, `Bash(uv*)`, `Bash(npm run*)`, `Bash(node*)`.
3. `docs/onboarding.md` taught `git add -A`, contradicting the agent rules.

The user approved changing the hook logic that 15-01 had locked.

## Commits

| Commit | Change |
|---|---|
| e6dc255 | RED: 8 journal-gate tests in each suite (4 allow, 4 guard) |
| d280a01 | GREEN: hook accepts a preceding `git add` naming JOURNAL.md / `-A` / `--all` / `.` when JOURNAL.md has changes, and `commit -a` when tracked JOURNAL.md is modified; `-C` and unparseable cases unchanged |
| 5660da5 | RED: ask-list bypass test (11 patterns) |
| f607bf3 | GREEN: 11 ask rules appended |
| (docs) | onboarding exact-path staging, CHANGELOG, STATE, 15-VERIFICATION follow-ups |

## Verification

- npm vitest: 184 passed, 1 skipped, 2 todo. pip pytest: 187 passed.
- Journal-gate suites: 30/30 npm, 30/30 pip.
- Independent 20-case matrix (from 5d539f4): 17 pass; 3 known design differences.

## Remaining work agreed with the user (2026-09-24)

| Item | Where |
|---|---|
| JSON-aware `update` merge; managed keys: journal-gate hook entry, SessionStart doctor entry, `permissions.ask` (add-only union), `mcpServers.context7` | Phase 16 (UPD-07 widened) |
| SessionStart `goodvibes doctor` hook, guarded by `command -v goodvibes`, with a fast mode | after Phase 16 |
| Directive rewrite; rules 6, 10, 11, 13, 14; Rule 15 project stub on fresh CLAUDE.md; no net CLAUDE.md growth | Phase 17 |
| ML / metric regression gate as an on-demand Claude Code skill, not in base templates | skill |
| v1.8.0 version bump and publish | release |

Not adopted: ML rule in base templates (token cost for every non-ML user); read-time prompt-injection scanner (own design pass).
