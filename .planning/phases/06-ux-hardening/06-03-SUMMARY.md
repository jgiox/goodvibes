---
phase: 06-ux-hardening
plan: "03"
subsystem: pip-cli-ux-hardening
tags: [tdd, red-green, copy-templates, init-cmd, ux-hardening, tuple-return, error-handling]
dependency_graph:
  requires: [06-01]
  provides: []
  affects:
    - packages/pip/src/goodvibes_cli/steps/copy_templates.py
    - packages/pip/src/goodvibes_cli/commands/init_cmd.py
    - packages/pip/tests/test_copy_templates.py
    - packages/pip/tests/test_init_cmd.py
    - packages/pip/tests/test_main.py
    - packages/pip/tests/conftest.py
tech_stack:
  added: []
  patterns: [tdd-red-green, tuple-return-destructuring, rich-panel-output, try-except-ux]
key_files:
  created:
    - packages/pip/tests/test_init_cmd.py
  modified:
    - packages/pip/src/goodvibes_cli/steps/copy_templates.py
    - packages/pip/src/goodvibes_cli/commands/init_cmd.py
    - packages/pip/tests/test_copy_templates.py
    - packages/pip/tests/test_main.py
    - packages/pip/tests/conftest.py
decisions:
  - "No-clobber guard changed from dest_candidate.exists() to dest_candidate.is_file() — directories must be traversed for nested file-level no-clobber to work"
  - "ci.yml guard appends to skipped_files list directly rather than via ignore_fn — rename happens after copytree, outside ignore_fn scope"
  - "Minimal filter expanded from '.github/workflows only' to all of .github/ and docs/ using rel.parts membership test (pathlib-safe, no separator issues)"
metrics:
  duration: "12 minutes"
  completed: "2026-06-26"
  tasks_completed: 2
  files_modified: 6
---

# Phase 6 Plan 03: Python UX Hardening — Summary

**One-liner:** Python pip CLI parity with npm CLI: copy_templates returns (written, skipped) tuple, init_cmd shows split panels, ci.yml guard prevents silent overwrite, minimal expands to all .github/ and docs/, and PermissionError produces plain-English Rich error with exit code 1.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | RED tests — test_copy_templates.py + test_init_cmd.py | e36843d | packages/pip/tests/test_copy_templates.py, packages/pip/tests/test_init_cmd.py |
| 2 | GREEN — copy_templates.py + init_cmd.py implementation | 183bed0 | packages/pip/src/goodvibes_cli/steps/copy_templates.py, packages/pip/src/goodvibes_cli/commands/init_cmd.py |

## What Was Done

### Task 1: RED Tests

Updated `test_copy_templates.py`:
- Changed `test_copy_templates_dry_run_returns_list_without_writing` to assert `isinstance(result, tuple)` instead of `isinstance(result, list)`.
- Added 6 new tests: tuple shape, skipped on second run, ci.yml guard (UX-04), minimal skips ISSUE_TEMPLATE (MIN-01), minimal skips docs (MIN-01), minimal keeps CLAUDE.md.

Created `test_init_cmd.py` with 4 tests:
- `test_non_empty_dir_prints_notice_before_tasks` (UX-01)
- `test_completion_shows_files_written_and_skipped_panels` (UX-02)
- `test_permission_error_prints_plain_english_and_exits_1` (UX-03)
- `test_dry_run_minimal_excludes_github_and_docs` (MIN-02)

Extended `conftest.py` template_dir fixture with `.github/ISSUE_TEMPLATE/bug_report.md` and `docs/onboarding.md`.

All 11 new/updated tests were RED before implementation.

### Task 2: GREEN Implementation

**copy_templates.py:**
- Return type changed from `list[str]` to `tuple[list[str], list[str]]` (written, skipped).
- Dry-run branch now returns `(all_files, [])` tuple.
- `skipped_files` list accumulates file-level no-clobber hits inside `ignore_fn`.
- No-clobber guard changed from `dest_candidate.exists()` to `dest_candidate.is_file()` — critical fix to allow directory traversal on second runs.
- ci.yml rename guard: if `variant_path.exists()` and `ci_path.exists()`, append to skipped instead of renaming.
- Minimal filter: `".github" in rel.parts or "docs" in rel.parts` (was `".github" in rel.parts and "workflows" in rel.parts`).
- PermissionError/OSError wrapped with plain-English messages.
- Final return builds `written` = all_dest minus skipped_files, ensures CLAUDE.md always present.

**init_cmd.py:**
- Non-empty dir notice: `Panel("Existing files will not be overwritten.", title="Non-empty project detected")` shown when `cwd.iterdir()` returns non-git entries (UX-01).
- Dry-run + minimal path: filters `list_template_files()` output excluding `.github` and `docs` prefixes (MIN-02).
- copy_templates call destructured: `written, skipped = copy_templates(...)`.
- Completion shows `Panel(written_str, title="Files written (N)")` and optionally `Panel(skipped_str, title="Files skipped (M)")` (UX-02).
- PermissionError/OSError caught, printed as `[red]Error:[/red] {e}`, raises `typer.Exit(1)` (UX-03).
- Minimal completion shows "Skipped layers" panel.

**test_main.py (Rule 1 auto-fix):** Updated 3 copy_templates mocks from `return_value=[]` / `return_value=["CLAUDE.md"]` to tuples.

## Test Results

```
74 passed in 0.96s (all GREEN)
```

Previously passing 63 tests: all still pass. 11 new/updated tests: all GREEN.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] No-clobber guard used `exists()` instead of `is_file()`**
- **Found during:** Task 2 — `test_copy_templates_does_not_overwrite_existing_ci_yml` failed
- **Issue:** `shutil.copytree` calls `ignore_fn` per directory with the directory's contents (not just files). When the plan uses `dest_candidate.exists()`, the entire `.github` directory name is added to skipped because `dest_dir/.github` exists. This prevents copytree from descending into `.github/`, so `ci-node.yml` was never copied and the rename guard never triggered.
- **Fix:** Changed `dest_candidate.exists()` to `dest_candidate.is_file()` so only files (not directories) are no-clobber skipped. Directories are always traversed.
- **Files modified:** packages/pip/src/goodvibes_cli/steps/copy_templates.py
- **Commit:** 183bed0

**2. [Rule 1 - Bug] test_main.py mocks returned list, not tuple**
- **Found during:** Task 2 full test suite run
- **Issue:** Three tests in `test_main.py` mocked `copy_templates` with `return_value=[]` or `return_value=["CLAUDE.md"]`; init_cmd now unpacks two values from the return.
- **Fix:** Changed all three mocks to return tuples: `([], [])` and `(["CLAUDE.md"], [])`.
- **Files modified:** packages/pip/tests/test_main.py
- **Commit:** 183bed0

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. Existing path-traversal guard (`full.resolve().relative_to(template_dir.resolve())`) preserved unchanged. Error messages surface `str(e)` only, no traceback leakage.

## Self-Check: PASSED

- packages/pip/src/goodvibes_cli/steps/copy_templates.py: FOUND
- packages/pip/src/goodvibes_cli/commands/init_cmd.py: FOUND
- packages/pip/tests/test_copy_templates.py: FOUND
- packages/pip/tests/test_init_cmd.py: FOUND
- packages/pip/tests/test_main.py: FOUND
- packages/pip/tests/conftest.py: FOUND
- .planning/phases/06-ux-hardening/06-03-SUMMARY.md: FOUND
- Commit e36843d (RED tests): FOUND
- Commit 183bed0 (GREEN implementation): FOUND
