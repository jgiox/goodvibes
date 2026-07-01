# Phase 9 Context — Vibe Platform Expansion

**Phase:** 09-vibe-platform-expansion
**Date:** 2026-07-01
**Status:** Planning

---

## Scope

Extend goodvibes to cover vibe-coding platforms beyond the IDE rule files shipped in Phase 8.

**In scope:**
- `templates/replit.md` — Replit Agent reads this from project root automatically
- `templates/.bolt/prompt` — Bolt.new reads this when the project is opened
- `templates/docs/platform-setup/chatgpt.md` — beginner guide for ChatGPT Projects (UI-only platform)
- `templates/docs/platform-setup/base44.md` — beginner guide for Base44 AI controls (UI-only platform)
- README IDE compatibility table: add Codex CLI, Lovable, Replit, Bolt.new rows
- Tests: 3-test pattern for each new template file (npm + pip)
- JOURNAL.md + CHANGELOG.md + version bump to 1.5.0

**Out of scope:**
- v0.dev (component generator, no persistent project rule file; low value for goodvibes audience)
- `goodvibes prompt` subcommand (possible Phase 10 feature)
- Replit symlink workaround AGENTS.md → replit.md (community-driven, not official)
- `.codex/config.toml` or `.codex/rules/` (security-oriented, not instruction-oriented)

---

## Decisions

### D-01: Codex CLI and Lovable need no new template files
AGENTS.md (already shipped in Phase 8) covers both. Add to README table only.

### D-02: replit.md is plain markdown, no frontmatter
Replit Agent auto-reads project root `replit.md`. Plain markdown, no YAML frontmatter.

### D-03: .bolt/prompt is the chosen filename (not .bolt/promptfile)
Confidence MEDIUM. Both appear in community sources. Use the shorter name. Note the
alternative in docs/platform-setup/bolt.md comments. Risk is low — if Bolt ignores it,
the file does no harm.

### D-04: Both replit.md and .bolt/prompt are written under --minimal
Consistent with all other IDE/platform rule files. --minimal only suppresses .github/ and
docs/ directories. Platform rule files are AI configuration, not scaffolding.

### D-05: docs/platform-setup/ guides go into templates/
Users get them on `goodvibes init`, alongside docs/onboarding.md (existing). Users who
don't need them can delete them.

### D-06: No new npm or pip dependencies
Only static template files added. Existing copy machinery handles them automatically.

### D-07: Version bump to 1.5.0
Both packages (npm + pip) bump from 1.4.0 to 1.5.0. CLAUDE.md version header also bumped.

---

## Open Questions (RESOLVED)

### OQ-01: .bolt/prompt vs .bolt/promptfile
**What we know:** Multiple community sources use both names; official Bolt docs primarily
describe UI-based Knowledge. `.bolt/prompt` is the simpler/shorter name and appears more
frequently.
**Decision:** Use `.bolt/prompt` (D-03). Note alternative in release comments.
**Risk:** LOW — if Bolt ignores it, no harm to the project.

### OQ-02: Replit Agent may auto-overwrite replit.md
Replit Agent auto-generates replit.md on first Agent interaction. goodvibes writes it on
init; Agent may regenerate it.
**Decision:** Document in replit.md itself (first comment line) and in the README. Users
who care can commit their replit.md to git and re-edit after Agent sessions.
**Risk:** LOW — this is a Replit-side behavior, not a goodvibes bug.

---

## Wave Structure

| Wave | Plans | Parallel? |
|------|-------|-----------|
| 1 | 09-01 (template files), 09-02 (tests) | Yes — no file conflicts |
| 2 | 09-03 (README + docs + version bump) | No — depends on both Wave 1 plans |

Wave 2 depends on Wave 1 because:
- 09-03 adds README rows for files authored in 09-01
- 09-03 runs both test suites to confirm GREEN before version bump

---

## Assumptions Log

| # | Claim | Risk if Wrong |
|---|-------|---------------|
| A1 | .bolt/prompt is read by current Bolt builds | If wrong: file silently ignored; no regression |
| A2 | Replit Agent may overwrite replit.md after goodvibes writes it | If wrong: no regression |
| A3 | Base44 has no file-based instruction mechanism as of 2026-07-01 | If added later: AGENTS.md auto-covers it |
| A4 | docs/platform-setup/ guides belong in templates (written to user project) | If wrong: move to goodvibes website in Phase 10 |
