---
phase: 15-journal-gate-hook-context7-mcp
plan: 06
subsystem: infra
tags: [git-hooks, shell, bash, vitest, pytest, security]

requires:
  - phase: 15-journal-gate-hook-context7-mcp (plan 05)
    provides: "-C <path> aware journal-gate hook (TARGETDIR extraction, GIT() wrapper, absolute GITDIR resolution), 15 passing scenarios"
provides:
  - "Fail-closed compound-command-plus--C guard and fail-closed unresolvable--C target (closes CR-01/CR-02/CR-03 from 15-REVIEW.md)"
  - "HASREALC existence gate + RAWCOUNT ambiguity check: raw-text -C extraction only runs when $UNQUOTED confirms a real, non-quoted git -C flag exists AND the anchor pattern matches raw $CMD exactly once (closes CR-06/CR-07, a regression introduced by round 2 of this same plan)"
  - "7 new adversarial regression tests (CR-01 through CR-07) added to both npm and pip integration suites; 22/22 passing in both, zero regressions against the 15 pre-existing scenarios"
affects: [16-goodvibes-update-json-merge]

tech-stack:
  added: []
  patterns:
    - "HASREALC gate: raw-$CMD extraction never runs unless $UNQUOTED (quote-stripped) already confirms a real -C flag exists, preventing commit-message text from ever being mistaken for a real flag"
    - "RAWCOUNT ambiguity check: fail closed (BLOCKED) if the git -C anchor pattern matches raw $CMD more than once, rather than guessing which occurrence is real"

key-files:
  created: []
  modified:
    - templates/.claude/settings.json
    - .claude/settings.json
    - packages/npm/templates/.claude/settings.json (gitignored prebuild mirror)
    - packages/npm/src/steps/journal-gate-hook.integration.test.ts
    - packages/pip/tests/test_journal_gate_hook.py

key-decisions:
  - "Fail closed on compound-command-plus--C (rather than a 4th regex layer for clause-scoped extraction) per HOOK-01's no-separate-script-file constraint and the escalating defect pattern across rounds 1-2"
  - "Went through 3 rounds (this plan's own round 1 fixed CR-01/02/03 but round 2's fix for a checker-flagged issue introduced CR-06/CR-07; round 3, documented here, fixed those without reopening anything else) — the orchestrator personally derived, locally verified via a real sh -c harness against hand-built repos, and JSON-round-trip-verified the round-3 fix string before handing it to the planner, to break the pattern of the planner introducing new bugs while fixing the last one"

patterns-established:
  - "Orchestrator-derived, pre-verified fix strings handed to the planner character-for-character (with explicit instruction not to re-derive the regex) once a defect class has recurred across multiple rounds"

requirements-completed: [HOOK-01, HOOK-02]

duration: ~3 rounds (round 1 + 2 revisions)
completed: 2026-09-06
---

# Phase 15 Plan 06: Close CR-01/CR-02/CR-03 -C bypasses, then CR-06/CR-07 regression from round 2 Summary

**Journal-gate hook now fails closed on both an unresolvable `-C` target and a compound-command-plus-`-C` combination (CR-01/02/03), and — after a round-2 regression was caught by `gsd-plan-checker` before shipping — gates all raw-text `-C` extraction behind a confirmed-real-flag existence check plus an unambiguous single-match requirement, so commit-message text that merely resembles a `-C` flag can never be mistaken for a real one in either direction (CR-06/CR-07).**

## Performance

- **Duration:** ~3 revision rounds (round 1 fix, round 2 fix + regression, round 3 fix)
- **Tasks:** 2 per round (RED, GREEN), round 3 is the shipped state
- **Files modified:** 5 (2 test files, 2 settings.json + 1 gitignored prebuild mirror)

