---
phase: 12-headroom-status-surfacing
plan: 03
subsystem: pip-cli
tags: [python, pytest, tdd, headroom, subprocess, discriminated-returns]

# Dependency graph
requires:
  - phase: 12-headroom-status-surfacing
    plan: 01
    provides: TypeScript patterns to mirror (HeadroomResult/McpResult, compress --help probe, 10s timeout)
provides:
  - install_headroom returning dict[str, str] with status key for all paths
  - configure_mcp returning dict[str, str] with status key for all paths
  - headroom functional probe (compress --help) in install_headroom.py
  - Headroom Panel in init_cmd.py for non-minimal runs
  - functional _check_headroom in doctor_cmd.py with "headroom installed and working" label
  - timeout=10 on all subprocess.run calls in both step files
  - subprocess.TimeoutExpired caught alongside CalledProcessError in all relevant except clauses
affects:
  - packages/pip consumers: init_cmd.py and doctor_cmd.py (updated in this plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Python discriminated dict return (dict[str, str] with status key) — mirrors TypeScript discriminated union"
    - "Functional subprocess probe (compress --help) over PATH-only check (shutil.which)"
    - "Hard timeout on all subprocess calls (timeout=10) to prevent hangs"
    - "Steps-never-raise invariant enforced via return {'status': 'failed'} at all error paths"
    - "getattr(e, 'stderr', '') or '' for safe stderr extraction (TimeoutExpired has no stderr)"

key-files:
  created: []
  modified:
    - packages/pip/src/goodvibes_cli/steps/install_headroom.py
    - packages/pip/src/goodvibes_cli/steps/configure_mcp.py
    - packages/pip/src/goodvibes_cli/commands/init_cmd.py
    - packages/pip/src/goodvibes_cli/commands/doctor_cmd.py
    - packages/pip/tests/test_install_headroom.py
    - packages/pip/tests/test_configure_mcp.py
    - packages/pip/tests/test_init_cmd.py
    - packages/pip/tests/test_doctor_cmd.py
    - JOURNAL.md

key-decisions:
  - "Python dict[str, str] chosen over TypeScript discriminated union — no runtime type system; tests enforce the status key contract"
  - "getattr(e, 'stderr', '') or '' used for TimeoutExpired (no stderr attr) — avoids AttributeError on timeout path"
  - "shutil removed from install_headroom.py and doctor_cmd.py — shutil.which replaced by functional probe; no other shutil usage in those files"
  - "configure_mcp.py retains shutil import — shutil.which still used for PATH check in primary strategy"
  - "Default skipped results initialized before if-not-minimal block in init_cmd.py — prevents NameError if minimal=True"

requirements-completed:
  - HDR2-01
  - HDR2-02
  - HDR2-03
  - HDR2-04
  - HDR2-05

# Metrics
duration: ~15min
completed: 2026-07-06
---

# Phase 12 Plan 03: Python Parity — Headroom Status Surfacing Summary

**Python parity for Phase 12: discriminated dict returns in install_headroom/configure_mcp, functional compress --help probe replacing shutil.which, timeout=10 on all subprocess calls, Headroom Panel in init_cmd, functional _check_headroom in doctor_cmd**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-06
- **Completed:** 2026-07-06
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 8 source/test files + JOURNAL.md

## Accomplishments

- `install_headroom()` now returns `dict[str, str]` with status key — callers can display `installed / already-installed / skipped / failed` without string-parsing log messages (HDR2-01/02)
- `configure_mcp()` same pattern — `registered / already-registered / skipped / failed` (HDR2-01/02)
- Idempotency probe changed from `shutil.which("headroom")` (PATH-only) to `subprocess.run(["headroom", "compress", "--help"], timeout=10)` (functional) — catches broken Python 3.13/Windows installs (HDR2-03)
- Every `subprocess.run` call in both step files carries `timeout=10` — subprocess hangs no longer possible (HDR2-04)
- `subprocess.TimeoutExpired` caught alongside `CalledProcessError` in all relevant except clauses
- `init_cmd.py` shows Headroom Panel for non-minimal runs with actual install and MCP status strings (HDR2-01)
- `_check_headroom()` in `doctor_cmd.py` uses functional compress --help probe; catches FileNotFoundError, CalledProcessError, and TimeoutExpired; label updated to "headroom installed and working" (HDR2-05)
- Unused `shutil` imports removed from `install_headroom.py` and `doctor_cmd.py`
- Fixed devenv issue in worktree: `uv sync --extra dev` needed to install pytest in worktree venv

## Task Commits

1. **Task 1: RED — update 4 Python test files** - `8dd5875` (test)
2. **Task 2: GREEN — implement discriminated returns, probe, timeout, Panel** - `bb1abd2` (feat)

## Files Created/Modified

- `packages/pip/src/goodvibes_cli/steps/install_headroom.py` — removed shutil import; functional compress --help probe; `dict[str, str]` return for all paths; timeout=10 on installer loop; TimeoutExpired in except clause
- `packages/pip/src/goodvibes_cli/steps/configure_mcp.py` — `dict[str, str]` return for all paths; timeout=10 on all subprocess.run calls; TimeoutExpired in idempotency and fallback except clauses; CalledProcessError handler now returns dict (was bare return)
- `packages/pip/src/goodvibes_cli/commands/init_cmd.py` — `_format_headroom_status` inline helper; default result dicts initialized before `if not minimal:`; return values captured from step calls; Headroom Panel added for non-minimal runs
- `packages/pip/src/goodvibes_cli/commands/doctor_cmd.py` — removed shutil import; `_check_headroom` now uses functional compress --help probe; catches all 3 exception types; label updated to "headroom installed and working"
- `packages/pip/tests/test_install_headroom.py` — replaced shutil.which mocks with subprocess.run probe mocks; fixed call index (probe is [0], installer is [1]); fixed call_count (probe + 3 installers = 4); test_already_installed_skips_installer updated; new test_probe_timeout_falls_through_to_installer; result assertions on all tests
- `packages/pip/tests/test_configure_mcp.py` — result capture and assertions on all 8 tests
- `packages/pip/tests/test_init_cmd.py` — return_value dicts on existing mocks; new test_normal_run_shows_headroom_panel
- `packages/pip/tests/test_doctor_cmd.py` — replaced shutil.which tests with subprocess.run tests; added broken/timeout tests; labels updated to "headroom installed and working" in all integration-style tests
- `JOURNAL.md` — entry for this task

## Decisions Made

- Python `dict[str, str]` return type (not a TypedDict or dataclass) — simplest approach matching TypeScript pattern; status key contract enforced by tests
- `getattr(e, 'stderr', '') or ""` used where TimeoutExpired is caught alongside CalledProcessError — TimeoutExpired has no `stderr` attribute
- Default `{"status": "skipped", "reason": ""}` result vars initialized before `if not minimal:` block to prevent potential NameError on minimal path

## Deviations from Plan

### Devenv Fix

**1. [Rule 3 - Blocking] Install pytest dev dependencies in worktree venv**
- **Found during:** Task 1 setup (running tests to confirm starting state)
- **Issue:** The worktree's `.venv` was created fresh by uv when the plan was run, with only runtime dependencies (typer, rich). `uv run pytest` was resolving to the global `~/.local/bin/pytest` which ran against a Python env that didn't have the editable goodvibes-cli install, causing `ModuleNotFoundError: No module named 'goodvibes_cli'`.
- **Fix:** Ran `uv sync --extra dev` from `packages/pip/` in the worktree to install pytest, pytest-mock, pytest-asyncio, pytest-cov into the local venv.
- **Files modified:** `packages/pip/uv.lock` (staged with RED commit)
- **Impact:** No scope change; this is a standard worktree setup step for a fresh venv.

None — plan executed as written after the devenv fix.

## Issues Encountered

- Headroom IS installed at `/home/ygiokas/.local/bin/headroom` on the development machine. This caused the RED tests to fail for a slightly different reason than expected (shutil.which returning a real path → early return → ONNX warning not logged). The failures were still assertion mismatches as required — no import or syntax errors — so the RED state was valid.

## Next Phase Readiness

- All 4 Python step/command files return structured results
- All 39 tests pass (GREEN)
- Python parity for Phase 12 complete — HDR2-01 through HDR2-05 satisfied for pip package
- Wave 2 of Phase 12 complete (12-02 TypeScript commands + 12-03 Python parity)

---
*Phase: 12-headroom-status-surfacing*
*Completed: 2026-07-06*
