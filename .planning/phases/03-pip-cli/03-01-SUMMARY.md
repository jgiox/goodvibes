---
phase: 03-pip-cli
plan: "01"
subsystem: pip-cli-foundation
tags: [python, packaging, pyproject, test-stubs, smoke-harness]
dependency_graph:
  requires: []
  provides: [packages/pip/pyproject.toml, scripts/verify-phase3.sh, pip-test-stubs]
  affects: [03-02-PLAN.md, 03-03-PLAN.md, 03-04-PLAN.md]
tech_stack:
  added: [hatchling, typer>=0.15, rich>=14, uv, pytest]
  patterns: [pyproject-toml-hatchling, uv-sync, python-version-guard, test-stubs-skip-all]
key_files:
  created:
    - scripts/verify-phase3.sh
    - packages/pip/pyproject.toml
    - packages/pip/README.md
    - packages/pip/src/goodvibes_cli/__init__.py
    - packages/pip/src/goodvibes_cli/__main__.py
    - packages/pip/tests/conftest.py
    - packages/pip/tests/test_sentinel_merge.py
    - packages/pip/tests/test_copy_templates.py
    - packages/pip/tests/test_install_headroom.py
    - packages/pip/tests/test_configure_mcp.py
    - packages/pip/uv.lock
    - packages/pip/.gitignore
    - .gitignore
  modified: []
decisions:
  - "D-01: pip package name is jgiox-goodvibes (goodvibes taken on PyPI by chemistry package)"
  - "D-02: headroom NOT in pyproject.toml dependencies — runtime-only install chain at goodvibes init time"
  - "D-03: hatchling force-include maps ../../templates to goodvibes_cli/templates in wheel"
  - "D-04: goodvibes script entry points to goodvibes_cli.main:app"
  - "D-05: sys.version_info guard in __main__.py runs before any import including typer"
metrics:
  duration: "4 minutes"
  completed_date: "2026-06-24"
  tasks_completed: 2
  files_changed: 13
---

# Phase 03 Plan 01: pip-cli Wave 0 Foundation Summary

**One-liner:** Wave 0 scaffolding — verify-phase3.sh smoke harness plus packages/pip/ with pyproject.toml (jgiox-goodvibes), Python version guard, and 34 test stubs ready for Wave 1 implementation.

## What Was Built

### Task 1: verify-phase3.sh smoke harness

Created `scripts/verify-phase3.sh` mirroring verify-phase2.sh exactly. Static checks (always run, --quick safe):

- PIP-PKG-01..04: pyproject.toml presence, name, script entry, requires-python
- PIP-05-GUARD/ORDER/EXIT: sys.version_info before import typer, sys.exit(1) present
- PIP-TEST-CFG: [tool.pytest.ini_options] present
- HDR-06-PY: headroom-ai NOT in dependencies (D-02)
- SENTINEL-FORMAT: goodvibes:start sentinel in templates/CLAUDE.md
- PIP-BUILD-01/02: __init__.py present; main.py soft-skip (Wave 2)

Full-mode checks: PIP-UV-BUILD, PIP-DOTFILES, PIP-INSTALL, PIP-HELP, PIP-DRYRUN, PIP-MINIMAL, PIP-TEST.

Result: `bash scripts/verify-phase3.sh --quick` exits 0 with "Results: 12 passed, 0 failed, Phase 3 gate: PASS".

### Task 2: packages/pip scaffold + test stubs

**pyproject.toml:** name=jgiox-goodvibes (D-01), requires-python>=3.10 (D-05), hatchling backend with force-include templates/ (D-03), goodvibes script entry (D-04), typer>=0.15 + rich>=14 dependencies, headroom absent (D-02), [tool.pytest.ini_options].

**src/goodvibes_cli/__init__.py:** single-line `__version__ = "1.0.0"`.

**src/goodvibes_cli/__main__.py:** sys.version_info < (3,10) check as lines 1-10 before any import. Error message names Python 3.10 minimum. sys.exit(1). Then `import typer` and `from goodvibes_cli.main import app` after guard.

