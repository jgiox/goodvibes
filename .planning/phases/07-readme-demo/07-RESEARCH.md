# Phase 7: README & Demo - Research

**Researched:** 2026-06-27
**Domain:** GitHub README authoring, VHS terminal recording, Shields.io badges, GitHub Actions CI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**README Hero Structure**
- D-01: Full hero redesign. Section order: title → tagline → badges → GIF → Quick start → What you get → Flags → What you need first → Platform support → Docs.
- D-02: Tagline: `> One command. Production-grade project. No config.` (blockquote under `# goodvibes` title)
- D-03: Badges between tagline and GIF. Order: npm version → PyPI version → CI status → License. Style: `flat-square`. Max 4.
- D-04: GIF embedded inline, linked to itself: `[![demo](docs/demo.gif)](docs/demo.gif)`
- D-05: Prerequisites section (`## What you need first`) moves to after `## Flags`
- D-06: `## Quick start` replaces existing unnamed command block; contains `npx goodvibes init` plus pip alternative

**Badge Configuration**
- D-07: Shields.io `flat-square` style. npm: `%40jgiox%2Fgoodvibes`. PyPI: `jgiox-goodvibes`. CI: points to `ci.yml` in `jgiox/goodvibes`.
- D-08: Exact badge markdown (locked):
  1. `[![npm](https://img.shields.io/npm/v/%40jgiox%2Fgoodvibes?style=flat-square)](https://www.npmjs.com/package/@jgiox/goodvibes)`
  2. `[![PyPI](https://img.shields.io/pypi/v/jgiox-goodvibes?style=flat-square)](https://pypi.org/project/jgiox-goodvibes/)`
  3. `[![CI](https://img.shields.io/github/actions/workflow/status/jgiox/goodvibes/ci.yml?style=flat-square)](https://github.com/jgiox/goodvibes/actions/workflows/ci.yml)`
  4. `[![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](LICENSE)`

**Demo Tape Content**
- D-09: Tape opens with `mkdir myproject && cd myproject`
- D-10: Main command: `npx goodvibes init --minimal --dry-run`
- D-11: Dark terminal theme. Width: 800px. GIF ≤2MB.
- D-12: Tape: `scripts/demo.tape`. GIF: `docs/demo.gif`. Both committed to repo.

**VHS CI Workflow**
- D-13: `vhs.yml` triggers on `push` to `main` with `paths: ['scripts/demo.tape']`. No `workflow_dispatch`.
- D-14: Commit-back: `stefanzweifel/git-auto-commit-action`. Commits `docs/demo.gif` only if changed. Message: `chore(demo): regenerate demo.gif`. Uses `GITHUB_TOKEN`.
- D-15: Researcher must verify `stefanzweifel/git-auto-commit-action` current release tag. (Resolved below — see Standard Stack.)

**Package Metadata**
- D-16: npm keywords: add `"ai-coding"`, `"claude-code"`, `"copilot"` to existing list.
- D-17: PyPI keywords: add `"ai-coding"`, `"claude-code"`, `"copilot"`. Add `[project.urls]` Homepage.
- D-18: README `## Flags` must state what `--minimal` skips: `.github/` and `docs/`.

### Claude's Discretion

None — all decisions locked.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| README-01 | README hero section contains a single copy-pasteable command above the fold, before prerequisites | D-01, D-06: Quick start section structure documented; `npx goodvibes init` is the hero command |
| README-02 | README displays live npm version, PyPI version, CI status, and license badges | D-08: All 4 badge URLs verified returning HTTP 200 |
| README-03 | README includes animated demo GIF showing `goodvibes init` completing in a real terminal | D-09–D-12: VHS tape structure documented; GIF constraints confirmed |
| README-04 | npm `package.json` and PyPI `pyproject.toml` descriptions, keywords, homepage match README; Flags section documents what `--minimal` skips | D-16–D-18: Exact keyword additions and pyproject.toml `[project.urls]` pattern documented |
| DEMO-01 | `scripts/demo.tape` produces deterministic demo GIF at ≤2MB / 800px — reproducible by any contributor | VHS tape syntax fully documented; `Set Width 800` confirmed; GIF size constraint achievable with `--dry-run` |
| DEMO-02 | `.github/workflows/vhs.yml` auto-regenerates `docs/demo.gif` when `demo.tape` changes on main | vhs-action@v2.1.0 + git-auto-commit-action@v7.1.0 YAML documented |
</phase_requirements>

