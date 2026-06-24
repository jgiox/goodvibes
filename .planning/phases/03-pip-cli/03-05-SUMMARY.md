---
phase: 03-pip-cli
plan: "05"
subsystem: pip-cli
tags: [bug-fix, tdd, regression, sentinel-merge, configure-mcp, install-headroom, main]
dependency_graph:
  requires: ["03-04"]
  provides: ["PIP-01-fixed", "PIP-02-fixed", "PIP-03-fixed", "PIP-05-fixed"]
  affects: ["packages/pip/src/goodvibes_cli/utils/sentinel_merge.py", "packages/pip/src/goodvibes_cli/steps/configure_mcp.py", "packages/pip/src/goodvibes_cli/steps/install_headroom.py", "packages/pip/src/goodvibes_cli/main.py"]
tech_stack:
  added: []
  patterns: ["RED→GREEN TDD commit pattern", "CalledProcessError soft-fail", "installer chain with continue"]
key_files:
  created: []
  modified:
    - packages/pip/tests/test_sentinel_merge.py
    - packages/pip/tests/test_configure_mcp.py
    - packages/pip/tests/test_install_headroom.py
    - packages/pip/src/goodvibes_cli/utils/sentinel_merge.py
    - packages/pip/src/goodvibes_cli/steps/configure_mcp.py
    - packages/pip/src/goodvibes_cli/steps/install_headroom.py
    - packages/pip/src/goodvibes_cli/main.py
decisions:
  - "Strip orphaned SENTINEL_START content when applying Case B fallback (existing[:start_idx]) to satisfy count(SENTINEL_START)==1 invariant"
  - "WR-01 CalledProcessError except placed after FileNotFoundError except on Step 2 try block with return to prevent fall-through to Step 3"
  - "post-loop message updated to cover both ENOENT-all and CPE-all cases: 'headroom could not be installed'"
metrics:
  duration: "6m 26s"
  completed: "2026-06-24T12:04:27Z"
  tasks_completed: 2
  files_modified: 7
---

# Phase 03 Plan 05: Gap Closure (CR-01, CR-02, WR-01, CR-03, CR-04) Summary

**One-liner:** Four surgical fixes closing data-corruption and crash bugs found in Phase 03 verification, with six regression tests following the RED→GREEN TDD pattern.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Regression tests RED | 5d2d230 | test_sentinel_merge.py, test_configure_mcp.py, test_install_headroom.py |
| 2 | Source fixes GREEN | af80340 | sentinel_merge.py, configure_mcp.py, install_headroom.py, main.py |

## What Was Done

**CR-01 — sentinel_merge.py malformed SENTINEL_END guard:**
Added `if end_idx == -1:` guard after `existing.find(SENTINEL_END)`. When SENTINEL_START is present but SENTINEL_END is absent (malformed/truncated file), the fix applies a Case B fallback: writes `existing[:start_idx].rstrip() + "\n\n" + template_block + "\n"`. This strips the orphaned start marker and everything after it, preserving user content before the marker, then appends the sentinel block cleanly.

**CR-02 — configure_mcp.py bare raise on headroom mcp install failure:**
Replaced `except subprocess.CalledProcessError: raise` (lines 79-80) with a soft-fail handler that logs the first line of stderr and instructs the user to run `headroom mcp install` manually. The module docstring says "Never raises" — the implementation now matches.

**WR-01 — configure_mcp.py unhandled CalledProcessError from claude mcp add:**
Added a second `except subprocess.CalledProcessError as e:` clause after `except FileNotFoundError:` in the Step 2 try block. When `claude mcp add` returns non-zero, logs the error and returns, preventing fall-through to Step 3.

**CR-03 — install_headroom.py early return stops fallback chain:**
Changed `return` to `continue` in the `except subprocess.CalledProcessError` block so all three installers (uv→pipx→pip) are tried when one fails with a non-zero exit. Updated log message to include the installer name and "trying next installer". Updated post-loop message to `'headroom could not be installed. Run manually: uv tool install "headroom-ai[all]"'`.

**CR-04 — main.py sys.exit at module top-level:**
Removed lines 1-9 (`import sys`, version guard, `sys.exit(1)`) and the `# noqa: E402` comments. The version guard already exists in `__main__.py` (the correct entry-point location). Library imports of `goodvibes_cli.main` no longer trigger sys.exit on Python <3.10.

## Test Results

- **Before fixes (RED):** 6 targeted tests failing, 42 passing = 42 passed / 6 failed
- **After fixes (GREEN):** 48 passed, 0 failed, 0 errors
- **New tests added:** 6 (3 new + 3 updated)

## Deviations from Plan

**1. [Rule 1 - Bug] sentinel_merge Case B fix uses existing[:start_idx] not existing**

- **Found during:** Task 2 (GREEN implementation)
- **Issue:** Plan specified `existing.rstrip() + "\n\n" + template_block + "\n"` for the Case B fallback. With the orphaned SENTINEL_START in `existing`, this produces `count(SENTINEL_START) == 2`, which fails the test assertion `content.count(SENTINEL_START) == 1`.
- **Fix:** Used `existing[:start_idx].rstrip() + "\n\n" + template_block + "\n"` — strips the orphaned marker and everything after it, preserving only user content before the marker.
- **Files modified:** packages/pip/src/goodvibes_cli/utils/sentinel_merge.py

**2. [Rule 1 - Bug] Sentinel test RED assertion required extra corruption check**

- **Found during:** Task 1 (RED test writing)
- **Issue:** Plan's three assertions (`"# User content" in content`, `SENTINEL_END in content`, `content.count(SENTINEL_START) == 1`) all PASS with the current broken code — the garbage appended (`goodvibes:start -->\norphaned start`) does not match the full SENTINEL_START pattern, so count stays 1, and SENTINEL_END comes from template_block. No RED failure.
- **Fix:** Added a fourth assertion: `after_end = content.split(SENTINEL_END, 1)[-1]; assert after_end.strip() == ""` — verifies nothing appears after the sentinel end marker. This fails with the current broken code (garbage is appended after the end marker) and passes after the fix.
- **Files modified:** packages/pip/tests/test_sentinel_merge.py

## Known Stubs

None — all fixes are complete implementations.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are error-handling paths in existing functions.

## Self-Check: PASSED

- [x] packages/pip/src/goodvibes_cli/utils/sentinel_merge.py — `if end_idx == -1:` at line 65
- [x] packages/pip/src/goodvibes_cli/steps/configure_mcp.py — 2 CalledProcessError except blocks
- [x] packages/pip/src/goodvibes_cli/steps/install_headroom.py — `continue  # advance` at line 45
- [x] packages/pip/src/goodvibes_cli/main.py — no `sys.exit` present
- [x] Commit 5d2d230 exists (RED)
- [x] Commit af80340 exists (GREEN)
- [x] 48 tests pass, 0 fail
