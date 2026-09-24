---
phase: 17-cross-tool-governance-directive-wording
verified: 2026-09-24T22:10:00Z
status: passed
score: 5/5 success criteria verified
human_verification:
  - test: "Open a fresh goodvibes project in Claude Code and send a short request"
    expected: "Reply is in caveman ultra style; `/caveman full` switches it"
    why_human: "Output style can only be judged in a live session"
---

# Phase 17 Verification

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | JOURNAL.md, CLAUDE.md, AGENTS.md tell a new session to read JOURNAL.md first and treat it as binding | VERIFIED | rule-files.test.ts "tells every agent to read JOURNAL.md before acting" over 13 rule files + JOURNAL.md |
| 2 | CLAUDE.md never-ask rule names README.md, CLAUDE.md, AGENTS.md, JOURNAL.md, codebase | VERIFIED | exact-string test |
| 3 | Directive language, no should/consider/try to, grep-checked | VERIFIED | hedge-word test over all 13 files |
| 4 | Copilot file authoritative; AGENTS.md fallback, not a guarantee | VERIFIED | wording test |
| 5 | caveman defaults to ultra; onboarding explains ultra and how to dial back | VERIFIED | caveman test; getting-started "Why Claude's replies are so short" |

Size: goodvibes block 159 → 151 lines, 8,367 → 8,407 characters (+0.5%).

Tests: npm vitest 246 passed, 1 skipped, 2 todo; pip pytest 206 passed. `scripts/verify-phase1.sh` and `verify-phase2.sh` fail identically before and after this phase (stale v1.0 checks: 80-100 line CLAUDE.md, `goodvibes` package name); not run in CI.
