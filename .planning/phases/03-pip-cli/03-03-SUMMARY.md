---
phase: 03-pip-cli
plan: "03"
subsystem: pip-cli-headroom
tags: [python, subprocess, detect-python, install-headroom, configure-mcp, tdd, stdlib-only]

dependency_graph:
  requires:
    - phase: 03-01
      provides: packages/pip pyproject.toml, test stubs, uv sync
    - phase: 03-02
      provides: utils/__init__.py, steps/__init__.py (package namespaces)
  provides:
    - packages/pip/src/goodvibes_cli/utils/detect_python.py
    - packages/pip/src/goodvibes_cli/steps/install_headroom.py
    - packages/pip/src/goodvibes_cli/steps/configure_mcp.py
  affects: [03-04-PLAN.md]

tech-stack:
  added: []
  patterns: [stdlib-only-subprocess, list-args-no-shell, soft-fail-pattern, mock-at-module-boundary]

key-files:
  created:
    - packages/pip/src/goodvibes_cli/utils/detect_python.py
    - packages/pip/src/goodvibes_cli/steps/install_headroom.py
    - packages/pip/src/goodvibes_cli/steps/configure_mcp.py
  modified:
    - packages/pip/tests/test_install_headroom.py
    - packages/pip/tests/test_configure_mcp.py

key-decisions:
  - "D-09: tests mock detect_python at install_headroom module boundary (goodvibes_cli.steps.install_headroom.detect_python) rather than patching subprocess.run in the detect_python module — avoids import-cache race condition"
  - "D-10: configure_mcp uses shutil.which() instead of subprocess which/where — stdlib, cross-platform, no extra subprocess"

patterns-established:
  - "Pattern: mock at the module boundary where the dependency is *used*, not where it is *defined* — avoids import caching issues"
  - "Pattern: soft-fail on CalledProcessError in init-time install steps — init must exit 0 even when optional tooling fails to install"

requirements-completed: [PIP-01, PIP-02, PIP-03]

duration: 5min
completed: 2026-06-24
---

# Phase 03 Plan 03: detect_python.py + install_headroom.py + configure_mcp.py Summary

**stdlib-only Python port of the headroom integration layer — uv→pipx→pip install chain, claude mcp add primary with headroom mcp install fallback, and Windows Store guard in detect_python; 14 passing mocked tests, no real subprocess calls in suite.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-24T07:22:17Z
- **Completed:** 2026-06-24T07:27:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `detect_python()` probes python3/python/py in order; returns first 3.10+ cmd or None; Windows Store guard skips commands whose output doesn't match `/Python \d+\.\d+/`
- `install_headroom(log)` tries uv→pipx→pip --user; logs ONNX warning before any subprocess; soft-fails on CalledProcessError; never raises; never shell=True
- `configure_mcp(log)` checks idempotency via `headroom mcp status`, registers via `claude mcp add -s user` (primary), falls back to `headroom mcp install` when claude not on PATH; uses shutil.which for path resolution
- 8 install_headroom tests + 6 configure_mcp tests — all mocked, exit 0

## Task Commits

1. **Task 1: detect_python.py + install_headroom.py** - `7531002` (feat)
2. **Task 2: configure_mcp.py** - `c123587` (feat)

## Files Created/Modified

- `packages/pip/src/goodvibes_cli/utils/detect_python.py` — probes python3/python/py, Windows Store guard, returns first 3.10+ cmd or None
- `packages/pip/src/goodvibes_cli/steps/install_headroom.py` — uv→pipx→pip chain, soft-fail, ONNX warning, list args only
- `packages/pip/src/goodvibes_cli/steps/configure_mcp.py` — idempotency + primary claude mcp add + fallback headroom mcp install, shutil.which
- `packages/pip/tests/test_install_headroom.py` — 8 tests, mocked at module boundary
- `packages/pip/tests/test_configure_mcp.py` — 6 tests, mocked subprocess.run + shutil.which

## Decisions Made

