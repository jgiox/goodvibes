---
phase: 4
slug: ci-cd-scaffolding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-24
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (npm)** | vitest 4.x |
| **Framework (pip)** | pytest 9.x |
| **Config file (npm)** | packages/npm/vitest.config.ts |
| **Config file (pip)** | packages/pip/pyproject.toml |
| **Quick run (npm)** | `npm test` |
| **Quick run (pip)** | `uv run --extra dev pytest tests/ -x -q` |
| **Full suite** | both above in sequence |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run for the affected package
- **After every plan wave:** Run full suite (both npm + pip)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 04-01-01 | 01 | 0 | CI-01 | unit | `npm test` | ⬜ pending |
| 04-01-02 | 01 | 0 | CI-02 | unit | `uv run --extra dev pytest tests/ -x -q` | ⬜ pending |
| 04-01-03 | 01 | 0 | CI-03 | unit | `npm test` | ⬜ pending |
| 04-02-01 | 02 | 1 | CI-04 | integration | manual — push to GitHub | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Unit tests for project-type detection logic (node/python/both)
- [ ] Unit tests for CI variant selection (which yml gets copied as ci.yml)
- [ ] Fixture: mock filesystem with package.json / pyproject.toml / empty dir

*Existing test infrastructure (vitest, pytest) covers all phase requirements — no new test framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Generated ci.yml passes on first push to new GitHub repo | CI-01, CI-02, CI-03 | Requires live GitHub Actions run | Create test repo, run `goodvibes init`, push, observe CI |
| dependabot.yml updates GitHub Actions, npm, and pip | CI-06 | Requires GitHub to process dependabot.yml | Check Dependabot tab after push |
| CodeQL graceful on no-source language | CI-05 (partial) | Requires GitHub Actions run | Check CodeQL workflow run on Python-only repo |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
