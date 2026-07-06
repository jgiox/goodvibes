# Phase 13: Anonymous Telemetry - Research

**Researched:** 2026-07-06
**Domain:** Cloudflare Workers + KV counter, fire-and-forget HTTP from Node.js and Python, GitHub Actions wrangler deploy
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Worker source lives in `workers/telemetry/` in this repo — `wrangler.toml` + worker script source-controlled alongside CLI code.
- **D-02:** Worker increments two KV keys per request: `total` and the current ISO date key (`YYYY-MM-DD`). The request body is ignored. IP is never read or stored.
- **D-03:** Worker deployed via GitHub Actions on push to main. Requires `CLOUDFLARE_API_TOKEN` secret. No manual deploy step.
- **D-04:** Both npm CLI and pip CLI get telemetry in Phase 13. Same disclosure line, same opt-out env vars (`DO_NOT_TRACK=1`, `GOODVIBES_NO_TELEMETRY=1`, `CI=true`), same fire-and-forget timing behavior.
- **D-05:** npm uses `fetch()` (Node 18+ built-in, no new dep). pip uses `urllib.request` (stdlib, no new dep).
- **D-06:** HTTP method is POST with an empty body.
- **D-07:** Production CF Worker URL hardcoded as a constant. `GOODVIBES_TELEMETRY_URL` env var overrides for local dev and test.
- **D-08:** Disclosure: `"Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out."`
- **D-09:** npm: `note()` after `intro()`. pip: `console.print(Panel(...))` after `console.rule(...)`.
- **D-10:** npm: `Promise.race([telemetryPromise, sleep(1000)])` after tasks resolve. pip: `threading.Thread(daemon=True)` joined with `thread.join(timeout=1.0)` after tasks.
- **D-11:** Unit tests mock the HTTP call at the module boundary. No real network calls in tests.

### Claude's Discretion

- Exact X-Request-Id header behavior for TEL-02 UUID (send as header vs. generate but not transmit — see Open Questions)
- CF Worker wrangler.toml `compatibility_date` value
- Whether `workers/telemetry/` gets its own `package.json` for local wrangler dev, or relies on `npx wrangler`
- Exact deploy workflow trigger: push to `main` only, or also path-filtered on `workers/telemetry/**`

### Deferred Ideas (OUT OF SCOPE)

- Telemetry in `goodvibes update` and `goodvibes doctor` — deferred to v1.3.0
- `goodvibes telemetry disable` command — deferred to v1.3.0
- A KV read endpoint to expose counter data via HTTP — not in scope for Phase 13
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEL-01 | `goodvibes init` sends an anonymous fire-and-forget event to a GDPR-compliant endpoint (no PII, no persistent user ID) | CF Worker + KV counter pattern; no IP storage; D-02; stdlib HTTP clients |
| TEL-02 | Telemetry uses a per-invocation `randomUUID()` — never stored on disk | `crypto.randomUUID()` (Node 20 built-in, VERIFIED); `uuid.uuid4()` (Python stdlib, VERIFIED) |
| TEL-03 | Opt-out via `DO_NOT_TRACK=1` or `GOODVIBES_NO_TELEMETRY=1`; auto-suppressed when `CI=true` | Env var check at module boundary; consistent with existing graceful-skip patterns |
| TEL-04 | One-line disclosure shown in init intro before tasks run | `note()` / Panel pattern already in codebase; D-08/D-09 |
| TEL-05 | Telemetry never blocks or slows init — `Promise.race` with 1-second grace after tasks complete | Node: Promise.race + AbortController; Python: threading.Thread(daemon=True) + join(1.0); D-10 |
</phase_requirements>

---

## Summary

Phase 13 wires a single-fire anonymous install counter into `goodvibes init` for both the npm and pip CLIs, and delivers the Cloudflare Worker + KV endpoint that counts it. The implementation is entirely stdlib on the client side — Node.js 20's built-in `fetch()` + `crypto.randomUUID()` (confirmed present in the project's `engines: >=20.12.0`) and Python's `urllib.request` + `uuid` + `threading`. No new runtime dependencies are introduced in either CLI package.