---

## Summary

Phase 7 ships three file groups: (1) a redesigned `README.md` with hero layout, four live badges, and an embedded demo GIF; (2) `scripts/demo.tape` and `docs/demo.gif` recorded with VHS; (3) `.github/workflows/vhs.yml` that auto-regenerates the GIF when the tape changes. There is no new code — this phase surfaces what already works.

The primary technical unknowns were the VHS tape syntax, the correct versions of `vhs-action` and `git-auto-commit-action`, and whether the Shields.io badge URLs for a scoped npm package and a lesser-known PyPI package resolve correctly. All four badge URLs confirmed HTTP 200. The `git-auto-commit-action` is at **v7.1.0** (not v5 as the discuss-phase assumed). The `vhs-action` is at **v2.1.0**. Both are confirmed via GitHub API.

The existing repo uses version-tag pinning (`@v7`, `@v6`) rather than SHA pinning — this research confirms SHA values are available but recommends following the project's established convention (version tags) to avoid friction on Dependabot updates.

**Primary recommendation:** Use `vhs-action@v2.1.0` with `ubuntu-latest`, commit back with `stefanzweifel/git-auto-commit-action@v7.1.0` requiring `permissions: contents: write` on the job. The tape should use `Hide`/`Show` to skip npx download noise, `Wait` to gate on command completion, and `Set Width 800` for the 800px requirement.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| README hero content | Static file (repo root) | — | README.md is a static Markdown file, no tier needed |
| Badge generation | External service (Shields.io CDN) | — | Shields.io fetches live data from npm/PyPI/GitHub and returns SVG; no code needed |
| Demo GIF production | CI (GitHub Actions) | Local (contributor machine) | vhs-action runs VHS in CI; contributors run `vhs scripts/demo.tape` locally |
| GIF commit-back | CI (GitHub Actions) | — | stefanzweifel/git-auto-commit-action pushes from within the workflow |
| Package metadata | Static config files | — | package.json and pyproject.toml edits only |

---

## Standard Stack

### Core

| Tool / Action | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| `charmbracelet/vhs-action` | v2.1.0 | Run VHS tape in CI, produce GIF | Official action from VHS maintainers [VERIFIED: github.com/charmbracelet/vhs-action] |
| `stefanzweifel/git-auto-commit-action` | v7.1.0 | Commit generated GIF back to repo | Standard pattern for CI-generated asset commit-back; 57M+ downloads [VERIFIED: github.com/stefanzweifel/git-auto-commit-action] |
| VHS | v0.11.0 (latest, installed by vhs-action) | Terminal session recording to GIF | Official charmbracelet tool; MIT license [VERIFIED: github.com/charmbracelet/vhs releases API] |
| Shields.io | hosted CDN | Live npm/PyPI/CI/license badges | De facto standard for GitHub README badges [VERIFIED: img.shields.io returned HTTP 200 for all 4 URLs] |

### No New npm/pip Packages

This phase installs no npm or pip packages. All work is: Markdown file edits, tape file creation, and a new GitHub Actions workflow file.

---

## Package Legitimacy Audit

No packages are installed in this phase (no `npm install`, no `pip install`). The phase uses only:
- GitHub Actions (charmbracelet/vhs-action, stefanzweifel/git-auto-commit-action) — these are not npm/pip packages; verified via GitHub API
- Shields.io CDN (no install required)

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
scripts/demo.tape
      |
      | git push to main (path filter)
      v
