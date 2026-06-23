---
phase: 02-npm-cli
plan: "02"
subsystem: cli-file-engine
tags: [typescript, fs-extra, sentinel-merge, copy-templates, tdd, esm]

dependency_graph:
  requires:
    - phase: 02-npm-cli
      plan: "01"
      provides: packages/npm/ scaffold with vitest, tsup, todo stub test files
    - phase: 01-template-content-repo-foundation
      provides: templates/ directory with CLAUDE.md (sentinel format established)
  provides:
    - packages/npm/src/utils/sentinel-merge.ts (four-case CLAUDE.md merge, mergeClaude export)
    - packages/npm/src/utils/sentinel-merge.test.ts (13 passing unit tests)
    - packages/npm/src/steps/copy-templates.ts (bulk copy orchestrator, copyTemplates/listTemplateFiles/resolveTemplatesDir)
    - packages/npm/src/steps/copy-templates.test.ts (9 passing integration tests)
  affects:
    - Wave 1 plans (02-03, 02-04) can now call copyTemplates and mergeClaude in the init action handler
    - NPM-04 (file list on completion) satisfied by listTemplateFiles return value

tech-stack:
  added: []
  patterns:
    - "TDD: RED (test commit) → GREEN (impl commit) per task"
    - "ESM path resolution: fileURLToPath(new URL('../../../../templates', import.meta.url)) — 4 levels up from src/steps/ to repo root"
    - "Four-case sentinel merge: A (create), B (append), C (replace block), D (skip if version >=)"
    - "parseInt-based version comparison — handles 1.10 > 1.9 correctly, zero runtime deps"
    - "fs-extra copy with overwrite:false + CLAUDE.md filter — belt-and-suspenders with sentinel merge"

key-files:
  created:
    - packages/npm/src/utils/sentinel-merge.ts
    - packages/npm/src/utils/sentinel-merge.test.ts
    - packages/npm/src/steps/copy-templates.ts
  modified:
    - packages/npm/src/steps/copy-templates.test.ts (replaced 4 todo stubs with 9 integration tests)

decisions:
  - "parseInt-based version compare chosen over semver package — 5 lines handles N.M.P format correctly, zero new runtime dependency (confirmed resolution from RESEARCH.md open question 3)"
  - "Path depth for resolveTemplatesDir is ../../../../templates (4 levels), not ../../../templates (3) — plan had off-by-one; corrected as Rule 1 auto-fix"
  - "Path traversal guard added to copy filter per T-02-02-A threat mitigation — belt-and-suspenders since templates are repo-controlled"

metrics:
  duration: 12min
  completed: "2026-06-23"
  tasks: 2
  files_created: 3
  files_modified: 1
---

# Phase 02 Plan 02: File Copy Engine — Sentinel Merge + Bulk Copy Summary

**Four-case CLAUDE.md sentinel merge (parseInt version compare, zero new deps) and idempotent fs-extra bulk copy orchestrator with --dry-run and --minimal flag support**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-23
- **Completed:** 2026-06-23
- **Tasks:** 2
- **Files created:** 3 new, 1 modified

## Accomplishments

- Implemented `sentinel-merge.ts` with all four cases: A (create file), B (append block to no-sentinel file), C (replace block when version older), D (skip when version >=). Uses parseInt-based comparison — no `semver` dependency added.
- Implemented `copy-templates.ts` with `copyTemplates` (bulk fs-extra copy + sentinel merge routing), `listTemplateFiles` (recursive sorted relative paths), and `resolveTemplatesDir` (ESM-safe fileURLToPath).
- Wrote 13 sentinel-merge unit tests and 9 copy-templates integration tests against real temp directories. All 22 pass. Full TDD cycle followed (RED commit → GREEN commit) for both tasks.
- Case B idempotency confirmed: calling `mergeClaude` twice on a file with no sentinel appends the block exactly once.
- Second-run idempotency confirmed: calling `copyTemplates` twice produces no errors; CLAUDE.md is unchanged (Case D skip); user-edited non-CLAUDE.md files preserved (overwrite:false).

## Task Commits

