---
phase: 14-goodvibes-update-with-manifest
plan: "03"
subsystem: cli
tags: [python, manifest, sha256, hashlib, init]

requires:
  - phase: 14-01
    provides: UPD-06 sentinel guard fix in mergeClaude

provides:
  - write_manifest() and read_manifest() step module (Python)
  - .goodvibes.json written after every successful goodvibes init (Python CLI)
  - 5 unit tests for write_manifest / read_manifest using real tmpdir
  - 2 new init_cmd tests covering write_manifest call count on normal and dry-run paths

affects: [14-04, 14-05]

tech-stack:
  added: []
  patterns:
    - "Step module shape: from __future__ import annotations, stdlib-only imports, plain functions, no class"
    - "read_bytes() for SHA-256 hashing to avoid encoding round-trip differences"
    - "autouse conftest fixture guards all test modules from real write_manifest I/O"

key-files:
  created:
    - packages/pip/src/goodvibes_cli/steps/write_manifest.py
    - packages/pip/tests/test_write_manifest.py
  modified:
    - packages/pip/src/goodvibes_cli/commands/init_cmd.py
    - packages/pip/tests/test_init_cmd.py
    - packages/pip/tests/conftest.py

key-decisions:
  - "autouse conftest fixture (_auto_mock_write_manifest) added to guard all tests except test_write_manifest.py — avoids patching in every individual test in test_main.py"
  - "write_manifest call placed after except OSError block and before tel_thread.join — propagates unexpected exceptions, not swallowed"
  - "importlib.metadata.version patched in test_init_cmd.py autouse; real version used in test_main.py (package is installed editable)"

requirements-completed: [UPD-01]

duration: 20min
completed: 2026-07-27
---

# Phase 14 Plan 03: Python write_manifest step and init wiring Summary

**Python manifest step (write_manifest.py) created with hashlib.sha256; wired into init_cmd so .goodvibes.json is written after every successful init**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-27T00:00:00Z
- **Completed:** 2026-07-27
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created write_manifest.py with MANIFEST_PATH, write_manifest(), and read_manifest() using stdlib only
- 5 unit tests using real tmpdir (TDD: RED commit then GREEN commit)
- Wired write_manifest into init_cmd.py after try/except block with list-comp filter for .goodvibes.json self-reference (T-14-03-02 mitigation)
- Added autouse test fixtures in conftest.py and test_init_cmd.py to guard all tests from real file I/O
- 146/146 tests pass (7 new tests added)

## Task Commits

Each task was committed atomically:

1. **Task 1 - RED: Failing tests** - `1a92cc0` (test)
2. **Task 1 - GREEN: write_manifest.py implementation** - `e688862` (feat)
3. **Task 2: Wire init_cmd + patch tests** - `c72c0ba` (feat)

_Note: Task 1 used TDD — separate RED and GREEN commits per plan spec_

## Files Created/Modified
- `packages/pip/src/goodvibes_cli/steps/write_manifest.py` - New step: MANIFEST_PATH, write_manifest(), read_manifest()
- `packages/pip/tests/test_write_manifest.py` - 5 unit tests using tmp_dir fixture, real file I/O
- `packages/pip/src/goodvibes_cli/commands/init_cmd.py` - Added importlib.metadata import, write_manifest import and call
- `packages/pip/tests/test_init_cmd.py` - Added autouse mock_write_manifest fixture + 2 new tests
- `packages/pip/tests/conftest.py` - Added _auto_mock_write_manifest autouse fixture for test_main.py coverage

## Decisions Made
- Used conftest-level autouse fixture rather than patching every individual test in test_main.py — smaller diff, correct behavior
- importlib.metadata.version is NOT patched globally (real version works because package is editable-installed); only patched in test_init_cmd.py where needed
- write_manifest call placed outside the try/except block — unexpected exceptions propagate to typer's top-level handler (fail loud per CLAUDE.md)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] conftest.py _auto_mock_write_manifest needed for test_main.py**
- **Found during:** Task 2 (patching test_init_cmd.py)
- **Issue:** test_main.py::test_next_steps_in_output invokes init via the full app without patching write_manifest; after Task 2 it attempted to read CLAUDE.md bytes from a path that doesn't exist in the runner CWD, causing FileNotFoundError
- **Fix:** Added autouse conftest fixture that patches `goodvibes_cli.commands.init_cmd.write_manifest` for all test modules except test_write_manifest.py
- **Files modified:** packages/pip/tests/conftest.py
- **Verification:** 146/146 tests pass including the previously-failing test_next_steps_in_output
- **Committed in:** c72c0ba (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Required to prevent pre-existing test_main.py tests from breaking. No scope creep.

## Issues Encountered
- Worktree venv was missing pytest-mock (only pytest was installed). Resolved with `uv sync --extra dev`. Tests then ran correctly.

## Threat Surface Scan
No new network endpoints, auth paths, or trust boundary changes. write_manifest writes to the local CWD (same directory where copy_templates just succeeded). T-14-03-02 (manifest self-reference) is mitigated by the `.goodvibes.json` filter at the call site.

## Next Phase Readiness
- Python CLI now writes .goodvibes.json after init — parity with npm CLI (14-02)
- 14-04 (update_cmd.py) and 14-05 (main.py wiring) can proceed — read_manifest is available
- No blockers

## Self-Check

**Created files:**
- `packages/pip/src/goodvibes_cli/steps/write_manifest.py` - FOUND
- `packages/pip/tests/test_write_manifest.py` - FOUND

**Commits:**
- `1a92cc0` - FOUND (test RED)
- `e688862` - FOUND (feat GREEN)
- `c72c0ba` - FOUND (feat Task 2)

## Self-Check: PASSED

---
*Phase: 14-goodvibes-update-with-manifest*
*Completed: 2026-07-27*
