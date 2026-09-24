---
phase: 15-journal-gate-hook-context7-mcp
plan: 01
subsystem: templates
tags: [claude-code, hooks, mcp, context7, journal]
requires: []
provides: [journal-gate-hook, context7-mcp-config]
affects: [phase-16-json-aware-update]
key-files:
  created:
    - templates/.mcp.json
    - packages/npm/src/journal-gate.integration.test.ts
  modified:
    - templates/.claude/settings.json
    - templates/docs/onboarding.md
    - packages/npm/src/steps/copy-templates.integration.test.ts
    - README.md
    - CHANGELOG.md
key-decisions:
  - Inline POSIX sh hook (per HOOK-01), no jq/Node/script file
  - In-command `git commit` guard in addition to `if`, so an older Claude Code that ignores `if` cannot block every Bash call
  - Compound `git add ... && git commit` and `git commit -a` judged against the working tree, since the index is not yet updated when PreToolUse fires
  - context7 key header is `Authorization: Bearer ${CONTEXT7_API_KEY}` (docs only, never in the shipped file)
requirements-completed: [HOOK-01, HOOK-02, HOOK-03, HOOK-04, CTX7-01, CTX7-02, CTX7-03]
completed: 2026-09-24
---

# Plan 15-01 Summary

## What shipped

- `templates/.claude/settings.json`: `hooks.PreToolUse` entry, `matcher: "Bash"`, `if: "Bash(git commit*)"`,
  one inline `sh` command. Blocks with exit 2 and the stderr message
  `goodvibes: commit blocked because JOURNAL.md is not staged. Add a JOURNAL.md entry ... run: git add JOURNAL.md, then commit again.`
- `templates/.mcp.json`: context7 at `https://mcp.context7.com/mcp`, `type: "http"`, no headers.
- Onboarding "Claude Code extras" section and README items 6 and 7 state the Claude-Code-only boundary,
  the trust prompt, the reset command, and the optional key upgrade.

## Deviation from research

Research recommended a `.mjs` or `.sh` script. HOOK-01 and the PROJECT.md key decision require an inline
command; followed the requirement.

## Tests

- New: 20 tests in `journal-gate.integration.test.ts` (17 hook behaviour/shape, 1 fallback guard, 2 `.mcp.json`).
  Passed under `sh` (dash) and, in a one-off run, under `bash`.
- New: 2 tests in `copy-templates.integration.test.ts` (fresh init writes `.mcp.json` and hooked settings; `--minimal` writes `.mcp.json`).
- Full suites: npm 167 passed, 1 skipped, 2 todo; pip all passed (see VERIFICATION).

## Not verified here

- Live Claude Code session actually blocking a commit (no `claude` binary in the build sandbox). See 15-HUMAN-UAT.md.
- Keyless context7 endpoint reachability: sandbox egress to mcp.context7.com is blocked (HTTP 403 at the proxy).
- Windows Git Bash execution.
