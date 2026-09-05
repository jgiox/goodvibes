---
phase: 15-journal-gate-hook-context7-mcp
plan: 02
subsystem: infra
tags: [mcp, context7, claude-code, template]

requires: []
provides:
  - "templates/.mcp.json canonical context7 HTTP config, no key, no signup"
  - "repo-root .mcp.json dogfood copy (D-02)"
  - "static shape tests in both packages guarding the no-headers-by-default invariant"
affects: [16-goodvibes-update-json-merge]

tech-stack:
  added: []
  patterns:
    - "Static .mcp.json template (not runtime `claude mcp add` registration) for keyless remote MCP servers"

key-files:
  created:
    - templates/.mcp.json
    - .mcp.json
    - packages/npm/src/steps/mcp-json.test.ts
    - packages/pip/tests/test_mcp_json.py
  modified: []

key-decisions:
  - "Shipped .mcp.json with no headers key by default — an unset ${CONTEXT7_API_KEY} would ship as literal unexpanded text and silently break every anonymous request (RESEARCH.md Pitfall 5)"
  - "pip test resolves templates/ via parents[3] path arithmetic rather than resolve_templates_dir() — that function targets an installed wheel and raises FileNotFoundError in dev/test mode"

requirements-completed: [CTX7-01]

duration: 3min
completed: 2026-09-05
---

# Phase 15 Plan 02: context7 MCP Template Summary

**Static `.mcp.json` template shipping context7 at its free/public HTTP endpoint (`https://mcp.context7.com/mcp`), no key, no signup, dogfooded into the repo root**

## Performance

- **Duration:** 3 min
- **Started:** 2026-09-05T18:55:34Z
- **Completed:** 2026-09-05T18:58:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `templates/.mcp.json` ships `mcpServers.context7` with `type: "http"` and `url: "https://mcp.context7.com/mcp"`, no `headers` key
- Repo root `.mcp.json` is a byte-identical dogfood copy (D-02)
- `packages/npm/templates/.mcp.json` (gitignored prebuild mirror) regenerated via `npm run prebuild`
- Static shape tests added in both packages, following TDD RED→GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing shape tests for .mcp.json (RED)** - `1a751f6` (test)
2. **Task 2: Create .mcp.json and dogfood it into repo root (GREEN)** - `b167105` (feat)

_TDD: RED commit before GREEN commit — no refactor step needed (implementation was already minimal)._

## Files Created/Modified
- `templates/.mcp.json` - Canonical source: context7 HTTP entry, no headers block
- `.mcp.json` - Repo root dogfood copy, byte-identical to templates/.mcp.json
- `packages/npm/src/steps/mcp-json.test.ts` - Vitest static shape assertion via `resolveTemplatesDir()`
- `packages/pip/tests/test_mcp_json.py` - Pytest static shape assertion via direct `parents[3]` path resolution (not `resolve_templates_dir()`, which targets an installed wheel)

## Decisions Made
- No `headers` key shipped by default (CTX7-02 safety property) — documented as the reason in RESEARCH.md Pitfall 5; the optional `${CONTEXT7_API_KEY}` upgrade path is out of scope for this plan (docs land separately)
- pip test bypasses `resolve_templates_dir()` per the plan's explicit instruction, since that function raises `FileNotFoundError` outside an installed wheel

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm devDependencies not installed in worktree**
- **Found during:** Task 1 (RED verification)
- **Issue:** `npx vitest run` failed with `ERR_MODULE_NOT_FOUND: Cannot find package 'vitest'` — the worktree's `packages/npm/node_modules` was not populated (fresh worktree checkout, no `npm install` run yet)
- **Fix:** Ran `npm install` (no new packages — installs already-declared `package-lock.json` dependencies) to populate `node_modules`
- **Files modified:** None (node_modules is gitignored, not committed)
- **Verification:** `npx vitest run src/steps/mcp-json.test.ts` then correctly failed for the intended RED reason (`ENOENT: templates/.mcp.json`)

**2. [Rule 3 - Blocking] pip dev extras not installed in worktree venv**
- **Found during:** Task 1 (RED verification)
- **Issue:** `uv run pytest tests/test_mcp_json.py` failed with `fixture 'mocker' not found` — `pytest-mock` (declared under `[project.optional-dependencies] dev`) was not installed in the auto-created venv
- **Fix:** Ran `uv sync --extra dev` to install the `dev` extra (pytest, pytest-mock, pytest-asyncio, pytest-cov) — no new dependency added, just synced existing declared extras
- **Files modified:** None (uv-managed `.venv` is gitignored)
- **Verification:** `uv run pytest tests/test_mcp_json.py` then correctly failed for the intended RED reason (`FileNotFoundError`)

**3. [Out of scope, deferred] `packages/pip/uv.lock` version metadata drift**
- **Found during:** Tasks 1 and 2 (both `uv sync`/`uv run` invocations)
- **Issue:** Each `uv` invocation rewrote `packages/pip/uv.lock`'s `goodvibes-cli` version field from `1.7.0` to `1.7.1`, reflecting a pre-existing mismatch between the lockfile and the installed package's actual version — unrelated to this plan's scope
- **Fix:** Reverted `git checkout -- packages/pip/uv.lock` before each commit; not fixed (out of scope per Scope Boundary rule)
- **Files modified:** None (reverted, not committed)
- **Note:** Logged here rather than a separate `deferred-items.md` since it is a single recurring artifact, not a design gap

---

**Total deviations:** 2 auto-fixed (Rule 3 — environment setup, not code changes), 1 deferred (out-of-scope pre-existing lockfile drift)
**Impact on plan:** No scope creep — both auto-fixes were environment bootstrap (installing already-declared dependencies) required to run the plan's own verification commands, not new functionality.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required

None - no external service configuration required. context7's HTTP endpoint requires no signup or API key at the free tier.

## Next Phase Readiness

CTX7-01 is complete. The exact key shapes (`mcpServers.context7.type`/`.url`) are now locked in for Phase 16's `goodvibes update` JSON-merge work. CTX7-02 (docs: optional `${CONTEXT7_API_KEY}` upgrade path) and CTX7-03 (docs: one-time MCP trust prompt) remain for a separate docs-focused plan in this phase per the phase's plan split.

---
*Phase: 15-journal-gate-hook-context7-mcp*
*Completed: 2026-09-05*
