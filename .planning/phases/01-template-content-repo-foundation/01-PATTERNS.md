# Phase 1: Template Content & Repo Foundation - Pattern Map

**Mapped:** 2026-06-23
**Files analyzed:** 22 (all new — greenfield repo)
**Analogs found:** 0 in-codebase / 22 total (no source files exist yet)
**Pattern source:** RESEARCH.md verified content + GSD skill format from `~/.codex/skills/`

---

## Note on Greenfield Status

The GoodVibes repo contains exactly one source file: `/home/ygiokas/GoodVibes/CLAUDE.md`
(the contributor CLAUDE.md, not the template). There are no controllers, services, components,
or utilities to mine. All patterns below are sourced from:

1. **Verified external content** documented verbatim in RESEARCH.md (ponytail SKILL.md, caveman
   structure, GitHub issue YAML schema, NOTICE format, CHANGELOG format)
2. **GSD skill format** observed in `~/.codex/skills/gsd-health/SKILL.md` — the canonical SKILL.md
   format used in this ecosystem
3. **RESEARCH.md Code Examples** — all marked `[VERIFIED]` with source citations

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `templates/CLAUDE.md` | config | transform | RESEARCH.md §Pattern 1 (sentinel block) | research-pattern |
| `templates/.claude/skills/caveman/SKILL.md` | config | — | `~/.codex/skills/gsd-health/SKILL.md` | format-match |
| `templates/.claude/skills/caveman/README.md` | documentation | — | RESEARCH.md §Pattern 2 | research-pattern |
| `templates/.claude/skills/caveman-commit/SKILL.md` | config | — | `~/.codex/skills/gsd-health/SKILL.md` | format-match |
| `templates/.claude/skills/caveman-compress/SKILL.md` | config | — | `~/.codex/skills/gsd-health/SKILL.md` | format-match |
| `templates/.claude/skills/caveman-help/SKILL.md` | config | — | `~/.codex/skills/gsd-health/SKILL.md` | format-match |
| `templates/.claude/skills/caveman-review/SKILL.md` | config | — | `~/.codex/skills/gsd-health/SKILL.md` | format-match |
| `templates/.claude/skills/caveman-stats/SKILL.md` | config | — | `~/.codex/skills/gsd-health/SKILL.md` | format-match |
| `templates/.claude/skills/cavecrew/SKILL.md` | config | — | `~/.codex/skills/gsd-health/SKILL.md` | format-match |
| `templates/.claude/skills/goodvibes-hygiene/SKILL.md` | config | — | RESEARCH.md §Pattern 3 + gsd-health SKILL.md | research-pattern |
| `templates/CONTRIBUTING.md` | documentation | — | RESEARCH.md §DOCS-01 | research-pattern |
| `templates/SECURITY.md` | documentation | — | RESEARCH.md §DOCS-02 | research-pattern |
| `templates/JOURNAL.md` | documentation | — | RESEARCH.md §DOCS-03 | research-pattern |
| `templates/CHANGELOG.md` | documentation | — | RESEARCH.md §CHANGELOG format | research-pattern |
| `templates/docs/onboarding.md` | documentation | — | RESEARCH.md §DOCS-07 | research-pattern |
| `templates/.github/ISSUE_TEMPLATE/bug_report.yml` | config | — | RESEARCH.md §GitHub YAML schema | research-pattern |
| `templates/.github/ISSUE_TEMPLATE/feature_request.yml` | config | — | RESEARCH.md §GitHub YAML schema | research-pattern |
| `templates/.github/PULL_REQUEST_TEMPLATE.md` | documentation | — | RESEARCH.md §DOCS-06 | research-pattern |
| `LICENSE` | legal | — | apache.org/licenses/LICENSE-2.0.txt | authoritative-source |
| `NOTICE` | legal | — | RESEARCH.md §NOTICE pattern | research-pattern |
| `README.md` | documentation | — | RESEARCH.md §REPO-03 | research-pattern |
| `packages/npm/` | placeholder | — | n/a | no-analog |
| `packages/pip/` | placeholder | — | n/a | no-analog |
| `scripts/verify-phase1.sh` | utility | batch | RESEARCH.md §Validation Architecture | research-pattern |

---

## Pattern Assignments

### `templates/CLAUDE.md` (config, transform)

**Analog:** RESEARCH.md §Pattern 1 — Sentinel Block Structure (verified)