- **D-09:** Tests mock `detect_python` at the `install_headroom` module boundary (`goodvibes_cli.steps.install_headroom.detect_python`) rather than patching `subprocess.run` inside the `detect_python` module. Rationale: `from goodvibes_cli.utils.detect_python import detect_python` binds the name in `install_headroom`'s namespace at import time. Patching `subprocess.run` in a transitively imported module suffers from import caching — the patch can fail to take effect if the module was already cached with the original `subprocess` reference. Mocking at the usage boundary is reliable and idiomatic.
- **D-10:** `configure_mcp` uses `shutil.which("headroom")` instead of `subprocess.run(["which", "headroom"])`. This is the stdlib cross-platform equivalent, avoids an extra subprocess, and handles Windows PATH correctly — a deliberate improvement over the TypeScript port which used `execa('which', ['headroom'])`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock strategy updated to use module-boundary patching**
- **Found during:** Task 1 GREEN phase — `test_uv_found_and_succeeds` failed with `assert False` (ONNX warning not in log_calls) even though the mock was applied
- **Issue:** The plan's action specified mocking `goodvibes_cli.utils.detect_python.subprocess.run` and `goodvibes_cli.steps.install_headroom.subprocess.run`. After investigation, the `subprocess.run` patch in `detect_python`'s module namespace was not consistently taking effect due to Python's import caching — `install_headroom.py` does `from goodvibes_cli.utils.detect_python import detect_python` at module level, and by the time the test ran its mock, the module was already cached with the real `subprocess.run` reference. The mock call count confirmed 0 calls even with the patch applied.
- **Fix:** Replaced `mocker.patch("goodvibes_cli.utils.detect_python.subprocess.run", ...)` with `mocker.patch("goodvibes_cli.steps.install_headroom.detect_python", return_value="python3")`. This directly replaces the `detect_python` name in `install_headroom`'s module namespace — reliable, fast, and clearer test intent.
- **Files modified:** packages/pip/tests/test_install_headroom.py
- **Verification:** 8 tests pass with `detect_python` mocked at module boundary; no real python probes run during test suite
- **Committed in:** 7531002 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in mock strategy)
**Impact on plan:** Auto-fix corrects mock strategy for reliability. No functional behavior changes in implementation modules. Plan's security and behavioral requirements all met.

## Issues Encountered

None in the implementation modules. The mock strategy issue was caught during GREEN verification and fixed immediately.

## Known Stubs

None in this plan's scope. The 22 remaining skipped tests in `test_sentinel_merge.py` and `test_copy_templates.py` were resolved in 03-02. All 14 tests in this plan's scope are implemented and passing.

## Threat Surface Scan

No new security-relevant network endpoints or auth paths introduced. All subprocess calls use list args (not strings) — no shell injection vector. `shutil.which()` result is passed as a discrete list element to `claude mcp add` — T-03-03-02 mitigated. No sudo or system-wide writes — `--user` flag for pip limits scope (T-03-03-03 accepted). Windows Store guard implemented in `detect_python()` — T-03-03-04 mitigated.

## Self-Check: PASSED

- packages/pip/src/goodvibes_cli/utils/detect_python.py: exists, returns None for all-ENOENT, Windows Store guard confirmed in code
- packages/pip/src/goodvibes_cli/steps/install_headroom.py: exists, imports detect_python from goodvibes_cli.utils.detect_python
- packages/pip/src/goodvibes_cli/steps/configure_mcp.py: exists, uses shutil.which, no shell=True
- packages/pip/tests/test_install_headroom.py: 8 tests, 0 skipped, exit 0
- packages/pip/tests/test_configure_mcp.py: 6 tests, 0 skipped, exit 0
- Combined: `uv run pytest tests/test_install_headroom.py tests/test_configure_mcp.py -x -q` exits 0, 14 passed
- No shell=True in detect_python.py, install_headroom.py, or configure_mcp.py: CONFIRMED
- headroom-ai[all] appears as literal list element in install_headroom.py: CONFIRMED
- Commits: 7531002 (Task 1), c123587 (Task 2) — both verified in git log

---
*Phase: 03-pip-cli*
*Completed: 2026-06-24*
