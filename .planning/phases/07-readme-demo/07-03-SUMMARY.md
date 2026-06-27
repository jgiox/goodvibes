---
phase: 07-readme-demo
plan: "03"
subsystem: infra
tags: [github-actions, vhs, vhs-action, git-auto-commit-action, ci, demo-gif]

# Dependency graph
requires:
  - phase: 07-readme-demo/07-02
    provides: scripts/demo.tape (VHS tape file that vhs.yml records)
provides:
  - .github/workflows/vhs.yml — CI workflow that auto-regenerates docs/demo.gif when scripts/demo.tape changes on main
affects:
  - 07-readme-demo/07-01 (README references docs/demo.gif produced by this workflow)

# Tech tracking
tech-stack:
  added:
    - charmbracelet/vhs-action@v2.1.0 (GitHub Actions action — runs VHS in CI)
    - stefanzweifel/git-auto-commit-action@v7.1.0 (GitHub Actions action — commits generated GIF back to repo)
  patterns:
    - Path-filtered push trigger to prevent infinite loop on CI-generated asset commit-back
    - Job-level permissions: contents: write (not workflow-level) for least-privilege GITHUB_TOKEN scope

key-files:
  created:
    - .github/workflows/vhs.yml
  modified: []

key-decisions:
  - "vhs-action@v2.1.0 pinned to exact version tag (not @latest) — follows repo version-tag convention from ci.yml/publish-npm.yml"
  - "git-auto-commit-action@v7.1.0 (not v5 — v5 never existed; action went v4 → v7)"
  - "permissions: contents: write at job level (not workflow level) for least-privilege scope"
  - "No workflow_dispatch trigger per D-13 — push-on-tape-change is sufficient"
  - "Path filter paths: ['scripts/demo.tape'] is the sole infinite-loop prevention mechanism; no [skip ci] annotation needed"

patterns-established:
  - "CI asset auto-commit pattern: vhs-action → git-auto-commit-action with file_pattern scoping"
  - "Path-filtered workflow trigger prevents re-triggering on generated asset commits"

requirements-completed:
  - DEMO-02

# Metrics
duration: 2min
completed: 2026-06-27
---

# Phase 7 Plan 03: VHS CI Workflow Summary

**GitHub Actions workflow that auto-regenerates docs/demo.gif via charmbracelet/vhs-action@v2.1.0 when scripts/demo.tape changes on push to main**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-27T06:23:16Z
- **Completed:** 2026-06-27T06:25:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created .github/workflows/vhs.yml with correct path filter, permissions, and action versions
- Infinite loop prevention via paths: ['scripts/demo.tape'] — GIF commit never touches demo.tape
- Job-level `permissions: contents: write` enables git-auto-commit-action@v7.1.0 to push without a PAT
- file_pattern: 'docs/demo.gif' scopes the auto-commit to the GIF only

## Task Commits

Each task was committed atomically:

1. **Task 1: Create .github/workflows/vhs.yml (D-13, D-14, D-15)** - `e54e1bd` (feat)

## Files Created/Modified

- `.github/workflows/vhs.yml` - CI workflow that triggers on push to main when scripts/demo.tape changes; runs vhs-action@v2.1.0 to produce docs/demo.gif; commits it back with git-auto-commit-action@v7.1.0

## Decisions Made

- Followed version-tag pinning convention from existing repo workflows (ci.yml uses @v7, @v6) — not SHA pinning
- git-auto-commit-action@v7.1.0 (research confirmed v5/v6 never existed; action version history is v4 → v7)
- No GITHUB_TOKEN field needed in git-auto-commit-action step — it uses the default GITHUB_TOKEN implicitly

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. The workflow uses GITHUB_TOKEN (default, no PAT needed). It activates automatically when any push to main touches `scripts/demo.tape`.

## Next Phase Readiness

- vhs.yml is committed and ready to trigger on the first push that includes scripts/demo.tape
- Once Plan 07-02 (demo.tape) is merged into main, the first CI run will produce docs/demo.gif
- Plan 07-01 (README) can proceed — README already references docs/demo.gif via relative path

---

## Self-Check

### Files Exist
- [x] `.github/workflows/vhs.yml` — created at worktree path, committed as `e54e1bd`

### Commits Exist
- [x] `e54e1bd` — feat(07-03): add vhs.yml workflow to auto-regenerate demo GIF

## Self-Check: PASSED

---
*Phase: 07-readme-demo*
*Completed: 2026-06-27*