.github/workflows/vhs.yml
      |
      |-- charmbracelet/vhs-action@v2.1.0
      |      |-- installs VHS v0.11.0
      |      |-- installs ttyd + ffmpeg (bundled by action)
      |      |-- runs: vhs scripts/demo.tape
      |      v
      |   docs/demo.gif  (produced in workspace)
      |
      |-- stefanzweifel/git-auto-commit-action@v7.1.0
             |-- checks if docs/demo.gif changed
             |-- if changed: git commit + push to main
             v
          docs/demo.gif committed to repo
                |
                v
          README.md embeds: [![demo](docs/demo.gif)](docs/demo.gif)
          (GitHub renders inline; clicking opens full-size)
```

### Recommended Project Structure (additions only)

```
scripts/
├── demo.tape           # NEW: VHS tape file
docs/
├── onboarding.md       # existing
└── demo.gif            # NEW: produced by VHS (committed)
.github/workflows/
└── vhs.yml             # NEW: auto-regen workflow
README.md               # MODIFIED: full hero redesign
packages/npm/
└── package.json        # MODIFIED: add 3 keywords
packages/pip/
└── pyproject.toml      # MODIFIED: add 3 keywords, add [project.urls]
```

### Pattern 1: VHS Tape Structure

**What:** A `.tape` file is a declarative script of terminal commands VHS will replay and record.

**Required ordering:** `Output` and `Set` commands MUST come before any input commands (`Type`, `Enter`, etc.). `Hide`/`Show` can appear anywhere after settings.

**Working tape for goodvibes demo:**

```elixir
# Source: https://github.com/charmbracelet/vhs (v0.11.0 docs)

Output docs/demo.gif

Set Shell "bash"
Set FontSize 14
Set Width 800
Set Height 500
Set Theme "Dracula"
Set TypingSpeed 80ms
Set Padding 10

# Hide the npx download noise — it's non-deterministic
Hide
Type "mkdir myproject && cd myproject"
Enter
Sleep 500ms
Show

Type "npx goodvibes init --minimal --dry-run"
Enter

# Wait for the command to finish (looks for the shell prompt returning)
Wait+Screen /\$/ 30s

Sleep 2s
```

**Key syntax rules:**
- `Output` path is relative to where `vhs` is invoked. In CI, vhs-action runs from repo root, so `Output docs/demo.gif` writes to `docs/demo.gif` in the workspace.
- `Set Width 800` sets terminal width in pixels (not columns). This satisfies DEMO-01.
- `Hide` stops frame capture; `Show` resumes. Use to hide `npx` cold-download noise.
- `Wait+Screen /regex/ <timeout>` waits for text matching the regex to appear. Use `/\$/ 30s` to wait for the shell prompt to return after the command.
- `Sleep 2s` at the end gives viewers time to read the final output before the GIF loops.
- `Set Theme "Dracula"` is a confirmed built-in dark theme [VERIFIED: charmbracelet/vhs THEMES.md].
- Other confirmed dark built-ins: `"Dark+"`, `"Catppuccin Mocha"`, `"Builtin Dark"`, `"GitHub Dark"`, `"Kanagawa"`.

**Size note:** `--minimal --dry-run` produces ~10-15 lines of output (no headroom download, no file writes). At 800px / Dracula theme / 14px font, this should comfortably fit within 2MB. [ASSUMED — not benchmarked; validate with actual recording]

### Pattern 2: vhs.yml Workflow

**What:** GitHub Actions workflow that runs vhs-action when demo.tape changes on main.

```yaml
# Source: https://github.com/charmbracelet/vhs-action (v2.1.0 README + action.yml)
name: VHS Demo

on:
  push:
    branches: [main]
    paths:
      - 'scripts/demo.tape'

jobs:
  vhs:
    runs-on: ubuntu-latest
    permissions:
      contents: write  # Required by git-auto-commit-action@v7 to push the GIF

    steps:
      - uses: actions/checkout@v7  # match repo convention

      - uses: charmbracelet/vhs-action@v2.1.0
        with:
          path: 'scripts/demo.tape'

      - uses: stefanzweifel/git-auto-commit-action@v7.1.0
        with:
          commit_message: 'chore(demo): regenerate demo.gif'
          file_pattern: 'docs/demo.gif'
