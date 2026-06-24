---
phase: 04-ci-cd-scaffolding
plan: "02"
subsystem: infra
tags: [github-actions, ci, codeql, dependabot, yaml, templates]

requires:
  - phase: 04-01
    provides: verify-phase4.sh harness and scripts/ structure

provides:
  - Six static GitHub Actions YAML templates under templates/.github/
  - ci-node.yml: Node CI with npm install + --if-present flags for zero-config first push
  - ci-python.yml: Python CI with setup-uv@v8 + python-version matrix + --extra dev pytest
  - ci-both.yml: combined test-node + test-python jobs (no dependency between them)
  - security.yml: CodeQL security-extended scan with weekly cron
  - dependency-review.yml: PR-only dep audit gate using dependency-review-action@v5
  - templates/.github/dependabot.yml: weekly updates for github-actions, npm, pip at directory "/"

affects: [04-03, 04-04]

tech-stack:
  added: []
  patterns:
    - "Static multi-file CI template selection: three ci-*.yml variants, copy-templates renames selected one to ci.yml at destination"
    - "Zero-config CI: npm install (not ci), --if-present flags, conditional pytest existence check"
    - "Least-privilege permissions: security-events:write only in security.yml, contents:read everywhere else"

key-files:
  created:
    - templates/.github/workflows/ci-node.yml
    - templates/.github/workflows/ci-python.yml
    - templates/.github/workflows/ci-both.yml
    - templates/.github/workflows/security.yml
    - templates/.github/workflows/dependency-review.yml
    - templates/.github/dependabot.yml
  modified:
    - JOURNAL.md

key-decisions:
  - "npm install over npm ci: new beginner projects lack package-lock.json; npm ci fails without it"
  - "--if-present on build/test/lint: prevents CI failure when scripts not yet defined in package.json"
  - "Combined security.yml language matrix (both js-ts and python always): CodeQL handles no-source gracefully, keeps template count down"
  - "dependency-review.yml pull_request trigger only: action fails with error if triggered on push"
  - "dependabot.yml directory / for all ecosystems: beginner target projects are single-package at root"
  - "setup-uv@v8 with explicit python-version: matrix.python wiring prevents all matrix versions running same Python"

patterns-established:
  - "Pattern: CI templates are static YAML, no string interpolation — consistent with existing copy-templates architecture"
  - "Pattern: uv run --extra dev pytest — always use --extra dev or pytest fails when declared as optional dep"

requirements-completed: [CI-01, CI-02, CI-03, CI-04, CI-06]

duration: 6min
completed: "2026-06-24"
---

# Phase 04 Plan 02: GitHub Actions Template Authoring Summary

**Six static GitHub Actions YAML templates covering Node CI, Python CI, combined CI, CodeQL security scan, dependency review PR gate, and Dependabot config — all using verified action versions and zero-config defaults for beginner projects**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-24T17:10:00Z
- **Completed:** 2026-06-24T17:16:57Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Three CI workflow variants (ci-node.yml, ci-python.yml, ci-both.yml) with verified pitfall mitigations from RESEARCH.md: `npm install` not `npm ci`, `--if-present` on all npm scripts, `--extra dev` in pytest, `python-version` matrix wiring in setup-uv@v8
- security.yml based directly on repo's working codeql.yml (same action versions, same permissions block) with `name: Security scan` and `queries: security-extended`
- dependency-review.yml with pull_request-only trigger (Pitfall 5 avoided), `actions/dependency-review-action@v5`, `permissions: contents: read`
- templates/.github/dependabot.yml with github-actions/npm/pip all at `directory: "/"` (correct for single-package beginner projects, not this monorepo's `/packages/npm` path)

## Task Commits

1. **Task 1: Author ci-node.yml, ci-python.yml, and ci-both.yml** - `6597978` (feat)
2. **Task 2: Author security.yml, dependency-review.yml, and dependabot.yml** - `9d55a7c` (feat)

## Files Created/Modified

- `templates/.github/workflows/ci-node.yml` - Node CI: matrix node 20/22, npm install, --if-present build/test/lint, setup-node@v6
- `templates/.github/workflows/ci-python.yml` - Python CI: matrix python 3.10/3.11/3.12, setup-uv@v8 with python-version wired, conditional install+test, --extra dev pytest
- `templates/.github/workflows/ci-both.yml` - Combined: test-node + test-python jobs, no interdependency
- `templates/.github/workflows/security.yml` - CodeQL security-extended scan, weekly Monday cron, security-events:write permissions
- `templates/.github/workflows/dependency-review.yml` - PR-only dep audit, dependency-review-action@v5, contents:read only
- `templates/.github/dependabot.yml` - Three ecosystems (github-actions/npm/pip), weekly schedule, directory: "/" for all
- `JOURNAL.md` - Phase 4 Plan 02 entry appended

## Decisions Made

- `npm install` used instead of `npm ci` because new beginner projects may not have committed `package-lock.json` on first push — `npm ci` would fail immediately
- `--if-present` on all npm scripts prevents CI failure when `test`/`lint`/`build` scripts are not yet defined
- Combined language matrix in security.yml (always both `javascript-typescript` and `python`) keeps template count at 1 for security — CodeQL handles "no source to scan" gracefully
- `dependency-review-action@v5` (latest) and `pull_request` trigger only — documented Pitfall 5 avoidance
- `directory: "/"` for all dependabot ecosystems — monorepo's `/packages/npm` would be wrong for the generated single-package target project

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. All files are static YAML; no configuration needed from the user to use these templates.

## Known Stubs

None. All six template files are complete and functional.

## Threat Flags

No new security surface introduced. All threat model mitigations (T-04-02-01, T-04-02-02) are implemented:
- T-04-02-01: Least-privilege permissions set explicitly per workflow
- T-04-02-02: No workflow uses `pull_request_target`; `checkout@v7` blocks unsafe fork PR checkouts

## Self-Check

Files exist:
- [x] templates/.github/workflows/ci-node.yml
- [x] templates/.github/workflows/ci-python.yml
- [x] templates/.github/workflows/ci-both.yml
- [x] templates/.github/workflows/security.yml
- [x] templates/.github/workflows/dependency-review.yml
- [x] templates/.github/dependabot.yml

Commits exist:
- [x] 6597978 (Task 1)
- [x] 9d55a7c (Task 2)

## Self-Check: PASSED

## Next Phase Readiness

- All 6 template files are ready for use by the copy-templates logic in Plan 03
- Plan 03 (project-type detection + copy-templates wiring) can proceed — it has all static templates it needs to reference
- Plan 04 (verify-phase4.sh smoke harness) can verify all 6 files independently

---
*Phase: 04-ci-cd-scaffolding*
*Completed: 2026-06-24*
