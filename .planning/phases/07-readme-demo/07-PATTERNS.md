# Phase 7: README & Demo - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 6
**Analogs found:** 5 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `README.md` | doc | static-content | `README.md` (current) | exact (modify in place) |
| `packages/npm/package.json` | config | static-content | `packages/npm/package.json` (current) | exact (modify in place) |
| `packages/pip/pyproject.toml` | config | static-content | `packages/pip/pyproject.toml` (current) | exact (modify in place) |
| `scripts/demo.tape` | config | batch | `scripts/verify-phase5.sh` (naming convention only) | naming-match |
| `docs/demo.gif` | asset | batch | `docs/onboarding.md` (directory convention only) | location-match |
| `.github/workflows/vhs.yml` | config | event-driven | `.github/workflows/publish-npm.yml` | role-match |

---

## Pattern Assignments

### `README.md` (doc, static-content)

**Analog:** `README.md` (current — full replacement of hero section, preserve body sections)

**Current structure to read before editing** (`/home/ygiokas/GoodVibes/README.md`, lines 1-60):

The existing README has no badges, no GIF, no tagline. It starts directly with a prose description paragraph then the command block. Section order is: title → description → command block → `## What you need first` → `## What happens when you run it` → `## Flags` → `## Platform support` → `## Docs`.

**Target hero pattern** (from RESEARCH.md Pattern 3):

```markdown
# goodvibes

> One command. Production-grade project. No config.

[![npm](https://img.shields.io/npm/v/%40jgiox%2Fgoodvibes?style=flat-square)](https://www.npmjs.com/package/@jgiox/goodvibes)
[![PyPI](https://img.shields.io/pypi/v/jgiox-goodvibes?style=flat-square)](https://pypi.org/project/jgiox-goodvibes/)
[![CI](https://img.shields.io/github/actions/workflow/status/jgiox/goodvibes/ci.yml?style=flat-square)](https://github.com/jgiox/goodvibes/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](LICENSE)

[![demo](docs/demo.gif)](docs/demo.gif)

## Quick start

```sh
npx goodvibes init
```

Or with Python:

```sh
pip install jgiox-goodvibes
goodvibes init
```
```

**Target section order** (D-01):
1. `# goodvibes`
2. Tagline blockquote (D-02)
3. 4 badges on consecutive lines (D-03, D-08)
4. GIF embed (D-04)
5. `## Quick start` with commands (D-06)
6. `## What you get` (rename from "What happens when you run it"; preserve body)
7. `## Flags` — must add `--minimal` description per D-18
8. `## What you need first` (move below Flags per D-05; preserve table body)
9. `## Platform support` (preserve)
10. `## Docs` (preserve)

**`## Flags` section update** (D-18) — replace existing content with:

```markdown
## Flags

```sh
goodvibes init --dry-run    # Preview files without writing anything
goodvibes init --minimal    # Skip headroom install, all .github/ files, and docs/
```

`--minimal` skips: `.github/` (workflows, issue templates, PR template, dependabot) and `docs/`.
```

**Current `## Flags` body** (lines 41-43 of existing README):
```markdown
goodvibes init --dry-run    # Preview files without writing anything
goodvibes init --minimal    # Skip headroom install and CI workflows
```
The `--minimal` description line is stale — D-18 requires updating it to name all skipped paths.

**GIF embedding pattern** (D-04):
```markdown
[![demo](docs/demo.gif)](docs/demo.gif)
```
Relative path from repo root. `README.md` is at repo root — path resolves correctly on GitHub.

---

### `packages/npm/package.json` (config, static-content)

**Analog:** `packages/npm/package.json` (current — surgical keyword addition only)

**Current keywords** (lines 21-28 of `/home/ygiokas/GoodVibes/packages/npm/package.json`):
```json
"keywords": [
  "scaffold",
  "vibe-coding",
  "claude",
  "llm",
  "starter-kit",
  "cli"
],
```

**Target keywords** (D-16 — extend, do not replace):
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
],
```

**Confirmed already present** (no change needed):
- `"description": "One-command bootstrap for vibe coding projects"` (line 4) — matches D-16
- `"repository": { "url": "https://github.com/jgiox/goodvibes" }` (lines 17-20) — homepage already present via repository field

**Touch only:** the `keywords` array. No other field changes.

---

### `packages/pip/pyproject.toml` (config, static-content)

**Analog:** `packages/pip/pyproject.toml` (current — keyword addition + new `[project.urls]` table)

**Current keywords** (line 8 of `/home/ygiokas/GoodVibes/packages/pip/pyproject.toml`):
```toml
keywords = ["scaffold", "vibe-coding", "claude", "llm", "starter-kit", "cli"]
```

**Target keywords** (D-17 — extend, do not replace):
```toml
keywords = ["scaffold", "vibe-coding", "claude", "llm", "starter-kit", "cli", "ai-coding", "claude-code", "copilot"]
```

**New `[project.urls]` table to add** (D-17, RESEARCH.md Pattern 4):
```toml
[project.urls]
Homepage = "https://github.com/jgiox/goodvibes"
```

**Insertion position:** After the `[project.scripts]` block (line 12), before `[build-system]` (line 14). The PyPI standard places `[project.urls]` after other `[project.*]` subtables and before `[build-system]`.

**Touch only:** `keywords` line + insert `[project.urls]` block. No other changes.

---

### `scripts/demo.tape` (config, batch)

**Analog:** None — no existing `.tape` files in codebase. Naming follows `scripts/verify-phase*.sh` convention (same directory, same dash-separated naming pattern).

**Complete tape content** (from RESEARCH.md Code Examples — all decisions locked):

```elixir
# DEMO-01: 800px width, ≤2MB, deterministic via --minimal --dry-run
# Source: charmbracelet/vhs v0.11.0

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

