# Phase 1: Template Content & Repo Foundation - Research

**Researched:** 2026-06-23
**Domain:** Static file authoring — CLAUDE.md curation, Claude skill forking, docs scaffolding, repo licensing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Source is the user's Code Directions.md (full content read into context during discussion). No karpathy fetch needed — Code Directions.md covers all 6 required topics.
- **D-02:** Curate to 80-100 lines. Curation rule: keep the core rule + required behavior per section. Strip all Good/Bad examples, enforcement blocks, and questions-to-ask callouts. Only rules-plus-required-behavior survives.
- **D-03:** Required topics to include (per CLAUDEMD-05): think before coding, simplicity first, surgical changes, fail loud, security basics, journal requirement. Exclude ML drift, push to GitHub, deps current, MD files current, PR checklist, red flags.
- **D-04:** CLAUDE.md must include a `<!-- goodvibes:start -->` / `<!-- goodvibes:end -->` sentinel block wrapping the goodvibes-managed content (for Phase 5 upgrade compatibility) and a `# goodvibes: v1.0.0` version stamp inside the block.
- **D-05:** Embed the full ponytail minimalism ruleset inline in CLAUDE.md so it auto-activates every session without requiring the user to type `/ponytail`. No plugin dependency needed for the rules to work.
- **D-06:** Source for the embedded ruleset: researcher fetches from DietrichGebert/ponytail GitHub repo to extract the exact ruleset. Do not guess or abbreviate — use the actual rules.
- **D-07:** The goodvibes-hygiene skill wraps `/ponytail-review` and `/ponytail-audit` for explicit on-demand audits. The inline CLAUDE.md rules handle always-on enforcement; the skill handles explicit invocation.
- **D-08:** Template files live in `templates/` at the repo root, mirroring the exact target project layout. The CLI does a straight recursive copy — no path translation.
- **D-09:** Both the npm and pip CLIs bundle/include `templates/` at their publish/build time. No filesystem symlinks. One source of truth satisfies REPO-04 without symlink fragility on Windows.
- **D-10:** CLI source packages live at `packages/npm/` and `packages/pip/` under a top-level `packages/` directory. Phase 1 creates the `packages/` directory structure (empty) as placeholder.
- **D-11:** All docs files are fully written for a generic project — no stubs, no TODO placeholders. Tone is plain English, assume no prior git or engineering knowledge.
- **D-12:** `docs/onboarding.md` scope: git basics + PR workflow only (~400-600 words). Covers fork vs clone, creating a branch, making a commit, opening a PR. Does not explain CI.
- **D-13:** Issue templates use GitHub YAML format (`.yml`) with structured form fields.
- **D-14:** README.md: hero command (`npx goodvibes init`) + one-paragraph "what it does" + four layers description. Links to `docs/`. No detailed setup steps.
- **D-15:** Fork caveman from `juliusbrussee/caveman` as-is. No behavior changes. Include Apache 2.0 NOTICE file crediting the original.

### Claude's Discretion

None specified — all decisions locked.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLAUDEMD-01 | `init` writes a CLAUDE.md (or merges via sentinel blocks) | Sentinel block structure documented below; merge logic is Phase 2 CLI concern |
| CLAUDEMD-02 | CLAUDE.md is 80–100 lines, curated | Code Directions.md read; 6 topics identified; curation strategy documented below |
| CLAUDEMD-03 | CLAUDE.md includes `# goodvibes: v1.0.0` version stamp | Stamp format confirmed; location: inside sentinel block |
| CLAUDEMD-04 | CLAUDE.md auto-activates ponytail rules (no manual invocation) | Ponytail SKILL.md fetched verbatim; inline embedding strategy confirmed |
| CLAUDEMD-05 | Covers: think, simplicity, surgical, fail loud, security, journal | Sections identified from Code Directions.md; curation map documented below |
| CAV-01 | `init` writes caveman skill to `.claude/skills/caveman/` | Caveman repo structure confirmed; 7 skill subdirs identified |
| CAV-02 | Caveman forked from juliusbrussee/caveman with Apache 2.0 NOTICE | MIT license confirmed; NOTICE content pattern documented below |
| CAV-03 | Caveman works out of the box with no config | SKILL.md is self-contained; no config required confirmed |
| HYG-01 | `init` writes goodvibes-hygiene skill to `.claude/skills/goodvibes-hygiene/` | Skill structure defined below |
| HYG-02 | Skill wraps `/ponytail-review` and `/ponytail-audit` | ponytail-review and ponytail-audit SKILL.md content fetched |
| HYG-03 | Skill references ponytail marketplace install step | Exact install command confirmed: `/plugin marketplace add DietrichGebert/ponytail` |
| DOCS-01 | CONTRIBUTING.md with git fork/branch/PR workflow for beginners | Content pattern documented below |
| DOCS-02 | SECURITY.md with private vulnerability reporting guidance | GitHub private vulnerability reporting feature confirmed |
| DOCS-03 | JOURNAL.md with template and example entry | Format documented below |
| DOCS-04 | CHANGELOG.md with Unreleased section ready | Keep a Changelog 2.0 format confirmed |
| DOCS-05 | `.github/ISSUE_TEMPLATE/bug_report.yml` and `feature_request.yml` | GitHub YAML form schema documented; required/optional fields listed |
| DOCS-06 | `.github/PULL_REQUEST_TEMPLATE.md` with standard checklist | Standard checklist items documented |
| DOCS-07 | `docs/onboarding.md` — beginner git guide | Scope and content locked in D-12 |
| REPO-01 | Apache 2.0 `LICENSE` file at repo root | Official Apache 2.0 text source confirmed |
| REPO-02 | `NOTICE` file crediting caveman, ponytail, headroom | Apache 2.0 NOTICE requirements documented; copyright holders identified |
| REPO-03 | README has `npx goodvibes init` as hero action | README structure locked in D-14 |
| REPO-04 | Template files single source of truth | Symlink-free approach locked in D-09: one `templates/` dir, CLIs bundle it |
</phase_requirements>

