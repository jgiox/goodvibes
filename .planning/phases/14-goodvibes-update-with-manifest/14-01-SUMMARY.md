---
phase: 14
plan: "01"
subsystem: npm-sentinel-merge
tags: [bug-fix, tdd, sentinel, data-integrity]
dependency_graph:
  requires: []
  provides: [sentinel-merge-upd06-guard]
  affects: [packages/npm/src/utils/sentinel-merge.ts]
tech_stack:
  added: []
  patterns: [TDD RED/GREEN]
key_files:
  created: []
  modified:
    - packages/npm/src/utils/sentinel-merge.ts
    - packages/npm/src/utils/sentinel-merge.test.ts
decisions:
  - "Treat SENTINEL_START-without-SENTINEL_END as Case B (append) — mirrors Python sentinel_merge.py lines 64-68"
metrics:
  duration: "4 minutes"
  completed: "2026-07-27"
---

# Phase 14 Plan 01: UPD-06 Sentinel Guard Fix Summary

**One-liner:** TypeScript `mergeClaude` now guards `endIdx === -1` after `indexOf(SENTINEL_END)`, preventing `existing.slice(startIdx, 21)` data-corruption when SENTINEL_END is absent from a malformed CLAUDE.md.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add failing UPD-06 test (RED) | 2b7ba8b | sentinel-merge.test.ts |
| 2 | Fix sentinel-merge.ts with endIdx === -1 guard (GREEN) | ef4fa49 | sentinel-merge.ts |

## What Was Built

### Task 1 — Red test
Added test case `'SENTINEL_START without SENTINEL_END does not corrupt file'` inside the existing `describe('mergeClaude')` block. The test writes a malformed CLAUDE.md (`# User content\n\n<!-- goodvibes:start -->\norphaned start`) and asserts that `mergeClaude` treats it as Case B: user content preserved, template block appended exactly once, nothing after `<!-- goodvibes:end -->`.

Test failed at RED (confirmed bug): `existing.slice(startIdx, -1 + 22)` = `existing.slice(16, 21)` left a garbage fragment `goodvibes:start -->\norphaned start` appended after the template end marker.

### Task 2 — Green fix
Inserted a 4-line guard in `sentinel-merge.ts` at line 50, immediately after `const endIdx = existing.indexOf(SENTINEL_END)`:

```typescript
if (endIdx === -1) {
  // Malformed: SENTINEL_START without SENTINEL_END — treat as Case B (append)
  await writeFile(destPath, existing.slice(0, startIdx).trimEnd() + '\n\n' + templateBlock + '\n')
  return
}
```

This mirrors Python `sentinel_merge.py` lines 64-68 exactly. The early return prevents the incorrect slice computation and falls back to Case B behavior: preserve content before the orphaned start marker, append the full template block.

## Verification

```
Test Files  10 passed | 1 skipped (11)
     Tests  133 passed | 1 skipped | 2 todo (136)
```

New test: `✓ src/utils/sentinel-merge.test.ts > mergeClaude > SENTINEL_START without SENTINEL_END does not corrupt file`

Guard confirmed: `grep -n "endIdx === -1" sentinel-merge.ts` → line 50.

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

- RED gate: commit `2b7ba8b` — `test(14-01): add failing UPD-06 test for orphaned SENTINEL_START`
- GREEN gate: commit `ef4fa49` — `fix(14-01): guard endIdx === -1 in mergeClaude (UPD-06)`

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- [x] `packages/npm/src/utils/sentinel-merge.ts` contains `if (endIdx === -1)` at line 50
- [x] `packages/npm/src/utils/sentinel-merge.test.ts` contains `SENTINEL_START without SENTINEL_END does not corrupt file`
- [x] commit `2b7ba8b` exists (test RED)
- [x] commit `ef4fa49` exists (fix GREEN)
- [x] `npm test` exits 0 with 133 tests passing
