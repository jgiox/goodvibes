# Feature Landscape: goodvibes v1.2.0 Growth & Retention

**Domain:** Developer bootstrapping CLI for AI-assisted (vibe) coding
**Researched:** 2026-07-03
**Milestone:** v1.2.0 — Growth & Retention (subsequent milestone, builds on v1.6.2 published packages)
**Overall confidence:** HIGH (telemetry UX patterns), HIGH (headroom status patterns), MEDIUM (update command — pattern variety)

---

## Context: What Already Exists

The v1.6.2 implementation is complete and published to npm + PyPI as `goodvibes-cli`:
- `goodvibes init` — copies templates, installs headroom via uv/pipx/pip chain, configures MCP
- `goodvibes upgrade` — self-updates binary via npm/PyPI
- `goodvibes doctor` — version check + health summary
- `installHeadroom()` — uv→pipx→pip fallback chain; returns `void`; communicates via log callback
- `configureMcp()` — claude mcp add / headroom mcp install fallback; returns `void`; communicates via log callback
- `init.ts` task list hardcodes `"headroom ready"` and `"MCP server registered"` as task return strings regardless of actual outcome

Critical observation: both `installHeadroom` and `configureMcp` already have all the branching for installed/skipped/failed — they just return `void` instead of a discriminated status. The headroom validation feature is almost entirely surfacing what already exists.

This research covers only the three v1.2.0 features. Do not re-derive v1.0.0–v1.6.2 scope.

---

## Feature 1: Headroom Integration Validation

### What problem this solves

`goodvibes init` currently shows a spinner with text messages streaming from the log callback, then always shows `"headroom ready"` as the task completion string — even when headroom was skipped (no Python) or failed (C++ build error). The user has no way to distinguish: fresh install, already installed, skipped, or failed.

### Table-stakes behavior (users expect this)

| Behavior | Why Expected | Complexity | Notes |
|----------|--------------|------------|-------|
| Final status shows `installed / already installed / skipped / failed` for headroom | Users need to know if the main value-add actually worked | LOW | Both functions already have branching; need to return a status instead of void |
| Final status shows `configured / already configured / skipped / failed` for MCP | MCP config is separate from install; both can independently fail | LOW | Same pattern as above |
| Failure case includes one-line fix instruction | CLIG standard: every error needs a "what to do next" | LOW | Already generating actionable log messages; persist them into the outro |
| Status persists in the outro, not just spinner scroll | Beginners miss spinner messages (they scroll past) | LOW | Move status summary to outro note block |
| `goodvibes doctor` also shows headroom status | Users who want to check without re-running init need this | MEDIUM | Requires doctor command to run headroom probe + mcp status check |

### Differentiators (above expected)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Aggregate summary: "Headroom: ready" vs "Headroom: action needed" | Beginners don't need to parse two separate status lines; they need one outcome | LOW | Combine install + MCP status into a single result |
| In failure: show exactly which step failed (install vs MCP) with distinct instructions | Distinguishes "install worked but MCP not configured" from "couldn't install at all" | LOW | The two functions already produce distinct messages |

### Anti-features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Exit code 1 on headroom failure | Headroom is additive; its failure should not break init | Keep current soft-fail behavior; surface in status block |
| Retrying headroom install silently | Silent retries confuse users | Current behavior (try 3 installers in sequence, log each attempt) is correct |
| Checking `headroom mcp status` as a post-install probe | `headroom mcp status` is unreliable immediately after registration; Claude must restart | Use the exit code of `configureMcp` directly as the status |

### Implementation approach

Change both `installHeadroom` and `configureMcp` return types from `void` to a status:

```typescript
type HeadroomInstallStatus = 'installed' | 'already_installed' | 'skipped' | 'failed'
type McpConfigStatus = 'configured' | 'already_configured' | 'skipped' | 'failed'
```

Return the appropriate value from each branch that currently just calls `log(...)` and returns.

In `init.ts`, collect both statuses and add a `note()` block in the outro:

```
Headroom: installed  — token compression active
MCP: configured      — Claude Code will use headroom automatically
```

Or on failure:

```
Headroom: skipped    — Python 3.10+ not found
                       Install Python then run: goodvibes init
MCP: skipped         — headroom not installed
```

Both npm (`installHeadroom.ts`, `configureMcp.ts`, `init.ts`) and pip (`install_headroom.py`, `configure_mcp.py`, `init_cmd.py`) need the same change.

### Complexity: LOW

The logic already exists. This is returning a discriminated union instead of void, plus surfacing it in the outro. No new dependencies, no new subprocess calls, no new files.

---

## Feature 2: Anonymous Install Telemetry

### Industry standard patterns (HIGH confidence)

All major developer CLIs (Next.js, Astro, GitHub CLI, .NET CLI, Sanity, Gatsby) use the same pattern:

