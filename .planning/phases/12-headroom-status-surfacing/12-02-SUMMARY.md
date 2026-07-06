---
phase: 12-headroom-status-surfacing
plan: 02
subsystem: npm-cli-commands
tags: [typescript, vitest, tdd, headroom, init, doctor, execa]

# Dependency graph
requires:
  - phase: 12-01
    provides: HeadroomResult and McpResult exported types from install-headroom.ts and configure-mcp.ts
provides:
  - init.ts emits a truthful 'Headroom' note after the file list (HDR2-01, HDR2-02)
  - doctor.ts probes headroom with compress --help + 10s timeout (HDR2-05)
  - formatHeadroomStatus inline helper for human-readable status lines
affects:
  - goodvibes init non-minimal run: shows actual install and MCP outcomes instead of hardcoded strings
  - goodvibes doctor: reports 'headroom installed and working' instead of 'headroom on PATH'

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Result capture pattern: step return value assigned to closure variable then used in note()"
    - "Inline label table: Record<StatusUnion['status'], string> resolves status variant to human-readable string"
    - "formatHeadroomStatus: inline helper (not a separate module) per ponytail rule"
    - "doctor soft-fail: empty catch on compress --help probe — doctor reports, never propagates"

key-files:
  created: []
  modified:
    - packages/npm/src/commands/init.ts
    - packages/npm/src/commands/doctor.ts
    - packages/npm/src/commands/init.test.ts
    - packages/npm/src/commands/doctor.test.ts
    - JOURNAL.md

key-decisions:
  - "formatHeadroomStatus kept inline in init.ts — too small to justify a separate module (ponytail)"
  - "Label tables declared inside the !minimal block — ponytail forbids module-level globals for data only used in one branch"
  - "doctor.ts checkHeadroom uses empty catch to soft-fail on any error (ENOENT, CalledProcessError, timedOut) — doctor's job is to report, not propagate (HDR2-05)"
  - "Headroom note guarded by !minimal && headroomResult — minimal runs never set headroomResult so no undefined access risk"

requirements-completed:
  - HDR2-01
  - HDR2-02
  - HDR2-05

# Metrics
duration: 8min
completed: 2026-07-06
---

# Phase 12 Plan 02: Commands Layer Headroom Wiring Summary

**init.ts captures HeadroomResult/McpResult and emits a 'Headroom' note; doctor.ts probes with compress --help and 10s timeout, reporting 'headroom installed and working'**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-06T07:28:00Z
- **Completed:** 2026-07-06T07:32:38Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 4 source + JOURNAL.md

## Accomplishments

- `init.ts` now imports `HeadroomResult` and `McpResult` types and captures actual step return values — no hardcoded 'headroom ready' / 'MCP server registered' strings
- `formatHeadroomStatus` inline helper renders both status variants to human-readable lines (e.g., 'headroom: installed', 'MCP: registered')
- Inline label tables for all four status variants of each result type
- 'Headroom' note is emitted after the file list in non-minimal runs, correctly guarded by `!minimal && headroomResult`
- `doctor.ts` checkHeadroom changed from PATH-only `--version` probe to functional `compress --help` with `{ timeout: 10_000 }` — catches broken installs (HDR2-05)
- Label changed from 'headroom on PATH' to 'headroom installed and working'
- All errors caught with empty catch — no re-throw — doctor reports status, never propagates subprocess failures

## Task Commits

1. **Task 1: RED — update init/doctor test assertions** - `808f24d` (test)
2. **Task 2: GREEN — init.ts result capture + Headroom note; doctor.ts functional probe** - `9e82eef` (feat)

## Files Created/Modified

- `packages/npm/src/commands/init.ts` — Added HeadroomResult/McpResult imports; formatHeadroomStatus helper; closure vars; dynamic label tables; result capture in task callbacks; Headroom note
- `packages/npm/src/commands/doctor.ts` — checkHeadroom changed to compress --help, timeout 10_000, empty catch, new label
- `packages/npm/src/commands/init.test.ts` — All 6 mockResolvedValue(undefined) → result objects; Headroom note assertion in normal run test
- `packages/npm/src/commands/doctor.test.ts` — Probe args/timeout assertions; 'headroom installed and working' assertion; not.toMatch(/headroom on PATH/i); comment updates
- `JOURNAL.md` — Phase 12-02 entry

## Decisions Made

- `formatHeadroomStatus` kept inline in `init.ts` — too small to justify a separate module (ponytail full mode)
- Label tables placed inside the `!minimal` block to avoid speculative module-level globals
- `doctor.ts` uses empty `catch` (no binding) so any execa error — ENOENT, CalledProcessError, timedOut — is treated as a soft fail, consistent with doctor's role as a reporter

## Deviations from Plan

None — plan executed exactly as written. TDD cycle was clean: RED state showed 3 failures on first run, GREEN state resolved all 3 with minimal implementation changes.

## Threat Model Coverage

Per plan threat register:

| Threat ID | Mitigation | Status |
|-----------|------------|--------|
| T-12-03 | `{ timeout: 10_000 }` in doctor.ts compress --help probe; empty catch ensures no hang propagates | Applied |
| T-12-04 | reason strings come from execa error.message (not user input); shown in local terminal only | Accepted (no change needed) |

## Known Stubs

None. The Headroom note in init.ts receives real data from the step functions — headroomResult is populated from installHeadroom() and mcpResult from configureMcp(). No mock data flows to the UI.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced.

---
*Phase: 12-headroom-status-surfacing*
*Completed: 2026-07-06*

## Self-Check: PASSED

- [x] init.ts exists and contains 'Headroom' note: `packages/npm/src/commands/init.ts`
- [x] doctor.ts exists and contains 'compress.*--help': `packages/npm/src/commands/doctor.ts`
- [x] RED commit 808f24d exists
- [x] GREEN commit 9e82eef exists
- [x] npm run test exits 0 (123 passed, 1 skipped)
