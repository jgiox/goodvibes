# Phase 1: Template Content & Repo Foundation - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Create the canonical static template files that both the npm CLI (Phase 2) and pip CLI (Phase 3) will copy into a user's project. This includes: the template CLAUDE.md (engineering rules), the caveman and goodvibes-hygiene Claude skills, all docs scaffolding (CONTRIBUTING.md, SECURITY.md, JOURNAL.md, CHANGELOG.md, issue templates, PR template, onboarding guide), and the repo's own LICENSE and NOTICE files. Also establishes the repo's folder structure (templates/ at root, packages/ for CLI source) and the README with the hero action.

Phase 1 output is **static files only** — no CLI code, no installers, no CI logic.

</domain>

<decisions>
## Implementation Decisions

### CLAUDE.md Content

- **D-01:** Source is the user's Code Directions.md (full content read into context during discussion). No karpathy fetch needed — Code Directions.md covers all 6 required topics.
- **D-02:** Curate to 80-100 lines. Curation rule: keep the core rule + required behavior per section. Strip all Good/Bad examples, enforcement blocks, and questions-to-ask callouts. Only rules-plus-required-behavior survives.
- **D-03:** Required topics to include (per CLAUDEMD-05): think before coding, simplicity first, surgical changes, fail loud, security basics, journal requirement. Exclude ML drift, push to GitHub, deps current, MD files current, PR checklist, red flags.
- **D-04:** CLAUDE.md must include a `<!-- goodvibes:start -->` / `<!-- goodvibes:end -->` sentinel block wrapping the goodvibes-managed content (for Phase 5 upgrade compatibility) and a `# goodvibes: v1.0.0` version stamp inside the block.

### Ponytail Auto-Activation

- **D-05:** Embed the full ponytail minimalism ruleset inline in CLAUDE.md so it auto-activates every session without requiring the user to type `/ponytail`. No plugin dependency needed for the rules to work.
- **D-06:** Source for the embedded ruleset: researcher fetches from DietrichGebert/ponytail GitHub repo to extract the exact ruleset. Do not guess or abbreviate — use the actual rules.
- **D-07:** The goodvibes-hygiene skill wraps `/ponytail-review` and `/ponytail-audit` for explicit on-demand audits. The inline CLAUDE.md rules handle always-on enforcement; the skill handles explicit invocation.

### Templates Directory Structure

- **D-08:** Template files live in `templates/` at the repo root, mirroring the exact target project layout. The CLI does a straight recursive copy — no path translation. Example: `templates/CLAUDE.md` → `user-project/CLAUDE.md`, `templates/.claude/skills/caveman/` → `user-project/.claude/skills/caveman/`.
- **D-09:** Both the npm and pip CLIs bundle/include `templates/` at their publish/build time. No filesystem symlinks. One source of truth (templates/) satisfies REPO-04 without symlink fragility on Windows.
- **D-10:** CLI source packages live at `packages/npm/` and `packages/pip/` under a top-level `packages/` directory. Phase 1 creates the `packages/` directory structure (empty) as placeholder — code arrives in Phases 2 and 3.

### Docs Completeness & Tone

- **D-11:** All docs files are **fully written for a generic project** — no `[YOUR_PROJECT_NAME]` stubs, no TODO placeholders. A beginner can read and use them as-is after goodvibes init. Tone is plain English, assume no prior git or engineering knowledge.
- **D-12:** `docs/onboarding.md` scope: git basics + PR workflow only (~400-600 words). Covers fork vs clone, creating a branch, making a commit, opening a PR. Does not explain CI (out of scope for Phase 1).
- **D-13:** Issue templates use **GitHub YAML format** (`.yml`) with structured form fields (Describe the bug, Steps to reproduce, Expected behavior). Not markdown stubs.
- **D-14:** README.md content: hero command (`npx goodvibes init` as the first and most prominent element) + one-paragraph "what it does" + brief description of the four layers (caveman, headroom, ponytail, CLAUDE.md rules). Links to `docs/`. No detailed setup steps (the CLI handles that).

### caveman Skill

- **D-15:** Fork caveman from `juliusbrussee/caveman` as-is. No behavior changes. Include Apache 2.0 NOTICE file crediting the original. Researcher must verify license compatibility before bundling (confirmed MIT → Apache 2.0 compatible, but check for any changes since PROJECT.md was written).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — All Phase 1 requirements (CLAUDEMD-01 through REPO-04, 22 requirements). Must read for full acceptance criteria.
- `.planning/ROADMAP.md` §Phase 1 — Success criteria (5 checkpoints). The phase goal and done-definition live here.

### CLAUDE.md Source Content
- `/mnt/c/Users/YiannisGiokas/Downloads/Code Directions.md` — The full source document for the template CLAUDE.md. Content read into context during discussion. Sections to include: Before you begin, Think before coding, Simplicity first, Surgical changes, Fail loud, Security, Journal. Curation rule: rules + required behavior only, strip examples and enforcement blocks.

### External Repos (researcher must fetch)
- `https://github.com/DietrichGebert/ponytail` — Fetch to extract the exact ponytail minimalism ruleset for inline embedding in CLAUDE.md. Use the actual rules, not a summary.
- `https://github.com/juliusbrussee/caveman` — Verify current license (MIT, Apache 2.0 compatible). Fetch skill file structure to understand what to copy into `templates/.claude/skills/caveman/`. Confirm NOTICE file requirements.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — this is a greenfield repo. No existing components, hooks, or utilities.

### Established Patterns
- None yet established. Phase 1 creates the first files. Conventions will emerge here.

### Integration Points
- `templates/` directory output of Phase 1 is the primary input to Phase 2 (npm CLI file-copy logic) and Phase 3 (pip CLI). The directory layout decided here (D-08) directly constrains the Phase 2 implementation.
- The `<!-- goodvibes:start -->` sentinel block decided here (D-04) directly constrains the Phase 5 upgrade implementation.

</code_context>

<specifics>
## Specific Ideas

- CLAUDE.md version stamp format: `# goodvibes: v1.0.0` (inside the sentinel block)
- Sentinel block markers: `<!-- goodvibes:start -->` and `<!-- goodvibes:end -->`
- onboarding.md target length: ~400-600 words (git basics + PR workflow)
- README hero: `npx goodvibes init` should be the first command a visitor sees — not buried in a list
- Four layers to describe in README: caveman (output token compression), headroom (input token compression), ponytail (code minimalism), CLAUDE.md rules (engineering discipline)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Template Content & Repo Foundation*
*Context gathered: 2026-06-23*
