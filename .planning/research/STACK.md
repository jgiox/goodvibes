# Technology Stack

**Project:** goodvibes
**Researched:** 2026-07-03 (v1.0 original: 2026-06-23; v1.1.0: 2026-06-26; updated for v1.2.0 Growth & Retention milestone)

---

## Existing Stack (v1.0 — Do Not Re-research)

Already validated and in production. Not changing for v1.2.0.

| Package | Version | Purpose | License |
|---|---|---|---|
| `commander` | ^15 | Argument parsing, subcommands | MIT |
| `@clack/prompts` | ^1 | Interactive wizard UX | MIT |
| `fs-extra` | ^11 | Cross-platform file copy/write | MIT |
| `execa` | ^9 | Subprocess calls (uv, git) | MIT |
| `tsup` | ^8 | Build / bundle | MIT |
| `typescript` | ^6 | Language | Apache 2.0 |
| `typer` | ^0.15 | pip CLI framework | MIT |
| `rich` | ^14 | Terminal output | MIT |

Note: package.json actually shows `commander ^15`, `@clack/prompts ^1`, `typescript ^6`, `@types/node ^26`, `vitest ^4` — the v1.1.0 STACK.md listed older versions, the above reflects actual current versions.

---

## New Tooling for v1.1.0

See prior STACK.md entry (VHS, shields.io, --minimal flag). No changes for v1.2.0.

---

## New Tooling for v1.2.0

Three features, zero new dependencies across all three. Detailed below.

---

### 1. Headroom Integration Validation

**Decision: No new dependencies. Refactor return types only.**

**What the problem is now:**

`installHeadroom()` and `configureMcp()` both return `Promise<void>`. The `@clack/prompts` `tasks()` array in `init.ts` hard-codes the task return value as `'headroom ready'` and `'MCP server registered'` regardless of whether the install succeeded, was skipped (Python absent), or failed (C++ build error).

The user sees "headroom ready" even when headroom was not installed, because the return value is a fixed string, not derived from the function's outcome.

**What to change:**

Change both functions to return a structured result instead of void:

```typescript
// In install-headroom.ts
export type HeadroomInstallResult =
  | { status: 'installed' }
  | { status: 'already-installed' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

export async function installHeadroom(
  log: (msg: string) => void
): Promise<HeadroomInstallResult>
```

```typescript
// In configure-mcp.ts
export type McpConfigResult =
  | { status: 'registered' }
  | { status: 'already-registered' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

export async function configureMcp(
  log: (msg: string) => void
): Promise<McpConfigResult>
```

The `init.ts` task then returns the human-readable string from the result:

```typescript
{
  title: 'Installing headroom',
  task: async (message) => {
    const result = await installHeadroom(msg => message(msg))
    switch (result.status) {
      case 'installed': return 'headroom installed'
      case 'already-installed': return 'headroom already installed'
      case 'skipped': return `headroom skipped — ${result.reason}`
      case 'failed': return `headroom install failed — ${result.reason}`
    }
  },
}
```

**Post-install validation:**

After the installer loop succeeds in `installHeadroom`, run `headroom --version` to confirm the binary is on PATH and usable. If this probe fails after a fresh install, return `{ status: 'failed', reason: 'headroom binary not found on PATH after install (check shell PATH)' }`. This uses the already-imported `execa` — no new dependency.

**Post-MCP validation:**

After `claude mcp add` or `headroom mcp install` succeeds in `configureMcp`, run `headroom mcp status` as a final probe and include whether it returned exit 0 in the result. Again, already uses `execa`.

**Final status display:**

Add a note after the task list in `init.ts` that summarizes the headroom state:

```
headroom: installed | MCP: registered
```

or

```
headroom: skipped (Python 3.10+ not found) | MCP: not configured
```

This is a single `note()` call using already-installed `@clack/prompts`.

**Confidence:** HIGH — confirmed by reading current source. The root cause is clear (fixed return strings). The fix is a type change and switch statement.

---

### 2. Anonymous Install Telemetry

**Decision: Native `fetch()` (Node 20 built-in) + PostHog EU Cloud. Zero new npm dependencies. Zero new pip dependencies.**

**Why this approach:**

