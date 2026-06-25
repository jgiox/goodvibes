---
phase: 05-upgrade-command-template-repo
plan: "01"
subsystem: testing
tags: [vitest, pytest, tdd, upgrade, shell, smoke-harness]

# Dependency graph
requires:
  - phase: 04-ci-scaffolding
    provides: detect-project-type step used in upgrade test mock setup patterns
  - phase: 03-pip-cli
    provides: sentinel_merge.py, copy_templates.py, main.py app structure
  - phase: 02-npm-cli
    provides: sentinel-merge.ts, copy-templates.ts, init.test.ts mock pattern
provides:
  - RED vitest test suite for upgrade command (5 tests, upgrade.test.ts)
  - RED pytest test suite for upgrade command (6 tests, test_upgrade_cmd.py)
  - verify-phase5.sh smoke harness (10 checks, grep-gate pattern)
affects:
  - 05-02 (upgrade command TS implementation — turns these RED tests GREEN)
  - 05-03 (upgrade command Python implementation — turns these RED tests GREEN)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED gate: dynamic import inside test body fails when module absent (TS)"
    - "TDD RED gate: pytest fails on first test when typer subcommand not registered (Python)"
    - "verify-phase5.sh grep-gate: grep -v '^#' | grep -q to exclude comment-only lines (T-05-01)"

key-files:
  created:
    - packages/npm/src/commands/upgrade.test.ts
    - packages/pip/tests/test_upgrade_cmd.py
    - scripts/verify-phase5.sh
  modified:
    - JOURNAL.md
    - packages/npm/package-lock.json

key-decisions:
  - "All 5 TS tests and 6 Python tests are RED by design — no implementation ships in this plan"
  - "verify-phase5.sh uses grep -v '^#' | grep -q pattern to guard against comment lines self-validating checks (T-05-01)"
  - "Python tests mock at goodvibes_cli.commands.upgrade_cmd.* namespace — module absent means all mocker.patch calls also fail, keeping tests RED"

patterns-established:
  - "TDD RED gate: import('./upgrade.js') inside test body produces Cannot find module error — no try/catch wrapping"
  - "verify-phase5.sh structure mirrors verify-phase4.sh verbatim — copy-and-replace pattern for Phase N harnesses"

requirements-completed:
  - UPG-01
  - UPG-02
  - UPG-03
  - UPG-04

# Metrics
duration: 18min
completed: 2026-06-25
---

# Phase 5 Plan 01: RED Unit Tests + Smoke Harness for Upgrade Command

**TDD RED gate established: vitest (5 tests) and pytest (6 tests) fail because upgrade.ts and upgrade_cmd.py do not yet exist; verify-phase5.sh exits 1 with "Phase 5 gate: FAIL"**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-25T08:10:00Z
- **Completed:** 2026-06-25T08:28:35Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- 5 RED vitest tests in upgrade.test.ts covering: skips-up-to-date, dry-run-no-write, absent-CLAUDE-runs-upgrade, diff-summary-printed, preserves-user-content-outside-sentinel
- 6 RED pytest tests in test_upgrade_cmd.py covering: upgrade-help-dry-run, dry-run-shows-summary, skips-up-to-date, runs-when-absent, diff-summary-printed, user-content-via-merge-claude
- verify-phase5.sh smoke harness with 10 checks (5 file existence, 5 content correctness) using T-05-01 grep-gate pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Write RED unit tests for upgrade command (TypeScript)** - `a970a46` (test)
2. **Task 2: Write RED unit tests for upgrade command (Python) and verify-phase5.sh harness** - `2e9930a` (test)

## Files Created/Modified
- `packages/npm/src/commands/upgrade.test.ts` - 5 vitest RED tests for upgrade command; all external I/O mocked
- `packages/pip/tests/test_upgrade_cmd.py` - 6 pytest RED tests for upgrade command; follows test_main.py pattern
- `scripts/verify-phase5.sh` - Phase 5 smoke harness; mirrors verify-phase4.sh structure; executable
- `JOURNAL.md` - Phase 5 Plan 01 entry added
- `packages/npm/package-lock.json` - Updated after installing worktree node_modules

## Decisions Made
- None — followed plan as specified. All mock patterns copied from init.test.ts (TS) and test_main.py (Python) exactly as directed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed node_modules in worktree**
- **Found during:** Task 1 verification
- **Issue:** Worktree had no node_modules; `npm test` failed with `sh: vitest: not found`
- **Fix:** Ran `npm install --prefer-offline` in the worktree's packages/npm directory
- **Files modified:** packages/npm/package-lock.json (updated), packages/npm/node_modules/ (created, gitignored)
- **Verification:** `npm test` ran successfully, 5 failures in upgrade.test.ts as expected
- **Committed in:** a970a46 (Task 1 commit — package-lock.json included)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for test execution infrastructure. No scope creep.

## Issues Encountered
- None beyond the worktree node_modules installation resolved by Rule 3.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None — this plan contains only test files and a smoke harness. No implementation code was written.

## Next Phase Readiness
- RED gate established: both test suites fail cleanly because upgrade.ts / upgrade_cmd.py are absent
- Plans 02-03 can implement the upgrade command and these tests will turn GREEN
- verify-phase5.sh --quick exits 1 until all implementation files exist and are registered

---
*Phase: 05-upgrade-command-template-repo*
*Completed: 2026-06-25*
