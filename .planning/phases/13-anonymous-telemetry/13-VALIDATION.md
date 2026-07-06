---
phase: 13
slug: anonymous-telemetry
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-06
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (npm)** | vitest ^4 |
| **Config file (npm)** | none — vitest picks up from scripts |
| **Quick run (npm)** | `cd packages/npm && npm test` |
| **Full suite (npm)** | `cd packages/npm && npm test` |
| **Framework (pip)** | pytest + pytest-mock |
| **Config file (pip)** | `packages/pip/pyproject.toml` `[tool.pytest.ini_options]` |
| **Quick run (pip)** | `cd packages/pip && uv run pytest tests/ -x -q` |
| **Full suite (pip)** | `cd packages/pip && uv run pytest tests/` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/npm && npm test` and `cd packages/pip && uv run pytest tests/ -x -q`
- **After every plan wave:** Run full suites for both packages
- **Before `/gsd-verify-work`:** Full suite must be green for both packages
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | TEL-01 | T-IP-logging | Worker reads nothing from request; KV stores only counters | unit | `cd packages/npm && npm test -- telemetry` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | TEL-02 | — | UUID generated per-invocation, never stored to disk | unit | `cd packages/npm && npm test -- telemetry` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | TEL-03 | — | DO_NOT_TRACK=1 / GOODVIBES_NO_TELEMETRY=1 / CI=true suppress fetch | unit | `cd packages/npm && npm test -- telemetry` | ❌ W0 | ⬜ pending |
| 13-01-04 | 01 | 1 | TEL-04 | — | N/A — disclosure display only | unit | `cd packages/npm && npm test -- init` | ✅ new case | ⬜ pending |
| 13-01-05 | 01 | 1 | TEL-05 | — | sendTelemetry never throws to caller | unit | `cd packages/npm && npm test -- telemetry` | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 1 | TEL-01 | T-IP-logging | Worker reads nothing from request; KV stores only counters | unit | `cd packages/pip && uv run pytest tests/test_telemetry.py -x -q` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 1 | TEL-02 | — | UUID generated per-invocation, never stored to disk | unit | `cd packages/pip && uv run pytest tests/test_telemetry.py -x -q` | ❌ W0 | ⬜ pending |
| 13-02-03 | 02 | 1 | TEL-03 | — | DO_NOT_TRACK=1 / GOODVIBES_NO_TELEMETRY=1 / CI=true suppress urlopen | unit | `cd packages/pip && uv run pytest tests/test_telemetry.py -x -q` | ❌ W0 | ⬜ pending |
| 13-02-04 | 02 | 1 | TEL-04 | — | N/A — disclosure display only | unit | `cd packages/pip && uv run pytest tests/test_init_cmd.py -x -q` | ✅ new case | ⬜ pending |
| 13-02-05 | 02 | 1 | TEL-05 | — | send_telemetry / thread never raises to caller | unit | `cd packages/pip && uv run pytest tests/test_telemetry.py -x -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/npm/src/steps/telemetry.test.ts` — stub file covering TEL-01, TEL-02, TEL-03, TEL-05
- [ ] `packages/pip/tests/test_telemetry.py` — stub file covering TEL-01, TEL-02, TEL-03, TEL-05
- [ ] New test cases in `packages/npm/src/commands/init.test.ts` — TEL-04 disclosure check
- [ ] New test cases in `packages/pip/tests/test_init_cmd.py` — TEL-04 disclosure check

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Worker actually increments KV on live POST | TEL-01 | Requires deployed Cloudflare Worker + real KV namespace | `curl -X POST https://<worker-url>/` then `wrangler kv:key get total --namespace-id <id>` |
| First-run disclosure appears before file operations | TEL-04 | Requires observing terminal output ordering | Run `goodvibes init` in a new temp dir and confirm disclosure line appears first |
| Telemetry adds ≤1s after tasks when endpoint is unreachable | TEL-05 | Requires network partition simulation | Block the endpoint via `/etc/hosts` null route and time `goodvibes init` end-to-end |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
