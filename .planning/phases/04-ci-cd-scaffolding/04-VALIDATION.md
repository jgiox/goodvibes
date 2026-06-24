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
| 04-01-01 | 01 | 0 | CI-05 | unit (RED) | `cd packages/npm && npm test 2>&1 \| grep -E "(FAIL\|Cannot find module\|detect-project-type)" \| head -5` | ⬜ pending |
| 04-01-02 | 01 | 0 | CI-05 | unit (RED) | `cd packages/pip && uv run --extra dev pytest tests/test_detect_project_type.py -x -q 2>&1 \| head -10` | ⬜ pending |
| 04-01-03 | 01 | 0 | CI-01 CI-02 CI-03 CI-04 | smoke | `bash scripts/verify-phase4.sh --quick 2>&1 \| tail -5` | ⬜ pending |
| 04-02-01 | 02 | 0 | CI-01 CI-06 | file+content | `grep -l "--if-present" templates/.github/workflows/ci-node.yml && grep -l "--extra dev" templates/.github/workflows/ci-python.yml` | ⬜ pending |
| 04-02-02 | 02 | 0 | CI-02 CI-03 CI-04 | file+content | `grep -q "queries: security-extended" templates/.github/workflows/security.yml && grep -q "dependency-review-action@v5" templates/.github/workflows/dependency-review.yml && ! grep -q "push:" templates/.github/workflows/dependency-review.yml && grep -q "github-actions" templates/.github/dependabot.yml && echo "all_present"` | ⬜ pending |
| 04-03-01 | 03 | 1 | CI-01 CI-05 | unit (GREEN) | `cd packages/npm && npm test 2>&1 \| tail -5` | ⬜ pending |
| 04-03-02 | 03 | 1 | CI-01 CI-05 | unit (GREEN) | `cd packages/pip && uv run --extra dev pytest tests/ -x -q 2>&1 \| tail -10` | ⬜ pending |
| 04-04-01 | 04 | 2 | CI-06 | manual | Create /tmp/test-gv-node, run goodvibes init, push to GitHub, confirm CI green | ⬜ pending |
| 04-04-02 | 04 | 2 | CI-06 | manual | Create /tmp/test-gv-python, run goodvibes init, push to GitHub, confirm CI green | ⬜ pending |
| 04-04-03 | 04 | 2 | CI-06 | manual | Confirm security.yml CodeQL run and dependency-review.yml on PR in test repo | ⬜ pending |

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
