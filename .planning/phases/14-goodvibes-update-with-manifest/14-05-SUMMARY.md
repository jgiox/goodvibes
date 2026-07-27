---
phase: 14-goodvibes-update-with-manifest
plan: "05"
subsystem: cli
tags: [python, manifest, update-cmd, typer, tdd]

requires:
  - phase: 14-03
    provides: write_manifest() and read_manifest() step module (Python)

provides:
  - update_cmd() Typer command: --dry-run, --force, UPD-05 graceful no-manifest exit
  - app.command("update") → update_cmd (not upgrade_cmd alias)
  - 7 unit tests covering UPD-02 through UPD-05 behaviors

affects: []

tech-stack:
  added: []
  patterns:
    - "TDD Red/Green: failing test committed first, then implementation"
    - "MagicMock template_dir: tests must mock merge_claude/shutil.copy2 when apply loop runs on MagicMock paths"
    - "pathlib.Path.cwd() patching for merge_claude test: mocker.patch('pathlib.Path.cwd', return_value=project_dir)"

key-files:
  created:
    - packages/pip/src/goodvibes_cli/commands/update_cmd.py
    - packages/pip/tests/test_update_cmd.py
  modified:
    - packages/pip/src/goodvibes_cli/main.py

key-decisions:
  - "main.py wiring included in Task 1 GREEN commit: tests invoke via runner.invoke(app, ['update']), which requires update_cmd registration — could not defer to Task 2 without making tests un-runnable"
  - "merge_claude/shutil.copy2 mocked in apply-loop tests: resolve_templates_dir() returns MagicMock, so template_src is also MagicMock; its exists() is truthy by default, bypassing pathlib.Path.exists False patch"
  - "UPD-05 uses plain return (not typer.Exit): returning from a Typer command yields exit code 0"

requirements-completed: [UPD-02, UPD-03, UPD-04, UPD-05]

duration: 30min
completed: 2026-07-27
---

# Phase 14 Plan 05: Python update_cmd Summary

**Python update_cmd with --dry-run/--force/UPD-05 and sentinel-safe CLAUDE.md merge wired as app.command("update")**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-27T22:15:00Z
- **Completed:** 2026-07-27T22:46:00Z
- **Tasks:** 2 (TDD: RED + GREEN + Task 2 integrated)
- **Files modified:** 3

## Accomplishments

- Created `update_cmd.py` with full UPD-02–UPD-05 implementation:
  - UPD-02: Files with user-modified SHA (manifest mismatch) categorised as skip, never overwritten
  - UPD-03: `--dry-run` prints three labelled categories (overwrite/skip/net-new) without writing
  - UPD-04: `typer.confirm` prompt before overwriting; `--force` skips it
  - UPD-05: `manifest is None` → Panel + rule + `return` (exit 0, no typer.Exit)
  - CLAUDE.md routed through `merge_claude()`, never `shutil.copy2`
  - `write_manifest()` called after apply loop with `applied` list
- 7 unit tests (TDD RED commit `57857fa`, GREEN commit `9ab416d`)
- Patched `main.py`: `app.command("update")` → `update_cmd` (upgrade_cmd alias removed)
- Baseline test count: 146 → 153 (+7 new)
- 153/153 tests pass

## Task Commits

1. **Task 1 RED** — `57857fa` (test): 7 failing tests (module didn't exist)
2. **Task 1 GREEN + Task 2** — `9ab416d` (feat): update_cmd.py, fixed test mocks, main.py wiring

## Files Created/Modified

- `packages/pip/src/goodvibes_cli/commands/update_cmd.py` — New command module
- `packages/pip/tests/test_update_cmd.py` — 7 unit tests (UPD-02–UPD-05)
- `packages/pip/src/goodvibes_cli/main.py` — Added import + changed app.command("update") registration

## Decisions Made

- main.py wiring was pulled into Task 1 GREEN commit because tests use `runner.invoke(app, ["update"])` — wiring was a prerequisite, not a follow-on step
- Tests mock `merge_claude` and `shutil.copy2` in apply-loop tests: `resolve_templates_dir()` returns a MagicMock, so `template_src.exists()` is truthy by default (MagicMock), bypassing the global `pathlib.Path.exists = False` patch
- `pathlib.Path.cwd` patched to return `project_dir` (a real tmpdir) for the merge_claude test so both the dest (non-existent) and template_src (real file) have correct existence values

## Deviations from Plan

### Integrated Changes

**1. [Rule 3 - Blocking] main.py wired in Task 1 GREEN (not Task 2)**
- **Found during:** Making Task 1 tests GREEN
- **Issue:** `runner.invoke(app, ["update"])` requires `app.command("update")` → `update_cmd` to be registered; without it, tests invoke `upgrade_cmd` and fail with wrong output
- **Fix:** Added import + assignment to main.py in the same commit as update_cmd.py
- **Files modified:** `packages/pip/src/goodvibes_cli/main.py`
- **Commit:** `9ab416d`

**2. [Rule 1 - Bug] Added merge_claude and shutil.copy2 mocks in apply-loop tests**
- **Found during:** Debugging test failures after GREEN implementation
- **Issue:** When `resolve_templates_dir()` returns a MagicMock, `template_dir / "CLAUDE.md"` is a MagicMock too; its `exists()` returns a truthy MagicMock regardless of the `pathlib.Path.exists = False` patch. Calling real merge_claude/shutil.copy2 with MagicMock paths causes TypeError
- **Fix:** Added explicit `mocker.patch("goodvibes_cli.commands.update_cmd.merge_claude")` and `mocker.patch("goodvibes_cli.commands.update_cmd.shutil.copy2")` to the 3 tests that exercise the apply loop
- **Files modified:** `packages/pip/tests/test_update_cmd.py`
- **Commit:** `9ab416d`

## Threat Surface Scan

All trust boundaries are in the plan's threat model:
- T-14-05-01: manifest key path traversal — mitigated by init-time write (no traversal possible)
- T-14-05-02: malformed JSON → read_manifest returns None → UPD-05 shown, exit 0
- T-14-05-03: shutil.copy2 without shell=True — no injection vector
- T-14-05-04: --force confirmation bypass — CLI flag only, not remotely accessible

No new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check

**Created files:**
- `packages/pip/src/goodvibes_cli/commands/update_cmd.py` — FOUND
- `packages/pip/tests/test_update_cmd.py` — FOUND

**Modified files:**
- `packages/pip/src/goodvibes_cli/main.py` — FOUND (verified: update_cmd import + registration)

**Commits:**
- `57857fa` — FOUND (test RED)
- `9ab416d` — FOUND (feat GREEN + main.py)

**Test suite:** 153/153 passed

## Self-Check: PASSED

---
*Phase: 14-goodvibes-update-with-manifest*
*Completed: 2026-07-27*