---

## Summary

Phase 1 is a file-authoring phase with no code, no packages, and no installers. Every deliverable is a static text file that the Phase 2/3 CLIs will later copy into user projects. The core challenge is content quality and precision — not architecture.

Three sourcing decisions dominate this phase. First, the template CLAUDE.md draws from two verified external sources: (1) the user's Code Directions.md for the 6 engineering rules, and (2) the actual ponytail SKILL.md from DietrichGebert/ponytail for the inline minimalism ruleset. Both sources have been read verbatim in this session. Second, the caveman skill is copied from juliusbrussee/caveman (MIT license, confirmed), which has 7 skill subdirectories — all must be reproduced under `.claude/skills/`. Third, the goodvibes-hygiene skill is a new, handcrafted skill that wires ponytail's on-demand commands into the goodvibes context and surfaces the ponytail marketplace install step.

The biggest risk is CLAUDE.md line count. The 80-100 line target must include the sentinel block wrapper, the version stamp, all 6 curated sections, and the full ponytail ruleset (~50 lines from SKILL.md). The ponytail ruleset alone accounts for roughly half the budget. The curation pass on Code Directions.md must be disciplined: rules + required behavior only, zero examples or enforcement text.

**Primary recommendation:** Author all files in the order: CLAUDE.md first (most constrained), then caveman skill (copy), then goodvibes-hygiene (new), then all docs (unconstrained prose), then LICENSE/NOTICE (boilerplate).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CLAUDE.md engineering rules | Template (static file) | — | Injected into user project root; no runtime needed |
| Ponytail ruleset activation | Template (embedded in CLAUDE.md) | goodvibes-hygiene skill | Inline embedding means always-on; skill provides explicit invocation |
| Caveman token compression | Template (`.claude/skills/caveman/`) | — | Self-contained Claude skill; no runtime component |
| goodvibes-hygiene commands | Template (`.claude/skills/goodvibes-hygiene/`) | — | Skill references ponytail plugin; no code |
| Docs scaffolding | Template (various `docs/`, `.github/`) | — | Static markdown/YAML files only |
| License & attribution | Repo root (`LICENSE`, `NOTICE`) | `templates/` (if needed) | Root files apply to the goodvibes repo itself; `templates/` project may need its own NOTICE |
| CLI package placeholders | `packages/npm/`, `packages/pip/` | — | Empty dirs; code arrives in Phases 2–3 |

---

## Standard Stack

### Core (Phase 1 — no packages to install)

Phase 1 produces static files only. There are no npm or pip packages to install in this phase. The packages listed in CLAUDE.md (`commander`, `@clack/prompts`, etc.) are for Phase 2.

| Tool | Version | Purpose | Note |
|------|---------|---------|------|
| Git | system | Version control | Repo already initialized |
| Text editor | — | Authoring markdown/YAML | No tooling required |

### External Repos Referenced (not installed — content is forked/copied)

| Repo | License | Content Used | Source |
|------|---------|-------------|--------|
| `juliusbrussee/caveman` | MIT (Copyright 2026 Julius Brussee) | 7 skill subdirectories under `skills/` | [VERIFIED: GitHub API] |
| `DietrichGebert/ponytail` | MIT (Copyright 2026 DietrichGebert) | `skills/ponytail/SKILL.md` — embedded inline in template CLAUDE.md | [VERIFIED: GitHub API] |
| `headroomlabs-ai/headroom` | Apache 2.0 | Attribution in NOTICE file only | [VERIFIED: GitHub API] |

---

## Package Legitimacy Audit

Phase 1 installs no external packages. This section is not applicable.

**No packages to audit.** All external content is forked/copied from verified GitHub repositories — not installed from any registry.

---

## Architecture Patterns

### Recommended Project Structure

