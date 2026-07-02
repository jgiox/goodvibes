---
phase: "11"
plan: "03"
subsystem: cli-ux
tags: [doctor, upgrade, tdd, pol-01, pol-02, pkg-02]
dependency_graph:
  requires: [11-01]
  provides: [doctor-version-line, upgrade-english-labels]
  affects: [doctor-command, upgrade-command]
tech_stack:
  added: []
  patterns: [tdd-red-green, createRequire-version-read, importlib-metadata]
key_files:
  created: []
  modified:
    - packages/npm/src/commands/doctor.ts
    - packages/npm/src/commands/upgrade.ts
    - packages/npm/src/commands/doctor.test.ts
    - packages/npm/src/commands/upgrade.test.ts
    - packages/pip/src/goodvibes_cli/commands/doctor_cmd.py
    - packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py
    - packages/pip/tests/test_doctor_cmd.py
    - packages/pip/tests/test_upgrade_cmd.py
    - JOURNAL.md
decisions:
  - "createRequire(import.meta.url) used in doctor.ts to read version from bundled package.json — same pattern already present in upgrade.ts (reuse existing approach)"
  - "formatChangeSummary exported from upgrade.ts to allow direct unit testing without going through Commander"
  - "Python test patches importlib.metadata.version at the module level (goodvibes_cli.commands.doctor_cmd.importlib.metadata.version) — requires the module to import importlib.metadata as a module, not from importlib.metadata import version, so the patch target resolves correctly"
metrics:
  duration: "~15 minutes"
  completed: "2026-07-02"
  tasks_completed: 2
  files_modified: 9
requirements:
  - POL-01
  - POL-02
  - PKG-02
---

# Phase 11 Plan 03: Doctor Version Line + Upgrade English Labels Summary

`goodvibes doctor` now shows the installed version (`goodvibes v1.6.1`) as the first line of its check panel; `goodvibes upgrade --dry-run` now uses English words (`updated`, `new`, `unchanged`) instead of diff symbols (`~`, `+`, `=`). Both changes implemented in TypeScript and Python with TDD (RED commit then GREEN commit).

## What Was Built

### Task 1: TypeScript — doctor version line + upgrade English labels (commit b9fb426 RED, 2c97ef8 GREEN)

**doctor.ts:**
- Added `import { createRequire } from 'node:module'`
- Added `_require = createRequire(import.meta.url)` and `_getVersion()` helper (try/catch returning pkg.version or 'unknown')
- In the action: `const version = _getVersion()` then `const lines = [\`goodvibes v${version}\`, ...all.map(...)]`

**upgrade.ts:**
- Changed `symbol` map values from `{ changed: '~', unchanged: '=', new: '+' }` to `{ changed: 'updated', unchanged: 'unchanged', new: 'new' }` (variable renamed to `label`)
- Added `export` keyword to `formatChangeSummary` for direct unit testing

**doctor.test.ts:**
- Added `vi.mock('node:module', () => ({ createRequire: () => () => ({ version: '1.6.1' }) }))` at the top
- Added test `'doctor output includes goodvibes version as first line'` asserting `firstNoteArg.split('\n')[0] === 'goodvibes v1.6.1'`

**upgrade.test.ts:**
- Added `describe('formatChangeSummary')` block with test `'uses English labels for changed new and unchanged statuses'` — imports `formatChangeSummary` directly, asserts `'updated CLAUDE.md'`, `'new .claude/skills/foo'`, `'unchanged ci.yml'` in result, and `'~'`, `'+'`, `'='` NOT in result

**Result:** 119 passed, 1 skipped, 2 todo (was 117 + 1 skipped + 2 todo)

### Task 2: Python — doctor version line + upgrade English labels (commit fcb7ac7 RED, e90a9b7 GREEN)

**doctor_cmd.py:**
- Added `import importlib.metadata` at the top
- Added `_installed_version()` helper before the dataclass (try/except PackageNotFoundError returning 'unknown')
- In `doctor_cmd()`: `version = _installed_version()` then `lines = [f"goodvibes v{version}"] + [...]`

**upgrade_cmd.py:**
- Changed `symbol = {"changed": "~", "unchanged": "=", "new": "+"}` to `symbol = {"changed": "updated", "unchanged": "unchanged", "new": "new"}`

**test_doctor_cmd.py:**
- Added `import importlib.metadata` at the top
- Added `test_doctor_output_starts_with_version_line` — patches `goodvibes_cli.commands.doctor_cmd.importlib.metadata.version` to return `'1.6.1'`, mocks all check functions as passing, invokes via CliRunner, asserts `'goodvibes v1.6.1' in result.output`

**test_upgrade_cmd.py:**
- Updated `test_diff_summary_printed_before_apply`: changed assertion from `any(marker in ... for marker in ["~", "changed", ...])` to `"updated" in result.output or "will change" in result.output`
- Added `test_format_change_summary_uses_english_labels` — imports `format_change_summary` directly, asserts English labels and no diff symbols

**Result:** 126 passed (was 124)

## Verification Results

```
npm test: 119 passed, 1 skipped, 2 todo — PASS
uv run pytest tests/ -x -q: 126 passed — PASS
grep "goodvibes v" packages/npm/src/commands/doctor.ts: found in lines array — PASS
grep "goodvibes v" packages/pip/src/goodvibes_cli/commands/doctor_cmd.py: found in lines list — PASS
grep "'updated'" packages/npm/src/commands/upgrade.ts: found in label map — PASS
grep '"updated"' packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py: found in symbol map — PASS
```

## Deviations from Plan

None — plan executed exactly as written. `createRequire` was already present in `upgrade.ts` (pre-existing); the same pattern was applied to `doctor.ts` as specified.

## Known Stubs

None.

## Threat Flags

None — version string in doctor output is public information (T-11-03-01, accepted). No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- b9fb426 (RED TS tests): confirmed
- 2c97ef8 (GREEN TS implementation): confirmed
- fcb7ac7 (RED Python tests): confirmed
- e90a9b7 (GREEN Python implementation): confirmed
- packages/npm/src/commands/doctor.ts contains 'goodvibes v': confirmed
- packages/pip/src/goodvibes_cli/commands/doctor_cmd.py contains 'goodvibes v': confirmed
- packages/npm/src/commands/upgrade.ts contains 'updated': confirmed
- packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py contains 'updated': confirmed
- npm test: 119 passed: confirmed
- pytest: 126 passed: confirmed
