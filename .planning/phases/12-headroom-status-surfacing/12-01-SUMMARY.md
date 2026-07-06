---
phase: 12-headroom-status-surfacing
plan: 01
subsystem: testing
tags: [typescript, vitest, tdd, headroom, execa, subprocess]

# Dependency graph
requires:
  - phase: 02-npm-cli
    provides: install-headroom.ts and configure-mcp.ts step functions (the files modified here)
provides:
  - HeadroomResult exported discriminated union type from install-headroom.ts
  - McpResult exported discriminated union type from configure-mcp.ts
  - headroom idempotency probe using compress --help (functional test, not PATH-only check)
  - 10-second timeout on every execa call in both step files
  - zero throw sites in configure-mcp.ts (full soft-fail coverage)
affects:
  - 12-02-PLAN (commands layer consumes HeadroomResult/McpResult to surface status in init.ts/doctor.ts)
  - 12-03-PLAN (Python parity: same probe and timeout pattern in install_headroom.py/configure_mcp.py)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated union return types from step functions (Promise<HeadroomResult> / Promise<McpResult>)"
    - "Functional subprocess probe (compress --help) over PATH-only check (--version)"
    - "Hard timeout on all subprocess calls ({ timeout: 10_000 }) to prevent hangs"
    - "Steps-never-throw invariant enforced via return { status: 'failed' } at all error paths"

key-files:
  created: []
  modified:
    - packages/npm/src/steps/install-headroom.ts
    - packages/npm/src/steps/configure-mcp.ts
    - packages/npm/src/steps/install-headroom.test.ts
    - packages/npm/src/steps/configure-mcp.test.ts
    - JOURNAL.md

key-decisions:
  - "HeadroomResult and McpResult are discriminated unions (not optional fields) — TypeScript enforces exhaustiveness at callsites"
  - "compress --help probe chosen over --version: catches broken installs where binary on PATH but compression pipeline fails (e.g. Windows + Python 3.13 hnswlib failure)"
  - "timeout: 10_000 (10s) chosen for all subprocess calls — balances CI timeout budget with real network slowness"
  - "configure-mcp.ts outer catch converted to if/else (ENOENT → fallback, else → return failed) — removes ambiguous fall-through behavior"

patterns-established:
  - "Step result type: every step function returns a typed result, never void"
  - "Functional probe pattern: test binary functionality (compress --help), not mere presence (--version)"
  - "Timeout pattern: all external subprocess calls include { timeout: 10_000 }"

requirements-completed:
  - HDR2-03
  - HDR2-04

# Metrics
duration: 5min
completed: 2026-07-06
---

# Phase 12 Plan 01: Headroom Step Refactor Summary

**HeadroomResult/McpResult discriminated union types with compress --help functional probe and 10s subprocess timeout replacing void returns and PATH-only --version check**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-06T07:18:09Z
- **Completed:** 2026-07-06T07:23:18Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 4 source + JOURNAL.md

## Accomplishments

- `installHeadroom()` now returns `HeadroomResult` — callers can display `installed / already-installed / skipped / failed` without string-parsing log messages
- `configureMcp()` now returns `McpResult` — same pattern, zero throw sites
- Idempotency probe changed from `headroom --version` (PATH-only) to `headroom compress --help` (functional) — catches broken Python 3.13/Windows installs
- Every execa call in both files carries `{ timeout: 10_000 }` — subprocess hangs no longer possible
- Added 4 new test cases covering previously untested paths: headroom-not-on-PATH skipped, fallback ENOENT skipped, headroom mcp install CalledProcessError failed, claude mcp add CalledProcessError failed

## Task Commits

1. **Task 1: RED — update TS step test assertions** - `f4a8bd2` (test)
2. **Task 2: GREEN — implement HeadroomResult/McpResult types, compress --help probe, 10s timeout** - `207ff4c` (feat)

## Files Created/Modified