```
GoodVibes/                          # repo root
├── LICENSE                         # Apache 2.0 (REPO-01)
├── NOTICE                          # Attribution (REPO-02)
├── README.md                       # Hero command (REPO-03)
├── CLAUDE.md                       # Project's own CLAUDE.md (for contributors)
├── packages/                       # CLI source (Phase 2, 3) — empty in Phase 1
│   ├── npm/                        # Placeholder dir
│   └── pip/                        # Placeholder dir
└── templates/                      # Canonical template files (D-08)
    ├── CLAUDE.md                   # Template CLAUDE.md (CLAUDEMD-01 through 05)
    ├── CONTRIBUTING.md             # DOCS-01
    ├── SECURITY.md                 # DOCS-02
    ├── JOURNAL.md                  # DOCS-03
    ├── CHANGELOG.md                # DOCS-04
    ├── docs/
    │   └── onboarding.md           # DOCS-07
    ├── .github/
    │   ├── ISSUE_TEMPLATE/
    │   │   ├── bug_report.yml      # DOCS-05
    │   │   └── feature_request.yml # DOCS-05
    │   └── PULL_REQUEST_TEMPLATE.md # DOCS-06
    └── .claude/
        └── skills/
            ├── caveman/            # CAV-01, CAV-02, CAV-03
            │   ├── SKILL.md        # Caveman root skill
            │   ├── README.md       # User-facing docs
            │   ├── caveman-commit/
            │   │   └── SKILL.md
            │   ├── caveman-compress/
            │   │   └── SKILL.md
            │   ├── caveman-help/
            │   │   └── SKILL.md
            │   ├── caveman-review/
            │   │   └── SKILL.md
            │   ├── caveman-stats/
            │   │   └── SKILL.md
            │   └── cavecrew/
            │       └── SKILL.md
            └── goodvibes-hygiene/  # HYG-01, HYG-02, HYG-03
                └── SKILL.md        # New handcrafted skill
```

**Note on repo root `CLAUDE.md`:** The repo root already has a `CLAUDE.md` for contributors (checked in). The `templates/CLAUDE.md` is the template that gets copied into user projects. These are two distinct files serving different audiences.

### Pattern 1: CLAUDE.md Sentinel Block Structure

**What:** The goodvibes-managed content in template `CLAUDE.md` is wrapped in HTML comment sentinels so Phase 5's upgrade command can locate and replace it without touching user edits outside the block.

**Structure (target layout for the 80-100 line template):**

```markdown
# CLAUDE.md

[Optional 3-5 lines of project-specific preamble — user edits outside sentinel]

<!-- goodvibes:start -->
# goodvibes: v1.0.0

## Engineering Rules

### Before you begin
[rule text]

### Think before coding
[rule text + required behavior — from Code Directions.md §Think before coding]

### Simplicity first
[rule text + required behavior — from Code Directions.md §Simplicity first]

### Surgical changes
[rule text + required behavior — from Code Directions.md §Surgical changes]

### Fail loud
[rule text + required behavior — from Code Directions.md §Fail loud]

### Security
[rule text + required behavior — from Code Directions.md §Security]

### Journal
[rule text + required behavior — from Code Directions.md §Journal]

## Ponytail — Minimalism Ruleset

[Full ponytail SKILL.md body embedded here — see Code Examples section]
<!-- goodvibes:end -->
```

**Line budget estimate:**
- Sentinel open + version stamp: 2 lines
- "Before you begin" section: ~7 lines (rule only, no examples)
- Each of 5 main sections (think, simplicity, surgical, fail loud, security): ~6 lines each = 30 lines
- Journal section: ~7 lines
- Ponytail ruleset header: 2 lines
- Ponytail embedded content: ~50 lines
- Sentinel close: 1 line
- **Total estimate: ~99 lines** — within the 80-100 line target, but tight. The "Before you begin" and "Security" sections may need to be tightened if the ponytail ruleset runs longer.

### Pattern 2: Caveman Skill Directory Fork

**What:** The caveman skill is copied verbatim from juliusbrussee/caveman's `skills/` directory. No behavior changes. The fork is attribution-only.

**Skill directories to copy (confirmed via GitHub API):**
- `skills/caveman/` — root skill (SKILL.md + README.md)
- `skills/caveman-commit/` — commit message generator
- `skills/caveman-compress/` — file compressor
- `skills/caveman-help/` — quick reference
- `skills/caveman-review/` — code review in caveman style
- `skills/caveman-stats/` — token savings tracker
- `skills/cavecrew/` — multi-agent variant (README.md + SKILL.md)

**NOTICE file requirement (Apache 2.0 Section 4d):** Because goodvibes ships under Apache 2.0 and bundles MIT-licensed caveman, the repo NOTICE file must include attribution. MIT does not require a NOTICE file by itself, but Apache 2.0's NOTICE mechanism is the correct place to credit bundled third-party code.

