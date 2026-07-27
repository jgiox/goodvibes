---
phase: 14
slug: goodvibes-update-with-manifest
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-27
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (npm), pytest (pip) |
| **Config file** | packages/npm/vitest.config.ts, packages/pip/pyproject.toml |
| **Quick run command** | `cd packages/npm && npm test` / `cd packages/pip && uv run pytest tests/` |
| **Full suite command** | `cd packages/npm && npm test && cd ../pip && uv run pytest tests/` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command for the changed package
- **After every plan wave:** Run full suite command (both packages)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 14-01-01 | 01 | 0 | UPD-06 | unit | `cd packages/npm && npm test -- --reporter=verbose` | ⬜ pending |
| 14-01-02 | 01 | 0 | UPD-06 | unit | `cd packages/npm && npm test` | ⬜ pending |
| 14-02-01 | 02 | 1 | UPD-01 | unit | `cd packages/npm && npm test -- --reporter=verbose` | ⬜ pending |
| 14-02-02 | 02 | 1 | UPD-01 | unit | `cd packages/npm && npm test` | ⬜ pending |
| 14-03-01 | 03 | 1 | UPD-01 | unit | `cd packages/pip && uv run pytest tests/ -v` | ⬜ pending |
| 14-03-02 | 03 | 1 | UPD-01 | unit | `cd packages/pip && uv run pytest tests/` | ⬜ pending |
| 14-04-01 | 04 | 2 | UPD-02,UPD-03,UPD-04,UPD-05 | unit | `cd packages/npm && npm test -- --reporter=verbose` | ⬜ pending |
| 14-04-02 | 04 | 2 | UPD-02,UPD-03,UPD-04,UPD-05 | unit | `cd packages/npm && npm test` | ⬜ pending |
| 14-05-01 | 05 | 2 | UPD-02,UPD-03,UPD-04,UPD-05 | unit | `cd packages/pip && uv run pytest tests/ -v` | ⬜ pending |
| 14-05-02 | 05 | 2 | UPD-02,UPD-03,UPD-04,UPD-05 | unit | `cd packages/pip && uv run pytest tests/` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/npm/src/steps/sentinel-merge.test.ts` — extend with UPD-06 case (SENTINEL_START no END)
- [ ] `packages/npm/src/steps/write-manifest.test.ts` — stubs for writeManifest / readManifest
- [ ] `packages/pip/tests/test_sentinel_merge.py` — extend with UPD-06 case
- [ ] `packages/pip/tests/test_write_manifest.py` — stubs for write_manifest / read_manifest

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `goodvibes update` confirmation prompt renders in real terminal | UPD-04 | @clack/prompts confirm() requires interactive TTY | Run `npx goodvibes update` in real terminal with pending overwrites |
| `goodvibes update` dry-run output formatting | UPD-03 | Visual output check | Run `npx goodvibes update --dry-run` and verify three labeled categories appear |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