| Criterion | posthog-node SDK | Raw fetch() to PostHog | Plausible Events API | Custom serverless counter |
|---|---|---|---|---|
| New npm dependencies | Yes (~500KB) | None | None | None |
| GDPR compliance | Yes (EU Cloud) | Yes (EU Cloud) | Yes (privacy-first, cookies-free) | Depends on impl |
| Infrastructure needed | No | No | $9/mo or self-host | Cloudflare Worker (free) |
| Dashboard / analytics | Yes | Yes (via PostHog UI) | Yes | No |
| Person profile creation | Opt-in | Opt-out via $process_person_profile: false | N/A | N/A |
| Free tier | 1M events/month | 1M events/month | Paid only (no free tier) | 100K req/day free |
| Offline handling | Built-in (fire & forget) | Manual (AbortSignal.timeout) | Manual | Manual |

PostHog Cloud EU (`https://eu.posthog.com`) with a raw `fetch()` call is the right pick. It gives a real analytics dashboard at zero new dependencies and handles the GDPR requirement by:
- Using `$process_person_profile: false` so no person record is created in PostHog
- Not sending IP in the request body (only the source IP reaches PostHog's server, which they hash and discard per their GDPR policy)
- Using a random per-invocation UUID as `distinct_id` — never stored on disk, never reused

**Why not posthog-node:** It would add ~500KB to the CLI bundle, contradicting the zero-dep philosophy. The raw `fetch()` call for a single event is 15 lines.

**Why not Plausible:** No free tier. Requires paying $9/month or self-hosting Docker infrastructure for a simple counter.

**Why not a custom Cloudflare Worker:** Requires maintaining separate infrastructure. PostHog free tier is simpler and gives a proper analytics dashboard.

**Node.js version dependency:** `fetch()` is stable and built-in since Node 18. goodvibes requires `>=20.12.0`, so no polyfill is needed.

**Implementation skeleton (npm, TypeScript):**

```typescript
// src/telemetry.ts
import { randomUUID } from 'node:crypto'

const POSTHOG_KEY = 'phc_...'   // PostHog project API key (not secret, safe to ship in CLI)
const POSTHOG_HOST = 'https://eu.posthog.com'

export async function trackInit(props: {
  version: string
  os: string
  headroomStatus: string
}): Promise<void> {
  if (process.env.GOODVIBES_TELEMETRY_DISABLED === '1') return

  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: 'init',
        distinct_id: `anon-${randomUUID()}`,   // fresh UUID each run, never stored
        properties: {
          version: props.version,
          os: props.os,
          headroom_status: props.headroomStatus,
          $process_person_profile: false,       // GDPR: no person record created
        },
      }),
      signal: AbortSignal.timeout(3000),        // never block the CLI
    })
  } catch {
    // Swallow silently — telemetry must never fail the CLI
  }
}
```

**Python equivalent (pip package):**

```python
# src/goodvibes_cli/telemetry.py
import json
import os
import uuid
from urllib.request import Request, urlopen

POSTHOG_KEY = "phc_..."
POSTHOG_HOST = "https://eu.posthog.com"

def track_init(version: str, os_name: str, headroom_status: str) -> None:
    if os.environ.get("GOODVIBES_TELEMETRY_DISABLED") == "1":
        return
    payload = json.dumps({
        "api_key": POSTHOG_KEY,
        "event": "init",
        "distinct_id": f"anon-{uuid.uuid4()}",
        "properties": {
            "version": version,
            "os": os_name,
            "headroom_status": headroom_status,
            "$process_person_profile": False,
        },
    }).encode()
    try:
        req = Request(f"{POSTHOG_HOST}/capture/", data=payload,
                      headers={"Content-Type": "application/json"}, method="POST")
        urlopen(req, timeout=3)
    except Exception:
        pass  # Never fail the CLI for telemetry
```

**Opt-out mechanism:**

Primary: `GOODVIBES_TELEMETRY_DISABLED=1` environment variable. This covers CI environments (set in GitHub Actions secrets), Docker containers, and users who want permanent opt-out via their shell profile.

No persistent config file for opt-out. The env var is the simplest mechanism that works everywhere without creating a `~/.goodvibes/` directory that users would be confused by. This matches the pattern used by Next.js (`NEXT_TELEMETRY_DISABLED=1`) and most CLI tools.

**GDPR compliance checklist:**
- [x] No PII collected (no email, username, IP stored, no persistent ID)
- [x] Opt-out via env var, documented in README
- [x] `$process_person_profile: false` prevents PostHog from creating person records
- [x] Per-invocation UUID — not persisted, no fingerprinting across sessions
- [x] EU Cloud endpoint — data stays in EU
- [x] Telemetry mention in README and init output (first run notice)

**First-run notice:** On the very first `goodvibes init`, emit a one-line note via `@clack/prompts` `note()`:

```
Anonymous usage data is collected to improve goodvibes.
Set GOODVIBES_TELEMETRY_DISABLED=1 to opt out.
```

This appears in the task output, not as a blocking prompt. It does not gate the install.

**Confidence:** HIGH — PostHog Node.js docs verified, `$process_person_profile` property confirmed, EU endpoint confirmed. `fetch()` built-in stability in Node 20 confirmed. urllib.request is stdlib, no verification needed.

---

### 3. `goodvibes update` Command

**Decision: SHA-256 manifest file (`.goodvibes.json`). Zero new dependencies.**

**The core problem:**

`goodvibes update` needs to pull new template versions into an existing project without overwriting files the user has edited. A naïve "overwrite everything" approach breaks user customizations. A naïve "skip everything existing" approach means users never get template improvements.

The right signal is: "was this file changed since goodvibes wrote it?" Not "does this file exist?" The SHA-256 of the file goodvibes originally wrote is the ground truth.

**The manifest approach:**

On `goodvibes init`, after all files are written, create `.goodvibes.json`:

```json
{
  "version": "1.6.2",
  "init_date": "2026-07-03",
  "files": {
    "CLAUDE.md": "sha256:e3b0c44298fc1c149afbf4c8996fb924...",
    ".github/workflows/ci-node.yml": "sha256:d82c3f5b1a7...",
    ".claude/skills/caveman/SKILL.md": "sha256:b94f6f125c7..."
  }
}
```

On `goodvibes update`:

1. Read `.goodvibes.json` — if absent, exit with: "This project was not initialized with goodvibes init, or .goodvibes.json was deleted. Run goodvibes init to set up the project."
2. Load new templates from the installed goodvibes package (same `resolveTemplatesDir()` used by init)
3. For each template file in the new package:
   - **File not in manifest** (added in a newer goodvibes version): write it; add to manifest
   - **File in manifest, not on disk** (user deleted): write it; update manifest hash
   - **File in manifest, on disk, disk hash == manifest hash**: user hasn't modified it → overwrite with new template; update manifest hash
   - **File in manifest, on disk, disk hash != manifest hash**: user modified it → skip; report as "kept (user-modified)"
4. Write updated `.goodvibes.json`
5. Show summary: "Updated N files, kept M (user-modified), added K (new files)"

**Implementation uses only existing tools:**
- `node:crypto` (`createHash('sha256')`) — built-in
- `fs-extra` (`readFile`, `outputFile`) — already installed
- `fs-extra` `pathExists()` — already installed

No three-way merge needed. Goodvibes writes static files, not parameterized templates — if the template file and the project file are identical (same SHA), the update is safe. If the user has edited the file, goodvibes defers to the user.

**Edge case: CLAUDE.md**

CLAUDE.md is always modified by users (goodvibes merges rules into it, then users add their own). Its SHA will always differ from the original template. The update command skips it and shows "CLAUDE.md — kept (user-modified)". This is correct behavior: CLAUDE.md is a living document, not a static template.

**Edge case: `.goodvibes.json` missing**

Introduced in v1.2.0 — projects initialized with v1.1.x or earlier do not have a manifest. `goodvibes update` should detect this and print:

```
.goodvibes.json not found — this project was initialized with an older version of goodvibes.
Run goodvibes init to re-initialize and create the manifest, then goodvibes update will work going forward.
```

Do not attempt a "best-effort update without manifest" — the risk of overwriting user-modified files is too high.

**`.goodvibes.json` should be committed** — it's not secret, it's small, and committing it means the whole team benefits from `goodvibes update` working correctly.

**No new dependencies:**
- npm: `node:crypto` (built-in since Node 10) + `fs-extra` (already installed) + `node:fs/promises` (built-in)
- pip: `hashlib` (stdlib) + `pathlib` (stdlib) + `shutil` (stdlib)

**Confidence:** HIGH — SHA-256 file integrity is a solved problem in every runtime. The manifest pattern is used by package managers, Docker layer caching, and npm's `package-lock.json`. No external validation needed.

---

## What NOT to Add for v1.2.0

| Tool | Why Not |
|---|---|
| `posthog-node` | Adds ~500KB bundle; raw `fetch()` achieves the same single-event capture in 15 lines |
| `plausible-telemetry` (npm) | Published 5 years ago, 0.1.0, effectively unmaintained; Plausible's HTTP API works directly via fetch |
| `diff` / `diff3` npm package | Three-way merge is overkill for static file templates; SHA hash comparison is sufficient |
| `copier` (Python) | Template engine approach for parametrized templates; goodvibes uses static files — shutil.copytree is enough |
| `@sindresorhus/conf` | Persistent config store for opt-out preference; env var (GOODVIBES_TELEMETRY_DISABLED=1) is simpler and CI-friendly |
| `uuid` npm package | `node:crypto` `randomUUID()` is built-in since Node 14.17 and covers the per-invocation UUID need |
| Cloudflare Worker / custom backend | Additional infrastructure to maintain; PostHog free tier (1M events/month) covers the counter need with a real dashboard |
| `semver` npm package | Not needed; version comparison for update command just reads the manifest version string — no range logic required |

---

## Summary of New Additions for v1.2.0

| Addition | Type | Where | New runtime dep? |
|---|---|---|---|
| `HeadroomInstallResult` / `McpConfigResult` types | Code change | `install-headroom.ts`, `configure-mcp.ts` | No |
| Structured return from headroom steps | Code change | `install-headroom.ts`, `configure-mcp.ts`, `init.ts` | No |
| Post-install `headroom --version` probe | Code change | `install-headroom.ts` | No |
| Headroom status `note()` in init output | Code change | `init.ts` | No |
| `src/telemetry.ts` | New file | `packages/npm/src/` | No (uses node:crypto + fetch) |
| `goodvibes_cli/telemetry.py` | New file | `packages/pip/src/` | No (uses urllib.request + hashlib) |
| `.goodvibes.json` manifest writer | Code change | `init.ts` / `init_cmd.py` | No |
| `goodvibes update` command | New command | `packages/npm/src/commands/update.ts` + pip equivalent | No |
| PostHog project (external setup) | External | PostHog EU Cloud dashboard | N/A |

Zero new runtime dependencies for either package.

---

## Confidence Levels

| Area | Confidence | Rationale |
|---|---|---|
| Headroom return-type refactor | HIGH | Source code read directly; root cause confirmed; fix is mechanical |
| `fetch()` available in Node 20 | HIGH | Node.js docs confirm stable since Node 18, unflagged since Node 21; project requires >=20.12.0 |
| PostHog `$process_person_profile: false` | HIGH | PostHog docs confirmed this property prevents person record creation; EU Cloud endpoint confirmed |
| `urllib.request` for Python telemetry | HIGH | Python stdlib since 3.0; no research needed |
| SHA-256 manifest update strategy | HIGH | Standard pattern used by package managers; `node:crypto` and Python `hashlib` both provide sha256 |
| GDPR compliance of per-invocation UUID | HIGH | No persistence = no tracking = no GDPR concern; `$process_person_profile: false` prevents PostHog profiling |
| `.goodvibes.json` not-in-manifest behavior | MEDIUM | The "older project" edge case is well-understood but the specific UX error message needs user testing |
| PostHog free tier limits | MEDIUM | "1M events/month free" confirmed on PostHog pricing page; actual rate limit enforcement not tested |

---

## Sources

- [PostHog Node.js library — posthog.com/docs](https://posthog.com/docs/libraries/node)
- [Next.js Telemetry — nextjs.org/telemetry](https://nextjs.org/telemetry) — reference pattern for opt-out via env var
- [Plausible Events API — plausible.io/docs/events-api](https://plausible.io/docs/events-api) — considered and rejected (no free tier)
- [Copier update mechanism — copier.readthedocs.io](https://copier.readthedocs.io/en/stable/updating/) — three-way merge approach; too heavy for static files
- [posthog-node — npm](https://www.npmjs.com/package/posthog-node?activeTab=dependents) — 518 dependents, v5.28.5 current as of July 2026
- [Archon telemetry issue — github.com/coleam00/Archon](https://github.com/coleam00/Archon/issues/1261) — reference pattern for anonymous CLI telemetry with PostHog
- [headroom MCP commands — headroom-docs.vercel.app](https://headroom-docs.vercel.app/docs/installation) — `headroom mcp status`, `headroom doctor` confirmed
- Codebase read directly: `packages/npm/src/steps/install-headroom.ts`, `configure-mcp.ts`, `commands/init.ts`, `packages/pip/src/goodvibes_cli/steps/`

---
*Stack research for: goodvibes v1.2.0 Growth & Retention (headroom validation, telemetry, update command)*
*Researched: 2026-07-03*
