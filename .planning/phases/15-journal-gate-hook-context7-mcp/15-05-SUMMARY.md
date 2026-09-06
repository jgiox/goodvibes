---
phase: 15-journal-gate-hook-context7-mcp
plan: 05
subsystem: infra
tags: [git-hooks, shell, bash, vitest, pytest, security]

requires:
  - phase: 15-journal-gate-hook-context7-mcp (plan 04)
    provides: UNQUOTED quote-stripping fix and the 12 pre-existing journal-gate hook scenarios
provides:
  - "-C <path> aware journal-gate hook: TARGETDIR extraction, GIT() wrapper, absolute GITDIR resolution"
  - "3 new adversarial cross-repo regression tests (Test D bypass, Test E false-block, Test F target-merge-exemption) in both npm and pip integration suites"
  - "15/15 passing journal-gate-hook integration tests in both packages, zero regressions"
affects: [16-goodvibes-update-json-merge]

tech-stack:
  added: []
  patterns:
    - "GIT() shell wrapper function conditionally prepends `-C \"$TARGETDIR\"` when a target dir is detected"
    - "git rev-parse --absolute-git-dir used instead of --git-dir so plain [ -f ]/[ -d ] file-test exemption checks remain cwd-independent"

key-files:
  created: []
  modified:
    - templates/.claude/settings.json
    - .claude/settings.json
    - packages/npm/templates/.claude/settings.json (gitignored prebuild mirror)
    - packages/npm/src/steps/journal-gate-hook.integration.test.ts
    - packages/pip/tests/test_journal_gate_hook.py

key-decisions:
  - "Full -C support (extract + route) chosen over fail-closed-on-detection, because the mandated ALLOW scenario (cwd unstaged, -C target staged) cannot be satisfied by any fail-closed policy"
  - "Only -C is parsed; --git-dir=/--work-tree= are an accepted, documented limitation (T-15-09), matching the exact flag named in the original phase goal (15-01-PLAN.md Test 8)"
  - "git rev-parse --absolute-git-dir (not --git-dir) used for GITDIR resolution so the un-wrappable plain file-test exemption checks resolve correctly under -C"

patterns-established:
  - "Cross-repo adversarial hook tests nest a second real git repo inside the existing fixture dir/tmp_path, set up directly (no hook involvement), to test -C routing"

requirements-completed: [HOOK-01, HOOK-02]

duration: ~35min
completed: 2026-09-06
---

# Phase 15 Plan 05: Fix journal-gate hook's cross-repo `-C <path>` bypass Summary

**Journal-gate hook now resolves GITDIR/merge-rebase exemptions/staged-file checks against the actual `-C <path>` target repo (via `git rev-parse --absolute-git-dir` + a `GIT()` wrapper), closing a bypass and a false-block that both existed when the intercepted `git commit` used `-C` to target a different repo than the hook's own cwd.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 (RED, GREEN)
- **Files modified:** 5 (2 test files, 2 settings.json + 1 gitignored prebuild mirror)

## Accomplishments
- Closed the sole remaining BLOCKER gap from 15-VERIFICATION.md (independently reproduced as 15-REVIEW.md CR-01)
- Added 3 new adversarial cross-repo test scenarios (Test D: bypass, Test E: false-block, Test F: target-merge-exemption) to both npm and pip integration suites, RED before the fix, GREEN after
- All 15 scenarios (12 pre-existing + 3 new) pass in both `packages/npm/src/steps/journal-gate-hook.integration.test.ts` and `packages/pip/tests/test_journal_gate_hook.py`
- Full regression suites remain green: 161 passed/1 skipped/2 todo (npm), 169 passed (pip)
- `templates/.claude/settings.json`, `.claude/settings.json`, and the regenerated `packages/npm/templates/.claude/settings.json` mirror carry byte-identical `hooks.PreToolUse` blocks

## Task Commits

Each task was committed atomically:

1. **Task 1: Add cross-repo -C adversarial regression tests (RED)** - `99383c7` (test)
2. **Task 2: Route git-state checks through the -C target directory using an absolute GITDIR (GREEN)** - `969b698` (fix)

_Note: This plan was TDD by design (RED task then GREEN task), not a single-task-with-internal-cycle._

## Files Created/Modified
- `packages/npm/src/steps/journal-gate-hook.integration.test.ts` - added Test D/E/F (15 total scenarios)
- `packages/pip/tests/test_journal_gate_hook.py` - added Test D/E/F (15 total scenarios, mirrored)
- `templates/.claude/settings.json` - hook command adds `TARGETDIR` extraction, `GIT()` wrapper, `--absolute-git-dir`
- `.claude/settings.json` - identical hook command change (dogfood parity); `permissions.allow` untouched
- `packages/npm/templates/.claude/settings.json` - regenerated via `npm run prebuild` (gitignored, not committed)

## Decisions Made
- Followed the plan's pre-verified exact command string verbatim (via `node -e` JSON round-trip, no hand-escaping) rather than re-deriving it — the plan documented that this exact string had already been execution-verified against all 15 scenarios in hand-built repos
- Did not attempt additional freeform manual shell reproduction of the three adversarial directions beyond what the automated Test D/E/F already exercise — the sandbox blocks complex git-invoking one-off commands outside the worktree-safety envelope, and the automated tests are byte-for-byte the same reproduction the plan's manual-verification acceptance criterion describes

## Deviations from Plan

**Worktree base correction (pre-task, required by orchestrator protocol):** On start, this worktree's branch (`worktree-agent-a01ed0abacbfd6e84`) HEAD was at a divergent commit (`e729eba`, a dependabot-PR merge on an unrelated lineage) rather than the plan's expected base commit (`ea67f04`, which carries the 15-05 plan itself). Per the worktree branch-check protocol's own explicit instruction (not a self-recovery/protected-branch violation — HEAD was correctly on a `worktree-agent-*` ref, just wrong base), ran `git reset --hard ea67f0402a4e2a85dc54606e330e700ddf39a5db` to correct it before any task work began.

**Dependency installs (not a plan deviation, environment setup only):** `packages/npm` had no `node_modules/` (fresh worktree) — ran `npm install`. `packages/pip`'s `.venv` was missing `pytest-mock` — ran `uv sync`. Neither is a source change; `uv sync` incidentally bumped `packages/pip/uv.lock`'s `goodvibes-cli` version field from a stale value, left unstaged/uncommitted as out-of-scope noise.

None of these affected task scope, file list, or test outcomes — no auto-fixed issues under the plan's deviation rules.

## Issues Encountered
- Initial attempt to run tests failed with module-not-found errors (npm) and a missing `mocker` fixture (pip) — both resolved by installing/syncing dependencies as noted above, not a code issue.
- The environment's command sandbox rejected several complex multi-line `bash -c` compound commands (git status checks, a standalone manual-repro script) as "too complex to verify... stays inside the worktree" — worked around by splitting into simpler single-purpose commands and using absolute worktree paths.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- HOOK-01 and HOOK-02 requirements now fully satisfied, including the `-C` cross-repo case; Phase 15's journal-gate hook deliverable is complete pending any further gap-closure verification pass
- `--git-dir=`/`--work-tree=` remain a documented, accepted limitation (T-15-09) for any future gap-closure round to pick up if ever prioritized
- No blockers for Phase 16 (which depends on Phase 15's settings.json key shapes, unchanged by this plan beyond the hook command string itself)

---
*Phase: 15-journal-gate-hook-context7-mcp*
*Completed: 2026-09-06*