- **Opt-out default** — telemetry is on by default. Opt-in rates fall below 3%, making data statistically useless. Industry consensus is opt-out.
- **First-run notice** — one-time message during first `goodvibes init`, not a blocking interactive prompt. Tells the user what's collected and how to opt out.
- **Fire-and-forget transport** — HTTP ping, never awaited, 2s timeout max. If it fails, it fails silently. CLI responsiveness is never affected.
- **Env var opt-out** — `DO_NOT_TRACK=1` (the donottrack.sh standard) and a tool-specific `GOODVIBES_NO_TELEMETRY=1`. Environment variable takes precedence over everything.
- **No PII** — no IP address, no username, no file paths, no OS, no arch. Counter only.

### What "counter only" means

For goodvibes, the right data posture is a simple increment per `goodvibes init` run. No version, no OS, no arch. This is consistent with goodvibes' own values (minimalism, zero-config) and eliminates any GDPR complexity.

> "Counter only" = one HTTP request to a server endpoint that increments a number. The request body or path can include a random event UUID (to deduplicate retries), but nothing identifying the user or machine.

This is simpler than what Next.js or Astro collect (they track command flags, integrations, OS). Simpler is correct for goodvibes.

### Table-stakes behavior

| Behavior | Why Expected | Complexity | Notes |
|----------|--------------|------------|-------|
| Opt-out via `DO_NOT_TRACK=1` | Standard per donottrack.sh; respecting this is a baseline expectation | LOW | Env var check at call site |
| Opt-out via `GOODVIBES_NO_TELEMETRY=1` | Tool-specific override for users who need to be explicit | LOW | Same as above |
| First-run notice shown exactly once | Users must be told telemetry exists; not showing = trust violation | LOW | Store "notice_shown: true" in `~/.config/goodvibes/telemetry.json` |
| Non-blocking — never delays or crashes init | CLI speed is table stakes | LOW | Fire-and-forget with void and catch-all |
| No PII collected ever | Legal baseline (GDPR, CCPA) and ethical baseline | LOW | Counter-only request with no user data |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| First-run notice in plain English, inline in outro | Users of a "beginner-first" tool need plain language, not a banner linking to a privacy policy | LOW | One line in the outro block; only on first run |
| Telemetry status visible in `goodvibes doctor` | Power users want to know what the tool is doing without reading docs | LOW | Add telemetry: enabled/disabled to doctor output |

### Anti-features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Interactive opt-in prompt ("Would you like to help?") | Kills zero-config; blocks init for everyone; opt-in rates are < 3% | Opt-out with first-run notice |
| Collecting OS, arch, Node/Python version, package version | Violates goodvibes' own minimalism values; creates unnecessary data retention obligation | Counter only |
| Unique persistent machine ID (UUID stored in config) | Creates a pseudonymous identifier that complicates GDPR posture | No ID at all; counter only |
| Using a third-party analytics service (PostHog, Amplitude, Segment) | Adds a dependency, creates data processor relationship, overkill for a count | Self-hosted simple counter endpoint |
| Batching events locally and flushing later | Unnecessary complexity for a counter | Fire-and-forget per init run |
| Showing telemetry notice on every run | Annoying; notice should show once | Persist "shown" flag in `~/.config/goodvibes/telemetry.json` |

### Implementation approach

**Client side (both npm and pip packages):**

```typescript
// utils/telemetry.ts
export async function sendTelemetryPing(): Promise<void> {
  if (process.env['DO_NOT_TRACK'] === '1' || process.env['GOODVIBES_NO_TELEMETRY'] === '1') return
  // fire-and-forget: void the promise, never await at call site
  fetch('https://goodvibes-telemetry.vercel.app/ping', { method: 'POST', signal: AbortSignal.timeout(2000) })
    .catch(() => {}) // ponytail: swallowing intentional — telemetry must never crash init
}
```

**First-run notice storage:** `~/.config/goodvibes/telemetry.json` with `{ "notice_shown": true }`.
On first init where `notice_shown` is not set:
- Write the file
- Add to the outro: `Tip: goodvibes counts anonymous installs (no data about you). Opt out: export GOODVIBES_NO_TELEMETRY=1`

**Server side:** A Vercel edge function (1 route, 10 lines) incrementing a counter in KV storage. This is infra, not package code.

**Parity:** Python package uses `urllib.request` from stdlib — no new dependencies.

### Complexity: LOW (client) + MEDIUM (server infra)

Client code is trivial. The server endpoint is a one-time setup but introduces infra dependency (Vercel KV or similar). The MEDIUM rating is for the server-side work, not the client.

---

## Feature 3: `goodvibes update` Command

### What problem this solves

Users who ran `goodvibes init` with v1.0.0 may have outdated CI workflows, stale IDE rule files, or older skill files. Currently there is no way to pull in updates without re-running `goodvibes init` (which skips existing files) or manually checking what changed. `goodvibes upgrade` updates the binary but not the project files.