**Key constraints:**
- `Output` and `Set` commands MUST precede all input commands (`Type`, `Enter`, `Hide`, `Show`)
- `Output docs/demo.gif` path is relative to where `vhs` is invoked — CI invokes from repo root, so this writes to `$GITHUB_WORKSPACE/docs/demo.gif`
- `Set Width 800` satisfies DEMO-01 (800px terminal width)
- `Set Framerate 24` reduces frame count to keep GIF under 2MB
- `Hide`/`Show` wraps the mkdir + cd to suppress that from the recording (D-09 says "show the full beginner flow" but the cold npx download noise inside Hide satisfies D-10's determinism requirement)

---

### `docs/demo.gif` (asset, batch)

**Analog:** `docs/onboarding.md` — same directory. No content analog; this is a binary asset produced by VHS, not authored directly.

**Production path:** Generated by running `vhs scripts/demo.tape` from repo root. In CI, produced by `charmbracelet/vhs-action@v2.1.0` as part of `.github/workflows/vhs.yml`.

**Committed to repo** (D-12): GIF is a tracked binary asset so the README `![demo](docs/demo.gif)` embed resolves without requiring CI artifacts.

**Size constraint** (DEMO-01): Must be ≤2MB. Validate locally with `ls -lh docs/demo.gif` after first recording. If over 2MB, add `Set PlaybackSpeed 1.5` to the tape.

**Placeholder strategy:** A placeholder (empty or minimal) GIF may be committed in Wave 0; the real GIF is produced in Wave 1 after vhs.yml runs for the first time, or after a local `vhs scripts/demo.tape` run.

---

### `.github/workflows/vhs.yml` (config, event-driven)

**Analog:** `.github/workflows/publish-npm.yml` — same role (GitHub Actions workflow), same structural pattern (trigger → single job → sequential steps)

**Analog trigger pattern** (lines 1-8 of `publish-npm.yml`):
```yaml
name: Publish npm package

on:
  push:
    tags:
      - 'npm-v*'
  workflow_dispatch:
```

**Analog job/permissions/steps pattern** (lines 10-16 of `publish-npm.yml`):
```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
```

**Established repo conventions** (from reading ci.yml and publish-npm.yml):
- `actions/checkout@v7` — repo uses `@v7` (version-tag pinning, not SHA)
- `runs-on: ubuntu-latest` — all jobs use ubuntu-latest
- `permissions:` block at job level (not workflow level) — matches publish-pip.yml pattern
- Step names with `name:` only when the step is non-obvious (ci.yml uses named steps; publish workflows use them selectively)

**Complete target file content** (from RESEARCH.md Pattern 2 + corrected to match repo conventions):

```yaml
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

**Critical differences from publish-npm.yml analog:**
- `permissions: contents: write` (vs `contents: read` in publish workflows) — required for git-auto-commit-action v7 to push
- `paths:` trigger filter — not used in publish workflows (tag-triggered), but matches D-13 requirement
- No `workflow_dispatch` — D-13 decision: push-on-tape-change is sufficient

**Action version notes** (from RESEARCH.md):
- `charmbracelet/vhs-action@v2.1.0` — verified current; v1 is superseded
- `stefanzweifel/git-auto-commit-action@v7.1.0` — verified current; v5/v6 do not exist as tags
- `actions/checkout@v7` — matches repo convention (ci.yml line 17, publish-npm.yml line 16)

---

## Shared Patterns

### Workflow Structure (GitHub Actions)
**Source:** `.github/workflows/ci.yml` and `.github/workflows/publish-npm.yml`
**Apply to:** `.github/workflows/vhs.yml`

```yaml
# Established repo conventions:
# 1. actions/checkout@v7 (version tag, not SHA)
# 2. runs-on: ubuntu-latest (all jobs)
# 3. permissions: block at job level
# 4. No workflow_dispatch on automated workflows (publish-template.yml uses it; vhs.yml does not need it per D-13)
```

### Action Pinning Convention
**Source:** All existing `.github/workflows/*.yml`
**Apply to:** `.github/workflows/vhs.yml`

Version-tag pinning (`@v7`, `@v6`, `@v7.1.0`) — not SHA pinning. The repo has no SHA-pinned actions. Follow this convention for `charmbracelet/vhs-action@v2.1.0` and `stefanzweifel/git-auto-commit-action@v7.1.0`.

### Config File Edit Pattern (surgical)
**Source:** `packages/npm/package.json` and `packages/pip/pyproject.toml` (current state)
**Apply to:** Both package metadata files

Both files have the correct `description` already. Edit only the `keywords` field and (for pip) add `[project.urls]`. Do not reformat, reorder, or change other fields.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/demo.tape` | config | batch | No `.tape` files exist in codebase; VHS tape syntax is domain-specific. Use RESEARCH.md Pattern 1 / Code Examples as the complete content source. |

---

## Metadata

**Analog search scope:** `README.md`, `packages/npm/package.json`, `packages/pip/pyproject.toml`, `.github/workflows/*.yml`, `scripts/`, `docs/`
**Files scanned:** 8 (README.md, package.json, pyproject.toml, ci.yml, publish-npm.yml, publish-pip.yml, scripts/ listing, docs/ listing)
**Pattern extraction date:** 2026-06-27
