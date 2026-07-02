---
phase: "11"
plan: "02"
subsystem: ci
tags: [ci, stamps, smoke-test, publish, pub-01, pub-02]
dependency_graph:
  requires: [11-01]
  provides: [check-stamps-gate, publish-smoke-test-npm, publish-smoke-test-pip]
  affects: [ci.yml, publish-npm.yml, publish-pip.yml]
tech_stack:
  added: []
  patterns: [parallel-ci-job, post-publish-smoke-test, registry-propagation-wait]
key_files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - .github/workflows/publish-npm.yml
    - .github/workflows/publish-pip.yml
    - JOURNAL.md
decisions:
  - "check-stamps runs with no needs (parallel) — stamp drift can exist on any branch, not just after tests pass"
  - "npm smoke-test strips npm-v prefix from GITHUB_REF_NAME to get bare semver for npm install -g"
  - "PyPI smoke-test installs latest (no version pin) — just-published package is always the latest"
  - "Both smoke-tests use tee+grep pattern — dry-run output assertion, not file presence (dry-run does not write)"
metrics:
  duration: "~3 minutes"
  completed: "2026-07-02"
  tasks_completed: 2
  files_modified: 4
requirements:
  - PUB-01
  - PUB-02
---

# Phase 11 Plan 02: CI Stamp Gate and Publish Smoke-Tests Summary

Version-stamp divergence gate (PUB-02) in ci.yml plus post-publish smoke-test jobs (PUB-01) in both publish workflows — ensures "published" and "works" are synonymous.

## What Was Built

### Task 1: check-stamps job in ci.yml (commit 31986fd)

Added a `check-stamps` job to `.github/workflows/ci.yml` that:
- Runs on `ubuntu-latest` with no `needs` dependency (parallel with existing jobs)
- Uses `actions/checkout@v7`
- Extracts `NPM_VER`, `PIP_VER`, `TPL_VER` via grep+sed (POSIX, no Node required)
- Fails with actionable fix instructions naming both stale files when any stamp diverges
- Emits `All stamps in sync: vX.Y.Z` on success

Existing jobs `test-npm`, `test-pip`, `smoke-test` are unchanged.

### Task 2: smoke-test jobs in publish workflows (commit ee0261b)

**publish-npm.yml** — new `smoke-test` job after `publish`:
- `needs: publish` — only runs after a successful publish
- `sleep 30` — wait for npm registry propagation
- `actions/setup-node@v6` with node-version 20
- `npm install -g goodvibes-cli@$VERSION` where `VERSION=${GITHUB_REF_NAME#npm-v}` strips the `npm-v` prefix
- `goodvibes init --dry-run 2>&1 | tee /tmp/gv-out.txt` then `grep -q "CLAUDE.md" /tmp/gv-out.txt`
- No checkout step (installs from registry, not source)

**publish-pip.yml** — new `smoke-test` job after `publish`:
- `needs: publish` — only runs after a successful publish
- `astral-sh/setup-uv@v7` then `sleep 30`
- `uv tool install goodvibes-cli` (latest = just published)
- Same tee+grep assertion pattern
- No checkout step

## Verification Results

```
grep "check-stamps" ci.yml — PASS
grep "smoke-test" publish-npm.yml — PASS
grep "smoke-test" publish-pip.yml — PASS
grep "needs: publish" publish-npm.yml — PASS
grep "needs: publish" publish-pip.yml — PASS
grep "sleep 30" publish-npm.yml — PASS
grep "GITHUB_REF_NAME" publish-npm.yml — PASS
grep "CLAUDE.md" publish-npm.yml — PASS
grep "CLAUDE.md" publish-pip.yml — PASS
check-stamps has no needs in ci.yml — PASS (0 needs:publish lines in ci.yml)
YAML lint: ci.yml, publish-npm.yml, publish-pip.yml all valid — PASS
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes. Smoke tests install the project's own package from public registries; supply chain risk is the same as the publish itself (T-11-02-03 accepted in threat register).

## Self-Check: PASSED

- 31986fd exists: confirmed (`git log --oneline | grep 31986fd`)
- ee0261b exists: confirmed (`git log --oneline | grep ee0261b`)
- .github/workflows/ci.yml contains check-stamps: confirmed
- .github/workflows/publish-npm.yml contains smoke-test: confirmed
- .github/workflows/publish-pip.yml contains smoke-test: confirmed
- All three YAML files lint clean: confirmed
