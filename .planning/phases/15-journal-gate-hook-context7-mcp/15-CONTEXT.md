# Phase 15: Journal-Gate Hook & context7 MCP — Context

**Gathered:** 2026-09-05

<domain>
## Phase Boundary

Two independent, no-shared-files deliverables:

1. **Journal-gate hook** — a `PreToolUse` hook (inline shell command, no separate script file) in `.claude/settings.json` that blocks Claude Code's Bash tool from running `git commit` unless `JOURNAL.md` is staged. Exempts `--amend`, in-progress merge/rebase, and any commit where `JOURNAL.md` is already staged (which trivially covers the "bootstrap commit that adds JOURNAL.md" case).
2. **context7 MCP** — a `.mcp.json` template shipping `context7` wired to the free/public HTTP endpoint (no key, no signup), plus docs for the optional `${CONTEXT7_API_KEY}` upgrade path and the one-time "trust this project's MCP servers" prompt.

Both ship into `templates/`, `packages/npm/templates/`, and `packages/pip/` template equivalents (existing generic copy/manifest pipeline from Phases 1-14 — no new pipeline needed). `goodvibes update` propagation is explicitly out of scope (Phase 16, depends on this phase's exact key shapes).

</domain>

<decisions>
## Implementation Decisions

### Dogfooding
- **D-01:** Apply the journal-gate hook to goodvibes' own repo root `.claude/settings.json` in this phase, not just the shipped templates. Root settings.json today only has a `permissions` block — extend it with the `PreToolUse` hook.
- **D-02:** Also create a root `.mcp.json` with context7 configured, for the same reason — dogfood both deliverables together, don't split them across when they land in this repo.

### Block message wording
- **D-03:** stderr message is a copy-pasteable fix, not a terse one-liner — e.g. `BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md`. Matches CLAUDE.md's own "error messages must be actionable and specific enough to debug" rule.
- **D-04:** Fix only, no "why" clause — don't add a policy explanation referencing CLAUDE.md in the message itself. Keep hook stderr to the actionable fix.

### Doc placement (HOOK-04, CTX7-02, CTX7-03)
- **D-05:** HOOK-04's caveat (hook only gates Claude Code's own Bash tool — not manual commits, not other agents/IDEs) goes in `docs/getting-started.md`, not README.md. New short section, same file/pattern as the existing "What is headroom?" section.
- **D-06:** CTX7-02 (optional `${CONTEXT7_API_KEY}` upgrade path, no literal key ever committed) and CTX7-03 (one-time "trust this project's MCP servers" prompt) get their own new section in `docs/getting-started.md` — "What is context7?" — mirroring the existing "What is headroom?" section, not spread elsewhere.

### Claude's Discretion
- Exact hook matcher pattern for intercepting `git commit` invocations (covering variants like `git commit -am`, `git -C path commit`) — technical implementation detail, not a vision question.
- Exact JSON shape of the `PreToolUse` hook block within `settings.json` and the `mcpServers` block within `.mcp.json` — researcher/planner determine the correct schema.
- context7's exact free-tier HTTP endpoint URL — researcher confirms current value from context7's own docs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements (locked, testable)
- `.planning/REQUIREMENTS.md` §"Journal-Gate Enforcement" (HOOK-01..04) and §"context7 MCP" (CTX7-01..03) — exact, numbered acceptance criteria for this phase. Do not re-derive scope from ROADMAP.md alone; REQUIREMENTS.md is more precise.

### Prior architecture decisions (already locked, do not re-litigate)
- `.planning/STATE.md` — "[v1.8.0 roadmap]" entries: hook is an inline shell command in settings.json (no separate script file, avoids jq/exec-bit questions); Phase 15 and Phase 17 are split by risk profile with no shared files and can run in parallel; Phase 16 (update JSON merge) depends on Phase 15's exact key shapes.

### Existing MCP wiring pattern (for context, not to copy literally — different mechanism)
- `packages/npm/src/steps/configure-mcp.ts` — headroom's MCP registration is a *runtime* `claude mcp add` CLI call. context7 is the opposite: a *static* `.mcp.json` template file checked into the repo/template tree (per CTX7-01's explicit wording "`.mcp.json` template ships with..."). Do not follow configure-mcp.ts's runtime-registration pattern for context7.

No ADRs/specs referenced beyond the above — requirements fully captured in REQUIREMENTS.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `templates/.claude/settings.json`, `packages/npm/templates/.claude/settings.json` — existing template settings files with a `permissions` block only; the hook is a net-new top-level key (`hooks.PreToolUse` or equivalent) added alongside `permissions`, not a new file.
- `.claude/settings.json` (repo root) — same shape, currently minimal (just a couple of `allow` entries); this is the dogfood target.
- `docs/getting-started.md` — has a "What is headroom?" section (line ~29) that's the direct pattern to mirror for the new "What is context7?" section and the HOOK-04 caveat.

### Established Patterns
- No `.mcp.json` exists anywhere in the codebase today (npm, pip, or root) — CTX7-01 is a net-new file, not an edit to an existing one.
- Generic copy/manifest pipeline (Phases 1-14) already handles adding new template files to both npm and pip packages — no new plumbing needed, just add the files.

### Integration Points
- `packages/npm/templates/`, `packages/pip/` template equivalent, `templates/` (repo-root canonical source) — all three need the hook + `.mcp.json` additions, kept in sync per the existing template-sync convention (`packages/npm/templates/` is a gitignored prebuild artifact — remember to run `cd packages/npm && npm run prebuild` after adding files to `templates/`).

</code_context>

<specifics>
## Specific Ideas

- Block message exact text: `BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md` (or planner's closest equivalent achieving the same copy-paste-fix intent).
- New doc sections in `docs/getting-started.md`: one covering the hook's Claude-Code-Bash-tool-only scope (HOOK-04), one titled "What is context7?" covering the upgrade path and trust prompt (CTX7-02, CTX7-03) — same file, mirroring the existing "What is headroom?" section style.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (`goodvibes update` propagation of these same keys is already correctly scoped to Phase 16, per STATE.md — not re-discussed here.)

</deferred>

---

*Phase: 15-journal-gate-hook-context7-mcp*
*Context gathered: 2026-09-05*
