---
phase: "11"
plan: "01"
subsystem: packaging
tags: [rename, npm, pip, discoverability, pkg-01]
dependency_graph:
  requires: []
  provides: [goodvibes-cli-npm, goodvibes-cli-pip]
  affects: [upgrade-command, publish-workflows, readme, verify-scripts]
tech_stack:
  added: []
  patterns: [atomic-rename, tdd-red-green]
key_files:
  created: []
  modified:
    - packages/npm/package.json
    - packages/npm/src/commands/upgrade.ts
    - packages/npm/src/commands/upgrade.test.ts
    - packages/pip/pyproject.toml
    - packages/pip/uv.lock
    - packages/pip/src/goodvibes_cli/main.py
    - packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py
    - packages/pip/tests/test_main.py
    - .github/workflows/publish-pip.yml
    - .github/workflows/vhs.yml
    - README.md
    - packages/pip/README.md
    - scripts/verify-phase3.sh
    - JOURNAL.md
decisions:
  - "Package names are goodvibes-cli on both npm and PyPI — discoverable without knowing the maintainer handle (PKG-01)"
  - "All 4 jgiox-goodvibes call sites in upgrade_cmd.py replaced atomically — PYPI_URL, version metadata, uv tool upgrade, pip install"
metrics:
  duration: "~10 minutes"
  completed: "2026-07-02"
  tasks_completed: 2
  files_modified: 14
requirements:
  - PKG-01
---

# Phase 11 Plan 01: Rename Packages to goodvibes-cli Summary

Both packages renamed from personal-handle-prefixed names (`@jgiox/goodvibes` / `jgiox-goodvibes`) to `goodvibes-cli` on npm and PyPI, with all in-repo call sites updated atomically.

## What Was Built

### Task 1: npm package rename (commit fe8cdf3)

- `packages/npm/package.json` name: `@jgiox/goodvibes` → `goodvibes-cli`; homepage field added
- `packages/npm/src/commands/upgrade.ts`: `npm view` and `npm install -g` now use `goodvibes-cli`
- `packages/npm/src/commands/upgrade.test.ts`: assertions updated to expect `goodvibes-cli`
- All 117 npm tests pass (TDD: RED on test change, GREEN on source change)

### Task 2: pip package rename (commit e52c235)

- `packages/pip/pyproject.toml`: name `jgiox-goodvibes` → `goodvibes-cli`; 11-entry classifiers array added; `Repository` URL added to `[project.urls]`
- `packages/pip/src/goodvibes_cli/main.py`: `importlib.metadata.version("goodvibes-cli")`
- `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py`: 4 occurrences replaced — `_PYPI_URL`, `_get_package_version`, `_self_update_pip` (uv path + pip fallback)
- `packages/pip/tests/test_main.py`: version test uses `goodvibes-cli` metadata key
- `.github/workflows/publish-pip.yml`: wheel check uses `goodvibes_cli-*.whl`; step comment updated to PKG-01
- `.github/workflows/vhs.yml`: installs `goodvibes-cli` instead of `@jgiox/goodvibes`
- `README.md`: npm and PyPI badges updated; all install commands updated
- `packages/pip/README.md`: install line updated
- `scripts/verify-phase3.sh`: PIP-PKG-02 asserts `name = "goodvibes-cli"`
- `packages/pip/uv.lock`: regenerated via `uv lock` (removed jgiox-goodvibes, added goodvibes-cli)
- All 124 pip tests pass (TDD: RED on test change, GREEN on source change)

## Verification Results

```
npm test: 117 passed, 1 skipped, 2 todo — PASS
pip pytest: 124 passed — PASS
grep jgiox-goodvibes packages/pip/src packages/npm/src: no output — CLEAN
grep @jgiox/goodvibes packages/npm/src packages/npm/package.json: no output — CLEAN
grep "name" packages/npm/package.json: "name": "goodvibes-cli" — PASS
grep ^name packages/pip/pyproject.toml: name = "goodvibes-cli" — PASS
grep 'npm install -g' vhs.yml: npm install -g goodvibes-cli — PASS
grep 'name = ' verify-phase3.sh: grep -q 'name = "goodvibes-cli"' — PASS
grep 'pip install' packages/pip/README.md: pip install goodvibes-cli — PASS
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are package name strings in existing files.

## Self-Check: PASSED

- fe8cdf3 exists: confirmed
- e52c235 exists: confirmed
- packages/npm/package.json "name" = "goodvibes-cli": confirmed
- packages/pip/pyproject.toml name = "goodvibes-cli": confirmed
- All test suites green: confirmed
