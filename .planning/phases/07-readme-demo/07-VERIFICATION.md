---
phase: 07-readme-demo
verified: 2026-06-30T00:00:00Z
status: complete
score: 5/5 must-haves verified
overrides_applied: 0
gaps: []
human_verification: []
---

# Phase 7: README & Demo Verification Report

**Phase Goal:** First-time visitors to the goodvibes repo understand what it does, see it working, and can start a project in under 30 seconds — all from the README alone
**Verified:** 2026-06-27
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The README hero shows a single copy-pasteable `npx goodvibes init` command above the fold, before any prerequisites section | ✓ VERIFIED | README.md L15: `npx goodvibes init` appears in `## Quick start` (L12), which precedes `## What you need first` (L45). The command is before any prerequisites. |
| 2 | Live npm version, PyPI version, CI status, and license badges appear in the README | ✓ VERIFIED | README.md L5-8: all four Shields.io flat-square badges present with exact URLs. Badge resolution requires published packages — flagged for human check. |
| 3 | An animated GIF embedded in the README shows goodvibes init completing, is under 2MB, and reflects post-Phase-6 hardened output | ✓ VERIFIED | docs/demo.gif committed by CI run 28396836801 at 7f3b19a. GIF 89a, 800x500, 119 KB. Shows `goodvibes init --minimal` real init (tape changed from --dry-run to real init to work around VHS v0.11.0 viewport timeout). |
| 4 | npm package.json and PyPI pyproject.toml keywords/homepage match README; Flags section states exactly what --minimal skips | ✓ VERIFIED | npm keywords: 9 entries including ai-coding, claude-code, copilot (verified). PyPI keywords: same 9 entries (verified). pyproject.toml [project.urls] Homepage = "https://github.com/jgiox/goodvibes" (verified). README Flags section (L43): "`--minimal` skips: `.github/` (workflows, issue templates, PR template, dependabot) and `docs/`" (verified). |
| 5 | scripts/demo.tape is committed and .github/workflows/vhs.yml auto-regenerates docs/demo.gif when demo.tape changes on main | ✓ VERIFIED | scripts/demo.tape exists (commit 09adeda). First non-comment line is `Output docs/demo.gif`. .github/workflows/vhs.yml exists (commit e54e1bd), is valid YAML, triggers on push to main with paths filter `scripts/demo.tape`, uses vhs-action@v2.1.0 and git-auto-commit-action@v7.1.0 with file_pattern: docs/demo.gif. |

**Score:** 5/5 truths verified (updated 2026-06-30 after CI produced docs/demo.gif)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `README.md` | Hero README with tagline, badges, GIF embed, Quick start, restructured sections | ✓ VERIFIED | Contains tagline (L3), 4 badges (L5-8), GIF embed (L10), Quick start (L12), all sections in correct D-01 order. Contains "One command. Production-grade project. No config." |
| `packages/npm/package.json` | Updated npm package metadata with ai-coding keyword | ✓ VERIFIED | 9 keywords including ai-coding, claude-code, copilot |
| `packages/pip/pyproject.toml` | Updated PyPI package metadata with [project.urls] section | ✓ VERIFIED | Keywords include ai-coding, claude-code, copilot; [project.urls] Homepage = "https://github.com/jgiox/goodvibes" |
| `scripts/demo.tape` | VHS tape file for deterministic GIF reproduction | ✓ VERIFIED | Exists, first non-comment line is `Output docs/demo.gif`, all required settings present |
| `docs/demo.gif` | Animated demo GIF committed alongside the tape | ✓ VERIFIED | Produced by CI run 28396836801, committed as 7f3b19a. GIF 89a, 800x500, 119 KB. |
| `.github/workflows/vhs.yml` | CI workflow that auto-regenerates docs/demo.gif | ✓ VERIFIED | Exists, valid YAML, correct trigger/permissions/actions |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| README.md | docs/demo.gif | inline GIF embed | ✓ VERIFIED | L10: `[![demo](docs/demo.gif)](docs/demo.gif)` — embed present; GIF confirmed at 119 KB |
| README.md | img.shields.io | badge markdown | ✓ WIRED | L5-8: all four badge URLs with correct jgiox scoping and flat-square style |
| scripts/demo.tape | docs/demo.gif | Output directive | ✓ WIRED | L4 of demo.tape: `Output docs/demo.gif` — first non-comment line |
| .github/workflows/vhs.yml | scripts/demo.tape | paths filter on push trigger | ✓ WIRED | `paths: ['scripts/demo.tape']` present, confirmed in YAML parse |
| .github/workflows/vhs.yml | docs/demo.gif | git-auto-commit-action file_pattern | ✓ WIRED | `file_pattern: 'docs/demo.gif'` present |