```

**Critical points:**
1. `permissions: contents: write` on the job is REQUIRED for `git-auto-commit-action@v7` to push. Without it the push fails silently. [VERIFIED: git-auto-commit-action v7 README]
2. `runs-on: ubuntu-latest` is sufficient — vhs-action installs VHS, ttyd, and ffmpeg itself. No container needed. [VERIFIED: vhs-action action.yml uses `node20`]
3. `file_pattern: 'docs/demo.gif'` scopes the auto-commit to only the GIF, not the entire workspace.
4. The `actions/checkout@v7` step uses the repo's established pinning convention (version tags, not SHAs).
5. The commit triggered by git-auto-commit-action will NOT re-trigger vhs.yml because the commit does not touch `scripts/demo.tape` (the path filter). No infinite loop risk.

### Pattern 3: README Hero Structure

```markdown
# goodvibes

> One command. Production-grade project. No config.

[![npm](https://img.shields.io/npm/v/%40jgiox%2Fgoodvibes?style=flat-square)](https://www.npmjs.com/package/@jgiox/goodvibes)
[![PyPI](https://img.shields.io/pypi/v/jgiox-goodvibes?style=flat-square)](https://pypi.org/project/jgiox-goodvibes/)
[![CI](https://img.shields.io/github/actions/workflow/status/jgiox/goodvibes/ci.yml?style=flat-square)](https://github.com/jgiox/goodvibes/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](LICENSE)

[![demo](docs/demo.gif)](docs/demo.gif)

## Quick start

\`\`\`sh
npx goodvibes init
\`\`\`

Or with Python:

\`\`\`sh
pip install jgiox-goodvibes
goodvibes init
\`\`\`

## What you get
...

## Flags

\`\`\`sh
goodvibes init --dry-run    # Preview files without writing anything
goodvibes init --minimal    # Skip headroom install, all .github/ files, and docs/
\`\`\`

`--minimal` skips: `.github/` (workflows, issue templates, PR template, dependabot) and `docs/`.

## What you need first
...

## Platform support
...

## Docs
...
```

**Badge alignment:** Left-aligned (one badge per line in source, renders inline on GitHub). Do NOT use `<div align="center">` — it breaks some mobile renderers and adds HTML complexity for marginal visual gain. [ASSUMED — confirmed as common pattern; GitHub's own repos use left-aligned badges]

**GIF embedding:** `[![demo](docs/demo.gif)](docs/demo.gif)` — relative path from repo root. Works correctly for a `README.md` at the repo root. GitHub renders inline without plugins for files under 10MB. [VERIFIED: GitHub docs + rekort.app guide]

### Pattern 4: pyproject.toml `[project.urls]` Addition

```toml
# Source: https://packaging.python.org/en/latest/guides/writing-pyproject-toml/
[project.urls]
Homepage = "https://github.com/jgiox/goodvibes"
```

This is the standard PyPI-recognized key for the homepage URL. Appears after the `[project]` table and before `[build-system]`. [ASSUMED — standard PyPI convention; training knowledge]

### Anti-Patterns to Avoid

- **Using `npx goodvibes init` without `--dry-run` in the tape:** Downloads headroom, writes to filesystem, timing is non-deterministic. Always use `--minimal --dry-run` for CI recording.
- **SHA-pinning actions against this repo's convention:** Existing workflows use `@v7`, `@v6` etc. (version tags, not SHAs). SHA pinning is more secure but introduces Dependabot friction and inconsistency. Follow existing convention.
- **Using `stefanzweifel/git-auto-commit-action@v5`:** v5 does not exist — the action jumped from v4 to v7. Using `@v5` will result in a 404 and workflow failure. Use `@v7.1.0` or `@v7`.
- **Omitting `permissions: contents: write`:** git-auto-commit-action v7 requires this explicitly. Default GITHUB_TOKEN has read-only contents in most org repositories.
- **Not filtering `file_pattern` in git-auto-commit-action:** Default `file_pattern: '.'` would commit any workspace change. Scope to `docs/demo.gif`.
- **Leaving `ttyd`/`ffmpeg` install as a manual step:** vhs-action handles this automatically. Do not add separate install steps.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal session recording | Custom screen capture / asciicast | VHS (`charmbracelet/vhs`) | VHS produces deterministic output, runs in CI, is MIT licensed, produces GIF natively |
| CI auto-commit of generated assets | Custom git push script in workflow | `stefanzweifel/git-auto-commit-action@v7` | Handles dirty-check, commit author, push, branch correctly; single action vs. 5+ raw git steps |
| Badge SVGs | Static SVG files | Shields.io CDN | Live version numbers; zero maintenance |

**Key insight:** All three problems in this phase have established single-action solutions. Adding custom shell scripts would introduce maintenance surface for zero gain.

---

## Common Pitfalls

### Pitfall 1: git-auto-commit-action version confusion

**What goes wrong:** Workflow fails with "Could not find action" or similar 404 error.
**Why it happens:** The discuss-phase referenced `@v5` (MEDIUM confidence). Actual version history: v1 → v2 → v3 → v4 → v7 (v5 and v6 were never released as stable tags).
**How to avoid:** Use `@v7.1.0` (verified current) or `@v7` (latest minor). Confirmed via GitHub API: tag `v7.1.0` SHA `04702edda442b2e678b25b537cec683a1493fcb9`.
**Warning signs:** Workflow step fails immediately without running; error mentions action not found.

### Pitfall 2: Missing `permissions: contents: write`

**What goes wrong:** vhs-action runs successfully, GIF is produced, but git-auto-commit-action fails to push with a 403 permission error.
**Why it happens:** GitHub Actions workflows default to read-only GITHUB_TOKEN for contents in many org settings. v7 requires explicit opt-in.
**How to avoid:** Add `permissions: contents: write` to the `vhs` job in vhs.yml (not at workflow level — job level is more precise).
**Warning signs:** `git push` step fails; logs mention "insufficient permission" or HTTP 403.

### Pitfall 3: VHS `Output` path resolution

**What goes wrong:** VHS generates `demo.gif` in the repo root instead of `docs/demo.gif`, so git-auto-commit-action doesn't find it at `docs/demo.gif`.
**Why it happens:** `Output` path is relative to the directory where `vhs` is invoked. vhs-action invokes VHS from the workspace root, so `Output docs/demo.gif` writes to `$GITHUB_WORKSPACE/docs/demo.gif`. If the tape says `Output demo.gif`, the GIF lands in the root.
**How to avoid:** Tape must explicitly say `Output docs/demo.gif`. Verify locally by running `vhs scripts/demo.tape` from the repo root.
**Warning signs:** GIF appears in wrong location; `file_pattern: 'docs/demo.gif'` finds nothing to commit.

### Pitfall 4: `npx` cold-start noise in the recording

**What goes wrong:** The GIF shows npm package download output (`npm warn`, progress bars) before the goodvibes output, making the demo look unprofessional.
**Why it happens:** `npx goodvibes init` on a CI runner (or cold cache) downloads the package first.
**How to avoid:** Wrap the `npx` install step in `Hide`/`Show` — hide during download, show from the moment goodvibes output starts. Alternatively, pre-install with `npm install -g @jgiox/goodvibes` in a `Hide` block before the demo commands.
**Warning signs:** GIF shows scrolling npm output before the goodvibes spinner appears.

### Pitfall 5: GIF over 2MB

**What goes wrong:** GIF exceeds 2MB (DEMO-01 constraint), usually from too many frames, long duration, or high font size.
**How to avoid:** Use `--minimal --dry-run` (deterministic ~5 second run, no headroom download). Keep `Set FontSize` at 13–16px range. Use `Set PlaybackSpeed 1.5` to speed up dead time. Set `Set Framerate 24` (default is higher). Keep `Sleep` calls short (no more than 2s at end).
**Warning signs:** `ls -lh docs/demo.gif` shows > 2MB after local test run.

### Pitfall 6: CI badge shows "error" state

**What goes wrong:** CI badge shows gray "error" shield instead of green/red.
**Why it happens:** The workflow filename in the badge URL doesn't match the actual file. Badge URL uses `ci.yml` — this must match exactly `.github/workflows/ci.yml`.
**How to avoid:** Confirmed `.github/workflows/ci.yml` exists with `name: CI`. Badge URL `ci.yml` matches file. No action needed.
**Warning signs:** Badge shows "error" on gray background immediately after pushing.

### Pitfall 7: vhs.yml triggers on GIF commit (infinite loop)

**What goes wrong:** git-auto-commit-action commits `docs/demo.gif`, which could trigger vhs.yml again.
**Why it happens:** Push triggers path filter — but only if the push touches `scripts/demo.tape`.
**How to avoid:** `paths: ['scripts/demo.tape']` filter ensures that a push touching only `docs/demo.gif` does NOT trigger vhs.yml. Confirmed safe by design. No `[skip ci]` annotation needed.
**Warning signs:** Workflows trigger in a chain; each run immediately follows the previous.

---

## Code Examples

### Complete VHS Tape

```elixir
# Source: charmbracelet/vhs v0.11.0 — https://github.com/charmbracelet/vhs
# DEMO-01: 800px width, ≤2MB, deterministic via --minimal --dry-run

Output docs/demo.gif

Set Shell "bash"
Set FontSize 14
Set Width 800
Set Height 500
Set Theme "Dracula"
Set TypingSpeed 80ms
Set Padding 10
Set Framerate 24

# Hide the cd / npx cold-start so the GIF opens on the goodvibes output
Hide
Type "mkdir myproject && cd myproject"
Enter
Sleep 500ms
Show

Type "npx goodvibes init --minimal --dry-run"
Enter

# Wait up to 30s for the shell prompt to return (command to finish)
Wait+Screen /\$/ 30s

Sleep 2s
```

### Complete vhs.yml Workflow

```yaml
# Source: charmbracelet/vhs-action v2.1.0 README + action.yml
#         stefanzweifel/git-auto-commit-action v7.1.0 README + action.yml
# DEMO-02: auto-regenerates docs/demo.gif when scripts/demo.tape changes on main

name: VHS Demo

on:
  push:
    branches: [main]
    paths:
      - 'scripts/demo.tape'

jobs:
  vhs:
    runs-on: ubuntu-latest
    permissions:
      contents: write  # required for git-auto-commit-action to push

    steps:
      - uses: actions/checkout@v7

      - uses: charmbracelet/vhs-action@v2.1.0
        with:
          path: 'scripts/demo.tape'

      - uses: stefanzweifel/git-auto-commit-action@v7.1.0
        with:
          commit_message: 'chore(demo): regenerate demo.gif'
          file_pattern: 'docs/demo.gif'
```

### pyproject.toml `[project.urls]` Addition

```toml
# Add after [project] block, before [build-system]
# Source: PyPI packaging standard — https://packaging.python.org/en/latest/guides/writing-pyproject-toml/
[project.urls]
Homepage = "https://github.com/jgiox/goodvibes"
```

### npm package.json Keywords Addition (diff)

```json
"keywords": [
  "scaffold",
  "vibe-coding",
  "claude",
  "llm",
  "starter-kit",
  "cli",
  "ai-coding",
  "claude-code",
  "copilot"
]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `asciinema` + manual GIF conversion | VHS (declarative tape → GIF) | 2022-present | Deterministic, CI-native, no manual steps |
| `stefanzweifel/git-auto-commit-action@v4` | `@v7.1.0` | Dec 2025 | Requires `permissions: contents: write`; uses node24 runtime |
| SHA-pinned actions | Version-tag-pinned actions | Repo convention | This repo uses `@v7`-style tags throughout |

**Deprecated/outdated:**
- `@v5` and `@v6` of `git-auto-commit-action`: These tags do not exist. The action went v4 → v7. Any reference to `@v5` in older documentation or AI suggestions is incorrect.
- `charmbracelet/vhs-action@v1`: Superseded by `@v2.1.0`. Use v2.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Set Width 800` produces an 800px-wide GIF (not 800 terminal columns) | Code Examples / tape | GIF could be wrong width; validate by running `vhs scripts/demo.tape` locally and checking output dimensions |
| A2 | `--minimal --dry-run` output fits within 2MB at 800px / 14px / Dracula / Framerate 24 | Pitfall 5 | GIF too large; fix with PlaybackSpeed or reduced Framerate |
| A3 | Left-aligned badges (no `<div align="center">`) is the right choice for this README | Architecture Patterns | Visual preference only; either works |
| A4 | `[project.urls]` Homepage is the correct pyproject.toml key for PyPI homepage display | Code Examples | PyPI may not surface it; low risk — worst case it's ignored |
| A5 | `Wait+Screen /\$/ 30s` correctly gates on the bash prompt returning after `npx` completes | Code Examples / tape | If prompt regex doesn't match, VHS waits 30s then times out; test locally first |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions (RESOLVED)

1. **GIF file size validation**
   - What we know: `--minimal --dry-run` produces ~10-15 lines of output; 800px at 14px font for ~5-8 seconds
   - What's unclear: Exact GIF file size — not benchmarked
   - Recommendation: First plan task should be local tape test + `ls -lh docs/demo.gif`. If > 2MB, adjust `Set Framerate 24` or `Set PlaybackSpeed 1.5`.
   - **RESOLVED:** Plans use `Set Framerate 24` by default to keep size minimal; Plan 02 checkpoint includes explicit `size-issue` resume signal with instructions to lower framerate if GIF exceeds 2MB.

2. **`npx` cold-start timing in CI**
   - What we know: `Hide`/`Show` hides download noise from the GIF
   - What's unclear: Whether `Wait+Screen /\$/ 30s` is enough for cold `npx` download on GitHub-hosted runners
   - Recommendation: Set `Wait+Screen /\$/ 60s` initially; reduce after first successful CI run.
   - **RESOLVED:** Plans use `Wait+Screen /\$/ 60s` (this research's recommendation); Plan 02 checkpoint includes explicit `timeout-issue` resume signal with instructions to increase to 90s if needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| VHS | DEMO-01 (local reproduction) | No | — | Run in CI via vhs-action; for local: `brew install vhs` or `go install github.com/charmbracelet/vhs@latest` |
| git | vhs.yml workflow | Yes | 2.43.0 | — |
| Node.js 20 | `npx` in tape | Yes | 20.20.2 | — |
| Python 3.12 | CI runner context | Yes | 3.12.3 | — |

**Missing dependencies with no fallback:**
- VHS is not installed locally. The tape can still be authored and committed; CI (vhs-action) produces the GIF. Local reproduction requires installing VHS separately.

**Missing dependencies with fallback:**
- None blocking the phase. The tape is a text file; it does not need to be executed locally to be committed and validated in CI.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (npm) + pytest (pip) |
| Config file | `packages/npm/package.json` (vitest via scripts) / `packages/pip/pyproject.toml` |
| Quick run command | `cd packages/npm && npm test` / `cd packages/pip && uv run --extra dev pytest tests/ -x -q` |
| Full suite command | Same (all tests are fast unit tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| README-01 | README contains `npx goodvibes init` above the fold | manual-only | visual inspection of rendered README on GitHub | N/A |
| README-02 | 4 badges resolve to non-error state | manual-only | View README on GitHub; verify no gray "error" shields | N/A |
| README-03 | GIF renders inline, < 2MB, shows hardened output | manual-only | View README on GitHub; `ls -lh docs/demo.gif` | N/A |
| README-04 | Package metadata matches README; Flags section accurate | manual-only | Read package.json, pyproject.toml, README Flags section | N/A |
| DEMO-01 | Tape produces reproducible GIF at ≤2MB / 800px | smoke test | `vhs scripts/demo.tape && ls -lh docs/demo.gif` (requires local VHS) | ❌ Wave 0 |
| DEMO-02 | vhs.yml triggers on tape change; commits GIF | manual-only | Push a tape change to main; verify CI run + commit | N/A |

**Note:** This phase is primarily content/config work. Most validation is visual/manual. The automated test opportunity is `DEMO-01` (tape syntax is valid and produces a GIF of the right size), but this requires local VHS install. In CI, this is validated by the vhs.yml workflow run itself.

### Sampling Rate

- **Per commit:** Run existing npm and pip test suites (`npm test`, `pytest`) to confirm package.json/pyproject.toml edits did not break anything
- **Phase gate:** All 5 success criteria from ROADMAP.md must be manually verified before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `scripts/demo.tape` — the tape file itself (created in Wave 0)
- [ ] `docs/demo.gif` — produced by running `vhs scripts/demo.tape` (can be placeholder for Wave 0, real GIF in Wave 1)
- [ ] `.github/workflows/vhs.yml` — new workflow file (Wave 0)

*(Existing test infrastructure covers package.json and pyproject.toml edits; no new test files needed)*

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | No | No user input in this phase |
| V6 Cryptography | No | — |

### Known Threat Patterns for GitHub Actions

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Supply chain: malicious action version | Tampering | Pin to version tags (repo convention); SHA pinning is stronger but not used here |
| Workflow secret exfiltration | Information Disclosure | No secrets in vhs.yml; only GITHUB_TOKEN with `contents: write` scope |
| Recursive workflow trigger | Denial of Service | Path filter `paths: ['scripts/demo.tape']` + GIF commit doesn't touch tape = no loop |

**Supply chain note:** `charmbracelet/vhs-action` and `stefanzweifel/git-auto-commit-action` are both well-established actions (MIT licensed, maintained by reputable authors). Pinning to exact version tags (`@v2.1.0`, `@v7.1.0`) rather than `@latest` provides sufficient supply chain protection at ASVS Level 1. SHA pinning would be Level 2+.

---

## Sources

### Primary (HIGH confidence)

- `github.com/charmbracelet/vhs` releases API — VHS v0.11.0 confirmed current (2026-03-10)
- `github.com/charmbracelet/vhs` README — full tape syntax (Output, Set, Type, Enter, Sleep, Hide, Show, Wait commands)
- `github.com/charmbracelet/vhs` THEMES.md — confirmed `"Dracula"` as valid built-in dark theme
- `github.com/charmbracelet/vhs-action` action.yml — inputs (path, version, token, install-fonts), `node20` runner
- `github.com/charmbracelet/vhs-action` examples/auto-commit.yml — canonical auto-commit pattern
- `github.com/stefanzweifel/git-auto-commit-action` releases API — v7.1.0 is latest (2025-12-17), SHA `04702edda442b2e678b25b537cec683a1493fcb9`
- `github.com/stefanzweifel/git-auto-commit-action` action.yml — all inputs, `node24` runner
- `github.com/stefanzweifel/git-auto-commit-action` README — `permissions: contents: write` requirement documented
- Shields.io live test — all 4 badge URLs returned HTTP 200

### Secondary (MEDIUM confidence)

- `github.blog/developer-skills/github/` — `<picture>` element for dark/light mode images; Shields.io badges not addressed
- `rekort.app/blog/gif-for-github-readme` — GitHub GIF rendering: inline under 10MB, relative paths work from repo root

### Tertiary (LOW confidence — not used for locked decisions)

- WebSearch results on badge alignment patterns — left-align is common practice; `<div align="center">` is an option but adds HTML

---

## Metadata

**Confidence breakdown:**
- VHS tape syntax: HIGH — verified from official charmbracelet/vhs README and action.yml
- vhs-action version and inputs: HIGH — verified from official action.yml via GitHub API
- git-auto-commit-action version + SHA: HIGH — verified via GitHub releases API
- Badge URLs: HIGH — all 4 tested HTTP 200
- GIF size estimate: LOW — not benchmarked; assumption only
- VHS Wait syntax for dynamic CLI output: MEDIUM — syntax verified; specific regex behavior for bash prompt untested

**Research date:** 2026-06-27
**Valid until:** 2026-09-27 (90 days; VHS and actions release infrequently)
