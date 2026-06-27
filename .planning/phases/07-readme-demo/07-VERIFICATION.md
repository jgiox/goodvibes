---
phase: 07-readme-demo
verified: 2026-06-27T00:00:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
gaps: []
human_verification:
  - test: "Confirm docs/demo.gif is produced by CI and committed to the repo"
    expected: "After the first push that touches scripts/demo.tape lands on main, the vhs.yml workflow runs and commits docs/demo.gif; the file is under 2MB; it shows a dark Dracula terminal with npx goodvibes init --minimal --dry-run being typed and the written/skipped completion summary visible"
    why_human: "docs/demo.gif does not exist in the working tree — it is intentionally deferred to CI (Option B). Cannot verify GIF content, size, or visual correctness without the CI run completing and the file being committed back."
  - test: "Confirm the npx command in README.md works for first-time visitors"
    expected: "Running `npx goodvibes init` resolves to the @jgiox/goodvibes package. Because npm maps scoped packages, visitors can run either `npx @jgiox/goodvibes init` (the technically correct form) or `npx goodvibes init` only if a top-level `goodvibes` package does not conflict. Verify that `npx goodvibes init` actually invokes @jgiox/goodvibes and not an unrelated package, or update the README command to `npx @jgiox/goodvibes init`."
    why_human: "The package is published as @jgiox/goodvibes (scoped). `npx goodvibes init` works only if there is no conflicting unscoped package named `goodvibes` on npm. This requires a live npm registry check or a test publish — cannot verify programmatically from the repo alone."
  - test: "Confirm the four Shields.io badges resolve to non-error state"
    expected: "All four badges (npm version, PyPI version, CI status, license) display correctly — no gray 'error' shields. This requires the npm package to be published as @jgiox/goodvibes and the PyPI package to be published as jgiox-goodvibes."
    why_human: "Badge resolution depends on live npm and PyPI registry state. Cannot verify without actual published packages or a browser check."
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
| 3 | An animated GIF embedded in the README shows goodvibes init completing, is under 2MB, and reflects post-Phase-6 hardened output | ? UNCERTAIN | README.md L10: `[![demo](docs/demo.gif)](docs/demo.gif)` embed is present. However, `docs/demo.gif` does NOT exist in the working tree. Per documented Option B, the GIF will be produced by CI (vhs.yml) on first push. The tape is configured correctly (see SC5 below) but the GIF itself cannot be verified until CI runs. |
| 4 | npm package.json and PyPI pyproject.toml keywords/homepage match README; Flags section states exactly what --minimal skips | ✓ VERIFIED | npm keywords: 9 entries including ai-coding, claude-code, copilot (verified). PyPI keywords: same 9 entries (verified). pyproject.toml [project.urls] Homepage = "https://github.com/jgiox/goodvibes" (verified). README Flags section (L43): "`--minimal` skips: `.github/` (workflows, issue templates, PR template, dependabot) and `docs/`" (verified). |
| 5 | scripts/demo.tape is committed and .github/workflows/vhs.yml auto-regenerates docs/demo.gif when demo.tape changes on main | ✓ VERIFIED | scripts/demo.tape exists (commit 09adeda). First non-comment line is `Output docs/demo.gif`. .github/workflows/vhs.yml exists (commit e54e1bd), is valid YAML, triggers on push to main with paths filter `scripts/demo.tape`, uses vhs-action@v2.1.0 and git-auto-commit-action@v7.1.0 with file_pattern: docs/demo.gif. |

**Score:** 4/5 truths verified (1 uncertain — docs/demo.gif pending CI)

### Deferred Items

No items were filtered to deferred (docs/demo.gif absence is flagged as human_needed, not deferred — it must be verified before the phase can be considered complete).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `README.md` | Hero README with tagline, badges, GIF embed, Quick start, restructured sections | ✓ VERIFIED | Contains tagline (L3), 4 badges (L5-8), GIF embed (L10), Quick start (L12), all sections in correct D-01 order. Contains "One command. Production-grade project. No config." |
| `packages/npm/package.json` | Updated npm package metadata with ai-coding keyword | ✓ VERIFIED | 9 keywords including ai-coding, claude-code, copilot |
| `packages/pip/pyproject.toml` | Updated PyPI package metadata with [project.urls] section | ✓ VERIFIED | Keywords include ai-coding, claude-code, copilot; [project.urls] Homepage = "https://github.com/jgiox/goodvibes" |
| `scripts/demo.tape` | VHS tape file for deterministic GIF reproduction | ✓ VERIFIED | Exists, first non-comment line is `Output docs/demo.gif`, all required settings present |
| `docs/demo.gif` | Animated demo GIF committed alongside the tape | ✗ MISSING | Does not exist in working tree — intentionally deferred to CI (Option B). Will be produced by vhs.yml on first push touching scripts/demo.tape. |
| `.github/workflows/vhs.yml` | CI workflow that auto-regenerates docs/demo.gif | ✓ VERIFIED | Exists, valid YAML, correct trigger/permissions/actions |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| README.md | docs/demo.gif | inline GIF embed | ✓ WIRED | L10: `[![demo](docs/demo.gif)](docs/demo.gif)` — embed present; GIF file absent (pending CI) |
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
| docs/demo.gif exists | `ls docs/demo.gif` | NOT FOUND | ? SKIP (pending CI — intentional per Option B) |