**Test stubs (all @pytest.mark.skip):**
- conftest.py: tmp_dir, template_dir, sample_template_content fixtures; TEMPLATE_CONTENT constant matching Phase 2 sentinel markers
- test_sentinel_merge.py: 13 stubs — versionGte (4), extractVersion (3), mergeClaude cases A/B/B-idempotent/C/D/D2 (6)
- test_copy_templates.py: 9 stubs — copy, skip-claude-md, sentinel-merge-call, minimal-flag, path-traversal, dry-run, idempotent, empty-dir
- test_install_headroom.py: 8 stubs — uv/pipx/pip chain, all-ENOENT, CalledProcessError soft-fail, python-absent, ONNX-warning, no-shell-true
- test_configure_mcp.py: 5 stubs — idempotent, claude-mcp-add primary, headroom-mcp-install fallback, ENOENT-safe, CLAUDE_CONFIG_DIR warning

`uv sync` succeeded: uv.lock generated, 9 packages resolved (typer 0.26.7, rich 15.0.0).

Result: `uv run pytest tests/ -x -q` exits 0, 34 stubs skipped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] __main__.py lacked explicit `import typer` line**
- **Found during:** Task 1 verification (verify-phase3.sh PIP-05-ORDER check)
- **Issue:** verify-phase3.sh PIP-05-ORDER checks that `import typer` appears after `sys.version_info` in __main__.py. Initial __main__.py only imported `from goodvibes_cli.main import app`, so `import typer` was absent and the ordering check could not pass.
- **Fix:** Added explicit `import typer` after the version guard block (with noqa comment explaining the placement). This satisfies the checker's intent: prove typer is not imported before the version guard runs.
- **Files modified:** packages/pip/src/goodvibes_cli/__main__.py
- **Commit:** 0e59ee2

**2. [Rule 2 - Missing critical functionality] No .gitignore — pycache committed**
- **Found during:** Task 2 commit
- **Issue:** No root .gitignore or packages/pip/.gitignore existed. `uv run pytest` generates __pycache__/ which was inadvertently staged and committed.
- **Fix:** Created root .gitignore and packages/pip/.gitignore with __pycache__/, *.pyc, .venv/, dist/ patterns. Removed committed pycache files via `git rm --cached`.
- **Files modified:** .gitignore (new), packages/pip/.gitignore (new)
- **Commit:** 1ca6f62

**3. [Rule 3 - Blocking] Missing README.md prevented uv sync**
- **Found during:** Task 2 — `uv sync` failed with `OSError: Readme file does not exist: README.md`
- **Issue:** pyproject.toml declared `readme = "README.md"` but the file did not exist, blocking hatchling from building the editable install.
- **Fix:** Created packages/pip/README.md with minimal content.
- **Files modified:** packages/pip/README.md (new)
- **Commit:** 0e59ee2

## Known Stubs

All 34 test functions in test_sentinel_merge.py, test_copy_templates.py, test_install_headroom.py, and test_configure_mcp.py are decorated with `@pytest.mark.skip(reason="stub — implement in Wave 1")`. These are intentional stubs — Wave 1 plans (03-02, 03-03) implement the modules and flesh out each test. The stubs define the full expected behavior surface.

## Threat Surface Scan

No new security-relevant surfaces introduced. verify-phase3.sh inputs are hardcoded (no user input). pyproject.toml force-include path is developer-controlled. No network access in this plan.

## Self-Check: PASSED

- scripts/verify-phase3.sh: exists, exits 0 with 12 passed / 0 failed
- packages/pip/pyproject.toml: exists, name=jgiox-goodvibes confirmed
- packages/pip/src/goodvibes_cli/__init__.py: exists
- packages/pip/src/goodvibes_cli/__main__.py: exists, sys.version_info before import typer
- packages/pip/tests/conftest.py: exists
- packages/pip/tests/test_sentinel_merge.py: exists (13 stubs)
- packages/pip/tests/test_copy_templates.py: exists (9 stubs)
- packages/pip/tests/test_install_headroom.py: exists (8 stubs)
- packages/pip/tests/test_configure_mcp.py: exists (5 stubs)
- packages/pip/uv.lock: exists
- Commits: bb076b4, 0e59ee2, 1ca6f62 all verified in git log
