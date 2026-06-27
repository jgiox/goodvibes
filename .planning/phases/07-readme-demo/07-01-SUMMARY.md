---
phase: 07-readme-demo
plan: "01"
subsystem: ui
tags: [readme, badges, shields.io, npm, pypi, metadata, markdown]

requires:
  - phase: 06-ux-hardening
    provides: "--minimal flag with .github/ and docs/ filter, written/skipped counts in output"

provides:
  - "Hero README with tagline, four live flat-square badges, GIF embed placeholder, Quick start above the fold"
  - "npm package.json with ai-coding, claude-code, copilot discovery keywords"
  - "PyPI pyproject.toml with ai-coding, claude-code, copilot keywords and [project.urls] Homepage"

affects: [07-02-demo-tape, 07-03-vhs-ci]

tech-stack:
  added: []
  patterns:
    - "README hero layout: title → tagline blockquote → badges → GIF → Quick start (command above the fold)"
    - "Shields.io flat-square style for npm/PyPI/CI/license badges"
    - "[project.urls] PyPI metadata table for homepage linking"

key-files:
  created: []
  modified:
    - README.md
    - packages/npm/package.json
    - packages/pip/pyproject.toml

key-decisions:
  - "Left-align badges (no <div align=center>) per D-03 — consistent with repo convention, works on mobile"
  - "GIF embed uses relative path [![demo](docs/demo.gif)](docs/demo.gif) — Plan 02 populates actual GIF"
  - "[project.urls] placed after [project.scripts] and before [build-system] per PyPI packaging standard"
  - "package-lock.json synced from stale 1.1.0 to 1.3.0 as side effect of npm install for test run"

patterns-established:
  - "Pattern: prerequisites section placed after Flags — value proposition and command before requirements"
  - "Pattern: Flags section explicitly lists what --minimal skips (named directories, not vague 'CI/docs')"

requirements-completed: [README-01, README-02, README-03, README-04]

duration: 8min
completed: 2026-06-27
---

# Phase 07 Plan 01: README Hero Redesign Summary

**Hero README with tagline blockquote, four flat-square Shields.io badges, GIF embed, and Quick start above the fold; npm/PyPI discovery keywords synced**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-27T05:55:41Z
- **Completed:** 2026-06-27T06:03:20Z
- **Tasks:** 2
- **Files modified:** 4 (README.md, package.json, pyproject.toml, package-lock.json)

## Accomplishments

- Rewrote README.md with D-01 section order: title → tagline → badges → GIF placeholder → Quick start → What you get → Flags → What you need first → Platform support → Docs
- Added all four Shields.io flat-square badges (npm version, PyPI version, CI status, License) as exact URLs from D-08
- Updated `## Flags` to explicitly state `--minimal` skips `.github/` and `docs/`
- Synced 3 discovery keywords (`ai-coding`, `claude-code`, `copilot`) to npm package.json (9 total) and PyPI pyproject.toml
- Added `[project.urls]` table to pyproject.toml with Homepage pointing to GitHub repo
- Both test suites confirmed passing after metadata edits (71 TS, 74 Python)

## Task Commits

1. **Task 1: README hero redesign** - `04c32c0` (feat)
2. **Task 2: Package metadata sync** - `f1cbfe6` (feat)
3. **Lockfile sync** - `ce005f0` (chore)
4. **JOURNAL.md update** - `36c0d45` (docs)

## Files Created/Modified

- `README.md` — Full hero redesign: tagline, 4 badges, GIF embed, section reorder
- `packages/npm/package.json` — Added ai-coding, claude-code, copilot keywords (6 → 9)
- `packages/pip/pyproject.toml` — Added 3 keywords and [project.urls] Homepage entry
- `packages/npm/package-lock.json` — Synced version from stale 1.1.0 to 1.3.0

## Decisions Made

- Left-aligned badges without HTML wrappers per D-03 and existing repo convention
- GIF embed is a placeholder (`[![demo](docs/demo.gif)](docs/demo.gif)`) — the actual GIF is produced by Plan 02
- `[project.urls]` table placed between `[project.scripts]` and `[build-system]` following PyPI packaging convention
- package-lock.json stale version (1.1.0 vs package.json 1.3.0) fixed opportunistically during `npm install` test run

## Deviations from Plan

None — plan executed exactly as written.

The package-lock.json version sync was a side effect of running `npm install` to install devDependencies before the test run. It is not a deviation; the lock was already inconsistent with package.json (a pre-existing condition) and aligning them is correct.

## Issues Encountered

- `npm test` failed with `vitest: not found` because `node_modules` were not present in the worktree. Ran `npm install` first, then tests passed. Not a code defect — isolated worktree environment.

## User Setup Required

None — no external service configuration required. The GIF embed placeholder (`docs/demo.gif`) will be populated in Plan 02.

## Known Stubs

- `[![demo](docs/demo.gif)](docs/demo.gif)` in README.md — the GIF file does not yet exist; this is an intentional placeholder. Plan 02 (VHS tape) creates `scripts/demo.tape` and commits an initial `docs/demo.gif`. Plan 03 (vhs.yml) automates regeneration in CI.

## Next Phase Readiness

- README.md hero layout is complete and correct; badges will resolve once npm/PyPI packages are live
- Plan 02 (VHS demo tape) can proceed: it authors `scripts/demo.tape`, produces `docs/demo.gif`, and validates GIF size
- Plan 03 (vhs.yml CI workflow) can proceed in parallel with Plan 02 (Wave 1)

## Self-Check

**Created files check:**
- `.planning/phases/07-readme-demo/07-01-SUMMARY.md` — this file

**Modified files check:**
- `README.md` — contains tagline, 4 badges, GIF embed, ## Quick start, ## What you need first, ## Flags with .github/ mention
- `packages/npm/package.json` — keywords array has 9 entries including ai-coding
- `packages/pip/pyproject.toml` — keywords include ai-coding; [project.urls] present
- `packages/npm/package-lock.json` — version 1.3.0

**Commits check:**
- `04c32c0` — feat(07-01): README hero redesign
- `f1cbfe6` — feat(07-01): sync package metadata
- `ce005f0` — chore(07-01): sync package-lock.json version
- `36c0d45` — docs(07-01): add Phase 7 Plan 01 journal entry

## Self-Check: PASSED

---
*Phase: 07-readme-demo*
*Completed: 2026-06-27*