**Sentinel block pattern** (from RESEARCH.md lines 187-217):
```markdown
<!-- goodvibes:start -->
# goodvibes: v1.0.0

## Engineering Rules

### Before you begin
[rule text]

### Think before coding
[rule text + required behavior]

### Simplicity first
[rule text + required behavior]

### Surgical changes
[rule text + required behavior]

### Fail loud
[rule text + required behavior]

### Security
[rule text + required behavior]

### Journal
[rule text + required behavior]

## Ponytail — Minimalism Ruleset

[Full ponytail SKILL.md body embedded here]
<!-- goodvibes:end -->
```

**Curation map** (RESEARCH.md lines 537-558):

| Source Section | Action |
|----------------|--------|
| Before you begin | Keep bold statement + 5-bullet checklist |
| Think before coding | Bold statement + Required behavior bullets only |
| Simplicity first | Bold statement + Required behavior bullets only |
| Surgical changes | Bold statement + Required behavior bullets only |
| Fail loud | Bold statement + Required behavior bullets only |
| Security | Bold statement + Required behavior bullets + "Must flag immediately" list |
| Journal | Bold statement + Required behavior bullets only |
| Goal-driven execution | EXCLUDE (D-03) |
| ML drift monitoring | EXCLUDE (D-03) |
| Push to GitHub | EXCLUDE (D-03) |
| Deps current | EXCLUDE (D-03) |
| MD files current | EXCLUDE (D-03) |
| PR checklist | EXCLUDE (D-03) |
| Red flags | EXCLUDE (D-03) |

**Ponytail inline embed** (RESEARCH.md lines 419-469 — verified verbatim from DietrichGebert/ponytail):
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

**Critical constraints:**
- Total file must be 80-100 lines (CLAUDEMD-02). Ponytail embed above is ~50 lines. Curated rules
  sections must fit in the remaining ~48 lines including sentinel markers.
- Version stamp `# goodvibes: v1.0.0` must appear inside the sentinel block (CLAUDEMD-03).
- Sentinel open `<!-- goodvibes:start -->` and close `<!-- goodvibes:end -->` are machine-readable
  markers for Phase 5 upgrade logic — do not add user-instruction comments inside the block.
- Source document for rule content: `/mnt/c/Users/YiannisGiokas/Downloads/Code Directions.md`
  (read verbatim during research session). Implementer must read this file to extract the
  "Required behavior" bullets for each retained section.

---

### `templates/.claude/skills/caveman/SKILL.md` and all caveman sub-skills (config)

**Analog:** `juliusbrussee/caveman` GitHub repo (MIT license, verified) — fetch verbatim.
**Secondary format analog:** `/home/ygiokas/.codex/skills/gsd-health/SKILL.md` — YAML frontmatter pattern.

**SKILL.md format pattern** (from `~/.codex/skills/gsd-health/SKILL.md` lines 1-6):
```yaml
---
name: "skill-name"
description: "Short description of what this skill does"
metadata:
  short-description: "Same as description"
---
```

**Caveman copy instruction:**

Copy the following from `https://github.com/juliusbrussee/caveman` at path `skills/`:
- `skills/caveman/SKILL.md` → `templates/.claude/skills/caveman/SKILL.md`
- `skills/caveman/README.md` → `templates/.claude/skills/caveman/README.md`
- `skills/caveman-commit/SKILL.md` → `templates/.claude/skills/caveman-commit/SKILL.md`
- `skills/caveman-compress/SKILL.md` → `templates/.claude/skills/caveman-compress/SKILL.md`
- `skills/caveman-help/SKILL.md` → `templates/.claude/skills/caveman-help/SKILL.md`
- `skills/caveman-review/SKILL.md` → `templates/.claude/skills/caveman-review/SKILL.md`
- `skills/caveman-stats/SKILL.md` → `templates/.claude/skills/caveman-stats/SKILL.md`
- `skills/cavecrew/SKILL.md` → `templates/.claude/skills/cavecrew/SKILL.md`

**What NOT to copy** (RESEARCH.md lines 244-248):
- `.claude-plugin/` — plugin hooks (plugin.json + compiled JS). Skills only, not plugin infrastructure.
- `src/`, `bin/`, `dist/` — installer scripts.
- `AGENTS.md`, `GEMINI.md`, caveman's own `CLAUDE.md`.

**Attribution required:** caveman is MIT (Copyright 2026 Julius Brussee). Apache 2.0 Section 4d
requires crediting in the repo NOTICE file. The skill files themselves are not modified.

---

### `templates/.claude/skills/goodvibes-hygiene/SKILL.md` (config — new, handcrafted)

**Analog:** RESEARCH.md §Pattern 3 (lines 249-266) + gsd-health SKILL.md frontmatter format.

**Full skeleton** (RESEARCH.md lines 490-534 — marked [ASSUMED], implementer must review):
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

