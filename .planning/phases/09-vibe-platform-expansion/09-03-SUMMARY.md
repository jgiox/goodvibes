---
phase: 09-vibe-platform-expansion
plan: "03"
subsystem: docs
tags: [docs, readme, changelog, version-bump, platform-support]
dependency_graph:
  requires:
    - 09-01
    - 09-02
  provides:
    - Updated README IDE compatibility table (14 tools)
    - CHANGELOG [1.5.0] entry
    - JOURNAL Phase 9 close entry
    - npm package version 1.5.0
    - pip package version 1.5.0
    - templates/CLAUDE.md v1.5.0 header
  affects:
    - README.md
    - CHANGELOG.md
    - JOURNAL.md
    - packages/npm/package.json
    - packages/pip/pyproject.toml
    - templates/CLAUDE.md
tech_stack:
  added: []
  patterns:
    - Surgical single-line version bump (package.json, pyproject.toml, CLAUDE.md header)
    - Keep a Changelog format for CHANGELOG entries
key_files:
  created: []
  modified:
    - README.md
    - CHANGELOG.md
    - JOURNAL.md
    - packages/npm/package.json
    - packages/pip/pyproject.toml
    - templates/CLAUDE.md
decisions:
  - IDE count line updated to 14 (was 10) to reflect all new platforms
  - CHANGELOG version diff links section added (was absent; added alongside [1.5.0] entry)
  - templates/CLAUDE.md bumped v1.3.0 → v1.5.0 (skipped 1.4.0 since template file was not bumped in Phase 8)
metrics:
  duration: "~8 minutes"
  completed: "2026-07-01"
  tasks_completed: 2
  files_created: 0
  files_modified: 6
---

# Phase 9 Plan 03: Documentation and Version Bump Summary

**One-liner:** README IDE table extended to 14 tools (Codex CLI, Lovable, Replit Agent, Bolt.new added), CHANGELOG [1.5.0] entry written, both packages bumped to 1.5.0.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update README IDE compatibility table | 42b42a7 | README.md |
| 2 | CHANGELOG entry, JOURNAL entry, and version bump to 1.5.0 | e703fdf | CHANGELOG.md, JOURNAL.md, packages/npm/package.json, packages/pip/pyproject.toml, templates/CLAUDE.md |

## What Was Built

### Task 1: README IDE table update

Three surgical edits to README.md:

1. **IDE count line** (line ~30): Updated "Supports 10 IDEs out of the box" → "Supports 14 AI coding tools out of the box" with all 14 names listed.

2. **IDE compatibility table**: Added 4 new rows after the Continue.dev row:
   - OpenAI Codex CLI — via `AGENTS.md` (already written), automatic
   - Lovable — via `AGENTS.md` + `CLAUDE.md` (already written), automatic
   - Replit Agent — via `replit.md`, automatic
   - Bolt.new — via `.bolt/prompt`, automatic

3. **--minimal description** (line ~44): Added `replit.md, .bolt/prompt` to the list of files written under `--minimal`.

### Task 2: CHANGELOG, JOURNAL, and version bumps

**CHANGELOG.md**: Added `## [1.5.0] - 2026-07-01` entry documenting all four new template files and README table update. Also added a version diff links section at the bottom (was absent from the file; added for all versions 1.0.0–1.5.0 in Keep a Changelog format).

**JOURNAL.md**: Added Phase 9 close entry dated 2026-07-01 after the Plan 01 entry. Follows established entry format.

**packages/npm/package.json**: `1.4.0` → `1.5.0` (version field only).

**packages/pip/pyproject.toml**: `1.4.0` → `1.5.0` (version field only).

**templates/CLAUDE.md**: `# goodvibes: v1.3.0` → `# goodvibes: v1.5.0` in the sentinel header line.

## Verification Results

**Python tests (packages/pip):** 109 passed, 0 failed — full GREEN.

**TS tests (packages/npm):** 106 passed, 0 failed (2 todo), 1 file skipped — full GREEN.

```
grep -c "Codex CLI|Lovable|Replit Agent|Bolt.new" README.md → 5
# (4 table rows + 1 in the count line that lists all 14 tool names)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Worktree pip venv missing dev dependencies**
- **Found during:** Task 2 test run
- **Issue:** The worktree pip `.venv` had only runtime deps (typer, rich) installed; pytest, pytest-mock, and other dev extras were absent, causing `ModuleNotFoundError` during test collection.
- **Fix:** Ran `uv sync --extra dev` inside the worktree pip package to install dev extras. This installs already-declared `[project.optional-dependencies] dev` deps — no new packages added.
- **Files modified:** packages/pip/.venv (runtime artifact, not committed), packages/pip/uv.lock (lockfile updated, committed)
- **Commit:** e703fdf (lockfile change included)

**2. [Rule 3 - Blocker] Worktree npm package missing node_modules**
- **Found during:** Task 2 test run
- **Issue:** The worktree npm package had no `node_modules/` directory; `vitest` was not on PATH, causing `npm test` to fail with "vitest: not found".
- **Fix:** Ran `npm install` inside the worktree npm package to install declared dependencies. No new packages added.
- **Files modified:** packages/npm/node_modules (runtime artifact, not committed), packages/npm/package-lock.json (lockfile, committed)
- **Commit:** e703fdf (lockfile change included)

**3. [Rule 2 - Enhancement] Added version diff links to CHANGELOG.md**
- **Found during:** Task 2 CHANGELOG edit
- **Issue:** The plan says "add a [1.5.0] diff link at the bottom of CHANGELOG.md in the same format as [1.4.0]" but no existing links section existed. The Keep a Changelog format requires a links section for the format to be complete.
- **Fix:** Added a full links section for all versions (1.0.0–1.5.0) following the standard Keep a Changelog footer format.
- **Files modified:** CHANGELOG.md
- **Commit:** e703fdf

## Known Stubs

None. All changes are documentation and version string updates.

## Threat Flags

None. Documentation-only plan; no new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- README.md updated: grep finds 5 matches for Codex CLI/Lovable/Replit Agent/Bolt.new
- CHANGELOG.md has [1.5.0]: FOUND
- JOURNAL.md has 2026-07-01 Phase 9 entry: FOUND
- packages/npm/package.json version 1.5.0: FOUND
- packages/pip/pyproject.toml version 1.5.0: FOUND
- templates/CLAUDE.md v1.5.0: FOUND
- Python tests: 109 passed
- TS tests: 106 passed
- Commit 42b42a7 (Task 1): FOUND
- Commit e703fdf (Task 2): FOUND