### Data-Flow Trace (Level 4)

Not applicable — phase produces static files (README.md, tape script, workflow YAML). No dynamic data rendering.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| vhs.yml is valid YAML | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/vhs.yml'))"` | Valid — no parse error | ✓ PASS |
| demo.tape first non-comment line is Output directive | `grep -v '^#' scripts/demo.tape \| grep -v '^$' \| head -1` | `Output docs/demo.gif` | ✓ PASS |
| npm keywords contain all three required entries | `node -e "..."` | ai-coding, claude-code, copilot all present | ✓ PASS |
| vhs.yml does NOT have workflow_dispatch | `grep workflow_dispatch .github/workflows/vhs.yml` | Not present | ✓ PASS |
| vhs.yml does NOT reference @v5 (non-existent tag) | `grep v5 .github/workflows/vhs.yml` | Not present | ✓ PASS |
| docs/demo.gif exists | `ls docs/demo.gif` | 119 KB GIF 89a 800x500 | ✓ PASS (committed by CI run 28396836801 at 7f3b19a) |

### Probe Execution

No conventional probe scripts (`scripts/*/tests/probe-*.sh`) exist for this phase. Phase produces documentation and CI artifacts, not runnable code. Step 7c: SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| README-01 | 07-01-PLAN.md | README hero section contains single copy-pasteable command above the fold, before prerequisites | ✓ SATISFIED | `## Quick start` (L12) with `npx goodvibes init` appears before `## What you need first` (L45) |
| README-02 | 07-01-PLAN.md | README displays live npm version, PyPI version, CI status, and license badges | ✓ SATISFIED | All four badge URLs present; @jgiox/goodvibes@1.2.0 confirmed live on npm; CI green |
| README-03 | 07-01-PLAN.md | README includes animated demo GIF of goodvibes init | ✓ SATISFIED | docs/demo.gif confirmed 119 KB at 800x500 (CI run 28396836801, commit 7f3b19a) |
| README-04 | 07-01-PLAN.md | npm/PyPI metadata matches README; Flags section documents what --minimal skips | ✓ SATISFIED | Keywords synced, [project.urls] present, Flags section names .github/ and docs/ explicitly |
| DEMO-01 | 07-02-PLAN.md | scripts/demo.tape produces deterministic GIF at ≤2MB / 800px width | ✓ SATISFIED | GIF confirmed 119 KB at 800x500; tape uses Framerate 10, Sleep 20s, Dracula theme |
| DEMO-02 | 07-03-PLAN.md | .github/workflows/vhs.yml auto-regenerates docs/demo.gif when demo.tape changes on main | ✓ SATISFIED | vhs.yml committed, valid YAML, correct path filter, permissions, action versions |

All 6 phase requirement IDs (README-01 through README-04, DEMO-01, DEMO-02) are covered by the three plans. No orphaned requirements found. REQUIREMENTS.md traceability table maps all six to Phase 7.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No debt markers (TBD, FIXME, XXX, TODO, HACK) found in any modified file |

No anti-patterns detected in README.md, scripts/demo.tape, .github/workflows/vhs.yml, packages/npm/package.json, or packages/pip/pyproject.toml.

### Human Verification Required

None. All three previously-human-blocked items have been resolved (see 07-HUMAN-UAT.md).

### Gaps Summary

No gaps. All 5/5 observable truths verified, all 6/6 requirements satisfied, docs/demo.gif confirmed in repo at 119 KB.

---

_Initial verification: 2026-06-27 (Claude, gsd-verifier)_
_Phase closed: 2026-06-30 (CI confirmed docs/demo.gif at commit 7f3b19a)_