**Required content checklist** (HYG-02, HYG-03):
- `/plugin marketplace add DietrichGebert/ponytail` install command — must appear (HYG-03)
- `/ponytail-review` reference — must appear (HYG-02)
- `/ponytail-audit` reference — must appear (HYG-02)
- Explanation that ponytail is already always-on via CLAUDE.md — must appear (D-07)

---

### `templates/CONTRIBUTING.md` (documentation)

**Analog:** RESEARCH.md §DOCS-01 constraints (D-11, D-12).

**Content requirements:**
- Zero placeholders — no `[YOUR_PROJECT_NAME]`, no TODO (D-11)
- Git fork/branch/PR workflow for beginners (DOCS-01)
- Assume reader has never opened a terminal before (beginner-first constraint)
- Plain English throughout

**Structure pattern** (standard open-source CONTRIBUTING.md):
```markdown
# Contributing

[1-paragraph welcome]

## Before you start

[Prerequisites: git installed, GitHub account]

## How to contribute

### Fork the repository
[Step-by-step instructions with exact commands]

### Create a branch
[Branch naming, exact git commands]

### Make your changes
[Editor-agnostic instructions]

### Open a pull request
[Step-by-step with screenshots or exact UI labels]

## Code style

[Brief note — defer to CLAUDE.md rules]

## Questions?

[Where to ask — GitHub Discussions or Issues]
```

---

### `templates/SECURITY.md` (documentation)

**Analog:** RESEARCH.md §DOCS-02 — GitHub private vulnerability reporting.

**Content requirements** (GitHub standard):
```markdown
# Security Policy

## Supported Versions

[Table of supported versions — for v1.0.0, just the current release]

## Reporting a Vulnerability

Do NOT open a public GitHub issue for security vulnerabilities.

Use GitHub's private vulnerability reporting:
[Link to Security tab → Report a vulnerability]

[What to include in the report]
[Expected response timeline]
```

---

### `templates/JOURNAL.md` (documentation)

**Analog:** RESEARCH.md §DOCS-03.

**Format pattern** (from RESEARCH.md):
```markdown
# Journal

[1-sentence description of what this file is for]

## Template

### YYYY-MM-DD

**What I did:**
[Bullet list]

**What I learned:**
[Bullet list]

**Next session:**
[1-3 bullet points]

---

## Example Entry

### 2026-06-23

**What I did:**
- Set up the project with goodvibes init
- Wrote the first version of the main feature

**What I learned:**
- [example learning]

**Next session:**
- [example next step]
```

---

### `templates/CHANGELOG.md` (documentation)

**Analog:** Keep a Changelog 2.0 format (keepachangelog.com — verified, RESEARCH.md lines 562-580).

**Exact pattern** (RESEARCH.md lines 564-579):
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

---

### `templates/docs/onboarding.md` (documentation)

**Analog:** RESEARCH.md §DOCS-07, D-12.

**Content constraints** (D-12):
- Scope: git basics + PR workflow only
- Target length: 400-600 words
- Covers: fork vs clone, creating a branch, making a commit, opening a PR
- Does NOT explain CI (out of scope for Phase 1)
- Tone: plain English, assume no prior git knowledge

**Structure pattern:**
```markdown
# Getting Started with Git and Pull Requests

[1-paragraph intro — what git is in plain English]

## Fork vs Clone

[Explain the difference in 2-3 sentences with analogy]

## Creating a Branch

[What a branch is + exact git commands]

## Making a Commit

[What staging and committing mean + exact commands]

## Opening a Pull Request

[Step-by-step GitHub UI walkthrough]
```

---

### `templates/.github/ISSUE_TEMPLATE/bug_report.yml` (config)

**Analog:** GitHub form schema (docs.github.com — verified, RESEARCH.md lines 358-411).

**Full verified pattern** (RESEARCH.md lines 360-411):
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

**Valid field types** (RESEARCH.md lines 299-301): `markdown`, `textarea`, `input`, `dropdown`,
`checkboxes`, `upload`. Do NOT use `type: text` — it is invalid and produces blank forms.

---

### `templates/.github/ISSUE_TEMPLATE/feature_request.yml` (config)

**Analog:** Same GitHub YAML schema as bug_report.yml. Adapt field labels:
- "What problem does this solve?" (textarea, required)
- "Describe the solution you'd like" (textarea, required)
- "Alternatives you've considered" (textarea, optional)
- "Additional context" (textarea, optional)

Use `labels: ["enhancement"]` instead of `["bug", "triage"]`.

---

### `templates/.github/PULL_REQUEST_TEMPLATE.md` (documentation)

**Analog:** RESEARCH.md §DOCS-06 — standard PR checklist pattern.

