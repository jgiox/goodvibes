---
phase: 6
slug: ux-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-26
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (TS) + pytest (Python) |
| **Config file** | packages/npm/vitest.config.ts / packages/pip/pyproject.toml |
| **Quick run command** | `cd packages/npm && npm test -- --run` |
| **Full suite command** | `cd packages/npm && npm test -- --run && cd ../pip && pytest` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/npm && npm test -- --run`
- **After every plan wave:** Run full suite (npm + pip)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 06-01-01 | 01 | 0 | UX-02 | unit | `npm test -- --run copy-templates` | ⬜ pending |
| 06-01-02 | 01 | 0 | UX-01 | unit | `npm test -- --run init` | ⬜ pending |
| 06-01-03 | 01 | 0 | UX-04 | unit | `npm test -- --run copy-templates` | ⬜ pending |
| 06-01-04 | 01 | 1 | UX-02 | unit | `npm test -- --run copy-templates` | ⬜ pending |
| 06-01-05 | 01 | 1 | UX-01, UX-03 | unit | `npm test -- --run init` | ⬜ pending |
| 06-02-01 | 02 | 0 | MIN-01, MIN-02 | unit | `npm test -- --run copy-templates` | ⬜ pending |
| 06-02-02 | 02 | 1 | MIN-01 | unit | `npm test -- --run copy-templates` | ⬜ pending |
| 06-03-01 | 03 | 0 | UX-01, UX-02, UX-03, UX-04 | unit | `pytest tests/` | ⬜ pending |
| 06-03-02 | 03 | 1 | MIN-01, MIN-02 | unit | `pytest tests/` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/npm/src/steps/copy-templates.test.ts` — update mocks for `{written, skipped}` return type
- [ ] `packages/pip/tests/test_init_cmd.py` — new file; test stubs for UX-01 through UX-04
- [ ] `packages/pip/tests/test_copy_templates.py` — update mock assertions for tuple return

*Existing vitest and pytest infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Non-empty dir notice appears before writes | UX-01 | Requires real filesystem + terminal inspection | Run `goodvibes init` in a dir with existing files; confirm `note()` block renders before spinner tasks |
| Raw stack trace absent on real EACCES | UX-03 | Requires chmod 000 on a real directory | `chmod 000 /tmp/testdir && goodvibes init /tmp/testdir`; confirm only plain-English message visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
