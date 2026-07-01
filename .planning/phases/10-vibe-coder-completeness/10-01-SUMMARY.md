---
phase: 10-vibe-coder-completeness
plan: "01"
subsystem: cli
tags: [npm, pip, typescript, python, doctor, update-alias, version-fix, headroom-idempotency]
dependency_graph:
  requires: []
  provides:
    - goodvibes update alias (upgrade command alias in both CLIs)
    - goodvibes doctor command (five-check health command in both CLIs)
    - --version reads package.json (not hardcoded)
    - headroom idempotency probe and description log (both CLIs)
  affects:
    - packages/npm/src/index.ts
    - packages/npm/src/commands/upgrade.ts
    - packages/npm/src/steps/install-headroom.ts
    - packages/pip/src/goodvibes_cli/main.py
    - packages/pip/src/goodvibes_cli/steps/install_headroom.py
tech_stack:
  added: []
  patterns:
    - TDD (RED/GREEN) for new behavior
    - Idempotency probe via execa (npm) / shutil.which (pip)
    - Collect-all pattern for doctor results before process.exit(1)
key_files:
  created:
    - packages/npm/src/commands/doctor.ts
    - packages/npm/src/commands/doctor.test.ts
    - packages/pip/src/goodvibes_cli/commands/doctor_cmd.py
  modified:
    - packages/npm/src/index.ts
    - packages/npm/src/commands/upgrade.ts
    - packages/npm/src/steps/install-headroom.ts
    - packages/npm/src/steps/install-headroom.test.ts
    - packages/pip/src/goodvibes_cli/main.py
    - packages/pip/src/goodvibes_cli/steps/install_headroom.py
    - packages/pip/tests/test_install_headroom.py
    - JOURNAL.md
decisions:
  - VCC-01 update alias: added .alias('update') on upgrade command (npm) and app.command('update')(upgrade_cmd) (pip) — no new logic, just routing
  - VCC-02 version fix: index.ts now reads version from package.json via createRequire; pip already used importlib.metadata correctly
  - VCC-03 doctor command: five checks (headroom on PATH, git user.name, git user.email, CLAUDE.md present, sentinel block present); collect-all before exit(1)
  - VCC-05 headroom transparency: description log before probe; shutil.which probe (pip) / execa probe (npm) to skip if already installed
  - SENTINEL_START/END defined locally in doctor.ts and doctor_cmd.py — sentinel-merge.ts does not export them; sentinel_merge.py does but plan specified local constants for clarity
  - pip test_install_headroom.py: all existing tests updated to mock shutil.which — deviation Rule 1 (existing tests broken by new idempotency check)
metrics:
  duration: "8 minutes"
  completed: "2026-07-01T09:59:10Z"
  tasks: 2
  files: 8
---

# Phase 10 Plan 01: CLI Completeness Gaps Summary

Wire `goodvibes update` alias, fix `--version` hardcoded string, add `goodvibes doctor` command, and add headroom install transparency (description log + idempotency) in both npm (TypeScript) and pip (Python) CLIs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for doctor and install-headroom idempotency | 3c083c1 | doctor.test.ts (new), install-headroom.test.ts |
| 1 (GREEN) | Wire update alias, fix --version, add doctor, add headroom idempotency | f88f649 | index.ts, upgrade.ts, doctor.ts (new), install-headroom.ts, main.py, doctor_cmd.py (new), install_headroom.py, test_install_headroom.py |

## Verification

- npm test: 116 passed (106 pre-existing + 10 new)
- pip pytest: 111 passed (109 pre-existing + 2 new)
- `from goodvibes_cli.main import app; [c.name for c in app.registered_commands]` → `['init', 'upgrade', 'update', 'doctor']`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing pip test_install_headroom.py tests to mock shutil.which**
- **Found during:** Task 2 verification
- **Issue:** Adding `shutil.which("headroom")` idempotency check before the installer loop caused all existing pip tests that exercise the installer path to fail — they mocked `subprocess.run` but not `shutil.which`. In a CI environment where headroom happens to be on PATH, the idempotency check would trigger early return before the ONNX warning, breaking assertions.
- **Fix:** Added `mocker.patch("goodvibes_cli.steps.install_headroom.shutil.which", return_value=None)` to all 8 existing tests that exercise the install path. Added 2 new tests: `test_already_installed_skips_installer` and `test_description_logged_before_idempotency_check`.
- **Files modified:** packages/pip/tests/test_install_headroom.py
- **Commit:** f88f649

**2. [Rule 1 - Bug] Updated existing npm install-headroom.test.ts tests for probe-first call order**
- **Found during:** Task 1 TDD RED phase
- **Issue:** The new idempotency probe (`execa('headroom', ['--version'])`) is the first execa call, shifting the call indices for all existing installer tests. Tests asserting `toHaveBeenNthCalledWith(1, 'uv', ...)` would fail because call 1 is now the probe.
- **Fix:** Updated all 5 existing tests to mock the probe as the first ENOENT call, shifting installer indices accordingly (uv is now call 2, pipx call 3, pip call 4). Added 2 new tests: `logs description before any subprocess call` and `logs already installed message and skips installer when headroom is on PATH`.
- **Files modified:** packages/npm/src/steps/install-headroom.test.ts
- **Commit:** 3c083c1 (RED), f88f649 (GREEN)

## TDD Gate Compliance

- RED commit: 3c083c1 — `test(10-01): add failing tests for doctor command and install-headroom idempotency`
- GREEN commit: f88f649 — `feat(10-01): wire update alias, fix --version, add doctor command, add headroom idempotency`

Both RED and GREEN gates satisfied.

## Known Stubs

None — all five doctor checks are fully wired. Headroom idempotency probe is live (execa/'shutil.which'), not mocked.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Doctor reads only local filesystem (CLAUDE.md in cwd) and runs read-only probes (headroom --version, git config) with no user-controlled input in arguments.

## Self-Check: PASSED

- FOUND: packages/npm/src/commands/doctor.ts
- FOUND: packages/pip/src/goodvibes_cli/commands/doctor_cmd.py
- FOUND: .planning/phases/10-vibe-coder-completeness/10-01-SUMMARY.md
- FOUND commit: 3c083c1 (RED phase tests)
- FOUND commit: f88f649 (GREEN phase implementation)
