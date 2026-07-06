---
phase: 13-anonymous-telemetry
plan: "02"
subsystem: npm-cli-telemetry
tags: [telemetry, typescript, unit-tests, privacy]
dependency_graph:
  requires: []
  provides: [sendTelemetry-export]
  affects: [packages/npm/src/steps/telemetry.ts, packages/npm/src/steps/telemetry.test.ts]
tech_stack:
  added: []
  patterns: [AbortController-timeout, vi.stubGlobal-fetch-mock, dynamic-import-crypto]
key_files:
  created:
    - packages/npm/src/steps/telemetry.ts
    - packages/npm/src/steps/telemetry.test.ts
  modified: []
decisions:
  - "sleep helper NOT placed in telemetry.ts — belongs in init.ts (Plan 13-04) per plan task description"
  - "Dynamic import used for node:crypto to keep file import-free at top level (matches plan intent)"
  - "vi.stubGlobal used in every test individually rather than shared beforeEach to ensure per-test isolation"
metrics:
  duration: "3 minutes"
  completed: "2026-07-06T17:17:25Z"
  tasks: 2
  files: 2
---

# Phase 13 Plan 02: npm Telemetry Step Module Summary

**One-liner:** sendTelemetry() fire-and-forget POST with per-invocation UUID, 5s AbortController timeout, and three-env-var opt-out guard using Node 20 built-ins.

## What Was Built

### Task 1: packages/npm/src/steps/telemetry.ts (commit e6c0bb5)

Implements `sendTelemetry(): Promise<void>` with:
- Module-top `TELEMETRY_URL` constant with `GOODVIBES_TELEMETRY_URL` env override
- Opt-out guard checking `DO_NOT_TRACK=1`, `GOODVIBES_NO_TELEMETRY=1`, `CI=true` before any network call
- Per-invocation `crypto.randomUUID()` via dynamic import — never stored to disk (TEL-02)
- `AbortController` with 5-second internal timeout
- `fetch()` POST with `X-Request-Id` header carrying the UUID
- Silent `catch` block — network failures never propagate to the caller (TEL-05)
- `finally` block clears the timeout to prevent timer leaks
- Zero new runtime dependencies — uses Node 20 built-in `fetch`, `AbortController`, and `crypto.randomUUID`

### Task 2: packages/npm/src/steps/telemetry.test.ts (commit 4ccb084)

Six unit tests covering all required behaviors:
- TEL-01: fetch called once with `method: 'POST'`
- TEL-02: `X-Request-Id` header matches UUID regex `^[0-9a-f]{8}-[0-9a-f]{4}-...`
- TEL-03a: `DO_NOT_TRACK=1` — fetch not called, resolves without throw
- TEL-03b: `GOODVIBES_NO_TELEMETRY=1` — fetch not called, resolves without throw
- TEL-03c: `CI=true` — fetch not called, resolves without throw
- TEL-05: fetch rejecting — `sendTelemetry()` resolves without throwing

Uses `vi.stubGlobal('fetch', vi.fn())` (not `vi.mock`) per RESEARCH.md Pitfall 4 for ESM global mocking. Env vars isolated with `vi.stubEnv` / `vi.unstubAllEnvs`.

## Verification

```
npm test -- telemetry → 6 tests pass
npm test            → 129 passed, 1 skipped (full suite green)
npm run build       → ESM dist/index.js 26.58 KB (TypeScript compiles clean)
```

## Deviations from Plan

None — plan executed exactly as written.

Note: The plan's task description contains a self-correction ("Wait — sleep is used in init.ts, not telemetry.ts. Do NOT define sleep in telemetry.ts.") — this was followed correctly; no sleep helper was added to telemetry.ts.

## Known Stubs

`TELEMETRY_URL` contains placeholder domain `PLACEHOLDER.workers.dev` — this is intentional per plan decision D-07 and is replaced in Plan 13-06 after the Cloudflare Worker is deployed. The unit tests mock `fetch` entirely so the placeholder URL does not affect test correctness.

## Threat Flags

None — no new network endpoints or auth paths beyond the documented telemetry module. The `TELEMETRY_URL` placeholder is already tracked in the plan's threat model (T-13-02-HANG mitigated by AbortController).

## Self-Check: PASSED

- [x] `packages/npm/src/steps/telemetry.ts` exists
- [x] `packages/npm/src/steps/telemetry.test.ts` exists
- [x] Commit e6c0bb5 exists (Task 1)
- [x] Commit 4ccb084 exists (Task 2)
- [x] All 6 tests pass
- [x] TypeScript build clean
