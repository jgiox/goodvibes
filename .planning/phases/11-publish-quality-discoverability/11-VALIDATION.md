---
phase: 11
slug: 11-publish-quality-discoverability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-02
---

# Phase 11 — Validation Strategy

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (npm)** | vitest ^4 |
| **Framework (pip)** | pytest + pytest-mock |
| **Config file (npm)** | `packages/npm/vitest.config.ts` |
| **Config file (pip)** | `packages/pip/pyproject.toml [tool.pytest.ini_options]` |
| **Quick run (npm)** | `cd packages/npm && npm test` |
| **Quick run (pip)** | `cd packages/pip && uv run pytest tests/ -x -q` |
| **Full suite** | both above |
| **Estimated runtime** | ~30 seconds total |

---

## Sampling Rate

- **After every task commit:** Run quick run for the package(s) touched (npm or pip or both)
- **After every plan wave:** Run full suite (both npm and pip)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 11-01 | 1 | PKG-01 | — | N/A | unit | `cd packages/npm && npm test && cd packages/pip && uv run pytest tests/ -x -q` | ✅ existing | ⬜ pending |
| 11-01-02 | 11-01 | 1 | PKG-01 | — | N/A | unit | `cd packages/npm && npm test && cd packages/pip && uv run pytest tests/ -x -q` | ✅ existing | ⬜ pending |
| 11-02-01 | 11-02 | 2 | PUB-02 | T-path | stamp gate shell uses mktemp-style isolation | integration (CI-only) | `bash scripts/check-stamps.sh` (if extracted) or CI job | ❌ W0 | ⬜ pending |
| 11-02-02 | 11-02 | 2 | PUB-01 | T-path | smoke test uses `mktemp -d` safe tmpdir | integration (CI-only) | CI job in publish-npm.yml + publish-pip.yml | ❌ W0 | ⬜ pending |
| 11-03-01 | 11-03 | 2 | POL-01 | — | N/A | unit | `cd packages/npm && npm test && cd packages/pip && uv run pytest tests/test_doctor_cmd.py -x -q` | ✅ existing (new assertion) | ⬜ pending |
| 11-03-02 | 11-03 | 2 | POL-02 | — | N/A | unit | `cd packages/npm && npm test && cd packages/pip && uv run pytest tests/test_upgrade_cmd.py -x -q` | ✅ existing (updated assertions) | ⬜ pending |
| 11-04-01 | 11-04 | 3 | PKG-01 | — | N/A | manual | Human verify PyPI OIDC configuration on pypi.org | manual-only | ⬜ pending |
| 11-04-02 | 11-04 | 3 | PKG-01, PKG-02 | — | N/A | manual | `pip install jgiox-goodvibes` should show deprecation warning redirecting to goodvibes-cli | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.github/workflows/ci.yml` — add `check-stamps` job (PUB-02)
- [ ] `.github/workflows/publish-npm.yml` — add `smoke-test` job (PUB-01)
- [ ] `.github/workflows/publish-pip.yml` — add `smoke-test` job (PUB-01)
- [ ] `packages/pip/tests/test_doctor_cmd.py` — add `test_doctor_output_starts_with_version_line` (POL-01)
- [ ] `packages/npm/src/commands/doctor.test.ts` — add version line first-position assertion (POL-01)
- [ ] `packages/pip/tests/test_upgrade_cmd.py` — update symbol assertions from `~`/`=`/`+` to `updated`/`unchanged`/`new` (POL-02)
- [ ] `packages/npm/src/commands/upgrade.test.ts` — update symbol assertions to English words (POL-02)

*Existing test infrastructure covers all phase requirements — gaps are additions to existing files, not new frameworks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Registry page description, keywords, homepage visible on npmjs.com and pypi.org | PKG-02 | Cannot assert on external registry pages in CI | After publish: visit https://www.npmjs.com/package/goodvibes-cli and https://pypi.org/project/goodvibes-cli/ and verify description, keywords, homepage link are present |
| PyPI trusted publishing OIDC configured | PKG-01 | Requires authenticated action on pypi.org | Before first pip-v* tag push: log in to pypi.org, go to goodvibes-cli project settings, add GitHub OIDC publisher with repo=jgiox/goodvibes and workflow=publish-pip.yml |
| `jgiox-goodvibes` tombstone shows deprecation warning | PKG-01 | Requires published tombstone on PyPI | After 11-04 tombstone publish: `pip install jgiox-goodvibes` should print deprecation warning and install goodvibes-cli |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