The Cloudflare Worker is a minimal read-increment-write counter (~20 lines of JavaScript) deployed via `cloudflare/wrangler-action@v4`. The only new package across the entire repo is `wrangler` (devDependency in `workers/telemetry/`), which is needed for local worker development and by the GitHub Actions deploy step.

The non-blocking timing patterns (Promise.race / daemon thread join) follow existing patterns in the codebase (headroom uses execa with timeout; graceful degradation is already the project convention). Testing follows the established mock-at-module-boundary pattern already used in `install-headroom.ts` and `test_install_headroom.py`.

**Primary recommendation:** Implement telemetry as a standalone module (`telemetry.ts` / `telemetry.py`) with a single exported function, keeping all env-var checks and HTTP logic inside it. Mock via `vi.stubGlobal('fetch', vi.fn())` in vitest; `mocker.patch('goodvibes_cli.steps.telemetry.urllib.request.urlopen')` in pytest. This mirrors the existing `installHeadroom` boundary pattern exactly.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Counter increment | Cloudflare Worker (edge) | — | Worker owns the write; client is fire-and-forget |
| Opt-out enforcement | CLI (npm + pip) | — | Env var check must happen before any network call leaves the client |
| Disclosure display | CLI (npm + pip) | — | UX concern lives at the CLI tier |
| Fire-and-forget timeout | CLI (npm + pip) | — | Client controls how long it waits; Worker has no concept of client timeout |
| KV persistence | Cloudflare KV (storage) | — | Only tier with persistence; Worker reads and writes |
| Deployment automation | GitHub Actions (CI) | — | Keeps Worker source-controlled and auto-deployed on merge |
| Secrets management | GitHub (CI secrets) | — | CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID; never in code |

---

## Standard Stack

### Core (no new runtime deps in CLI packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fetch` (Node built-in) | Node 20+ | HTTP POST from npm CLI | Built into Node 20+ (project requires `>=20.12.0`) [VERIFIED: runtime check] |
| `crypto.randomUUID` (Node built-in) | Node 20+ | Per-invocation UUID for TEL-02 | Built into Node 20+ crypto module [VERIFIED: runtime check] |
| `AbortController` (Node built-in) | Node 20+ | Timeout signal for fetch | Built into Node 20+ [VERIFIED: runtime check] |
| `urllib.request` (Python stdlib) | 3.10+ | HTTP POST from pip CLI | Python stdlib; project requires `>=3.10` [VERIFIED: runtime check] |
| `uuid.uuid4()` (Python stdlib) | 3.10+ | Per-invocation UUID for TEL-02 | Python stdlib `uuid` module [VERIFIED: runtime check] |
| `threading.Thread` (Python stdlib) | 3.10+ | Non-blocking telemetry execution | Python stdlib; daemon=True prevents blocking process exit [VERIFIED: runtime check] |