**Structure pattern:**
```markdown
## Description

[What does this PR do?]

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Other: ___

## Checklist

- [ ] I have tested my changes
- [ ] I have updated the CHANGELOG.md (if applicable)
- [ ] I have updated docs (if applicable)
- [ ] My changes follow the coding style in CLAUDE.md
```

---

### `LICENSE` (legal — repo root)

**Analog:** Official Apache 2.0 license text from `https://www.apache.org/licenses/LICENSE-2.0.txt`

**Critical rule:** Fetch the official text verbatim. Do not write from memory. Any deviation creates
legal ambiguity (RESEARCH.md §Don't Hand-Roll). The copyright line at the top:
```
Copyright 2026 Ioannis Giokas (jgiox)
```

---

### `NOTICE` (legal — repo root)

**Analog:** RESEARCH.md §NOTICE file pattern (lines 327-356 — verified against Apache 2.0 Section 4d
and headroom NOTICE file via GitHub API).

**Exact pattern** (RESEARCH.md lines 329-354):
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

**Requirement check:** NOTICE must contain "Julius Brussee" (CAV-02 smoke test:
`grep -c 'Julius Brussee' NOTICE`).

---

### `README.md` (documentation — repo root)

**Analog:** RESEARCH.md §REPO-03, D-14.

**Hero command must be first visible element** (REPO-03 smoke test: `grep -c 'npx goodvibes init' README.md`):

**Structure pattern:**
```markdown
# goodvibes

```sh
npx goodvibes init
```

[One-paragraph "what it does" description]

## How it works

goodvibes installs four layers into your project:

- **caveman** — compresses Claude's output tokens so you get more done per context window
- **headroom** — compresses input tokens by summarizing what Claude reads
- **ponytail** — keeps your code minimal (enforced via CLAUDE.md on every session)
- **CLAUDE.md rules** — engineering discipline: think before coding, simplicity first,
  fail loud, security basics, keep a journal

## Docs

- [onboarding.md](docs/onboarding.md) — git and PR basics for beginners
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [CHANGELOG.md](CHANGELOG.md)
```

---

### `packages/npm/` and `packages/pip/` (placeholder directories)

**Analog:** None — empty placeholder directories only (D-10).

**Implementation:** Create a `.gitkeep` file in each so git tracks the directory:
- `packages/npm/.gitkeep`
- `packages/pip/.gitkeep`

---

### `scripts/verify-phase1.sh` (utility — batch validation)

**Analog:** RESEARCH.md §Validation Architecture, Wave 0 Gaps (lines 675-677).

**Pattern** (shell one-liners from RESEARCH.md lines 651-666):
```bash
#!/usr/bin/env bash
set -e

pass=0; fail=0

check() {
  if eval "$2" > /dev/null 2>&1; then
    echo "PASS [$1]"
    ((pass++))
  else
    echo "FAIL [$1]: $2"
    ((fail++))
  fi
}

check "CLAUDEMD-01" "test -f templates/CLAUDE.md"
check "CLAUDEMD-02" "[ $(wc -l < templates/CLAUDE.md) -le 100 ] && [ $(wc -l < templates/CLAUDE.md) -ge 80 ]"
check "CLAUDEMD-03" "grep -q 'goodvibes: v1.0.0' templates/CLAUDE.md"
check "CLAUDEMD-04" "grep -q 'goodvibes:start' templates/CLAUDE.md"
check "CLAUDEMD-05" "grep -q 'Think before' templates/CLAUDE.md && grep -q 'Simplicity' templates/CLAUDE.md"
check "CAV-01"      "test -d templates/.claude/skills/caveman"
check "CAV-02"      "grep -q 'Julius Brussee' NOTICE"
check "HYG-01"      "test -d templates/.claude/skills/goodvibes-hygiene"
check "HYG-03"      "grep -q 'plugin marketplace add' templates/.claude/skills/goodvibes-hygiene/SKILL.md"
check "DOCS-01"     "test -f templates/CONTRIBUTING.md && ! grep -q 'TODO\|YOUR_PROJECT' templates/CONTRIBUTING.md"
check "DOCS-02"     "test -f templates/SECURITY.md"
check "DOCS-03"     "test -f templates/JOURNAL.md"
check "DOCS-04"     "test -f templates/CHANGELOG.md"
check "DOCS-05"     "test -f templates/.github/ISSUE_TEMPLATE/bug_report.yml && test -f templates/.github/ISSUE_TEMPLATE/feature_request.yml"
check "DOCS-06"     "test -f templates/.github/PULL_REQUEST_TEMPLATE.md"
check "DOCS-07"     "test -f templates/docs/onboarding.md"
check "REPO-01"     "test -f LICENSE"
check "REPO-02"     "test -f NOTICE"
check "REPO-03"     "grep -q 'npx goodvibes init' README.md"

echo ""
echo "Results: $pass passed, $fail failed"
[ $fail -eq 0 ] && echo "Phase 1 gate: PASS" || { echo "Phase 1 gate: FAIL"; exit 1; }
```

---

## Shared Patterns

### No Placeholders Rule (applies to all documentation files)

**Source:** Decision D-11 — prohibits `[YOUR_PROJECT_NAME]`, TODO, and stub text.
**Apply to:** `templates/CONTRIBUTING.md`, `templates/SECURITY.md`, `templates/JOURNAL.md`,
`templates/CHANGELOG.md`, `templates/docs/onboarding.md`, `templates/.github/PULL_REQUEST_TEMPLATE.md`

Every documentation file must be complete and readable for a generic project on day one.
Smoke test: `! grep -q 'TODO\|YOUR_PROJECT\|\[PROJECT\]' <file>`.

### Beginner-First Tone (applies to all user-facing documentation)

**Source:** CLAUDE.md project constraint "Beginner-first" + D-11.
**Apply to:** All docs files and README.md.

- Assume reader has never opened a terminal before
- Spell out exact commands in code blocks
- Avoid jargon without inline explanation
- No references to CI workflows in Phase 1 docs (deferred to Phase 4)

### Apache 2.0 Attribution (applies to LICENSE and NOTICE)

**Source:** RESEARCH.md §Pitfall 4, §NOTICE pattern.
**Apply to:** `LICENSE`, `NOTICE`

- `LICENSE` = verbatim Apache 2.0 text from apache.org (fetch, do not write from memory)
- `NOTICE` = credits goodvibes, caveman (MIT), ponytail (MIT), headroom (Apache 2.0)
- Apache 2.0 Section 4d mandates NOTICE file — omission is a compliance gap

### GitHub YAML Field Types (applies to issue templates)

**Source:** RESEARCH.md §Pitfall 3.
**Apply to:** `templates/.github/ISSUE_TEMPLATE/bug_report.yml`,
`templates/.github/ISSUE_TEMPLATE/feature_request.yml`

Valid types only: `markdown`, `textarea`, `input`, `dropdown`, `checkboxes`, `upload`.
Never use `type: text` — invalid, produces blank forms silently.

---

## No Analog Found (in-codebase)

All 22 files have no in-codebase analog. This is a greenfield project. The table below
records the pattern source used instead for each category:

| File(s) | Role | Pattern Source | Notes |
|---------|------|----------------|-------|
| `templates/CLAUDE.md` | config | RESEARCH.md §Pattern 1 + Code Directions.md | Implementer must read Code Directions.md at `/mnt/c/Users/YiannisGiokas/Downloads/Code Directions.md` |
| Caveman SKILL.md files (7) | config | juliusbrussee/caveman GitHub — copy verbatim | MIT license verified; fetch from upstream |
| `templates/.claude/skills/goodvibes-hygiene/SKILL.md` | config | RESEARCH.md §Pattern 3 skeleton | Marked [ASSUMED]; content is new/handcrafted |
| All docs files | documentation | RESEARCH.md §DOCS-* constraints | No-placeholder rule is cross-cutting |
| Issue template YAMLs | config | GitHub form schema (docs.github.com verified) | Use verified type names only |
| `LICENSE` | legal | apache.org/licenses/LICENSE-2.0.txt | Fetch verbatim, do not author |
| `NOTICE` | legal | RESEARCH.md §NOTICE pattern (verified) | Must credit caveman, ponytail, headroom |
| `README.md` | documentation | RESEARCH.md §REPO-03 + D-14 | Hero command must be first element |
| `packages/npm/`, `packages/pip/` | placeholder | n/a — empty dirs | .gitkeep only |
| `scripts/verify-phase1.sh` | utility | RESEARCH.md §Validation Architecture | Shell one-liners; no test framework |

---

## Metadata

**Analog search scope:** `/home/ygiokas/GoodVibes/` (full repo), `/home/ygiokas/.codex/skills/` (GSD skills)
**Files scanned:** 1 source file in repo (`CLAUDE.md`), 20+ GSD skill SKILL.md files for format reference
**Pattern extraction date:** 2026-06-23
**Greenfield note:** Patterns are sourced entirely from RESEARCH.md verified content and the GSD
skill SKILL.md format. The planner should treat RESEARCH.md §Code Examples as the authoritative
copy-from source for this phase, in place of in-codebase analogs.
