---
phase: 10
slug: vibe-coder-completeness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (npm)** | vitest (via `npm test`) |
| **Framework (pip)** | pytest + pytest-mock |
| **Config file (npm)** | `packages/npm/package.json` scripts |
| **Config file (pip)** | `packages/pip/pyproject.toml` |
| **Quick run (npm)** | `cd packages/npm && npm test` |
| **Quick run (pip)** | `cd packages/pip && uv run pytest tests/ -x -q` |
| **Full suite (npm)** | `cd packages/npm && npm test` |
| **Full suite (pip)** | `cd packages/pip && uv run pytest tests/` |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/npm && npm test && cd packages/pip && uv run pytest tests/ -x -q`
- **After every plan wave:** Run both full suites
- **Before `/gsd-verify-work`:** Both suites must be green
- **Max feedback latency:** ~30 seconds

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Command | File | Status |
|--------|----------|-----------|---------|------|--------|
| VCC-01 | `goodvibes update` invokes upgrade logic (npm) | unit | `cd packages/npm && npm test` | `src/commands/upgrade.test.ts` (add) | ⬜ pending |
| VCC-01 | `goodvibes update` invokes upgrade logic (pip) | unit | `cd packages/pip && uv run pytest tests/test_upgrade_cmd.py` | `tests/test_upgrade_cmd.py` (add) | ⬜ pending |
| VCC-02 | Doctor exits 0 when all checks pass | unit | `cd packages/npm && npm test` | `src/commands/doctor.test.ts` (new) | ⬜ pending |
| VCC-02 | Doctor exits 1 when headroom not installed | unit | `cd packages/npm && npm test` | `src/commands/doctor.test.ts` (new) | ⬜ pending |
| VCC-02 | Doctor exits 1 when git user.name not set | unit | `cd packages/npm && npm test` | `src/commands/doctor.test.ts` (new) | ⬜ pending |
| VCC-02 | Doctor exits 1 when CLAUDE.md absent | unit | `cd packages/npm && npm test` | `src/commands/doctor.test.ts` (new) | ⬜ pending |
| VCC-02 | Doctor exits 1 when sentinel missing | unit | `cd packages/npm && npm test` | `src/commands/doctor.test.ts` (new) | ⬜ pending |
| VCC-02 | Doctor prints remediation for each failing check | unit | `cd packages/npm && npm test` | `src/commands/doctor.test.ts` (new) | ⬜ pending |
| VCC-02 | Python doctor exits 0 and 1 correctly | unit | `cd packages/pip && uv run pytest tests/test_doctor_cmd.py` | `tests/test_doctor_cmd.py` (new) | ⬜ pending |
| VCC-03 | `--version` output matches package.json version dynamically | unit | `cd packages/npm && npm test` | `src/index.test.ts` (add/update) | ⬜ pending |
| VCC-03 | Python `--version` includes installed version | unit | `cd packages/pip && uv run pytest tests/test_main.py` | `tests/test_main.py` (add) | ⬜ pending |
| VCC-04 | `templates/docs/getting-started.md` is copied by `copyTemplates` | integration | `cd packages/npm && npm test` | `src/steps/copy-templates.integration.test.ts` (add) | ⬜ pending |
| VCC-05 | Headroom install logs "already installed" when on PATH | unit | `cd packages/npm && npm test` | `src/steps/install-headroom.test.ts` (add) | ⬜ pending |
| VCC-05 | Headroom install logs description before subprocess | unit | `cd packages/npm && npm test` | `src/steps/install-headroom.test.ts` (add) | ⬜ pending |
| VCC-05 | Python headroom install logs "already installed" | unit | `cd packages/pip && uv run pytest tests/test_install_headroom.py` | `tests/test_install_headroom.py` (add) | ⬜ pending |
| VCC-06 | Platform-setup files copied (static — covered by copy-templates tests) | integration | manual check | n/a (static template files) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/commands/doctor.test.ts` — new test file for VCC-02 (npm)
- [ ] `tests/test_doctor_cmd.py` — new test file for VCC-02 (pip)

*All other test infrastructure exists (vitest, pytest, fixtures). Gaps are only the new doctor test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VCC-06 platform-setup guides content quality | VCC-06 | Static markdown content — automated tests only verify file existence | Read `templates/docs/platform-setup/*.md` for completeness and accuracy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Both test suites green before verify-work
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
