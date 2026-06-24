---
phase: 03-pip-cli
plan: "02"
subsystem: pip-cli-sentinel-copy
tags: [python, sentinel-merge, copy-templates, tdd, stdlib-only]
dependency_graph:
  requires: [03-01]
  provides:
    - packages/pip/src/goodvibes_cli/utils/sentinel_merge.py
    - packages/pip/src/goodvibes_cli/steps/copy_templates.py
  affects: [03-03-PLAN.md, 03-04-PLAN.md]
tech_stack:
  added: [pytest>=9, pytest-mock>=3, pytest-asyncio>=0.25, pytest-cov>=7 (dev deps)]
  patterns: [tdd-red-green, stdlib-only-port, shutil-copytree-ignore, importlib-resources, sentinel-merge]
key_files:
  created:
    - packages/pip/src/goodvibes_cli/utils/__init__.py
    - packages/pip/src/goodvibes_cli/utils/sentinel_merge.py
    - packages/pip/src/goodvibes_cli/steps/__init__.py
    - packages/pip/src/goodvibes_cli/steps/copy_templates.py
  modified:
    - packages/pip/tests/test_sentinel_merge.py
    - packages/pip/tests/test_copy_templates.py
    - packages/pip/tests/conftest.py
    - packages/pip/pyproject.toml
    - packages/pip/uv.lock
decisions:
  - "D-06: pytest + pytest-mock added to [project.optional-dependencies] dev so uv run pytest uses venv python (not user's ~/.local/bin/pytest)"
  - "D-07: copy_templates checks claude_src.exists() before calling merge_claude, so empty template dirs don't crash"
  - "D-08: conftest template_dir fixture extended to include CONTRIBUTING.md and .github/workflows/ci.yml (needed for copy_templates tests)"
metrics:
  duration: "7 minutes"
  completed_date: "2026-06-24"
  tasks_completed: 2
  files_changed: 9
---

# Phase 03 Plan 02: sentinel_merge.py + copy_templates.py Summary

**One-liner:** Wave 1a — stdlib-only port of sentinel-merge.ts and copy-templates.ts with 22 passing tests (13 sentinel + 9 copy_templates, zero skipped).

## What Was Built

### Task 1: sentinel_merge.py (TDD)

`packages/pip/src/goodvibes_cli/utils/sentinel_merge.py` — direct port of `sentinel-merge.ts`. Stdlib only (re, pathlib).

- `SENTINEL_START = "<!-- goodvibes:start -->"`, `SENTINEL_END = "<!-- goodvibes:end -->"` — byte-for-byte identical to TypeScript
- `extract_version(block)` — re.search for `# goodvibes: v([\d.]+)`
- `version_gte(a, b)` — integer component comparison, handles `1.10.0 > 1.9.0` correctly
- `merge_claude(dest_path, template_content)` — 4-case merge:
  - Case A: dest absent → write template verbatim (creates parent dirs)
  - Case B: dest present, no sentinel → append sentinel block
  - Case C: sentinel present, older version → replace only sentinel block
  - Case D: sentinel present, same or newer → no write (idempotent)
- Case B idempotency is guaranteed by Case D on second call

Test file: `tests/test_sentinel_merge.py` — 13 tests, all PASSED.

### Task 2: copy_templates.py (TDD)

`packages/pip/src/goodvibes_cli/steps/copy_templates.py` — port of `copy-templates.ts`. Uses shutil + importlib.resources.

- `resolve_templates_dir()` — `importlib.resources.files("goodvibes_cli").joinpath("templates")`, wrapped with `pathlib.Path(str(...))` for compatibility
- `list_template_files(template_dir)` — `rglob("*")` filtered to files, returns sorted relative str paths
- `copy_templates(template_dir, dest_dir, dry_run, minimal)`:
  - `dry_run=True` → returns file list immediately, no writes
  - `ignore_fn` handles: CLAUDE.md exclusion, no-clobber (T-03-02-03), path-traversal guard (T-03-02-01), minimal flag for `.github/workflows`
  - `shutil.copytree(..., dirs_exist_ok=True)` for the non-CLAUDE.md files
  - `merge_claude` called for CLAUDE.md only when `claude_src.exists()`
