---
phase: 5
slug: upgrade-command-template-repo
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-25
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (TS)** | vitest |
| **Framework (Python)** | pytest + pytest-mock |
| **Config file (TS)** | packages/npm/vitest.config.ts |
| **Config file (Python)** | packages/pip/pyproject.toml |
| **Quick run (TS)** | `cd packages/npm && npm test` |
| **Quick run (Python)** | `cd packages/pip && uv run --extra dev pytest -x -q` |
| **Full suite command** | Both of the above sequentially |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run for the affected package
- **After every plan wave:** Run full suite (both npm and pip)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 05-01-01 | 01 | 0 | UPG-01 | T-05-01 | — | unit | `npm test` | ⬜ pending |
| 05-02-01 | 02 | 0 | UPG-02 | T-05-02 | — | unit | `pytest -x -q` | ⬜ pending |
| 05-03-01 | 03 | 1 | UPG-01/02 | T-05-03 | — | unit | `npm test && pytest -x -q` | ⬜ pending |
| 05-03-02 | 03 | 2 | UPG-03/SC-3 | T-05-08 | template repo contains no monorepo cruft; CLAUDE.md at root | manual | human checkpoint (Task 2, Plan 03) | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `packages/npm/src/commands/upgrade.test.ts` — RED unit tests for upgrade command (TS)
- [ ] `packages/pip/tests/test_upgrade_cmd.py` — RED unit tests for upgrade command (Python)

*Wave 0 creates RED failing tests before any implementation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GitHub template repo click-to-fork | UPG-03 | Requires real GitHub UI interaction | Create repo from template; open in Claude Code; verify CLAUDE.md rules active |
| diff-style summary output | UPG-02 | Output format is UX verification | Run upgrade in a project with stale files; verify ~ / = / + markers appear before apply |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
