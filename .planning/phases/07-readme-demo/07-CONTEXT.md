# Phase 7: README & Demo - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the first-impression assets for the goodvibes repo: a redesigned hero README, four live Shields.io badges, an animated demo GIF recorded with VHS, and a CI workflow that auto-regenerates the GIF when the tape changes.

Output is three file groups: (1) `README.md` — full hero redesign with tagline, badges, GIF, and restructured sections; (2) `scripts/demo.tape` + `docs/demo.gif` — the VHS tape and generated GIF; (3) `.github/workflows/vhs.yml` — auto-regen workflow on push to main.

Phase does NOT add new CLI features, fix bugs, or change installer behavior. It surfaces what already works.

</domain>

<decisions>
## Implementation Decisions

### README Hero Structure

- **D-01:** Full hero redesign (not minimal reorder). New section order: title → tagline → badges → GIF → Quick start command → What you get → Flags → What you need first → Platform support → Docs.
- **D-02:** Tagline: `> One command. Production-grade project. No config.` — placed as a blockquote directly under the `# goodvibes` title.
- **D-03:** Badges appear between the tagline and the GIF. Order: npm version → PyPI version → CI status → License. Style: `flat-square`. Max 4 badges.
- **D-04:** GIF embedded inline between badges and the Quick start command block. Linked to itself (`[![demo](docs/demo.gif)](docs/demo.gif)`) so GitHub renders it inline; clicking opens full-size.
- **D-05:** Prerequisites section (`## What you need first`) moves to after `## Flags` — below the fold. Visitor sees value proposition and command before they see requirements.
- **D-06:** `## Quick start` replaces the existing unnamed command block; contains just `npx goodvibes init` plus the pip alternative below it.

### Badge Configuration

- **D-07:** Badge URLs use Shields.io with `flat-square` style. Package names: `%40jgiox%2Fgoodvibes` (npm, URL-encoded) and `jgiox-goodvibes` (PyPI). CI badge points to `ci.yml` in the `jgiox/goodvibes` repo.
- **D-08:** Badge order and exact format:
  1. `[![npm](https://img.shields.io/npm/v/%40jgiox%2Fgoodvibes?style=flat-square)](https://www.npmjs.com/package/@jgiox/goodvibes)`
  2. `[![PyPI](https://img.shields.io/pypi/v/jgiox-goodvibes?style=flat-square)](https://pypi.org/project/jgiox-goodvibes/)`
  3. `[![CI](https://img.shields.io/github/actions/workflow/status/jgiox/goodvibes/ci.yml?style=flat-square)](https://github.com/jgiox/goodvibes/actions/workflows/ci.yml)`
  4. `[![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](LICENSE)`

### Demo Tape Content

- **D-09:** Tape opens with `mkdir myproject && cd myproject` to show the full beginner flow before the goodvibes command.
- **D-10:** Main command: `npx goodvibes init --minimal --dry-run`. Using `--minimal --dry-run` for deterministic timing — no headroom download, no filesystem writes, shows the written/skipped counts from Phase 6 hardening.
- **D-11:** Terminal theme: dark (VHS default). Renders best in GitHub dark mode (majority of viewers). Width: 800px (matches DEMO-01 requirement). GIF must be ≤2MB.
- **D-12:** Tape file location: `scripts/demo.tape`. GIF output: `docs/demo.gif`. GIF is committed alongside the tape so contributors can reproduce by running `vhs scripts/demo.tape`.

### VHS CI Workflow

- **D-13:** `vhs.yml` triggers on `push` to `main` with `paths: ['scripts/demo.tape']`. No `workflow_dispatch` — push-on-tape-change is sufficient for the use case.
- **D-14:** Commit-back strategy: `stefanzweifel/git-auto-commit-action@v5`. Commits `docs/demo.gif` only if it changed. Commit message: `chore(demo): regenerate demo.gif`. Uses `GITHUB_TOKEN` — no PAT required.
- **D-15:** Researcher must verify `stefanzweifel/git-auto-commit-action` current release tag before pinning (STATE.md flagged MEDIUM confidence). Pin by SHA for supply chain safety.

### Package Metadata (npm + PyPI)

- **D-16:** `packages/npm/package.json` description: `"One-command bootstrap for vibe coding projects"` (already set). Keywords: add `"ai-coding"`, `"claude-code"`, `"copilot"` to existing list. Homepage: `"https://github.com/jgiox/goodvibes"` (already set).
- **D-17:** `packages/pip/pyproject.toml` description: `"One-command bootstrap for vibe coding projects"` (already set). Keywords: add `"ai-coding"`, `"claude-code"`, `"copilot"`. Homepage classifier and `[project.urls]` Homepage field: `"https://github.com/jgiox/goodvibes"`.
- **D-18:** README `## Flags` section must explicitly state what `--minimal` skips: `.github/` (workflows, issue templates, PR template, dependabot) and `docs/`. This satisfies README-04.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §v1.1.0 Requirements — README-01 through README-04, DEMO-01, DEMO-02. Six requirements for this phase.
- `.planning/ROADMAP.md` §Phase 7 — Success criteria (5 checkpoints). Done-definition lives here.

### Existing Files to Modify
- `README.md` — Current README. Full hero redesign required; read before editing to understand existing section content to preserve.
- `packages/npm/package.json` — Add keywords; verify description and homepage.
- `packages/pip/pyproject.toml` — Add keywords; add `[project.urls]` Homepage entry.

### Workflows Reference
- `.github/workflows/ci.yml` — CI workflow the badge links to. Read to confirm workflow name matches badge URL.
- `.github/workflows/publish-npm.yml` — Reference for workflow structure patterns (trigger, steps).

### VHS
- VHS tape syntax: `charmbracelet/vhs` docs — researcher must fetch current VHS tape syntax (Output, Type, Enter, Sleep, Set commands). Tape format is not stdlib — do not guess.
- `stefanzweifel/git-auto-commit-action` — Researcher must verify current release tag (v5 expected, confirm SHA for pinning).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/workflows/publish-npm.yml` — Existing workflow with `paths` trigger pattern, environment setup, and action pinning conventions. Use as structural reference for `vhs.yml`.
- `scripts/verify-phase*.sh` — Existing scripts in `scripts/` directory. `demo.tape` follows the same naming convention.
- `packages/npm/package.json` `keywords` array — Already has `["scaffold", "vibe-coding", "claude", "llm", "starter-kit", "cli"]`; extend, don't replace.

### Established Patterns
- Package names: npm = `@jgiox/goodvibes`, PyPI = `jgiox-goodvibes`, CLI entry point = `goodvibes` (both CLIs).
- Workflow action pinning: existing workflows use version tags (e.g., `@v4`); researcher should confirm whether SHA pinning is used elsewhere in this repo.
- `docs/` directory exists (contains `onboarding.md`); `docs/demo.gif` follows the existing pattern.

### Integration Points
- `docs/demo.gif` is produced by `scripts/demo.tape` via VHS. The GIF path is embedded in `README.md`. All three files must be consistent.
- Badge CI URL must match the actual workflow filename `ci.yml` (confirmed: `.github/workflows/ci.yml` exists).

</code_context>

<specifics>
## Specific Ideas

- Hero layout: title → `> One command. Production-grade project. No config.` → 4 flat-square badges on one line → demo GIF → `## Quick start` with `npx goodvibes init` command.
- Demo opens: `mkdir myproject && cd myproject`, then `npx goodvibes init --minimal --dry-run`. Dark terminal, 800px wide.
- The GIF must show the Phase 6 hardened output: written/skipped file counts in the completion summary.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 7-README & Demo*
*Context gathered: 2026-06-27*