### Worker Infrastructure

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `wrangler` | ^4.107.0 | Local CF Worker dev + CI deploy | Official Cloudflare CLI; MIT OR Apache-2.0 [VERIFIED: npm registry] |
| `cloudflare/wrangler-action` | v4 | GitHub Actions deploy step | Official Cloudflare action; default wrangler version is now v4 [VERIFIED: GitHub API] |
| Cloudflare Workers + KV | — | Counter endpoint | Project decision D-01 through D-03 (locked) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fetch()` built-in | `axios`, `node-fetch` | New dep, cold-start overhead — D-05 explicitly locks built-in |
| `urllib.request` | `requests`, `httpx` | New dep — D-05 explicitly locks stdlib |
| `threading.Thread` | `asyncio` | asyncio would require making `init_cmd` async throughout; threading is simpler and sufficient |
| CF KV read-modify-write | Durable Objects atomic counter | Durable Objects requires different Worker class, more complex setup; KV is sufficient for this throughput |

**Installation (new `workers/telemetry/` package only):**
```bash
cd workers/telemetry && npm install
```
No changes to `packages/npm/package.json` or `packages/pip/pyproject.toml`.

---

## Package Legitimacy Audit

Only one new package is introduced — `wrangler` as a devDependency in the new `workers/telemetry/` subpackage. The CLI packages (npm and pip) gain zero new dependencies.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `wrangler` | npm | ~7 years | Very high (CF core product) | github.com/cloudflare/workers-sdk | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

slopcheck ran successfully on 2026-07-06. Note: slopcheck queried PyPI (cross-ecosystem), but npm registry confirms `wrangler` at v4.107.0 from the official `cloudflare/workers-sdk` monorepo with MIT OR Apache-2.0 license. [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
goodvibes init (npm or pip)
        │
        ├─► [1] note()/Panel: "Anonymous usage stats are collected..."
        │
        ├─► [2] telemetryPromise = sendTelemetry() ──────────────────────┐
        │         (non-blocking, errors swallowed)                        │
        │                                                                 │
        ├─► [3] await tasks([...]) — copy files, install headroom        │
        │                                                                 │
        └─► [4] await Promise.race([telemetryPromise, sleep(1000)])  ◄───┘
                  (give telemetry up to 1s after tasks; capped)
                        │
                        ▼
            POST https://goodvibes-telemetry.<account>.workers.dev/
                  (empty body, X-Request-Id header optional)
                        │
                        ▼
              Cloudflare Worker (edge)
                        │
                 request.method !== POST? → 204 return
                        │
                        ▼
              KV.get("total") → increment → KV.put("total", n+1)
              KV.get("YYYY-MM-DD") → increment → KV.put(date, n+1)
                        │
                        ▼
                    200 OK (empty body)
```

Python equivalent: threading.Thread(daemon=True) + thread.join(timeout=1.0) replacing Promise.race + sleep.

### Recommended Project Structure

```
workers/
└── telemetry/
    ├── wrangler.toml        # Worker config + KV binding
    ├── worker.js            # ~20-line counter script (JS, not TS — no build step needed)
    └── package.json         # {"devDependencies": {"wrangler": "^4"}} for local dev

packages/
├── npm/src/
│   └── steps/
│       ├── telemetry.ts         # NEW: sendTelemetry() export
│       └── telemetry.test.ts    # NEW: unit tests (mock fetch)
└── pip/src/goodvibes_cli/
    └── steps/
        ├── telemetry.py         # NEW: send_telemetry() + start_telemetry_thread()
        └── (tests in packages/pip/tests/test_telemetry.py)

.github/workflows/
└── deploy-worker.yml        # NEW: wrangler deploy on push to main
```

### Pattern 1: Fire-and-Forget with Timeout (npm/TypeScript)

**What:** Start telemetry before tasks; after tasks complete, wait at most 1 second for it to finish.

**When to use:** Any init command that needs a best-effort side-effect without blocking the user.

```typescript
// Source: D-05 (built-in fetch), D-10 (Promise.race), Node 20 AbortController
const TELEMETRY_URL = process.env.GOODVIBES_TELEMETRY_URL
  ?? 'https://goodvibes-telemetry.<account>.workers.dev/'

export async function sendTelemetry(): Promise<void> {
  if (
    process.env.DO_NOT_TRACK === '1' ||
    process.env.GOODVIBES_NO_TELEMETRY === '1' ||
    process.env.CI === 'true'
  ) return

  const { randomUUID } = await import('node:crypto')
  const id = randomUUID() // per-invocation, never stored to disk (TEL-02)
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 5_000)
  try {
    await fetch(TELEMETRY_URL, {
      method: 'POST',
      body: null,
      signal: ac.signal,
      headers: { 'X-Request-Id': id },
    })
  } catch {
    // silent on error — network failure must not affect init
  } finally {
    clearTimeout(timer)
  }
}

// ponytail: inline helper — too small to justify a separate module
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

Integration in `init.ts`:
```typescript
// After intro(), before tasks()
note('Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out.')

const telemetryPromise = sendTelemetry()
// ... existing tasks setup ...
await tasks(taskList)
await Promise.race([telemetryPromise, sleep(1_000)])
```

### Pattern 2: Fire-and-Forget with Timeout (pip/Python)

**What:** Daemon thread for telemetry; join with 1-second timeout after tasks complete.

```python
# Source: D-05 (urllib.request), D-10 (threading.Thread), Python stdlib
import os
import threading
import urllib.request
import uuid as _uuid

