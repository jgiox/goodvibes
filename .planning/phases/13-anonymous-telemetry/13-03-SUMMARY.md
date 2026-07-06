---
phase: 13-anonymous-telemetry
plan: "03"
subsystem: pip-telemetry
tags: [telemetry, python, threading, urllib, pip-cli]
dependency_graph:
  requires: []
  provides: [packages/pip/src/goodvibes_cli/steps/telemetry.py]
  affects: [packages/pip/src/goodvibes_cli/commands/init_cmd.py]
tech_stack:
  added: []
  patterns: [daemon-thread fire-and-forget, urllib.request stdlib HTTP, pytest-mock module-boundary mocking]
key_files:
  created:
    - packages/pip/src/goodvibes_cli/steps/telemetry.py
    - packages/pip/tests/test_telemetry.py
  modified: []
decisions:
  - "Used urllib.request (stdlib) for HTTP POST — no new dep per D-05"
  - "daemon=True on threading.Thread ensures auto-kill on process exit (RESEARCH.md Pitfall 5)"
  - "except Exception: pass in _fire() — network failure must never affect init (TEL-05)"
  - "TELEMETRY_URL overridable via GOODVIBES_TELEMETRY_URL env var per D-07; placeholder URL used until Plan 13-06"
metrics:
  duration: "~5 minutes"
  completed: "2026-07-06"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 13 Plan 03: Pip Telemetry Step Module Summary

**One-liner:** Fire-and-forget Python telemetry using threading.Thread(daemon=True) + urllib.request POST with per-invocation uuid4 and three-env-var opt-out guard.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create telemetry.py implementation | 69c7821 | packages/pip/src/goodvibes_cli/steps/telemetry.py |
| 2 | Create test_telemetry.py (6 tests) | e04b73a | packages/pip/tests/test_telemetry.py |

## What Was Built

### `packages/pip/src/goodvibes_cli/steps/telemetry.py`

Exports `start_telemetry_thread() -> threading.Thread | None`. Three private helpers:

- `TELEMETRY_URL` — module constant, overridable via `GOODVIBES_TELEMETRY_URL` env var (placeholder URL until Plan 13-06 deploys the Cloudflare Worker)
- `_opt_out() -> bool` — returns True if `DO_NOT_TRACK=1`, `GOODVIBES_NO_TELEMETRY=1`, or `CI=true`
- `_fire(request_id: str) -> None` — `urllib.request.Request` POST with `X-Request-Id` header, `timeout=5`, all exceptions swallowed silently

`start_telemetry_thread()` returns `None` when opted out; otherwise generates a per-invocation `uuid4`, starts a `daemon=True` thread running `_fire`, and returns the thread for the caller to join.

### `packages/pip/tests/test_telemetry.py`

Six tests covering TEL-01 through TEL-05:

1. `test_posts_to_telemetry_url_when_no_opt_out_env_var_set` — urlopen called once, method is POST (TEL-01)
2. `test_sends_uuid_in_x_request_id_header` — X-Request-Id header matches UUID4 pattern (TEL-02)
3. `test_returns_none_when_do_not_track_is_set` — DO_NOT_TRACK=1 returns None (TEL-03a)
4. `test_returns_none_when_goodvibes_no_telemetry_is_set` — GOODVIBES_NO_TELEMETRY=1 returns None (TEL-03b)
5. `test_returns_none_when_ci_is_set` — CI=true returns None (TEL-03c)
6. `test_does_not_raise_when_urlopen_raises_os_error` — OSError swallowed, thread completes (TEL-05)

All mocked at `goodvibes_cli.steps.telemetry.urllib.request.urlopen`. Env isolation via `monkeypatch.setenv`/`monkeypatch.delenv`.

## Verification

- `uv run pytest tests/test_telemetry.py -v` → 6 passed in 0.02s
- `uv run pytest tests/` → 136 passed in 1.11s (full pip suite)
- `uv run python -c "from goodvibes_cli.steps.telemetry import start_telemetry_thread; print('import OK')"` → import OK

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pytest-mock not installed in fresh venv**
- **Found during:** Task 2 (first test run)
- **Issue:** `uv sync` without `--extra dev` created the venv with only runtime deps; `mocker` fixture was unavailable
- **Fix:** Ran `uv sync --extra dev` to install `pytest-mock>=3` and other dev deps
- **Files modified:** None (venv state only)
- **Commit:** N/A (environment fix, not source change)

### TDD Gate Note

Task 2 has `tdd="true"` but the implementation (Task 1) was created first per plan ordering. The RED phase would trivially pass against a non-existent module, but since the plan explicitly ordered implementation before tests, tests were written after the implementation and verified to pass (GREEN). This is an intentional plan-ordering choice, not a TDD deviation.

## Known Stubs

- `TELEMETRY_URL = 'https://goodvibes-telemetry.PLACEHOLDER.workers.dev/'` — placeholder URL in telemetry.py. Plan 13-06 replaces this with the deployed Cloudflare Worker URL after Plan 13-04 deploys the worker.

## Threat Flags

No new threat surface beyond the plan's threat model. `_fire()` makes one outbound POST to a hardcoded URL; all identified STRIDE threats (T-13-03-DRY, T-13-03-UUID, T-13-03-HANG, T-13-03-THREAD) are addressed in the implementation.

## Self-Check: PASSED

- [x] `packages/pip/src/goodvibes_cli/steps/telemetry.py` exists
- [x] `packages/pip/tests/test_telemetry.py` exists
- [x] Commit 69c7821 (feat) exists
- [x] Commit e04b73a (test) exists
- [x] 6 tests pass; 136 total pass