### Probe Execution

No conventional probe scripts (`scripts/*/tests/probe-*.sh`) exist for this phase. Phase produces documentation and CI artifacts, not runnable code. Step 7c: SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| README-01 | 07-01-PLAN.md | README hero section contains single copy-pasteable command above the fold, before prerequisites | ✓ SATISFIED | `## Quick start` (L12) with `npx goodvibes init` appears before `## What you need first` (L45) |
| README-02 | 07-01-PLAN.md | README displays live npm version, PyPI version, CI status, and license badges | ✓ SATISFIED (code) / ? HUMAN (live) | All four badge URLs present in README; live resolution requires published packages |
| README-03 | 07-01-PLAN.md | README includes animated demo GIF of goodvibes init | ? NEEDS HUMAN | GIF embed present in README (L10) but docs/demo.gif does not yet exist — pending CI |
| README-04 | 07-01-PLAN.md | npm/PyPI metadata matches README; Flags section documents what --minimal skips | ✓ SATISFIED | Keywords synced, [project.urls] present, Flags section names .github/ and docs/ explicitly |
| DEMO-01 | 07-02-PLAN.md | scripts/demo.tape produces deterministic GIF at ≤2MB / 800px width | ✓ SATISFIED (tape) / ? HUMAN (GIF) | Tape exists with Width 800, Framerate 24, Dracula theme, correct commands; GIF pending CI |
| DEMO-02 | 07-03-PLAN.md | .github/workflows/vhs.yml auto-regenerates docs/demo.gif when demo.tape changes on main | ✓ SATISFIED | vhs.yml committed, valid YAML, correct path filter, permissions, action versions |

All 6 phase requirement IDs (README-01 through README-04, DEMO-01, DEMO-02) are covered by the three plans. No orphaned requirements found. REQUIREMENTS.md traceability table maps all six to Phase 7.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No debt markers (TBD, FIXME, XXX, TODO, HACK) found in any modified file |

No anti-patterns detected in README.md, scripts/demo.tape, .github/workflows/vhs.yml, packages/npm/package.json, or packages/pip/pyproject.toml.

### Human Verification Required

#### 1. docs/demo.gif Existence and Content

**Test:** After the first push that changes `scripts/demo.tape` reaches main, confirm the vhs.yml CI workflow runs successfully and commits `docs/demo.gif` back to the repo.
**Expected:**
- `ls -lh docs/demo.gif` shows the file exists
- `wc -c < docs/demo.gif` reports < 2,097,152 bytes (under 2MB)
- Opening the GIF confirms: dark Dracula terminal theme, 800px approximate width, `npx goodvibes init --minimal --dry-run` command typed on screen, no npm cold-start download noise before goodvibes output, completion summary shows written/skipped file counts (Phase 6 hardened output)
**Why human:** docs/demo.gif is intentionally absent from the working tree per documented Option B in Plan 07-02. The file will be produced by the vhs.yml CI workflow on first relevant push to main. Cannot verify GIF content, size, or visual correctness without the CI run completing.

#### 2. npx Command Correctness

**Test:** Verify that `npx goodvibes init` (as written in README.md) correctly invokes the `@jgiox/goodvibes` package — not a different, unrelated package.
**Expected:** Running `npx goodvibes init` in a fresh directory launches the @jgiox/goodvibes CLI and produces the goodvibes init flow. Alternatively, confirm no unscoped package named `goodvibes` exists on npm that would shadow it, and update README to `npx @jgiox/goodvibes init` if a conflict exists.
**Why human:** The npm package is published as `@jgiox/goodvibes` (scoped). The README uses the bare `npx goodvibes init` form. This works only when (a) there is no conflicting unscoped `goodvibes` package on npm, AND (b) the scoped package is actually published. Neither condition can be verified from the local repo without a live npm registry check.

#### 3. Shields.io Badges Live Resolution

**Test:** Open the README on GitHub (github.com/jgiox/goodvibes) and confirm all four badges render with real version numbers / status rather than gray "error" shields.
**Expected:** npm badge shows current version (e.g. "1.3.0"), PyPI badge shows current version, CI badge shows "passing" or latest run status, license badge shows "Apache 2.0".
**Why human:** Badge resolution depends on the npm and PyPI packages being published. Shields.io fetches live data from the respective registries. Cannot verify from the local repo.

### Gaps Summary

No blocking gaps. The phase implementation is complete and correct for all items that can be verified programmatically:

- README.md hero structure is exactly as specified (title → tagline → 4 badges → GIF embed → Quick start → sections in correct order)
- All four Shields.io badge URLs are correct and use flat-square style
- GIF embed is present at the correct path
- Flags section explicitly names `.github/` and `docs/`
- npm keywords: 9 entries including all three required (ai-coding, claude-code, copilot)
- PyPI keywords: same; [project.urls] Homepage correctly set
- scripts/demo.tape: all VHS settings correct, Hide/Show in place, correct main command
- .github/workflows/vhs.yml: valid YAML, correct trigger/permissions/actions, no infinite loop, no workflow_dispatch

The one unresolved item — docs/demo.gif — is intentionally absent and blocked on CI execution (Option B). This is not a code defect; it is a documented procedural dependency. All infrastructure for producing and maintaining the GIF is in place.

---

_Verified: 2026-06-27_
_Verifier: Claude (gsd-verifier)_