TELEMETRY_URL = os.environ.get(
    'GOODVIBES_TELEMETRY_URL',
    'https://goodvibes-telemetry.<account>.workers.dev/'
)

def _opt_out() -> bool:
    return (
        os.environ.get('DO_NOT_TRACK') == '1'
        or os.environ.get('GOODVIBES_NO_TELEMETRY') == '1'
        or os.environ.get('CI') == 'true'
    )

def _fire(request_id: str) -> None:
    try:
        req = urllib.request.Request(
            TELEMETRY_URL,
            method='POST',
            headers={'X-Request-Id': request_id},
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass  # ponytail: silent on error — network must not affect init

def start_telemetry_thread() -> threading.Thread | None:
    if _opt_out():
        return None
    request_id = str(_uuid.uuid4())  # per-invocation, never stored (TEL-02)
    t = threading.Thread(target=_fire, args=(request_id,), daemon=True)
    t.start()
    return t
```

Integration in `init_cmd.py`:
```python
# After console.rule(), before tasks
console.print(Panel(
    'Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out.',
    title='Privacy'
))

tel_thread = start_telemetry_thread()
# ... existing task blocks ...
if tel_thread is not None:
    tel_thread.join(timeout=1.0)
```

### Pattern 3: Cloudflare Worker Counter

```javascript
// Source: CITED: developers.cloudflare.com/kv/api/write-key-value-pairs/
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response(null, { status: 204 });

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const total = parseInt((await env.INSTALLS.get('total')) ?? '0', 10);
    await env.INSTALLS.put('total', String(total + 1));
    const day = parseInt((await env.INSTALLS.get(today)) ?? '0', 10);
    await env.INSTALLS.put(today, String(day + 1));

    return new Response(null, { status: 200 });
  },
};
```

`wrangler.toml`:
```toml
# Source: CITED: developers.cloudflare.com/workers/wrangler/configuration/
name = "goodvibes-telemetry"
main = "worker.js"
compatibility_date = "2025-01-01"
workers_dev = true

[[kv_namespaces]]
binding = "INSTALLS"
id = "<KV_NAMESPACE_ID>"           # set after: wrangler kv:namespace create INSTALLS
```

### Pattern 4: GitHub Actions Deploy Workflow

```yaml
# Source: CITED: developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
name: Deploy Telemetry Worker

