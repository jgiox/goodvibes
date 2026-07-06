---
phase: 13-anonymous-telemetry
plan: "04"
subsystem: npm-init-wiring
tags: [telemetry, typescript, init-command, privacy, opt-out]
dependency_graph:
  requires: [13-02]
  provides: [packages/npm/src/commands/init.ts telemetry wiring]
  affects: [packages/npm/src/commands/init.test.ts]
tech_stack:
  - TypeScript
  - vitest
status: complete
---

# Plan 13-04 — npm init telemetry wiring — SUMMARY

## What was built

Wired telemetry disclosure and fire-and-forget timing into `packages/npm/src/commands/init.ts`.

### Changes

**packages/npm/src/commands/init.ts**
- Import added: `import { sendTelemetry } from '../steps/telemetry.js'`
- Opt-out flag: `const telemetryOptOut = process.env.DO_NOT_TRACK === '1' || process.env.GOODVIBES_NO_TELEMETRY === '1' || process.env.CI === 'true'`
- Disclosure note: `if (!telemetryOptOut) { note('Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out.', 'Privacy') }` — immediately after `intro()`, before the dry-run guard
- `const telemetryPromise = sendTelemetry()` — after the dry-run early return (Pitfall 6 safe)
- `await Promise.race([telemetryPromise, sleep(1_000)])` — after `tasks()` completes
- `function sleep(ms: number): Promise<void>` — inline helper at bottom of file

**packages/npm/src/commands/init.test.ts**
- `vi.mock('../steps/telemetry.js', () => ({ sendTelemetry: vi.fn().mockResolvedValue(undefined) }))` — prevents real HTTP in ALL tests
- New test: `shows disclosure note with Privacy title before file operations` (TEL-04)
- New test: `does not call sendTelemetry during --dry-run`
- New test: `does not show disclosure note when DO_NOT_TRACK is set to 1` (ROADMAP SC2)

## Test results

```
Tests  132 passed | 1 skipped | 2 todo (135)
```

All 132 tests passing including 3 new telemetry tests.

## Decisions honored

- D-08: exact disclosure text `"Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out."`
- D-09: note() placed immediately after intro()
- D-10: Promise.race 1s cap
- D-04: npm wiring mirrors pip (same disclosure, same opt-out vars, same timing pattern)
- ROADMAP SC2: disclosure suppressed when opted out
