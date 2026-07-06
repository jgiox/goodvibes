---
phase: 13-anonymous-telemetry
plan: "05"
subsystem: pip-init-wiring
tags: [telemetry, python, threading, init-command, privacy, opt-out]
dependency_graph:
  requires: [13-03]
  provides: [packages/pip/src/goodvibes_cli/commands/init_cmd.py telemetry wiring]
  affects: [packages/pip/tests/test_init_cmd.py]
tech_stack:
  - Python
  - pytest
  - pytest-mock
status: complete
---

# Plan 13-05 — pip init telemetry wiring — SUMMARY

## What was built

Wired telemetry disclosure and fire-and-forget threading into `packages/pip/src/goodvibes_cli/commands/init_cmd.py`.

### Changes

**packages/pip/src/goodvibes_cli/commands/init_cmd.py**
- Added `import os` to stdlib imports
- Added `from goodvibes_cli.steps.telemetry import start_telemetry_thread`
- Opt-out flag: `_opted_out = (os.environ.get('DO_NOT_TRACK') == '1' or os.environ.get('GOODVIBES_NO_TELEMETRY') == '1' or os.environ.get('CI') == 'true')`
- Disclosure panel: `if not _opted_out: console.print(Panel('Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out.', title='Privacy'))` — immediately after `console.rule(...)`
- `tel_thread = start_telemetry_thread()` — after dry-run early return
- `if tel_thread: tel_thread.join(timeout=1.0)` — after try/except task block

**packages/pip/tests/test_init_cmd.py**
- `@pytest.fixture(autouse=True) def mock_telemetry(mocker):` — patches `start_telemetry_thread` in all tests, prevents real HTTP
- New test: `test_shows_privacy_panel_with_disclosure_text_when_not_opted_out` (TEL-04)
- New test: `test_does_not_call_start_telemetry_thread_during_dry_run`
- New test: `test_does_not_show_privacy_panel_when_do_not_track_is_1` (ROADMAP SC2)

## Test results

```
139 passed in 1.68s
```

All 139 tests passing including 3 new telemetry tests.

## Decisions honored

- D-08: exact disclosure text `"Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out."`
- D-09: Panel placed immediately after console.rule() header
- D-10: thread.join(timeout=1.0) caps wait at 1s
- D-04: pip wiring mirrors npm (same disclosure, same opt-out vars, same timing pattern)
- ROADMAP SC2: disclosure suppressed when opted out
