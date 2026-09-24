# Phase 15: Journal-Gate Hook & context7 MCP - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-05
**Phase:** 15-journal-gate-hook-context7-mcp
**Areas discussed:** Dogfood on this repo, Block message wording, Doc placement

---

## Dogfood on this repo

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, dogfood now | Add the hook to root .claude/settings.json in this phase. Proves it works in real daily use, catches bugs before users hit them. | ✓ |
| Templates only | Ship the hook into templates/ + packages/*/templates/ for new/updated projects, but leave root untouched this phase. | |

**User's choice:** Yes, dogfood now (hook)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add root .mcp.json too | Consistent with dogfooding the hook — no .mcp.json exists at root today, this creates it. | ✓ |
| Templates only | Leave root without .mcp.json; only ship it in templates/ and packages/*/templates/. | |

**User's choice:** Yes, add root .mcp.json too (context7)
**Notes:** Both the hook and context7 dogfooding land on goodvibes' own repo in this phase, not deferred.

---

## Block message wording

| Option | Description | Selected |
|--------|-------------|----------|
| Copy-pasteable fix | e.g. "BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md" — beginner-first per CLAUDE.md's own actionable-error rule. | ✓ |
| Terse one-liner | e.g. "BLOCKED: stage JOURNAL.md before committing." — minimal, assumes user knows git. | |

**User's choice:** Copy-pasteable fix

| Option | Description | Selected |
|--------|-------------|----------|
| Fix only | Keep stderr to the actionable fix, no policy explanation. | ✓ |
| Fix + why | Add a clause referencing CLAUDE.md's journal rule. | |

**User's choice:** Fix only

---

## Doc placement

| Option | Description | Selected |
|--------|-------------|----------|
| docs/getting-started.md | New section near the existing "What is headroom?" pattern. | ✓ |
| README.md | Add to "What you get" section — higher visibility, longer README. | |

**User's choice:** docs/getting-started.md (HOOK-04 caveat)

| Option | Description | Selected |
|--------|-------------|----------|
| Same file, own section | docs/getting-started.md gets a "What is context7?" section mirroring "What is headroom?". | ✓ |
| Different location | User specifies elsewhere. | |

**User's choice:** Same file, own section (CTX7-02/03)

---

## Claude's Discretion

- Exact hook matcher pattern for intercepting `git commit` invocations (covering `git commit -am`, `git -C path commit`, etc.)
- Exact JSON shape of the `PreToolUse` hook block in settings.json and the `mcpServers` block in .mcp.json
- context7's exact free-tier HTTP endpoint URL (confirm from context7's own docs during research)

## Deferred Ideas

None — discussion stayed within phase scope. `goodvibes update` propagation of these keys is already scoped to Phase 16 per STATE.md, not re-discussed here.