## Accomplishments
- Closed CR-01 (unresolvable `-C` target fails open), CR-02 (unrelated `-C` in a chained command hijacks routing), CR-03 (quoted `-C` path with a space silently reintroduces the original bug) — all three critical bypasses found in 15-REVIEW.md's black-box probing of 15-05's fix
- Round 2's own fix for CR-03 introduced a new pair of bugs (CR-06 bypass, CR-07 false-block: raw-text extraction ran unconditionally without confirming a real flag exists) — caught by `gsd-plan-checker` before it ever shipped, not after
- Round 3 added `HASREALC` (confirms a real `-C` flag via `$UNQUOTED` before any raw-text extraction) and `RAWCOUNT` (fails closed if the raw-text anchor matches more than once) — closes CR-06/CR-07 without reopening CR-01 through CR-05
- 22 total scenarios (15 pre-existing + 7 new CR-01 through CR-07) pass in both `packages/npm/src/steps/journal-gate-hook.integration.test.ts` and `packages/pip/tests/test_journal_gate_hook.py`
- Full regression suites remain green: 168 passed/1 skipped/2 todo (npm), 176 passed (pip)
- `templates/.claude/settings.json`, `.claude/settings.json`, and the regenerated `packages/npm/templates/.claude/settings.json` mirror carry byte-identical `hooks.PreToolUse` blocks (1879 chars)
- Independently re-verified by the orchestrator (not just the executing subagent's self-report): byte-diff of all three settings.json files against a pre-derived, locally-tested fix string; direct `sh -c` reproduction of all 7 CR directions plus 15-05's Test D/E/F against the actual shipped hook; a second `gsd-plan-checker` pass returned `## VERIFICATION PASSED` with 0 blockers

## Task Commits

Round 3 (shipped state):

1. **Task 1: Add CR-06/CR-07 adversarial regression tests (RED)** - `91b9edb` (test)
2. **Task 2: Gate raw -C extraction on a confirmed real flag, fail closed on ambiguity (GREEN)** - `4e0fe3a` (fix)

Prior rounds (superseded by round 3, kept for history): round 1 revision `689373e`; round 2's fix was drafted but never independently committed as its own GREEN commit — the checker caught CR-06/CR-07 in round 2's draft before it shipped, so round 3's commits above are the only code changes from this plan that ever landed on `main`.

## Files Created/Modified
- `packages/npm/src/steps/journal-gate-hook.integration.test.ts` - added CR-01 through CR-07 (22 total scenarios)
- `packages/pip/tests/test_journal_gate_hook.py` - added CR-01 through CR-07 (22 total scenarios, mirrored)
- `templates/.claude/settings.json` - hook command adds `HASREALC` gate and `RAWCOUNT` ambiguity check around `TARGETDIR` extraction
- `.claude/settings.json` - identical hook command change (dogfood parity); `permissions.allow` untouched
- `packages/npm/templates/.claude/settings.json` - regenerated via `npm run prebuild` (gitignored, not committed)

## Decisions Made
- Orchestrator personally derived and locally verified the round-3 fix (via a real `sh -c` test harness against hand-built temp git repos, plus a Python `json.dumps`/`json.loads` round-trip check) before handing it to the planner character-for-character, explicitly forbidding it from re-deriving the regex logic — breaking the pattern where rounds 1 and 2 each fixed the prior round's bug while introducing a new one
- Fail-closed-on-ambiguity (rather than a smarter clause-scoped regex) chosen for the `RAWCOUNT` check, consistent with the plan's existing fail-closed philosophy for the compound-command case (T-15-13) and the unresolvable-target case (T-15-15)

## Deviations from Plan
None beyond the round-1→round-2→round-3 revision history itself, which is the expected shape of a `--gaps` closure loop, not a deviation from an approved plan.

## Issues Encountered
- **Executor gap:** the round-3 executing subagent applied and committed the fix correctly but did not create this `15-06-SUMMARY.md` file, despite the plan's `<output>` section requiring it. Created retroactively by the orchestrator from independently-verified facts (see JOURNAL.md's 2026-09-06 entries) once the gap was noticed during `/gsd-verify-work`.
- **Known issue, not fixed (out of scope for this plan):** a `git add <files> && git commit -m "$(cat <<'EOF' ...)"` heredoc-substitution commit appeared to bypass the *round-2* (pre-fix) hook's JOURNAL.md-staged check once during manual use; an isolated `sh -c` reproduction of the identical command shape did not reproduce it, so the exact trigger is unconfirmed. Flagged in JOURNAL.md for a future round.
- **Accepted, documented risk (T-15-20):** a legitimate single `-C` invocation whose commit message independently repeats the literal "git -C" anchor phrase will now fail closed (BLOCKED, "ambiguous") even though the first occurrence is the real flag — a narrow, safe-direction false-positive surface, not a bypass.
- **Accepted, documented risk (T-15-21):** `--amend` used as `-C`'s own literal value (e.g. `git -C --amend commit -am "fix"`) is not independently exploitable and requires no fix this round.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- HOOK-01 and HOOK-02 requirements remain fully satisfied; CR-01 through CR-07 (7 adversarial `-C`-related defects across 2 planning rounds) are now closed and independently re-verified
- `gsd-plan-checker`'s round-3 pass found 0 blockers and 2 non-blocking warnings (the T-15-20-adjacent `-C`-value-text false-block corner case, and a pre-existing, out-of-scope tab-escape JSON-field-extraction defect from phase 15-01) — both filed for future tracking, neither reopens this plan's scope
- No blockers for Phase 16

---
*Phase: 15-journal-gate-hook-context7-mcp*
*Completed: 2026-09-06*