1. **Task 1 RED: Failing sentinel-merge tests** — `b9aa84b` (test)
2. **Task 1 GREEN: sentinel-merge implementation** — `ab31996` (feat)
3. **Task 2 RED: Failing copy-templates tests** — `23fd403` (test)
4. **Task 2 GREEN: copy-templates implementation** — `01f4c33` (feat)

## Files Created/Modified

- `packages/npm/src/utils/sentinel-merge.ts` — exports `mergeClaude`, `extractVersion`, `versionGte`; SENTINEL_START/END constants; parseInt-based version comparison
- `packages/npm/src/utils/sentinel-merge.test.ts` — 13 unit tests covering all 4 cases (A, B, B-idempotency, C, D, D2) plus extractVersion and versionGte
- `packages/npm/src/steps/copy-templates.ts` — exports `copyTemplates(templateDir, destDir, dryRun, minimal)`, `listTemplateFiles(templateDir)`, `resolveTemplatesDir()`; path traversal guard per T-02-02-A
- `packages/npm/src/steps/copy-templates.test.ts` — 9 integration tests using real temp dirs (replaced 4 todo stubs)

## Decisions Made

1. **parseInt-based version comparison:** `semver` npm package would work but adds a runtime dependency. The version stamp format (`# goodvibes: v1.0.0`) is simple N.M.P — five lines of parseInt handles it correctly including the 1.10 > 1.9 edge case. Zero new deps.

2. **resolveTemplatesDir uses 4 levels up (`../../../../templates`):** The plan specified `../../../templates` (3 levels) but the actual path from `packages/npm/src/steps/copy-templates.ts` requires 4 traversals to reach repo root. Auto-fixed as Rule 1 (bug).

3. **Path traversal guard in copy filter:** `relative(templateDir, src).includes('..')` check added per T-02-02-A threat mitigation. Templates are repo-controlled so this is belt-and-suspenders, but the threat model requires `mitigate` disposition.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed resolveTemplatesDir path depth (off-by-one in plan)**
- **Found during:** Task 2 GREEN — all copy-templates tests failed with `ENOENT: /home/ygiokas/GoodVibes/packages/templates`
- **Issue:** Plan specified `new URL('../../../templates', import.meta.url)` (3 levels up). From `packages/npm/src/steps/copy-templates.ts`, URL resolution: strip filename → `src/steps/`, `../` → `src/`, `../../` → `npm/`, `../../../` → `packages/` (not repo root). One `../` short.
- **Fix:** Changed to `new URL('../../../../templates', import.meta.url)` — correctly resolves to `/home/ygiokas/GoodVibes/templates`
- **Files modified:** `packages/npm/src/steps/copy-templates.ts`
- **Committed in:** `01f4c33` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan's path specification)
**Impact on plan:** Necessary correction. The plan's path was off-by-one; fix is minimal and correct.

## Known Stubs

None. Both modules are fully implemented and tested. The todo stubs in the other Wave 1 test files (`detect-python.test.ts`, `install-headroom.test.ts`, `configure-mcp.test.ts`, `init.test.ts`, `index.test.ts`) are out-of-scope for this plan and will be addressed in plans 02-03 and 02-04.

## Threat Surface Scan

No new threat surface beyond the plan's threat model. The copy filter provides path traversal protection (T-02-02-A mitigated). CLAUDE.md sentinel guard validates both markers before replacement (T-02-02-B mitigated — if SENTINEL_END missing, `endIdx` is -1 and the code falls through to Case B append rather than corrupting content). No network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- packages/npm/src/utils/sentinel-merge.ts: FOUND
- packages/npm/src/utils/sentinel-merge.test.ts: FOUND
- packages/npm/src/steps/copy-templates.ts: FOUND
- packages/npm/src/steps/copy-templates.test.ts: FOUND (modified)
- Commit b9aa84b exists: FOUND
- Commit ab31996 exists: FOUND
- Commit 23fd403 exists: FOUND
- Commit 01f4c33 exists: FOUND
- npm test exits 0: CONFIRMED (22 passed, 19 todo)
- npm run build exits 0: CONFIRMED (ESM dist/index.js 858 B)