on:
  push:
    branches: [main]
    paths:
      - 'workers/telemetry/**'

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Deploy Worker
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: workers/telemetry
```

### Anti-Patterns to Avoid

- **Sending telemetry in dry-run mode:** The `--dry-run` path returns early before the task list; telemetry must NOT fire in dry-run. Guard it inside the non-dry-run path.
- **Calling `process.exit()` before awaiting telemetry race:** Node exits kill pending network calls. The `Promise.race` after tasks is the fix — don't remove it.
- **Reading IP or User-Agent in the worker:** GDPR requires these not be stored. The worker reads nothing from the request. Return 200 immediately after writing KV.
- **Blocking on telemetry failure:** If the Worker returns 4xx/5xx or the network times out, `sendTelemetry()` must swallow the error silently — never propagate to the user.
- **Hardcoding KV namespace ID in CI:** The KV namespace ID in `wrangler.toml` is a non-secret config value (not a credential), but it must be created manually before first deploy. Document this as a one-time setup step.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client (npm) | custom XMLHttpRequest wrapper | `fetch()` built-in | Already in Node 20+; zero dep overhead |
| HTTP client (pip) | `requests` or manual socket | `urllib.request` | Python stdlib; D-05 locks this |
| UUID generation | custom random string | `crypto.randomUUID()` / `uuid.uuid4()` | Cryptographically random; stdlib; TEL-02 compliant |
| KV counter atomicity | Durable Objects counter | KV read-modify-write (with acknowledged eventual consistency) | Durable Objects adds setup complexity; install counter doesn't need strong consistency |
| Worker build pipeline | TypeScript + tsup for worker | Plain JavaScript (`worker.js`) | Workers runtime supports modern JS natively; no build step needed |
| Non-blocking in Python | asyncio refactor of init_cmd | `threading.Thread(daemon=True)` | init_cmd is synchronous; threading is stdlib, no refactor required |

**Key insight:** Zero new runtime dependencies in either CLI package. All client-side telemetry is implemented with what Node 20 and Python 3.10 already provide.

---

## Common Pitfalls

### Pitfall 1: The Circular URL Dependency

**What goes wrong:** The production CF Worker URL must be hardcoded in the CLI packages before publishing. But the URL isn't known until the Worker is deployed. The first deploy of the worker assigns it a `*.workers.dev` URL.

**Why it happens:** The Worker deployment step is a prerequisite for the code constant, but the code must be written before deploy.

**How to avoid:** The plan must sequence: (a) write worker code + wrangler.toml with placeholder URL, (b) deploy worker manually once to get the URL, (c) hardcode URL in telemetry modules, (d) CI handles subsequent deploys automatically. Use `GOODVIBES_TELEMETRY_URL` env override for testing before the URL is known.

**Warning signs:** Tests fail with "fetch called with localhost" — URL constant still has placeholder value.

### Pitfall 2: Node.js Process Exit Races

**What goes wrong:** `goodvibes init` calls `process.exit()` (implicitly via Commander after the action runs) before the `fetch()` call completes. The telemetry event is dropped silently.

**Why it happens:** Node.js does not wait for pending Promises when the main call stack completes if the CLI framework calls `process.exit()` directly.

**How to avoid:** The `Promise.race([telemetryPromise, sleep(1000)])` await after `tasks()` ensures the process stays alive for up to 1 extra second. The existing `init.ts` does NOT call `process.exit()` on success (only on error via `cancel() + process.exit(1)`), so the race is the correct fix.

**Warning signs:** Telemetry fires in tests but never reaches the Worker in production.

### Pitfall 3: KV Write Throttle at Burst

**What goes wrong:** Multiple simultaneous `goodvibes init` runs (e.g., a team onboarding event) cause `Workers KV has a maximum of 1 write to the same key per second` errors on the `total` key.

**Why it happens:** CF KV does not support atomic increment. Concurrent workers read the same stale value and both write n+1 instead of n+2.

**How to avoid:** This is accepted for Phase 13. The counter is for trend visibility, not exact counts. The Worker should handle KV throttle errors gracefully (return 200 anyway, drop the increment). Document the limitation.

**Warning signs:** Counter increments by less than actual installs during peak. Not user-visible.

### Pitfall 4: vitest ESM Mock for globalThis.fetch

**What goes wrong:** `vi.mock('fetch')` fails because `fetch` is a global, not a module. `vi.spyOn(global, 'fetch')` throws in strict ESM mode.

**Why it happens:** Node ESM globals are not module exports; they cannot be mocked via `vi.mock()`.

**How to avoid:** Use `vi.stubGlobal('fetch', vi.fn(...))` in `beforeEach` and `vi.unstubAllGlobals()` in `afterEach`. Alternatively, expose fetch as a module-level injectable (pass as parameter or read from a module-level constant that can be overridden). [ASSUMED — consistent with vitest docs pattern; verify against vitest version in project]

**Warning signs:** Tests pass but fetch is being called for real in CI.

### Pitfall 5: Python Thread Leak on Early Exit

**What goes wrong:** If `init_cmd` raises an exception before `thread.join(timeout=1.0)`, the daemon thread leaks and the request may fire after the CLI exits (non-deterministic behavior).

**Why it happens:** The join call is after the try/except block. If copy_templates raises PermissionError, the except block calls `raise typer.Exit(1)` — the thread join is never reached.

**How to avoid:** The thread is `daemon=True`, so Python will kill it automatically when the process exits. This is intentional and safe — a leaked daemon thread cannot block exit. The join is a best-effort wait, not a required cleanup.

**Warning signs:** None — daemon threads are correctly discarded on process exit.

### Pitfall 6: Dry-Run Mode Sends Telemetry

**What goes wrong:** If telemetry is started before the `if dryRun: return` check, a `--dry-run` run sends a real install event.

**Why it happens:** The disclosure note and telemetry start are inserted after `intro()`, which is before the dry-run guard.

**How to avoid:** Start telemetry only in the non-dry-run branch. The disclosure note can appear in both paths (harmless), but `sendTelemetry()` / `start_telemetry_thread()` must be inside the non-dry-run code path.

---

## Code Examples

Verified patterns from official sources:

### CF Worker KV Get/Put

```javascript
// Source: CITED: developers.cloudflare.com/kv/api/read-key-value-pairs/
// get() returns null if key not found; defaults to '0' safely
const current = parseInt((await env.INSTALLS.get('total')) ?? '0', 10);
await env.INSTALLS.put('total', String(current + 1));
```

### Node.js fetch with AbortController (VERIFIED: runtime)

```typescript
const ac = new AbortController()
const timer = setTimeout(() => ac.abort(), 5_000)
try {
  await fetch(url, { method: 'POST', body: null, signal: ac.signal })
} catch {
  // AbortError or network error — both swallowed
} finally {
  clearTimeout(timer)
}
```

### vitest globalThis.fetch stub

```typescript
// Source: [ASSUMED — consistent with vitest stubGlobal API]
import { vi, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
})
afterEach(() => {
  vi.unstubAllGlobals()
})
```

### pytest-mock for urllib.request.urlopen

```python
# Source: [ASSUMED — consistent with existing project mock patterns in test_install_headroom.py]
def test_telemetry_fires_when_no_opt_out(mocker):
    urlopen = mocker.patch('goodvibes_cli.steps.telemetry.urllib.request.urlopen')
    # ... call send_telemetry or start + join thread ...
    urlopen.assert_called_once()