### How comparable tools handle template updates

| Tool | Strategy | Conflict handling | Notes |
|------|----------|-------------------|-------|
| Copier | 3-way merge, `--pretend` for dry-run | inline conflict markers or `.rej` files | Best-in-class but requires git history; too complex for beginners |
| Meltano EDK | `init --update` flag; overwrite specified files | Force overwrite, no merge | Simple but destructive without preview |
| Angular `ng update` | Migration scripts per version | Applies transforms programmatically | Language-specific, not applicable |
| dotnet new update | Updates template package, re-scaffolds | Interactive per-file | Too verbose for beginners |
| Drupal scaffold composer plugin | Hash comparison; overwrites managed files | Warns on user modifications | Closest to the right model for goodvibes |
| Terraform init | Fully idempotent re-run; no merge needed | Not applicable (declarative) | Wrong model |

**Evidence-backed recommendation for goodvibes:** Hash-comparison strategy (SHA256), not 3-way merge. Three-way merge requires git history context that goodvibes does not own and conflict markers that beginners cannot resolve.

### Three categories of files for update

| Category | Files | Strategy |
|----------|-------|----------|
| Managed (safe to update) | `.github/workflows/`, `.claude/skills/`, IDE rule files (`.cursorrules`, `GEMINI.md`, etc.) | Hash compare; overwrite if different and user confirms |
| Merge-safe | `CLAUDE.md` | Re-run sentinel merge; append new rule sections, never remove user content |
| Never touch | `JOURNAL.md`, `CHANGELOG.md`, user code files | Explicitly excluded; not part of templates ownership |

### Table-stakes behavior

| Behavior | Why Expected | Complexity | Notes |
|----------|--------------|------------|-------|
| `--dry-run` preview shows what would change before anything is written | Users expect to see the impact before committing | MEDIUM | Must compare all managed file hashes, report changed count and which files |
| Confirmation step (or `--force` flag) before any overwrites | Files the user may have edited are at risk; silent overwrite is destructive | LOW | `@clack/prompts` `confirm()` before writing, or skip with `--force` |
| CLAUDE.md uses sentinel merge, not overwrite | CLAUDE.md is the only template file users are expected to edit | LOW | Re-use existing `sentinelMerge` utility already in codebase |
| Files not from goodvibes templates are never touched | Users must be able to trust that `update` has a defined scope | LOW | Only iterate the template file list; never walk the project directory |
| Summary shows: X files updated, Y up-to-date, Z skipped (user-modified) | Users need to understand what happened | LOW | Depends on hash comparison result |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "User-modified" detection: if local file differs from both old and new template versions, flag it as "you've edited this — skipped" | Protects user work without 3-way merge complexity | HIGH | Requires storing the original template hash at init time (manifest file) |
| Per-category `--skip-ci`, `--skip-ide-rules` flags | Power users may want to update only some categories | LOW | Add after the core update flow works |

### Anti-features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| 3-way merge with inline conflict markers | Beginners cannot resolve `<<<<<<< OURS` markers; creates broken files | Hash comparison + confirmation |
| Interactive per-file confirmation for all files | 15+ files × Y/N = unusable; beginners will panic | Show summary, confirm once, then apply all |
| Silently overwriting files the user has edited | Destructive; destroys user work | Confirmation step + `--force` flag for CI |
| `goodvibes update` also updating the binary | Conflates two concerns; `goodvibes upgrade` already does binary updates | Clearly distinct from `goodvibes upgrade` in UX and docs |
| Storing a manifest of which files goodvibes wrote (for user-modified detection) | Adds complexity and a lockfile to track; v1.2.0 scope should be simpler | Ship without user-modified detection; detect by hash only |

### Implementation approach

**Simpler v1.2.0 approach (no manifest):**

1. Iterate all files in the bundled templates directory (same `resolveTemplatesDir()` already used by init)
2. For each file, compute SHA256 of the bundled version and the on-disk version
3. If hashes differ: candidate for update
4. If file does not exist on disk: new file (just write it)
5. Show summary: "N files have newer versions, M new files"
6. If `--dry-run`: stop here
7. Otherwise: confirm once ("Update these files? (y/N)") or skip with `--force`
8. Write updated files, re-run sentinel merge for CLAUDE.md

**Deferred (v1.3.0):** user-modified detection via stored manifest of original-install hashes.

### Complexity: MEDIUM

The hash-comparison loop and `--dry-run` output are new logic. Re-using `copyTemplates`, `resolveTemplatesDir`, and `sentinelMerge` keeps it from being HIGH. The confirmation flow requires a new `@clack/prompts` `confirm()` call. Both npm and pip packages need the new command registered.

---

## Feature Dependencies