- `packages/npm/src/steps/install-headroom.ts` — Added `HeadroomResult` type; probe `['--version']` → `['compress', '--help', { timeout: 10_000 }]`; all execa calls get timeout; all returns typed
- `packages/npm/src/steps/configure-mcp.ts` — Added `McpResult` type; all execa calls get timeout; both `throw` sites replaced with `return { status: 'failed', reason }`
- `packages/npm/src/steps/install-headroom.test.ts` — Result assertions on all tests; probe assertion updated; installer assertions include timeout
- `packages/npm/src/steps/configure-mcp.test.ts` — Result assertions on all tests; timeout assertion on mcp-status; 4 new tests for missing coverage paths
- `JOURNAL.md` — Entry for this task

## Decisions Made

- `compress --help` chosen as the functional probe (not `compress --version`) because `--help` exits 0 on all headroom versions without requiring valid input files
- Outer catch in `configure-mcp.ts` restructured to if/else instead of if + fall-through — eliminates ambiguity about which call triggered the ENOENT

## Deviations from Plan

### Auto-added Coverage

**1. [Rule 2 - Missing Critical] Added 4 new tests for uncovered configure-mcp code paths**
- **Found during:** Task 1 (RED test updates)
- **Issue:** The plan listed headroom-not-on-path, headroom-enoent-in-fallback, headroom-mcp-install-CalledProcessError, and claude-mcp-add-CalledProcessError as expected test assertions, but none existed in configure-mcp.test.ts
- **Fix:** Added 4 new `it()` blocks covering those paths — these test the soft-fail behavior newly introduced in Task 2
- **Files modified:** packages/npm/src/steps/configure-mcp.test.ts
- **Verification:** All 4 new tests fail in RED (correct) and pass in GREEN (correct)
- **Committed in:** f4a8bd2 (Task 1 RED commit)

**2. [Rule 2 - Correctness] Updated all execa call assertions to include timeout in RED phase**
- **Found during:** Task 1 (RED test updates)
- **Issue:** Plan specified updating mcp-status and uv-installer timeout assertions in RED, but all assertions would break in GREEN when the implementation adds timeout to every execa call
- **Fix:** Updated all `toHaveBeenCalledWith` assertions for execa calls in both test files to include `expect.objectContaining({ timeout: 10_000 })` — ensures GREEN needs only implementation changes, not test fixes
- **Files modified:** packages/npm/src/steps/install-headroom.test.ts, packages/npm/src/steps/configure-mcp.test.ts
- **Verification:** RED fails on all updated assertions; GREEN passes after implementation changes
- **Committed in:** f4a8bd2 (Task 1 RED commit)

---

**Total deviations:** 2 auto-added (both Rule 2 — missing test coverage for critical code paths)
**Impact on plan:** No scope creep — both additions ensure the TDD cycle is complete and test coverage matches implementation paths.

## Issues Encountered

None — plan executed cleanly with the TDD cycle working as designed.

## Next Phase Readiness

- `HeadroomResult` and `McpResult` are ready for import in `init.ts` (Plan 12-02) and `doctor.ts` (Plan 12-02)
- Python parity step (Plan 12-03) can proceed in parallel — same patterns apply to `install_headroom.py` and `configure_mcp.py`
- All tests green: 123 passed, 1 skipped from `cd packages/npm && npm run test`

---
*Phase: 12-headroom-status-surfacing*
*Completed: 2026-07-06*

## Self-Check: PASSED

- [x] install-headroom.ts exists: `/home/ygiokas/GoodVibes/.claude/worktrees/agent-a7e4732c784b93541/packages/npm/src/steps/install-headroom.ts`
- [x] configure-mcp.ts exists: `/home/ygiokas/GoodVibes/.claude/worktrees/agent-a7e4732c784b93541/packages/npm/src/steps/configure-mcp.ts`
- [x] RED commit f4a8bd2 exists
- [x] GREEN commit 207ff4c exists
- [x] npm run test exits 0 (123 passed)
