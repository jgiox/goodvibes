---
phase: 05-upgrade-command-template-repo
plan: "03"
subsystem: template-repo
tags: [template-repo, github-template, publish-workflow, ci-cd]

# Dependency graph
requires:
  - phase: 05-02
    provides: upgrade command (TypeScript + Python) fully implemented and GREEN
provides:
  - .github/workflows/publish-template.yml (manual sync workflow to goodvibes-template)
  - jgiox/goodvibes-template (external GitHub Template repo — populated by user)
affects:
  - Phase 5 success criterion 3: click-to-fork zero-install entry point

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "git subtree push --prefix=templates for clean subtree extraction to external repo"
    - "workflow_dispatch only (no auto-push on commit — manual control over template sync)"
    - "TEMPLATE_REPO_TOKEN secret (classic PAT, repo scope) — never hardcoded"

key-files:
  created:
    - .github/workflows/publish-template.yml
  modified:
    - JOURNAL.md

key-decisions:
  - "workflow_dispatch only — template pushes are deliberate versioning events, not automatic; avoids accidental sync on every commit"
  - "git subtree push --prefix=templates — pushes ONLY templates/ contents to goodvibes-template root; monorepo internals excluded by construction (T-05-07, T-05-08)"
  - "Initial push is a manual user step — requires the GitHub repo to exist first; documented in checkpoint"
  - "TEMPLATE_REPO_TOKEN scoped to jgiox/goodvibes-template write only (T-05-06)"

# Metrics
duration: 5min
completed: 2026-06-25
---

# Phase 5 Plan 03: Template repo CI workflow and checkpoint

**publish-template.yml added — manual workflow_dispatch trigger using git subtree push to sync templates/ to jgiox/goodvibes-template**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-25T08:43:00Z
- **Completed:** 2026-06-25T08:48:40Z
- **Tasks:** 1 of 2 (Task 2 is a human-verify checkpoint — pending user action)
- **Files modified:** 2

## Accomplishments

- `.github/workflows/publish-template.yml` — manually triggered GitHub Actions workflow
  - `workflow_dispatch` trigger (manual only, not on push)
  - Checks out monorepo with full history (`fetch-depth: 0`) for `git subtree`
  - Configures git identity as `github-actions[bot]`
  - Runs `git subtree push --prefix=templates <goodvibes-template-url> main`
  - Uses `${{ secrets.TEMPLATE_REPO_TOKEN }}` — no hardcoded tokens
  - No `shell: true` anywhere
- JOURNAL.md updated with task entry

## Task Commits

1. **Task 1: Create publish-template.yml workflow** — `b2d85c5` (chore)

## Files Created/Modified

- `.github/workflows/publish-template.yml` — 33-line workflow; single job; git subtree push
- `JOURNAL.md` — 1 entry added

## Decisions Made

- `workflow_dispatch` only trigger — template sync is a deliberate versioning action, not an automatic consequence of every commit to the monorepo. This prevents accidental partial syncs.
- `git subtree push --prefix=templates` — the cleanest approach for extracting a subdirectory as the root of another repo. No shell injection risk (URL is static). The subtree boundary guarantees `packages/`, `.planning/`, and other monorepo internals are structurally excluded (T-05-07, T-05-08).
- Initial push is a human step — the GitHub repo must exist before the first subtree push; documented in the checkpoint.
- Token scope: TEMPLATE_REPO_TOKEN must be a classic PAT with `repo` scope limited to `jgiox/goodvibes-template`. Documented in workflow comment (T-05-06).

## Deviations from Plan

None — plan executed exactly as written. The workflow matches the recommended implementation from the plan's `<action>` block. The initial push to `jgiox/goodvibes-template` is deferred to the human checkpoint as specified.

## User Setup Required

This plan has a human-verify checkpoint (Task 2). Before the checkpoint can be approved, the user must:

1. Create `jgiox/goodvibes-template` on GitHub (public, Apache-2.0, no README)
2. Mark it as a Template repository: Settings → General → scroll to bottom → "Template repository" checkbox
3. Perform the initial push of `templates/` contents to the repo root:
   ```bash
   git subtree push --prefix=templates https://github.com/jgiox/goodvibes-template.git main
   ```
   (Run from the goodvibes monorepo root on the `main` branch, not from a worktree)
4. Create a `TEMPLATE_REPO_TOKEN` PAT (classic, repo scope) and add it as a repo secret at
   Settings → Secrets and variables → Actions → New repository secret
5. Verify the checkpoint criteria listed in Task 2 of the plan

## Known Stubs

None — the workflow is fully functional. The only deferred item is the manual initial push and repo creation (human-verify checkpoint).

## Threat Flags

All threats from the plan's threat model are mitigated:

| Threat | File | Mitigation |
|--------|------|------------|
| T-05-06 | publish-template.yml | `${{ secrets.TEMPLATE_REPO_TOKEN }}` — never hardcoded; documented in comment |
| T-05-07 | publish-template.yml | `--prefix=templates` scope; URL is static; no user-supplied path components |
| T-05-08 | publish-template.yml | git subtree push pushes ONLY `templates/` contents; `packages/` and `.planning/` excluded by construction |

---

## Self-Check

### Created files exist

- FOUND: .github/workflows/publish-template.yml

### Commits exist

- FOUND: b2d85c5 chore(05-03): add publish-template.yml workflow for jgiox/goodvibes-template

## Self-Check: PASSED