- No subprocess, no shell=True anywhere

Test file: `tests/test_copy_templates.py` — 9 tests, all PASSED.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pytest not in venv — tests failed with ModuleNotFoundError**
- **Found during:** Task 1 GREEN phase (first `uv run pytest` with real imports)
- **Issue:** `uv run pytest` resolved to `~/.local/bin/pytest` (user-installed), which ran under `/usr/bin/python3` without the venv's site-packages. The editable install `.pth` file was not loaded, so `goodvibes_cli` was not importable. Skipped tests (Wave 0) didn't trigger imports so the issue was hidden.
- **Fix:** Added `[project.optional-dependencies] dev = [pytest>=9, pytest-mock>=3, pytest-asyncio>=0.25, pytest-cov>=7]` to pyproject.toml; ran `uv sync --extra dev`. Now `uv run pytest` uses the venv's pytest binary which loads `.pth` files correctly.
- **Files modified:** packages/pip/pyproject.toml, packages/pip/uv.lock
- **Commit:** e49dd91

**2. [Rule 2 - Missing critical functionality] conftest template_dir fixture lacked CONTRIBUTING.md and .github/workflows**
- **Found during:** Task 2 — first test failure (`CONTRIBUTING.md` not found in dest_dir)
- **Issue:** The conftest fixture only created `CLAUDE.md`. copy_templates tests need non-CLAUDE.md files to verify raw copy, no-clobber, and minimal flag behavior.
- **Fix:** Extended conftest `template_dir` fixture to add `CONTRIBUTING.md` and `.github/workflows/ci.yml`. Updated test bodies that tried to create those files themselves.
- **Files modified:** packages/pip/tests/conftest.py, packages/pip/tests/test_copy_templates.py
- **Commit:** e894be9

**3. [Rule 1 - Bug] test_copy_templates tests created fixture files that conftest now provides**
- **Found during:** After conftest update — `FileExistsError` for `.github/workflows` directory
- **Fix:** Removed redundant `mkdir/write_text` calls from test bodies that now rely on the conftest fixture.
- **Files modified:** packages/pip/tests/test_copy_templates.py
- **Commit:** e894be9

## TDD Gate Compliance

Both tasks followed RED/GREEN pattern:
- Task 1 RED: Test file written without skip decorators → `ModuleNotFoundError: No module named 'goodvibes_cli'` (module absent) → confirmed RED
- Task 1 GREEN: `sentinel_merge.py` implemented → 13 passed
- Task 2 RED: Test file written → `ModuleNotFoundError: No module named 'goodvibes_cli.steps.copy_templates'` → confirmed RED
- Task 2 GREEN: `copy_templates.py` implemented → 9 passed

## Known Stubs

None in this plan's scope. The 13 remaining skipped tests in the test suite are from `test_install_headroom.py` (8) and `test_configure_mcp.py` (5) — Wave 1b/1c scope, not this plan.

## Threat Surface Scan

No new security-relevant network endpoints or auth paths introduced. Path-traversal guard (T-03-02-01) implemented as specified. No-clobber (T-03-02-03) implemented. No user input reaches merge_claude (T-03-02-02 accepted). No subprocess/shell=True in any new file.

## Self-Check: PASSED

- packages/pip/src/goodvibes_cli/utils/sentinel_merge.py: exists, SENTINEL_START confirmed
- packages/pip/src/goodvibes_cli/steps/copy_templates.py: exists, imports from goodvibes_cli.utils.sentinel_merge
- packages/pip/tests/test_sentinel_merge.py: 13 tests, 0 skipped
- packages/pip/tests/test_copy_templates.py: 9 tests, 0 skipped
- `uv run pytest tests/test_sentinel_merge.py tests/test_copy_templates.py -x -q` exits 0: CONFIRMED
- No subprocess/shell=True: CONFIRMED
- Sentinel markers byte-for-byte identical to TypeScript: CONFIRMED
- Commits: e49dd91 (Task 1), e894be9 (Task 2) — both verified in git log