```

### wrangler.toml

```toml
# Source: CITED: developers.cloudflare.com/workers/wrangler/configuration/
name = "goodvibes-telemetry"
main = "worker.js"
compatibility_date = "2025-01-01"
workers_dev = true

[[kv_namespaces]]
binding = "INSTALLS"
id = "<KV_NAMESPACE_ID>"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node-fetch` npm package | `fetch()` built-in | Node 18 (2022) | Zero deps for HTTP in Node CLIs |
| `wrangler` v2/v3 | wrangler v4 (default) | wrangler-action v4.0.0 (2025) | wrangler-action@v4 uses wrangler 4 by default |
| `cloudflare/wrangler-action@v3` | `cloudflare/wrangler-action@v4` | 2025 | v4 is the current tag; v3 still works |
| PostHog / Plausible | CF Worker + KV | Phase 13 decision | Zero third-party analytics service; full control |

**Deprecated/outdated:**
- `wrangler-action@v3`: Still functional but v4 is the latest stable tag as of 2026-07-06 [VERIFIED: GitHub API].
- `node-fetch`: Never needed for Node 20+ projects.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | vitest uses `vi.stubGlobal('fetch', vi.fn())` to mock the global fetch in ESM | Code Examples / Pitfall 4 | Wrong API would cause test failures; safe to verify by running vitest on a stub |
| A2 | `pytest-mock` mocker.patch path for urllib is `goodvibes_cli.steps.telemetry.urllib.request.urlopen` | Code Examples | Wrong patch path = mock doesn't intercept calls; verify by running test |
| A3 | CF Worker `*.workers.dev` URL is assigned after first `wrangler deploy` run | Pitfall 1 | URL format might differ; verify in actual Cloudflare dashboard after deploy |
| A4 | `X-Request-Id` header is the right vehicle for the TEL-02 UUID (vs. not transmitting it) | Open Questions | If worker ever needs dedup, sending is better; if not needed, generating and discarding is sufficient |

---

## Open Questions (RESOLVED)

1. **TEL-02 UUID transmission** (RESOLVED — Plans 13-02/13-03)
   - What we know: D-06 says empty POST body. D-02 says worker ignores the request body. TEL-02 requires a per-invocation randomUUID never stored on disk.
   - What's unclear: Is the UUID transmitted at all (as `X-Request-Id` header), or just generated locally and discarded?
   - Recommendation: Send as `X-Request-Id` header. Cost: zero. Benefit: request is traceable for debugging if needed. Worker ignores it; GDPR clean.
   - **Resolution:** UUID transmitted as `X-Request-Id` header in both `sendTelemetry()` (Plan 13-02) and `_fire()` (Plan 13-03). Worker does not log or store the header (D-02).

2. **KV Namespace ID bootstrapping** (RESOLVED — Plan 13-01)
   - What we know: `wrangler.toml` requires the KV namespace ID, which is created by running `wrangler kv:namespace create INSTALLS`.
   - What's unclear: Should the plan include a wave-zero step for the user to create the namespace and paste the ID into wrangler.toml?
   - Recommendation: Yes — Wave 0 or a dedicated "deploy-worker" plan step should document `wrangler kv:namespace create INSTALLS` and the wrangler.toml ID update. STATE.md already notes this blocker.
   - **Resolution:** Plan 13-01 includes a `checkpoint:human-action` task for `wrangler kv:namespace create INSTALLS` and the wrangler.toml ID update before first deploy.

3. **`workers/telemetry/package.json` scope** (RESOLVED — Plan 13-01)
   - What we know: wrangler-action v4 auto-installs wrangler; no local install needed for CI.
   - What's unclear: Should contributors be able to run `wrangler dev` locally without a global install?
   - Recommendation: Add minimal `package.json` with `"devDependencies": {"wrangler": "^4"}` so `npm install` + `npx wrangler dev` works in the `workers/telemetry/` directory. No hoisting needed.
   - **Resolution:** Plan 13-01 creates `workers/telemetry/package.json` with `{"devDependencies": {"wrangler": "^4"}}`. CI deploy uses `wrangler-action@v4` which auto-installs wrangler; local dev uses `npx wrangler`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20+ | npm CLI + tests | ✓ | v20.20.2 | — |
| Python 3.10+ | pip CLI + tests | ✓ | 3.12 (inferred from slopcheck env) | — |
| `wrangler` CLI | Worker local dev | ✗ | — | `npx wrangler` or CI-only deploy |
| Cloudflare account + API token | Worker deploy | ✗ (not verified) | — | Cannot deploy without; blocks Phase 13 go-live |
| CF KV namespace (INSTALLS) | Worker counter | ✗ (not created yet) | — | Must create before first deploy |

**Missing dependencies with no fallback:**
- Cloudflare account with API token (`CLOUDFLARE_API_TOKEN`) — required for Worker deploy; noted as existing blocker in STATE.md
- CF KV namespace ID — must be created via `wrangler kv:namespace create INSTALLS` before deploy

**Missing dependencies with fallback:**
- `wrangler` CLI locally — `npx wrangler` covers local dev without global install

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (npm) | vitest ^4 |
| Config file (npm) | none — vitest picks up `vitest` from scripts |
| Quick run (npm) | `cd packages/npm && npm test` |
| Full suite (npm) | `cd packages/npm && npm test` |
| Framework (pip) | pytest + pytest-mock (dev deps in pyproject.toml) |
| Config file (pip) | `packages/pip/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run (pip) | `cd packages/pip && uv run pytest tests/ -x -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEL-01 | sendTelemetry() calls fetch with POST method | unit | `cd packages/npm && npm test -- telemetry` | ❌ Wave 0 |
| TEL-01 | send_telemetry / start_telemetry_thread calls urlopen | unit | `cd packages/pip && uv run pytest tests/test_telemetry.py -x -q` | ❌ Wave 0 |
| TEL-02 | fetch is called with X-Request-Id header matching UUID pattern | unit | (same telemetry test file) | ❌ Wave 0 |
| TEL-03 | DO_NOT_TRACK=1 prevents fetch call | unit | (same telemetry test file — env var parametrize) | ❌ Wave 0 |
| TEL-03 | GOODVIBES_NO_TELEMETRY=1 prevents fetch call | unit | (same telemetry test file) | ❌ Wave 0 |
| TEL-03 | CI=true prevents fetch call | unit | (same telemetry test file) | ❌ Wave 0 |
| TEL-04 | note() called with disclosure text (npm) | unit | `cd packages/npm && npm test -- init` | ✅ (init.test.ts exists) — new test case needed |
| TEL-04 | Panel printed with disclosure text (pip) | unit | `cd packages/pip && uv run pytest tests/test_init_cmd.py -x -q` | ✅ (test_init_cmd.py exists) — new test case needed |
| TEL-05 | sendTelemetry never throws to caller; swallows errors | unit | (same telemetry test file) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd packages/npm && npm test` and `cd packages/pip && uv run pytest tests/ -x -q`
- **Per wave merge:** same as above (both suites must be green)
- **Phase gate:** Full suite green for both packages before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/npm/src/steps/telemetry.test.ts` — covers TEL-01, TEL-02, TEL-03, TEL-05
- [ ] `packages/pip/tests/test_telemetry.py` — covers TEL-01, TEL-02, TEL-03, TEL-05
- New test cases in existing `packages/npm/src/commands/init.test.ts` — covers TEL-04
- New test cases in existing `packages/pip/tests/test_init_cmd.py` — covers TEL-04

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Anonymous counter; no auth |
| V3 Session Management | no | No session; fire-and-forget |
| V4 Access Control | partial | Worker: reject non-POST (204); no read endpoint |
| V5 Input Validation | yes | Worker: `request.method !== 'POST'` guard before any KV write |
| V6 Cryptography | no | UUID is for request identity only, not encryption |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Counter spam (artificial inflation) | Tampering | Accepted for Phase 13; CF Worker rate limiting or IP-based throttle can be added later if abuse occurs |
| IP logging in Worker | Information Disclosure | D-02: Worker reads nothing from request; KV stores only counters |
| Secret leak (API token) | Information Disclosure | CLOUDFLARE_API_TOKEN in GitHub Secrets only; never in wrangler.toml or worker.js |
| KV write throttle (1/sec) denial | Denial of Service | Self-limiting; 1 write/sec means at most 86,400 installs/day are counted — not a practical limit |
| Endpoint discovery | Elevation of Privilege | Workers.dev URL is effectively public; only consequence is counter inflation (accepted) |
| Telemetry fires in --dry-run | Spoofing (false count) | Dry-run guard must be enforced before sendTelemetry() call (see Pitfall 6) |

**Security verdict:** GDPR-clean by design — no IP, no headers, no PII stored. ASVS Level 1 compliant for this scope.

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: npm registry] `wrangler` v4.107.0 — https://www.npmjs.com/package/wrangler
- [VERIFIED: GitHub API] `cloudflare/wrangler-action` latest tag v4.0.0
- [VERIFIED: runtime check] Node 20 built-ins: `fetch`, `AbortController`, `crypto.randomUUID`
- [VERIFIED: runtime check] Python stdlib: `urllib.request`, `uuid.uuid4`, `threading.Thread`

### Secondary (MEDIUM confidence)

- [CITED: developers.cloudflare.com/kv/api/write-key-value-pairs/] KV `put()` API — no atomic increment; 1 write/sec throttle per key
- [CITED: developers.cloudflare.com/kv/api/read-key-value-pairs/] KV `get()` API — returns null for missing keys
- [CITED: developers.cloudflare.com/workers/wrangler/configuration/] wrangler.toml format — `[[kv_namespaces]]`, `binding`, `id`, `compatibility_date`
- [CITED: developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/] GitHub Actions workflow format — `cloudflare/wrangler-action@v3`; official docs show v3 but v4 is latest tag per GitHub API

### Tertiary (LOW confidence — validate before use)

- vitest `vi.stubGlobal('fetch', ...)` pattern — [ASSUMED] from training data; consistent with vitest API surface
- pytest-mock patch path for `urllib.request.urlopen` — [ASSUMED] from existing project mock patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all client-side tooling is stdlib/built-in; wrangler verified on npm registry; wrangler-action tag verified via GitHub API
- Architecture: HIGH — CF KV API and wrangler.toml format cited from official docs; worker pattern is minimal and well-documented
- Pitfalls: HIGH (process exit race, dry-run guard, KV throttle) / MEDIUM (vitest mock pattern — assumed but consistent with project vitest usage)

**Research date:** 2026-07-06
**Valid until:** 2026-09-06 (wrangler versions move fast; recheck if planning is delayed > 60 days)