```
Feature 1 (headroom validation)
    └── depends on ──> existing installHeadroom + configureMcp (already built)
    └── surfaces in ──> init.ts outro block (minor change)

Feature 2 (telemetry)
    └── depends on ──> server-side counter endpoint (infra, not package code)
    └── client code is independent of Feature 1 and Feature 3

Feature 3 (update command)
    └── depends on ──> resolveTemplatesDir() — already built
    └── reuses ──> sentinelMerge — already built
    └── independent of ──> Feature 1 and Feature 2
```

**Recommended build order within the milestone:** 1 → 2 → 3

- Feature 1 is the fastest win (small return-type change, big UX improvement)
- Feature 2 requires server-side infra to be set up first, then client is trivial
- Feature 3 is the most complex and benefits from the milestone being otherwise stable

---

## MVP Definition

### Ship (v1.2.0 — all three features)

- [ ] `installHeadroom` returns `HeadroomInstallStatus` — closes the void→status gap
- [ ] `configureMcp` returns `McpConfigStatus` — closes the void→status gap
- [ ] `init` outro shows headroom + MCP status in a structured note block
- [ ] `goodvibes doctor` reports headroom installed/not-installed
- [ ] Telemetry HTTP ping, fire-and-forget, 2s timeout, no PII
- [ ] `GOODVIBES_NO_TELEMETRY=1` and `DO_NOT_TRACK=1` both skip telemetry
- [ ] First-run notice shown once in outro; state stored in `~/.config/goodvibes/telemetry.json`
- [ ] Server-side counter endpoint deployed (Vercel edge function)
- [ ] `goodvibes update` command registered in both npm and pip packages
- [ ] `goodvibes update --dry-run` shows count and list of changed files
- [ ] `goodvibes update` prompts confirmation (or accepts `--force`)
- [ ] CLAUDE.md updated via sentinel merge, not overwrite
- [ ] npm and pip parity throughout (all three features in both packages)

### Defer (v1.3.0)

- [ ] User-modified detection via stored hash manifest — requires designing a lockfile format
- [ ] `goodvibes update --skip-ci` / `--skip-ide-rules` granular flags
- [ ] `goodvibes telemetry disable` command (env var is sufficient for v1.2.0)
- [ ] Telemetry in `goodvibes update` and `goodvibes doctor` runs (start with init only)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Headroom install status in outro | HIGH — most users run goodvibes init and have no idea if headroom worked | LOW — return type change + outro update | P1 |
| MCP config status in outro | HIGH — same reason as above | LOW | P1 |
| `goodvibes update --dry-run` | HIGH — users want to see what changed before committing | MEDIUM — hash comparison loop | P1 |
| `goodvibes update` (apply) | HIGH — core value of the milestone | MEDIUM — confirmation flow + writes | P1 |
| Telemetry ping | MEDIUM — value is author insight, not user value | LOW (client) / MEDIUM (server infra) | P2 |
| First-run telemetry notice | MEDIUM — required for trust, not for functionality | LOW | P2 |
| `goodvibes doctor` telemetry status | LOW — power-user feature | LOW | P3 |
| User-modified detection in update | HIGH — prevents accidental user work loss | HIGH — requires manifest design | Defer to v1.3 |

---

## Sources

- [GitHub CLI telemetry documentation — docs.github.com](https://docs.github.com/en/github-cli/github-cli/github-cli-telemetry)
- [GitHub CLI: Opt-out usage telemetry — GitHub Changelog (2026-04-22)](https://github.blog/changelog/2026-04-22-github-cli-opt-out-usage-telemetry/)
- [DO_NOT_TRACK standard — donottrack.sh](https://donottrack.sh/)
- [Astro telemetry — astro.build/telemetry](https://astro.build/telemetry/)
- [Next.js telemetry — nextjs.org/telemetry](https://nextjs.org/telemetry)
- [Why Your Open Source Project Needs Telemetry — 1984 Ventures](https://1984.vc/docs/founders-handbook/eng/open-source-telemetry)
- [Copier CLI reference — deepwiki.com/copier-org/copier](https://deepwiki.com/copier-org/copier/5.2-cli-reference)
- [Scaffold file update paradigm — meltano/edk issue #65](https://github.com/meltano/edk/issues/65)
- [UX patterns for CLI tools — lucasfcosta.com](https://lucasfcosta.com/2022/06/01/ux-patterns-cli-tools.html)
- [CLI UX best practices: progress displays — Evil Martians](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays)
- [Headroom MCP documentation — headroom-docs.vercel.app/docs/mcp](https://headroom-docs.vercel.app/docs/mcp)
- [Headroom CLI commands — headroomlabs-ai.github.io/headroom/cli](https://headroomlabs-ai.github.io/headroom/cli/)

---
*Feature research for: goodvibes v1.2.0 Growth & Retention*
*Researched: 2026-07-03*
