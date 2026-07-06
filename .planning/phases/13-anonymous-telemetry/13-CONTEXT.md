# Phase 13: Anonymous Telemetry - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire a fire-and-forget anonymous install counter into `goodvibes init` for both the npm and pip CLIs. Includes: a one-line disclosure before file operations, env-var opt-out support, a non-blocking timeout (Promise.race / threading), and a Cloudflare Worker + KV as the counter endpoint. The worker source code lives in this repo and is deployed via CI.

</domain>

<decisions>
## Implementation Decisions

### Cloudflare Worker
- **D-01:** Worker source lives in `workers/telemetry/` in this repo — `wrangler.toml` + worker script source-controlled alongside the CLI code.
- **D-02:** Worker increments two KV keys per request: `total` (global install count) and the current ISO date key (`YYYY-MM-DD`) for per-day trend data. The request body is ignored. IP is never read or stored.
- **D-03:** Worker is deployed via a GitHub Actions workflow triggered on push to main. Requires `CLOUDFLARE_API_TOKEN` secret in GitHub. No manual deploy step.

### Client — Both CLIs (npm + pip)
- **D-04:** Both the npm CLI and pip CLI get telemetry in Phase 13. Same disclosure line, same opt-out env vars (`DO_NOT_TRACK=1`, `GOODVIBES_NO_TELEMETRY=1`, `CI=true`), same fire-and-forget timing behavior.
- **D-05:** npm uses `fetch()` (Node 18+ built-in, no new dep). pip uses `urllib.request` (stdlib, no new dep).
- **D-06:** HTTP method is POST with an empty body. Semantically correct for a write/increment; avoids proxy caching that could corrupt a GET-based counter.

### Endpoint URL Configuration
- **D-07:** Production CF Worker URL is hardcoded as a constant in both packages. `GOODVIBES_TELEMETRY_URL` env var overrides the URL for local dev and test mocking. Zero config for end users; testable for contributors.

### Disclosure Line
- **D-08:** Terse one-liner: `"Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out."`
- **D-09:** Rendered as a `note()` call in npm (@clack/prompts) immediately after `intro()`. In pip, rendered as `console.print(Panel(...))` immediately after the `console.rule(...)` header. Appears before the task list / copy operations begin — consistent with the 'Non-empty project detected' pattern.

### Non-Blocking Timing
- **D-10:** Telemetry fetch starts concurrently with (or just before) the task list. In npm: `Promise.race([telemetryPromise, sleep(1000)])` after all tasks resolve — capped at 1-second additional wait. In pip: run telemetry in a `threading.Thread(daemon=True)` started before tasks, joined with `thread.join(timeout=1.0)` after tasks complete.

### Testing
- **D-11:** Unit tests mock the HTTP call at the module boundary (mock `fetch` in TS; mock `urllib.request.urlopen` in Python). Opt-out env vars are exercised as unit test cases. No real network calls in tests.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — TEL-01 through TEL-05 (the five telemetry requirements, exact acceptance criteria)
- `.planning/ROADMAP.md` — Phase 13 entry (goal, success criteria, depends-on)
- `.planning/PROJECT.md` — Key Decisions table (CF Worker + KV endpoint rationale, GDPR exclusions, PostHog/Plausible exclusion reasoning)

### Integration Points (read before touching)
- `packages/npm/src/commands/init.ts` — where telemetry call and disclosure line are inserted (after `intro()`, before `tasks()`)
- `packages/pip/src/goodvibes_cli/commands/init_cmd.py` — pip equivalent integration point

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `note()` from `@clack/prompts` (already imported in `init.ts`): used for 'Non-empty project detected' panel — telemetry disclosure follows the same pattern
- `console.print(Panel(...))` in pip's `init_cmd.py`: same 'Non-empty project detected' pattern to mirror
- `intro()` / `outro()` already in both CLIs: disclosure appears immediately after `intro()` call

### Established Patterns
- Subprocess/network calls are mocked in all unit tests (CLAUDE.md rule) — telemetry module must expose a mockable boundary
- Env var checks already exist in both CLIs — consistent approach for `DO_NOT_TRACK`, `GOODVIBES_NO_TELEMETRY`, `CI` flags
- Both CLIs already have a graceful degradation pattern (headroom skips on failure) — telemetry follows the same silent-on-error approach

### Integration Points
- `packages/npm/src/commands/init.ts`: telemetry starts as a `Promise` before the `tasks([...])` call; disclosure `note()` inserted after `intro()`
- `packages/pip/src/goodvibes_cli/commands/init_cmd.py`: telemetry thread started before task loop; disclosure Panel after `console.rule(...)`
- `workers/` (new directory): Cloudflare Worker source — wrangler.toml + worker script + deploy GitHub Actions workflow

</code_context>

<specifics>
## Specific Ideas

- Both the `total` counter and per-day date key are incremented in the same KV namespace. Reading them back (for analytics) is a manual `wrangler kv:key get` or a separate read endpoint — not in scope for Phase 13.
- The `GOODVIBES_TELEMETRY_URL` override is primarily for contributors running tests locally without hitting production — unit tests can set it to a mock server or just mock `fetch` entirely.
- Telemetry is completely silent on error — a failed fetch is swallowed (no log, no retry). The timeout cap (1 second) is the only user-visible consequence of a slow endpoint.

</specifics>

<deferred>
## Deferred Ideas

- Telemetry in `goodvibes update` and `goodvibes doctor` — deferred to v1.3.0 (per REQUIREMENTS.md)
- `goodvibes telemetry disable` command — deferred to v1.3.0
- A KV read endpoint to expose counter data via HTTP — not in scope for Phase 13

</deferred>

---

*Phase: 13-anonymous-telemetry*
*Context gathered: 2026-07-06*
