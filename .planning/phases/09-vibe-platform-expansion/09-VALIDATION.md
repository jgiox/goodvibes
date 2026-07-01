---
phase: 09-vibe-platform-expansion
type: validation
---

# Phase 9 Validation Plan

## Test Framework

| Property | Value |
|----------|-------|
| Framework (TS) | vitest (`packages/npm`) |
| Framework (Python) | pytest + pytest-mock (`packages/pip`) |
| Config file (TS) | `packages/npm/vitest.config.ts` |
| Config file (Python) | `packages/pip/pyproject.toml` |
| Quick run (TS) | `cd packages/npm && npm test` |
| Quick run (Python) | `cd packages/pip && uv run pytest tests/` |
| Integration (TS) | `cd packages/npm && npm run test:integration` |
| Integration (Python) | `cd packages/pip && uv run pytest tests/integration/` |

## Phase Requirements → Test Map

| REQ | Behavior | Test Type | Command | Plan |
|-----|----------|-----------|---------|------|
| VPE-01 | Fresh init writes `replit.md` | integration | `npm run test:integration` | 09-02 |
| VPE-02 | Existing `replit.md` is skipped (no-clobber) | integration | `npm run test:integration` | 09-02 |
| VPE-03 | `--minimal` writes `replit.md` | integration | `npm run test:integration` | 09-02 |
| VPE-04 | Fresh init writes `.bolt/prompt` | integration | `npm run test:integration` | 09-02 |
| VPE-05 | Existing `.bolt/prompt` is skipped | integration | `npm run test:integration` | 09-02 |
| VPE-06 | `--minimal` writes `.bolt/prompt` | integration | `npm run test:integration` | 09-02 |
| VPE-07 | Python: `replit.md` written on fresh init | integration | `uv run pytest tests/integration/` | 09-02 |
| VPE-08 | Python: `.bolt/prompt` written on fresh init | integration | `uv run pytest tests/integration/` | 09-02 |

## Pass Criteria

All 8 test cases GREEN before version bump in 09-03.

TS integration run: `cd packages/npm && npm run test:integration`
Python run: `cd packages/pip && uv run pytest tests/`

Both suites must pass before tagging v1.5.0.
