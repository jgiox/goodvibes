---
phase: 10-vibe-coder-completeness
plan: "02"
subsystem: cli-tests
tags: [npm, pip, typescript, python, doctor, update-alias, version-test, unit-tests]
dependency_graph:
  requires:
    - 10-01 (doctor.ts, upgrade.ts alias, install-headroom.ts idempotency, doctor_cmd.py, install_headroom.py)
  provides:
    - VCC-01 alias regression test (npm + pip)
    - VCC-02 version regression test (npm + pip)
    - VCC-03 doctor command regression tests (npm + pip)
    - VCC-05 headroom transparency regression tests (npm + pip)
  affects:
    - packages/npm/src/commands/upgrade.test.ts
    - packages/npm/src/index.test.ts
    - packages/pip/tests/test_doctor_cmd.py
    - packages/pip/tests/test_upgrade_cmd.py
    - packages/pip/tests/test_main.py
tech_stack:
  added: []
  patterns:
    - vitest vi.mock for external deps
    - pytest-mock mocker.patch at module boundary
    - typer.testing.CliRunner for CLI integration assertions
    - Commander .aliases() introspection for alias test
key_files:
  created:
    - packages/pip/tests/test_doctor_cmd.py
  modified:
    - packages/npm/src/commands/upgrade.test.ts
    - packages/npm/src/index.test.ts
    - packages/pip/tests/test_upgrade_cmd.py
    - packages/pip/tests/test_main.py
    - JOURNAL.md
decisions:
  - Doctor tests in TS use captured action pattern (mock program.command chain, extract action callback) consistent with existing upgrade tests
  - Python doctor tests use typer.Exit not SystemExit — doctor_cmd raises typer.Exit(1), not sys.exit(1)
  - collect-all test uses CliRunner for Python (avoid Panel object string-repr issue when patching console.print)
  - Version test in index.test.ts runs against dist/index.js with build guard — skips cleanly on fresh checkout
  - Pip version test uses importlib.metadata.version('jgiox-goodvibes') to get actual installed version
metrics:
  duration: "7 minutes"
  completed: "2026-07-01T10:15:00Z"
  tasks: 2
  files: 5
---

# Phase 10 Plan 02: VCC Unit Test Coverage Summary

Unit test coverage for VCC-01 through VCC-05 — alias routing, version display, doctor checks, and headroom transparency — in both npm (TypeScript) and pip (Python) CLIs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add npm unit tests — alias and version | e921696 | upgrade.test.ts, index.test.ts |
| 2 | Add pip unit tests — doctor, alias, version | 9c470ad | test_doctor_cmd.py (new), test_upgrade_cmd.py, test_main.py |

## Verification

- npm test: 117 passed, 1 skipped (10 test files)
- pip pytest: 124 passed (up from 111 — 13 new tests)

### New Tests Added

**npm (upgrade.test.ts):**
- `registers update as an alias for upgrade` — asserts commander .aliases() contains 'update'

**npm (index.test.ts):**
- `version flag output matches package.json version and is not the hardcoded 1.0.0 string` — runs dist/index.js --version, verifies against package.json

**pip (test_doctor_cmd.py — 11 tests):**
- `test_check_headroom_returns_pass_when_headroom_on_path`
- `test_check_headroom_returns_fail_with_remedy_when_not_on_path`
- `test_check_git_config_returns_pass_when_name_set`
- `test_check_git_config_returns_fail_with_remedy_when_not_set`
- `test_check_claude_md_returns_pass_when_file_exists`
- `test_check_claude_md_returns_fail_when_file_absent`
- `test_check_sentinel_returns_pass_when_both_markers_present`
- `test_check_sentinel_returns_fail_when_sentinel_missing`
- `test_doctor_cmd_raises_exit_1_when_any_check_fails`
- `test_doctor_cmd_does_not_raise_when_all_checks_pass`
- `test_doctor_cmd_collects_all_failures_before_exiting`

**pip (test_upgrade_cmd.py):**
- `test_update_alias_is_registered_in_app` — asserts app.registered_commands contains 'update'

**pip (test_main.py):**
- `test_version_output_includes_installed_version` — asserts version from importlib.metadata appears in output

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Python doctor tests use typer.Exit not SystemExit**
- **Found during:** Task 2 — first test run
- **Issue:** Plan specified `pytest.raises(SystemExit)` with `exc.value.code == 1`. The implementation raises `typer.Exit(1)`, not `sys.exit(1)`. `typer.Exit` is `click.exceptions.Exit`, not a `SystemExit` subclass.
- **Fix:** Changed `pytest.raises(SystemExit)` to `pytest.raises(typer.Exit)` and `exc.value.code` to `exc.value.exit_code`.
- **Files modified:** packages/pip/tests/test_doctor_cmd.py
- **Commit:** 9c470ad

**2. [Rule 1 - Bug] collect-all test uses CliRunner instead of console.print mock**
- **Found during:** Task 2 — second test iteration
- **Issue:** Patching `console.print` and asserting on `str(Panel(...))` produces `<rich.panel.Panel object at 0x...>` — the str() of a Panel renderable is the class repr, not the rendered text.
- **Fix:** Used `typer.testing.CliRunner` to invoke the full CLI for the collect-all test, which captures all Rich output as rendered text.
- **Files modified:** packages/pip/tests/test_doctor_cmd.py
- **Commit:** 9c470ad

## Known Stubs

None — all tests are fully wired.

## Threat Flags

None — test-only changes. No new network endpoints, auth paths, or runtime surface introduced.

## Self-Check: PASSED

- FOUND: packages/npm/src/commands/upgrade.test.ts (modified)
- FOUND: packages/npm/src/index.test.ts (modified)
- FOUND: packages/pip/tests/test_doctor_cmd.py (created)
- FOUND: packages/pip/tests/test_upgrade_cmd.py (modified)
- FOUND: packages/pip/tests/test_main.py (modified)
- FOUND commit: e921696 (npm tests)
- FOUND commit: 9c470ad (pip tests)
