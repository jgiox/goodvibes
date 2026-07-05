---
phase: 12
slug: headroom-status-surfacing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-03
---

# Phase 12 — Validation Strategy

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **TS Framework** | vitest (`npm run test` in `packages/npm/`) |
| **Python Framework** | pytest + pytest-mock (`cd packages/pip && uv run pytest tests/`) |
| **TS quick run** | `cd packages/npm && npm run test` |
| **Python quick run** | `cd packages/pip && uv run pytest tests/test_install_headroom.py tests/test_configure_mcp.py tests/test_init_cmd.py tests/test_doctor_cmd.py -x` |
| **Estimated runtime** | ~30 seconds (TS) + ~15 seconds (Python) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the affected language
- **After every plan wave:** Run both TS and Python suites
- **Before `/gsd-verify-work`:** Both suites must be green

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 12-01-T1 | 12-01 | 1 | HDR2-03, HDR2-04 | unit (RED) | `cd packages/npm && npm run test -- steps` | Pending |
| 12-01-T2 | 12-01 | 1 | HDR2-03, HDR2-04 | unit (GREEN) | `cd packages/npm && npm run test -- steps` | Pending |
| 12-02-T1 | 12-02 | 2 | HDR2-01, HDR2-02, HDR2-05 | unit (RED) | `cd packages/npm && npm run test -- commands` | Pending |
| 12-02-T2 | 12-02 | 2 | HDR2-01, HDR2-02, HDR2-05 | unit (GREEN) | `cd packages/npm && npm run test -- commands` | Pending |
| 12-03-T1 | 12-03 | 2 | HDR2-01..05 | unit (RED) | `cd packages/pip && uv run pytest tests/test_install_headroom.py tests/test_configure_mcp.py tests/test_init_cmd.py tests/test_doctor_cmd.py -x` | Pending |
| 12-03-T2 | 12-03 | 2 | HDR2-01..05 | unit (GREEN) | `cd packages/pip && uv run pytest tests/test_install_headroom.py tests/test_configure_mcp.py tests/test_init_cmd.py tests/test_doctor_cmd.py -x` | Pending |

---

## Security Domain

| ASVS Category | Applies | Control |
|---------------|---------|---------|
| V5 Input Validation (subprocess args) | Yes | execa array args + `shell=False` in Python — already enforced |
| Subprocess DoS (hang) | Yes | HDR2-04: 10-second hard timeout on all headroom calls |

No new security risks introduced by this phase.

---

## Wave 0 Gaps

All test files exist. No new test files needed. Updates required in existing tests:

- [ ] `install-headroom.test.ts` line 29: `resolves.toBeUndefined()` → returns `{ status: 'already-installed' }`
- [ ] `install-headroom.test.ts` line 181: probe changes from `['headroom', '--version']` to `['headroom', 'compress', '--help']`
- [ ] `init.test.ts` line 133: `mockResolvedValue(undefined)` → result objects for installHeadroom + configureMcp
- [ ] `doctor.test.ts` line 48: mock must reflect `compress --help` call
- [ ] `test_install_headroom.py`: `shutil.which` mock → `subprocess.run` mock
- [ ] `test_doctor_cmd.py`: `shutil.which` mock → `subprocess.run` mock
