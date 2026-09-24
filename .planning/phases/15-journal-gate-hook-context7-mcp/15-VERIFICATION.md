---
phase: 15-journal-gate-hook-context7-mcp
verified: 2026-09-24T20:10:00Z
status: human_needed
score: 4/4 success criteria verified in automation; 3 items need human UAT
overrides_applied: 0
human_verification:
  - test: "Open Claude Code interactively in a freshly initialised project"
    expected: "One-time prompt to approve project MCP servers lists context7; after approving, `claude mcp list` shows context7 connected, not Pending approval"
    why_human: "Interactive trust dialog cannot be driven from `claude -p`; sandbox egress to mcp.context7.com is blocked"
  - test: "On Windows with Git Bash, ask Claude Code to commit without staging JOURNAL.md"
    expected: "Commit blocked with the goodvibes stderr message"
    why_human: "No Windows runner available; CI is ubuntu-only"
  - test: "`pip install` the built wheel, run `goodvibes init` in a blank dir, inspect `.claude/settings.json` and `.mcp.json`"
    expected: "Both files present; settings.json contains hooks.PreToolUse"
    why_human: "Wheel contents verified by zip listing, not by an installed end-to-end run"
---

# Phase 15 Verification Report: Journal-Gate Hook & context7 MCP

**Phase Goal:** Claude Code users get a real commit-time guardrail that enforces the "update JOURNAL.md every task" rule, and every goodvibes project ships with context7 MCP wired at the free/public tier.

## Success criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Claude Code's Bash tool is blocked from `git commit` when `JOURNAL.md` is not staged, with an actionable stderr message | VERIFIED | Integration test `blocks git commit with exit 2 when JOURNAL.md is not staged`; live `claude -p` run in a temp repo returned the goodvibes message and `git log` showed no new commit |
| 2 | Not blocked for `--amend`, in-progress merge/rebase, or the bootstrap commit that adds `JOURNAL.md` | VERIFIED | Tests: amend, `MERGE_HEAD`, `rebase-merge`, `rebase-apply`, no-HEAD first commit, bootstrap add, `git add . && git commit` with untracked JOURNAL.md |
| 3 | `.mcp.json` has context7 at the free HTTP endpoint, no key; trust prompt documented | VERIFIED | Tests `configures context7 at the free public HTTP endpoint with no key`, `contains no headers or literal API key`; `templates/docs/onboarding.md` "Claude Code extras" |
| 4 | Docs state the hook only gates Claude Code's own Bash tool, and document the optional `${CONTEXT7_API_KEY}` path with no literal key | VERIFIED | README items 6 and 7; onboarding section lists terminal, editor Git panel, other AI tools as not covered; key example uses `Bearer ${CONTEXT7_API_KEY}` with a never-paste warning |

## Requirements

| ID | Status | Where |
|----|--------|-------|
| HOOK-01 | Done | `templates/.claude/settings.json` inline `sh` command, `matcher: Bash`, `if: Bash(git commit*)` |
| HOOK-02 | Done | Exemptions in command; 7 exemption tests |
| HOOK-03 | Done | stderr names `JOURNAL.md is not staged` and `git add JOURNAL.md` |
| HOOK-04 | Done | README item 6, onboarding "The journal check" |
| CTX7-01 | Done | `templates/.mcp.json` |
| CTX7-02 | Done | onboarding key upgrade block |
| CTX7-03 | Done | onboarding trust prompt paragraph |

## Automated evidence (2026-09-24)

```
packages/npm$ npx vitest run
 Test Files  13 passed | 1 skipped (14)
      Tests  167 passed | 1 skipped | 2 todo (170)

packages/npm$ npx vitest run src/journal-gate.integration.test.ts
      Tests  20 passed (20)

packages/pip$ uv run --extra dev pytest tests/
153 passed in 2.43s

$ bash scripts/verify-phase5.sh --quick
Results: 10 passed, 0 failed
Phase 5 gate: PASS

packages/npm$ npm run build
ESM ⚡️ Build success

wheel: ['goodvibes_cli/templates/.mcp.json', 'goodvibes_cli/templates/.claude/settings.json']
npm pack --dry-run: templates/.claude/settings.json, templates/.mcp.json
```

Live Claude Code (`claude -p`, temp repo, template settings.json):

```
blocked:  goodvibes: commit blocked because JOURNAL.md is not staged. ... run: git add JOURNAL.md, then commit again.
passed:   [master 5ba9f8f] change app with journal   (git add JOURNAL.md && git commit ...)
```

Observation: in an untrusted workspace Claude Code ignored `permissions.allow` but still ran the hook.

## Known gaps (accepted, documented)

- Existing `.claude/settings.json` is not overwritten by `init`, so those projects do not get the hook. Phase 16 (UPD-07).
- Windows without Git Bash runs hooks under PowerShell; the `sh` syntax errors and Claude Code treats that as non-blocking, so the gate fails open.
- `if` matching is best-effort: `git -C dir commit`, aliases, or `$VAR`-built commands can bypass.
- `npx tsc --noEmit` reports 143 pre-existing `TS2591` errors (Node types not in tsconfig `types`) across all files; CI does not run tsc and this phase did not change tsconfig.
