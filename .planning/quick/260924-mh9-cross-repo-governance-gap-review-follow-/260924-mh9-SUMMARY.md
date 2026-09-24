---
phase: quick/260924-mh9-cross-repo-governance-gap-review-follow-
plan: 260924-mh9
subsystem: templates, ci, cli
tags: [goodvibes-update, manifest, claude-settings, github-actions, gitleaks, ruff, governance-templates]

# Dependency graph
requires:
  - phase: .planning/research/2026-09-24-cross-repo-gap-review.md
    provides: cross-repo governance gap findings (D1, D2, D3, Rules 1-15)
provides:
  - "goodvibes update no longer drops user-modified (skipped) files from the manifest on write-back (npm + pip)"
  - "goodvibes update always refreshes the CLAUDE.md sentinel block even with custom prose outside it"
  - "templates/.claude/settings.json requires explicit ask for git push / npm,uv,twine publish / wrangler,vercel,netlify,firebase deploy"
  - "CI templates fail loud: no swallowed uv sync errors, ruff lint step, visible ::warning:: for missing tests/lint, gitleaks secret scan job"
  - "Definition-of-done, .env.example, no-fabricated-data, and doc-lookup-data-handling rules across every shipped agent-instruction template"
affects: [next-version-bump-and-publish, phase-17-directive-rewrite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "writeManifest/write_manifest now accept a preserved-hashes map merged ahead of newly-hashed files, so skipped files can never be reclassified as net-new"
    - "CLAUDE.md is unconditionally routed through mergeClaude (block-only replacement) instead of gated on a whole-file hash comparison"
    - "CI 'fail loud': real command failures are never hidden behind 2>/dev/null; absence of optional tooling (tests, lint) emits a GitHub Actions ::warning:: annotation instead of silently passing"

key-files:
  created:
    - packages/npm/src/commands/update.integration.test.ts
    - packages/npm/src/steps/settings-permissions.test.ts
  modified:
    - packages/npm/src/steps/write-manifest.ts
    - packages/npm/src/commands/update.ts
    - packages/npm/src/commands/update.test.ts
    - packages/npm/src/steps/write-manifest.test.ts
    - packages/pip/src/goodvibes_cli/steps/write_manifest.py
    - packages/pip/src/goodvibes_cli/commands/update_cmd.py
    - packages/pip/tests/test_write_manifest.py
    - packages/pip/tests/test_update_cmd.py
    - templates/.claude/settings.json
    - templates/.github/workflows/ci-python.yml
    - templates/.github/workflows/ci-node.yml
    - templates/.github/workflows/ci-both.yml
    - templates/.github/workflows/security.yml
    - templates/CLAUDE.md
    - templates/AGENTS.md
    - templates/.windsurfrules
    - templates/GEMINI.md
    - templates/.clinerules/goodvibes.md
    - templates/.amazonq/rules/goodvibes.md
    - templates/.continue/rules/goodvibes.md
    - templates/.devin/rules/goodvibes.md
    - templates/.github/copilot-instructions.md
    - templates/.cursor/rules/goodvibes.mdc
    - templates/.kiro/steering/goodvibes.md
    - templates/replit.md
    - templates/.bolt/prompt
    - CHANGELOG.md
    - JOURNAL.md

key-decisions:
  - "Preserved manifest hashes are taken only from the prior manifest, never re-read from the destination file, so a skipped (user-modified) file can never be silently reclassified as unmodified/net-new on a later update run"
  - "CLAUDE.md is now always passed through mergeClaude regardless of whole-file hash, since that merge only ever touches the sentinel block and is inherently safe even when custom prose sits outside the block"
  - "permissions.ask was added as a new array sibling to permissions.deny in templates/.claude/settings.json, leaving the existing broad Bash(npx*)/Bash(uv*) allow rules and the hooks.PreToolUse block untouched"
  - "CI templates now use ::warning:: GitHub Actions annotations for optional-tooling absence (no tests, no lint script) instead of a silent echo, while real command failures (uv sync, ruff check) are never swallowed by a 2>/dev/null or || fallback"
  - "gitleaks runs via the pinned Docker image ghcr.io/gitleaks/gitleaks:v8.30.1 rather than a package-manager install, since it is supply-chain content (a container image tag), not a package name subject to the Package Legitimacy Gate"
  - "Governance rules (definition of done, .env.example, no-fabricated-data, doc-lookup data handling) were worded to match each template's existing style (bulleted vs terse-paragraph vs flowing-prose) rather than copy-pasted verbatim, to keep each file internally consistent"
  - "No correction needed to .planning/research/2026-09-24-cross-repo-gap-review.md's 'Changes shipped with this review' table — the actual implementation matches every row exactly"

patterns-established:
  - "Manifest write-back always receives a `preserved` map built from the current manifest's skip-list before any new hashing happens, so skip decisions survive across update runs"
  - "New IDE/agent rule content is added once to templates/AGENTS.md, then propagated to the byte-identical rule-file group via a direct `cp`, then re-verified with `diff` against every member of the group"

requirements-completed: []

# Metrics
duration: ~3h (across two sessions)
completed: 2026-09-24
---

# Quick Task 260924-mh9: Cross-Repo Governance Gap Review Follow-Up Summary

**Fixed a real `goodvibes update` data-loss bug (skipped/user-modified files silently reclassified as net-new on a second run) in both CLIs, closed the git-push/publish/deploy auto-approval gap in the Claude Code settings template, made CI templates fail loud instead of silently swallowing errors, added a gitleaks secret-scan job, and backfilled definition-of-done/`.env.example`/no-fabricated-data governance rules across all 13 shipped agent-instruction template files.**

## Performance

- **Duration:** ~3h across two sessions
- **Tasks:** 3/3 completed
- **Files modified:** 29 (across npm, pip, CI templates, agent-instruction templates, CHANGELOG.md, JOURNAL.md)

## Accomplishments

- D1: `goodvibes update` no longer drops user-modified files from the manifest, and always refreshes the CLAUDE.md sentinel block, in both the npm and pip CLIs — RED tests committed before the fix, both full test suites green after
- D2: `templates/.claude/settings.json` now requires explicit `ask` approval for `git push`, npm/uv/twine publish, and wrangler/vercel/netlify/firebase deploy commands
- D3: CI templates stop hiding `uv sync` failures, add a `ruff check` lint step, emit visible `::warning::` annotations for missing tests/lint instead of silently passing, and add a `gitleaks` secret-scan job to `security.yml`
- Governance rules (definition of done, `.env.example` discipline, no-fabricated-data, doc-lookup data handling) added to every one of the 13 shipped agent-instruction templates, each worded to match that file's existing style

## Task Commits

Each task was committed atomically, with RED/GREEN pairs for the two TDD tasks:

1. **Task 1: Fix update data-loss bug (D1)** — RED `727eeb7`, GREEN `6067a20`
2. **Task 2: Ask-before-publish/deploy + CI fails loud (D2, D3)** — RED `ec4dcfe`, GREEN `e176b81`
3. **Task 3: Governance rules across all templates + CHANGELOG** — `c750ba8` (docs, no TDD)

**Plan metadata:** not committed by this executor — orchestrator handles the docs commit (STATE.md, PLAN.md, this SUMMARY.md).

## Files Created/Modified

- `packages/npm/src/steps/write-manifest.ts` — `writeManifest` now takes an optional `preserved` map merged ahead of newly-hashed files
- `packages/npm/src/commands/update.ts` — routes CLAUDE.md through `overwrite` (mergeClaude) unconditionally; builds `preserved` from the skip list before calling `writeManifest`
- `packages/npm/src/commands/update.integration.test.ts` (new) — end-to-end regression coverage for the manifest data-loss bug
- `packages/npm/src/steps/write-manifest.test.ts`, `packages/npm/src/commands/update.test.ts` — updated/added unit coverage, including the new `writeManifest` 4th-arg call signature
- `packages/pip/src/goodvibes_cli/steps/write_manifest.py`, `packages/pip/src/goodvibes_cli/commands/update_cmd.py` — mirrored fix in Python
- `packages/pip/tests/test_write_manifest.py`, `packages/pip/tests/test_update_cmd.py` — mirrored regression coverage
- `packages/npm/src/steps/settings-permissions.test.ts` (new) — asserts `permissions.ask` contains all 11 required patterns and that `allow`/`deny`/`hooks.PreToolUse` are untouched
- `templates/.claude/settings.json` — added `permissions.ask` array
- `templates/.github/workflows/ci-python.yml`, `ci-node.yml`, `ci-both.yml` — lint step, visible warnings, no swallowed `uv sync` errors
- `templates/.github/workflows/security.yml` — new `secrets` job running pinned gitleaks image
- `templates/CLAUDE.md`, `templates/AGENTS.md`, and the byte-identical rule-file group (`.windsurfrules`, `GEMINI.md`, `.clinerules/goodvibes.md`, `.amazonq/rules/goodvibes.md`, `.continue/rules/goodvibes.md`, `.devin/rules/goodvibes.md`), plus `.github/copilot-instructions.md`, `.cursor/rules/goodvibes.mdc`, `.kiro/steering/goodvibes.md`, `replit.md`, `.bolt/prompt` — governance rule additions
- `CHANGELOG.md` — `[Unreleased]` Fixed/Added/Changed entries for D1/D2/D3 and the template rules
- `JOURNAL.md` — one additive entry per commit (5 entries total across the plan)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated two pre-existing npm tests broken by the new `writeManifest` 4-arg signature**
- **Found during:** Task 1 GREEN implementation
- **Issue:** `update.test.ts`'s `'calls writeManifest after applying changes'` and `'skips template file missing from templateDir during apply'` asserted the old 3-arg `writeManifest` call signature; both broke once `writeManifest` always received a 4th `preserved` argument
- **Fix:** Appended `expect.any(Object)` as the 4th expected argument to both assertions
- **Files modified:** `packages/npm/src/commands/update.test.ts`
- **Commit:** `6067a20`

No other deviations — the rest of the plan executed as written.

## Known Stubs

None.

## Threat Flags

None — D1's fix removes a data-loss vector rather than adding surface; D2/D3 narrow existing auto-approval and add a secret scanner; the template rule additions are documentation-only.

## Verification (plan-level)

- `cd packages/npm && npx vitest run` — 173 passed, 1 skipped, 2 todo (176 total)
- `cd packages/pip && uv run pytest tests/` — 179 passed
- `bash scripts/verify-phase4.sh --quick` — 15 passed, 0 failed, `Phase 4 gate: PASS`
- `diff templates/AGENTS.md templates/<each byte-identical-group file>` — clean for all six (`.windsurfrules`, `GEMINI.md`, `.clinerules/goodvibes.md`, `.amazonq/rules/goodvibes.md`, `.continue/rules/goodvibes.md`, `.devin/rules/goodvibes.md`)
- `git log --oneline -8` — shows the 5 plan commits (RED/GREEN pairs for Task 1 and Task 2, one commit for Task 3), each carrying a JOURNAL.md entry

## Self-Check: PASSED

- Verified all 15 files staged in the Task 3 commit exist and match the intended list (`git status --short` before commit)
- Verified all 5 commit hashes (`727eeb7`, `6067a20`, `ec4dcfe`, `e176b81`, `c750ba8`) are present in `git log --oneline -8`
- Verified `packages/pip/uv.lock` remained unstaged (out of scope) and the repo-root `.bolt/`, repo-root `replit.md`, and `packages/npm/templates/` (gitignored) were never staged
