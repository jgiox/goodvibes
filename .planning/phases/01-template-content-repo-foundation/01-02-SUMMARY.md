---
phase: 01-template-content-repo-foundation
plan: 02
subsystem: templates
tags: [caveman, ponytail, claude-skills, token-compression, code-minimalism]

# Dependency graph
requires:
  - phase: 01-template-content-repo-foundation
    plan: 01
    provides: "templates/CLAUDE.md with ponytail ruleset embedded"
provides:
  - "templates/.claude/skills/caveman/ — root skill (SKILL.md + README.md) forked verbatim from juliusbrussee/caveman"
  - "templates/.claude/skills/caveman-commit/ — commit message generator skill"
  - "templates/.claude/skills/caveman-compress/ — memory file compressor skill"
  - "templates/.claude/skills/caveman-help/ — quick reference card skill"
  - "templates/.claude/skills/caveman-review/ — code review skill"
  - "templates/.claude/skills/caveman-stats/ — token usage stats skill"
  - "templates/.claude/skills/cavecrew/ — multi-agent delegation guide (SKILL.md + README.md)"
  - "templates/.claude/skills/goodvibes-hygiene/ — new on-demand ponytail audit skill"
affects:
  - "02-npm-cli"
  - "03-pip-cli"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SKILL.md YAML frontmatter pattern with name, description, trigger phrases"
    - "Verbatim fork pattern: fetch from raw.githubusercontent.com, write unchanged"

key-files:
  created:
    - "templates/.claude/skills/caveman/SKILL.md"
    - "templates/.claude/skills/caveman/README.md"
    - "templates/.claude/skills/caveman-commit/SKILL.md"
    - "templates/.claude/skills/caveman-compress/SKILL.md"
    - "templates/.claude/skills/caveman-help/SKILL.md"
    - "templates/.claude/skills/caveman-review/SKILL.md"
    - "templates/.claude/skills/caveman-stats/SKILL.md"
    - "templates/.claude/skills/cavecrew/SKILL.md"
    - "templates/.claude/skills/cavecrew/README.md"
    - "templates/.claude/skills/goodvibes-hygiene/SKILL.md"
  modified: []

key-decisions:
  - "Fork caveman verbatim (D-15): fetch from raw.githubusercontent.com/juliusbrussee/caveman, no behavior changes, MIT attribution to follow in NOTICE file (Plan 03)"
  - "goodvibes-hygiene wraps /ponytail-review and /ponytail-audit for explicit invocation; does NOT duplicate ponytail ruleset (D-07: that lives in templates/CLAUDE.md)"
  - "cavecrew README.md included because it exists in upstream repo (bonus beyond plan spec)"

patterns-established:
  - "Skill fork pattern: skills/ subdirs only, no .claude-plugin/, plugin.json, or .js files"
  - "SKILL.md YAML frontmatter: name, description with trigger phrases in description field"
  - "Handcrafted skill pattern: frontmatter + Setup section + Commands section + always-on explanation"

requirements-completed:
  - CAV-01
  - CAV-02
  - CAV-03
  - HYG-01
  - HYG-02
  - HYG-03

# Metrics
duration: 15min
completed: 2026-06-23
---

# Phase 01 Plan 02: Caveman Skill Fork & goodvibes-hygiene Authoring Summary

**8 caveman/cavecrew skill files forked verbatim from juliusbrussee/caveman (MIT), plus new goodvibes-hygiene skill wrapping /ponytail-review and /ponytail-audit for on-demand minimalism audits**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-23T11:17:00Z
- **Completed:** 2026-06-23T11:32:03Z
- **Tasks:** 2
- **Files modified:** 10 created

## Accomplishments

- Forked 9 files from juliusbrussee/caveman (SKILL.md root + README.md + 5 sub-skill SKILL.md files + cavecrew SKILL.md + cavecrew README.md) — all verbatim, no modification
- Verified no plugin infrastructure leaked (.claude-plugin/, plugin.json, .js files) — skills only
- Authored new goodvibes-hygiene/SKILL.md with YAML frontmatter, Setup section containing `/plugin marketplace add DietrichGebert/ponytail`, Commands section with /ponytail-review and /ponytail-audit, and always-on explanation per D-07

## Task Commits

1. **Task 1: Fork caveman skill (8 files) from juliusbrussee/caveman** - `2aee8c0` (feat)
2. **Task 2: Author goodvibes-hygiene/SKILL.md** - `04b21be` (feat)

## Files Created/Modified

- `templates/.claude/skills/caveman/SKILL.md` — Root caveman skill: 6 intensity modes, auto-clarity rules, persistence rules
- `templates/.claude/skills/caveman/README.md` — Human-readable quick-start for caveman
- `templates/.claude/skills/caveman-commit/SKILL.md` — Conventional Commits terse message generator
- `templates/.claude/skills/caveman-compress/SKILL.md` — Memory file compressor (CLAUDE.md, todos)
- `templates/.claude/skills/caveman-help/SKILL.md` — Quick-reference card for all caveman commands
- `templates/.claude/skills/caveman-review/SKILL.md` — One-line code review comment generator
- `templates/.claude/skills/caveman-stats/SKILL.md` — Token usage stats (delivered by hook)
- `templates/.claude/skills/cavecrew/SKILL.md` — Multi-agent delegation decision guide
- `templates/.claude/skills/cavecrew/README.md` — Human-readable quick-start for cavecrew
- `templates/.claude/skills/goodvibes-hygiene/SKILL.md` — New handcrafted skill: ponytail on-demand audit wrapper

## Decisions Made

- Forked caveman verbatim per D-15 — no behavior changes, NOTICE attribution deferred to Plan 03
- Included cavecrew README.md (existed in upstream) as bonus beyond plan spec — no harm, more completeness
- goodvibes-hygiene does NOT duplicate ponytail ruleset (per D-07): the ruleset is already embedded in templates/CLAUDE.md for always-on enforcement; this skill only surfaces the explicit audit commands

## Deviations from Plan

None - plan executed exactly as written. The cavecrew README.md was included because the plan says "If the cavecrew directory has a README.md as well, fetch and copy it too" — this was explicitly covered.

## Issues Encountered

None. All 8 upstream files fetched successfully from raw.githubusercontent.com on first attempt. Content integrity verified: no plugin.json or .js files in fetched content.

## Known Stubs

None. The caveman skill files are verbatim from upstream (complete, no stubs). The goodvibes-hygiene skill is complete and functional as authored.

## Threat Flags

None new beyond the plan's threat register. Content is static markdown. No credentials, tokens, or PII. No new network endpoints or auth paths introduced.

## User Setup Required

None for this plan. Users who want the on-demand audit commands will follow the Setup section in goodvibes-hygiene/SKILL.md to install the ponytail plugin.

## Next Phase Readiness

- Plan 03 (docs scaffolding + LICENSE + NOTICE) can proceed; NOTICE must credit "Julius Brussee" per Apache 2.0 Section 4d for the bundled caveman MIT code
- The templates/.claude/skills/ directory layout is now established — npm CLI (Phase 2) and pip CLI (Phase 3) can copy this directory structure verbatim

## Self-Check: PASSED

All 10 created files confirmed to exist. Both commits confirmed in git log.

---
*Phase: 01-template-content-repo-foundation*
*Completed: 2026-06-23*