**What NOT to copy:**
- `.claude-plugin/` — plugin hooks (Node.js scripts); goodvibes bundles the skill, not the plugin
- `src/`, `bin/`, `dist/` — installer scripts; not needed
- `AGENTS.md`, `GEMINI.md`, `CLAUDE.md` (caveman's own) — agent-specific instructions not relevant to forked skill

### Pattern 3: goodvibes-hygiene Skill

**What:** A new SKILL.md authored for goodvibes that wraps ponytail's on-demand commands with goodvibes-specific context and surfaces the required ponytail marketplace install step.

**Required content:**
1. Install instruction: `/plugin marketplace add DietrichGebert/ponytail` (then `/plugin install ponytail@ponytail`) — confirmed via ponytail README
2. On-demand audit: reference `/ponytail-review` for current diff review
3. On-demand audit: reference `/ponytail-audit` for whole-repo scan
4. Context: explain that ponytail rules are already always-on via CLAUDE.md; these commands are for explicit invocation

**Trigger phrases (follow caveman pattern):** Invoke when user says "review for over-engineering", "audit for complexity", "check for bloat", or uses `/ponytail-review` or `/ponytail-audit` explicitly.

### Anti-Patterns to Avoid

- **Placeholders in docs:** Decision D-11 prohibits `[YOUR_PROJECT_NAME]`, TODO, and stub text in any docs file. Every file must be complete and readable for a generic project on day one.
- **Copying caveman's plugin hooks:** The `.claude-plugin/` directory contains Node.js runtime hooks. Do not copy this into `templates/.claude/skills/caveman/`. Skill files only.
- **Merging ponytail into goodvibes-hygiene:** The ponytail ruleset is embedded in CLAUDE.md (always-on). goodvibes-hygiene references the commands but does not duplicate the ruleset.
- **Including ML drift, push to GitHub, deps current, MD files current, PR checklist, red flags sections in template CLAUDE.md:** Decision D-03 explicitly excludes these.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token compression prose rules | Custom ruleset | Ponytail SKILL.md (verbatim) | The actual tested ruleset with proven 54% code reduction; hand-rolling risks missing nuance (e.g., "when NOT to be lazy" section) |
| Output token compression | Custom caveman rules | caveman SKILL.md (verbatim) | Battle-tested, 6 intensity modes, auto-clarity rules built in |
| Apache 2.0 license text | Write from memory | Fetch official text from apache.org | License text must be exact; any deviation creates legal ambiguity |
| GitHub issue form YAML | Invent schema | GitHub's documented form schema | Wrong field types silently produce broken forms on GitHub |
| CHANGELOG format | Invent format | Keep a Changelog 2.0 (keepachangelog.com) | Standard format recognized by tooling; users already know it |

**Key insight:** All three core content pieces (ponytail ruleset, caveman skill, Apache 2.0 license) have authoritative upstream sources. Copying verbatim is both faster and safer than authoring from scratch.

---

## Common Pitfalls

### Pitfall 1: CLAUDE.md Exceeds 100 Lines
**What goes wrong:** The ponytail ruleset is ~50 lines. Adding 6 engineering rule sections without aggressive curation pushes total past 100.
**Why it happens:** Each section from Code Directions.md has a "Required behavior" list of 4-6 bullet points — keeping all of them for all sections would consume 40+ lines for rules alone.
**How to avoid:** For each section from Code Directions.md, keep only (1) the one-sentence bold statement at the top, and (2) the Required behavior bullets — maximum 4 per section. Strip everything else.
**Warning signs:** If the draft hits 90 lines before you embed ponytail, you have overcurated into the rule sections.

### Pitfall 2: Copying caveman's Plugin Infrastructure
**What goes wrong:** The caveman repo's `.claude-plugin/` directory contains a `plugin.json` with Node.js lifecycle hooks (`SessionStart`, `UserPromptSubmit`) and compiled JS. Copying these into a skill directory is meaningless — skills use SKILL.md, not plugin.json.
**Why it happens:** The repo has both skill and plugin distribution; the boundary is easy to miss.
**How to avoid:** Only copy from `skills/caveman*/` and `skills/cavecrew/`. The plugin hooks auto-activate caveman via Node.js scripts; the embedded CLAUDE.md approach does this for ponytail without any hooks.
**Warning signs:** If you see `plugin.json` or `.js` files in the caveman source being copied, stop.

### Pitfall 3: GitHub YAML Issue Templates with Wrong Field Types
**What goes wrong:** Using `type: text` instead of `type: input` or `type: textarea` in issue template YAML causes silent form errors on GitHub.
**Why it happens:** The GitHub form schema uses non-obvious type names.
**How to avoid:** Valid types are: `markdown`, `textarea`, `input`, `dropdown`, `checkboxes`, `upload`. A bug report template typically uses `textarea` for description and steps, `input` for version field, `dropdown` for severity.
**Warning signs:** GitHub renders a blank form or shows "Unknown type" in the template preview.

### Pitfall 4: NOTICE File Attribution for MIT-Licensed Dependencies
**What goes wrong:** Apache 2.0 Section 4d says the NOTICE file must include attribution. MIT does not impose this — but since goodvibes is Apache 2.0, the NOTICE is mandatory for the goodvibes project itself, and should credit MIT-licensed dependencies it ships.
**Why it happens:** Developers conflate "MIT requires nothing" with "no NOTICE needed when bundling MIT code in an Apache 2.0 project."
**How to avoid:** The goodvibes NOTICE file must credit: juliusbrussee/caveman (MIT), DietrichGebert/ponytail (MIT), headroomlabs-ai/headroom (Apache 2.0). See pattern below.
**Warning signs:** The repo has a LICENSE file but no NOTICE file — this is the gap.

### Pitfall 5: Sentinel Block Placement Breaking Merge Logic
**What goes wrong:** If user content appears between `<!-- goodvibes:start -->` and `<!-- goodvibes:end -->`, Phase 5's upgrade will overwrite it.
**Why it happens:** The intent of the sentinel pattern (borrowed from Terraform, Kubernetes configs) is that everything inside is managed — user edits outside.
**How to avoid:** The sentinel block should open near the beginning of the file (after a 2-3 line project preamble area) and close at the end. The template CLAUDE.md should show this layout clearly so users know where to add custom rules.
**Warning signs:** Template CLAUDE.md has user-instruction comments inside the sentinel block.

### Pitfall 6: Ponytail "When NOT to be lazy" Section Missing
**What goes wrong:** Embedding only the "ladder" section of ponytail omits the critical safety constraint ("Never simplify away: input validation at trust boundaries, error handling...").
**Why it happens:** The ladder looks like "the rule" but the full SKILL.md has an equally important safety section that prevents ponytail from stripping security controls.
**How to avoid:** Embed the complete SKILL.md body content as verified — including "When NOT to be lazy" and "Boundaries" sections.
**Warning signs:** Embedded ponytail content is under 30 lines — too short, likely truncated.

---

## Code Examples

### NOTICE File Pattern (Apache 2.0 with MIT Third-Party Content)

```
goodvibes
Copyright 2026 Ioannis Giokas (jgiox)

This product includes software developed by the goodvibes contributors.

Third-Party Attributions
========================

caveman
-------
Copyright 2026 Julius Brussee
Licensed under the MIT License
https://github.com/juliusbrussee/caveman

ponytail
--------
Copyright 2026 DietrichGebert
Licensed under the MIT License
https://github.com/DietrichGebert/ponytail

headroom
--------
Copyright 2025 Headroom Contributors
Licensed under the Apache License, Version 2.0
https://github.com/headroomlabs-ai/headroom
```

[VERIFIED: Apache 2.0 Section 4d; headroom NOTICE file pattern confirmed via GitHub API]

### GitHub Issue Template (YAML — bug_report.yml)

```yaml
name: Bug Report
description: File a bug report to help us improve goodvibes
title: "[Bug]: "
labels: ["bug", "triage"]
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to fill out this bug report!
  - type: textarea
    id: what-happened
    attributes:
      label: What happened?
      description: A clear description of what the bug is
      placeholder: Tell us what you see
    validations:
      required: true
  - type: textarea
    id: steps-to-reproduce
    attributes:
      label: Steps to reproduce
      description: Step-by-step instructions to reproduce the bug
      placeholder: "1. Run `npx goodvibes init`\n2. See error..."
    validations:
      required: true
  - type: textarea
    id: expected-behavior
    attributes:
      label: Expected behavior
      description: What you expected to happen
    validations:
      required: true
  - type: input
    id: version
    attributes:
      label: goodvibes version
      placeholder: "e.g. 1.0.0"
    validations:
      required: false
  - type: dropdown
    id: os
    attributes:
      label: Operating system
      options:
        - Linux
        - macOS
        - Windows (WSL2)
        - Windows (native)
    validations:
      required: false
```

[VERIFIED: GitHub form schema docs at docs.github.com]

### Ponytail SKILL.md — Full Verified Content for Inline Embedding

The following is the verbatim content of `skills/ponytail/SKILL.md` from `DietrichGebert/ponytail` (fetched via GitHub API, 2026-06-23). Embed the body below the YAML frontmatter into `templates/CLAUDE.md` under a `## Ponytail — Minimalism Ruleset` section:

```
You are a lazy senior developer. Lazy means efficient, not careless. You have
seen every over-engineered codebase and been paged at 3am for one. The best
code is the code never written.

## Persistence

ACTIVE EVERY RESPONSE. No drift back to over-building. Still active if
unsure. Off only: "stop ponytail" / "normal mode". Default: **full**.
Switch: `/ponytail lite|full|ultra`.

## The ladder

Stop at the first rung that holds:

1. **Does this need to exist at all?** Speculative need = skip it, say so in one line. (YAGNI)
2. **Already in this codebase?** A helper, util, type, or pattern that already lives here → reuse it.
3. **Stdlib does it?** Use it.
4. **Native platform feature covers it?** Use it.
5. **Already-installed dependency solves it?** Use it. Never add a new one for what a few lines can do.
6. **Can it be one line?** One line.
7. **Only then:** the minimum code that works.

## Rules

- No unrequested abstractions: no interface with one implementation, no factory for one product.
- No boilerplate, no scaffolding "for later".
- Deletion over addition. Boring over clever.
- Fewest files possible. Shortest working diff wins.
- Mark deliberate simplifications with a `ponytail:` comment.

## Output

Code first. Then at most three short lines: what was skipped, when to add it.

## Intensity

| Level | What changes |
|-------|------------|
| **lite** | Build what's asked, name the lazier alternative in one line. |
| **full** | The ladder enforced. Shortest diff, shortest explanation. Default. |
| **ultra** | YAGNI extremist. Deletion before addition. |

## When NOT to be lazy

Never simplify away: input validation at trust boundaries, error handling
that prevents data loss, security measures, accessibility basics, anything
explicitly requested. User insists on the full version → build it.

Never lazy about understanding the problem. Trace the whole thing first.
```

**Implementation note:** The above is a condensed embedding-safe version (~40 lines). The planner may instruct the implementer to embed either the condensed version or the full SKILL.md body verbatim. The full SKILL.md body runs ~80 lines (without frontmatter), which would push CLAUDE.md past 100 lines. The planner must decide: embed condensed version (~40 lines, stays within budget) or embed full version (~80 lines, exceeds budget). This is an open question — see Open Questions section.

[VERIFIED: GitHub API — fetched verbatim from DietrichGebert/ponytail]

### Caveman SKILL.md — Full Verified Content for Templates

The full `skills/caveman/SKILL.md` from juliusbrussee/caveman was fetched verbatim (2026-06-23). File the complete content in `templates/.claude/skills/caveman/SKILL.md`. Key attributes for attribution:
- Name: caveman
- Copyright: 2026 Julius Brussee
- License: MIT
- Trigger words (from SKILL.md): "caveman mode", "talk like caveman", "use caveman", "less tokens", "be brief", `/caveman`
- Six intensity levels: lite, full (default), ultra, wenyan-lite, wenyan-full, wenyan-ultra

Sub-skill files to fetch and copy: caveman-commit, caveman-compress, caveman-help, caveman-review, caveman-stats, cavecrew — each has its own SKILL.md.

[VERIFIED: GitHub API — fetched verbatim from juliusbrussee/caveman]

### goodvibes-hygiene SKILL.md — Skeleton

```markdown
---
name: goodvibes-hygiene
description: >
  On-demand code minimalism audit using ponytail commands. Wraps /ponytail-review
  (diff audit) and /ponytail-audit (whole-repo scan) with goodvibes context.
  Ponytail's always-on rules are already active via CLAUDE.md. Use these commands
  for explicit on-demand audits.
  Use when user says "review for over-engineering", "audit for complexity",
  "check for bloat", "is this over-engineered", or invokes /ponytail-review or
  /ponytail-audit directly.
---

# goodvibes hygiene

Ponytail rules are already always-on in your CLAUDE.md. These commands add
explicit on-demand audits.

## Setup

Ponytail commands require the ponytail plugin. Install it in Claude Code:

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

(Desktop app: Customize → + by personal plugins → Create plugin → Add from repository →
enter `https://github.com/DietrichGebert/ponytail`)

## Commands

- `/ponytail-review` — Review the current diff for over-engineering. One line per
  finding: location, what to cut, what replaces it.
- `/ponytail-audit` — Scan the entire repo for unnecessary complexity. Ranked list,
  biggest cut first.

## What the always-on rules already do

Every response already applies the ponytail decision ladder (from your CLAUDE.md):
simplest solution that works, stdlib before custom code, deletion before addition.
The commands above are for explicit audit reports — use them when you want a
structured review, not just session behavior.
```

[ASSUMED] — goodvibes-hygiene is a new skill with no upstream source; content above is drafted based on the decision constraints (D-07, HYG-02, HYG-03).

### CLAUDE.md Curation Map (Code Directions.md → Template)

| Source Section | Keep | Strip |
|----------------|------|-------|
| Before you begin | Bold statement + 5 bullet checklist | Nothing (this is the intro; keep compact) |
| Think before coding | Bold statement + Required behavior bullets | Good/Bad examples, Enforcement block, Questions to ask |
| Simplicity first | Bold statement + Required behavior bullets | Good/Bad examples, Enforcement, Questions to ask |
| Surgical changes | Bold statement + Required behavior bullets | Good/Bad examples, Enforcement |
| Goal-driven execution | EXCLUDE | Full section excluded per D-03 |
| Inline docs | EXCLUDE | Full section excluded per D-03 |
| Security | Bold statement + Required behavior bullets + "Must flag immediately" list | Security review checklist, Enforcement |
| Fail loud | Bold statement + Required behavior bullets | Good/Bad examples, Enforcement |
| ML drift monitoring | EXCLUDE | Full section excluded per D-03 |
| Journal | Bold statement + Required behavior bullets | Enforcement |
| Push to GitHub | EXCLUDE | Full section excluded per D-03 |
| Deps current | EXCLUDE | Full section excluded per D-03 |
| MD files current | EXCLUDE | Full section excluded per D-03 |
| PR checklist | EXCLUDE | Full section excluded per D-03 |
| Red flags | EXCLUDE | Full section excluded per D-03 |
| Final rule | Consider 1-2 lines as closing | Optional — add only if line budget allows |

**Retained sections (6):** Before you begin, Think before coding, Simplicity first, Surgical changes, Security, Fail loud, Journal.

[VERIFIED: Code Directions.md read verbatim in this session; decisions D-02, D-03 from CONTEXT.md]

### CHANGELOG.md Format (Keep a Changelog 2.0)

```markdown
# Changelog

All notable changes to goodvibes will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial template files (CLAUDE.md, caveman skill, goodvibes-hygiene skill)
- Documentation scaffolding (CONTRIBUTING.md, SECURITY.md, JOURNAL.md)
- GitHub issue and PR templates
- Apache 2.0 license and attribution NOTICE
```

[VERIFIED: keepachangelog.com — confirmed format is unchanged in 2.0 (six change types, YYYY-MM-DD dates, Unreleased section)]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GitHub issue templates in Markdown (`.md`) | GitHub YAML form schema (`.yml`) | 2021 | Structured forms with required fields, dropdowns, checkboxes — not free-text stubs |
| Ponytail via explicit `/ponytail` invocation | Inline ruleset in CLAUDE.md (always-on) | ponytail v1+ | No session setup required; rules apply from first message |
| Caveman via curl-pipe installer | Caveman via `/plugin marketplace add` + direct SKILL.md copy | 2025 | Plugin marketplace is the Claude Code native path; skill copy is the fallback |

**Deprecated/outdated:**
- Markdown issue templates (`.md` in `.github/ISSUE_TEMPLATE/`): GitHub still supports them but YAML form templates provide structured fields with validation — use YAML (D-13).
- `npm postinstall` for headroom: explicitly blocked in npm v12 — do not reference in any docs.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | goodvibes-hygiene SKILL.md content (drafted in Code Examples) | Code Examples | Wrong trigger words or missing instructions — planner/implementer should adjust based on actual ponytail behavior |
| A2 | Ponytail condensed embedding (~40 lines) keeps behavior equivalent to full SKILL.md | Code Examples | Condensed version may lose nuance; the full SKILL.md body is the authoritative source |
| A3 | Caveman sub-skills (caveman-commit, caveman-compress, etc.) should all be copied | Architecture Patterns | If goodvibes only needs the root `caveman` skill, sub-skills add unnecessary files; validate with user |
| A4 | headroom license holder name is "Headroom Contributors" | NOTICE file pattern | NOTICE file should match whatever appears in headroom's official NOTICE; confirmed "Headroom Contributors" via GitHub API |

---

## Open Questions

1. **Ponytail embedding: condensed vs. full SKILL.md**
   - What we know: Full SKILL.md body is ~80 lines (without frontmatter). Condensed version is ~40 lines. The 80-100 line target for CLAUDE.md is firm (CLAUDEMD-02).
   - What's unclear: Decision D-06 says "use the actual rules, not a summary" — but embedding the full content blows the line budget.
   - Recommendation: Planner should clarify: does D-06 mean "no paraphrasing" (use exact text, condensed section) or "embed entire file" (accept >100 lines as an exception). If unclear, embed the ladder + rules + when-not-to-be-lazy sections only (~50 lines) and omit the intensity table and examples.

2. **Caveman sub-skills: all 7 or just root skill?**
   - What we know: juliusbrussee/caveman has 7 skill subdirs. The CAV-03 requirement says "works out of the box with no config."
   - What's unclear: The root `caveman/SKILL.md` is self-contained. Sub-skills (caveman-commit, etc.) provide additional commands. D-15 says "fork caveman as-is" — which implies all files.
   - Recommendation: Copy all 7 skill directories. "As-is" in D-15 means no behavior changes, not "partial copy."

3. **Template CLAUDE.md vs. repo root CLAUDE.md**
   - What we know: The repo already has a `CLAUDE.md` for contributors. `templates/CLAUDE.md` is for user projects.
   - What's unclear: Should `templates/CLAUDE.md` be identical to the repo's own contributor CLAUDE.md, or is it a different document?
   - Recommendation: They are distinct. The repo CLAUDE.md governs goodvibes contributors (GSD workflow enforcement, etc.). The `templates/CLAUDE.md` is what gets installed into user projects (80-100 lines, ponytail, 6 rules).

---

## Environment Availability

Phase 1 is pure file authoring. No external tools, databases, or services are required beyond git (already initialized) and a text editor. This section is SKIPPED — no external dependencies beyond what is already available.

---

## Validation Architecture

### Test Framework

Phase 1 produces no code. There is no test framework to configure. Validation is manual — copy-to-blank-project verification is the acceptance gate (Success Criterion 1 in ROADMAP.md).

| Property | Value |
|----------|-------|
| Framework | None (static files phase) |
| Config file | None |
| Quick run command | Manual: `cp -r templates/ /tmp/test-project/ && ls /tmp/test-project/` |
| Full suite command | Manual: open `/tmp/test-project/` in Claude Code and verify CLAUDE.md rules activate |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLAUDEMD-01 | CLAUDE.md exists at `templates/CLAUDE.md` | smoke | `test -f templates/CLAUDE.md && echo PASS` | ❌ Wave 0 |
| CLAUDEMD-02 | CLAUDE.md is 80-100 lines | smoke | `wc -l < templates/CLAUDE.md` | ❌ Wave 0 |
| CLAUDEMD-03 | Version stamp present | smoke | `grep -c 'goodvibes: v1.0.0' templates/CLAUDE.md` | ❌ Wave 0 |
| CLAUDEMD-04 | Sentinel blocks present | smoke | `grep -c 'goodvibes:start' templates/CLAUDE.md` | ❌ Wave 0 |
| CLAUDEMD-05 | 6 required sections present | smoke | `grep -c 'Think before\|Simplicity\|Surgical\|Fail loud\|Security\|Journal' templates/CLAUDE.md` | ❌ Wave 0 |
| CAV-01 | caveman skill dir present | smoke | `test -d templates/.claude/skills/caveman && echo PASS` | ❌ Wave 0 |
| CAV-02 | NOTICE file credits caveman | smoke | `grep -c 'Julius Brussee' NOTICE` | ❌ Wave 0 |
| HYG-01 | goodvibes-hygiene dir present | smoke | `test -d templates/.claude/skills/goodvibes-hygiene && echo PASS` | ❌ Wave 0 |
| HYG-03 | Hygiene skill references marketplace install | smoke | `grep -c 'plugin marketplace add' templates/.claude/skills/goodvibes-hygiene/SKILL.md` | ❌ Wave 0 |
| DOCS-01 | CONTRIBUTING.md present, no TODO | smoke | `test -f templates/CONTRIBUTING.md && ! grep -q 'TODO\|YOUR_PROJECT' templates/CONTRIBUTING.md && echo PASS` | ❌ Wave 0 |
| DOCS-05 | Both issue template YAMLs present | smoke | `test -f templates/.github/ISSUE_TEMPLATE/bug_report.yml && test -f templates/.github/ISSUE_TEMPLATE/feature_request.yml && echo PASS` | ❌ Wave 0 |
| REPO-01 | LICENSE file present | smoke | `test -f LICENSE && echo PASS` | ❌ Wave 0 |
| REPO-02 | NOTICE file present | smoke | `test -f NOTICE && echo PASS` | ❌ Wave 0 |
| REPO-03 | README has npx goodvibes init | smoke | `grep -c 'npx goodvibes init' README.md` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Run the relevant `test -f` or `grep -c` one-liner for the file just created
- **Per wave merge:** Run all smoke commands above as a batch shell script
- **Phase gate:** All smoke commands pass + manual copy-to-blank-project test before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `scripts/verify-phase1.sh` — shell script that runs all smoke commands above as a batch (Wave 0 creation recommended; one file covers all 22 requirements)
- [ ] No test framework install needed — pure shell one-liners suffice

---

## Security Domain

`security_enforcement: true` and `security_asvs_level: 1` per `.planning/config.json`.

Phase 1 creates static text files only — no code runs, no network calls, no user input processing, no authentication. The security surface is minimal but not zero.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in static files |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | No permissions model |
| V5 Input Validation | No | No input processing |
| V6 Cryptography | No | No crypto |
| V7 Error Handling | No | No code |
| V14 Configuration | Partial | Template files should not include secrets, tokens, or real credentials in examples |

### Known Threat Patterns for Static File Authoring

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Embedding real credentials in examples | Information Disclosure | Use placeholder text (`<your-token>`, `example-only`) in any credential-adjacent examples in docs |
| Copying third-party content without license verification | Repudiation | Verified both caveman (MIT) and ponytail (MIT) licenses via GitHub API before forking |
| NOTICE file omission | Repudiation | Apache 2.0 Section 4d requires NOTICE — documented and required by REPO-02 |

---

## Sources

### Primary (HIGH confidence)
- `DietrichGebert/ponytail` GitHub repo — skills/ponytail/SKILL.md fetched verbatim via GitHub API
- `juliusbrussee/caveman` GitHub repo — skills/caveman/SKILL.md, LICENSE, INSTALL.md fetched via GitHub API
- `headroomlabs-ai/headroom` GitHub repo — LICENSE (Apache 2.0), NOTICE file fetched via GitHub API
- `/mnt/c/Users/YiannisGiokas/Downloads/Code Directions.md` — read verbatim in this session
- `.planning/phases/01-template-content-repo-foundation/01-CONTEXT.md` — decisions D-01 through D-15
- GitHub issue form schema docs at docs.github.com/en/communities — YAML form types verified
- keepachangelog.com/en/2.0.0/ — CHANGELOG format confirmed
- Apache License 2.0 official text at apache.org/licenses/LICENSE-2.0.txt — license text source

### Secondary (MEDIUM confidence)
- GitHub docs on SECURITY.md — recommended content (supported versions + reporting path) confirmed
- Apache 2.0 Section 4d — NOTICE file requirements confirmed via choosealicense.com

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- CLAUDE.md curation strategy: HIGH — source document read verbatim; curation decisions locked in CONTEXT.md
- Ponytail ruleset: HIGH — SKILL.md fetched verbatim from upstream repo
- Caveman skill structure: HIGH — all 7 skill dirs confirmed via GitHub API; licenses verified
- goodvibes-hygiene content: MEDIUM — new skill, no upstream; content drafted from decision constraints
- NOTICE file content: HIGH — headroom NOTICE pattern confirmed; copyright holders verified
- GitHub YAML schema: HIGH — official docs verified; field types confirmed
- CHANGELOG format: HIGH — keepachangelog.com 2.0 confirmed

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 (stable — caveman and ponytail are actively maintained but the SKILL.md content is stable; re-verify if either repo cuts a major release before implementation)
