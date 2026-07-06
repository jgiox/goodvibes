# Phase 13: Anonymous Telemetry - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 13-anonymous-telemetry
**Areas discussed:** Worker code ownership, Python parity, Disclosure text, Endpoint URL config

---

## Worker Code Ownership

### Q1: Where does the Cloudflare Worker source code live?

| Option | Description | Selected |
|--------|-------------|----------|
| In this repo (workers/ subdir) | Phase 13 includes a workers/telemetry/ directory with wrangler.toml and the worker script. Source-controlled, reviewable, deployed via wrangler or CI. | ✓ |
| External — deployed separately | The worker is (or will be) deployed outside this repo. Phase 13 only implements the client-side fetch call — the endpoint URL is a given. | |

**User's choice:** In this repo (workers/ subdir)

---

### Q2: What does the Cloudflare Worker do with the incoming request?

| Option | Description | Selected |
|--------|-------------|----------|
| Increment a KV counter, discard request | Worker receives any request, increments a single KV key (e.g., 'installs'), returns 200. IP never stored — pure counter. | |
| Increment KV per-day bucket | Worker uses a date-keyed KV entry (e.g., '2026-07-06') so you can see install counts over time without storing any per-request data. | |
| Both: global counter + per-day bucket | Increments 'total' and a daily key. Lets you see trend data without any PII. | ✓ |

**User's choice:** Both: global counter + per-day bucket

---

### Q3: How is the worker deployed?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual: wrangler deploy from local | Developer runs `wrangler deploy` once. Simple, no CI secret needed. Worker is stable and rarely changes. | |
| CI: GitHub Actions workflow on push to main | Automatic deploy on merge. Requires CLOUDFLARE_API_TOKEN secret in GitHub. Good if the worker script changes often. | ✓ |

**User's choice:** CI: GitHub Actions workflow on push to main

---

## Python Parity

### Q1: Does the pip CLI get telemetry in Phase 13?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — same behavior as npm CLI | pip CLI sends the same fire-and-forget request, shows the same disclosure line, respects the same opt-out env vars. urllib.request (stdlib, no new dep). | ✓ |
| No — npm only in Phase 13 | Pip telemetry deferred to Phase 14 or later. Keeps Phase 13 scope tight; pip gets it when the feature is validated. | |

**User's choice:** Yes — same behavior as npm CLI

---

### Q2: For pip: what HTTP mechanism sends the telemetry request?

| Option | Description | Selected |
|--------|-------------|----------|
| urllib.request | stdlib only — no new dependency. Wraps in a thread so it's non-blocking. Consistent with goodvibes's zero-new-deps philosophy. | ✓ |
| httpx or requests | Cleaner API but adds a dependency to pyproject.toml. Not worth it for a single fire-and-forget GET. | |

**User's choice:** urllib.request

---

## Disclosure Text

### Q1: How verbose should the disclosure line be?

| Option | Description | Selected |
|--------|-------------|----------|
| Terse — one short sentence | e.g., "Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out." Minimal noise, respects the zero-config beginner experience. | ✓ |
| Slightly more beginner-friendly | e.g., "goodvibes collects anonymous install counts (no personal data). Set DO_NOT_TRACK=1 or GOODVIBES_NO_TELEMETRY=1 to opt out." | |

**User's choice:** Terse — one short sentence

---

### Q2: How should the disclosure be rendered in the CLI output?

| Option | Description | Selected |
|--------|-------------|----------|
| note() call from @clack/prompts | Consistent with how other status messages appear (e.g., 'Non-empty project detected'). Rich panel in pip via console.print(Panel(...)). Stands out from spinner output. | ✓ |
| Inline text before intro | Plain console.log/print before the intro banner. Less prominent but simpler. | |

**User's choice:** note() from @clack/prompts

---

## Endpoint URL Config

### Q1: How is the CF Worker URL embedded in the CLI packages?

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded constant + GOODVIBES_TELEMETRY_URL env var override | Default is the production URL baked in at build time. GOODVIBES_TELEMETRY_URL overrides for local dev and testing. Zero config for users, testable for contributors. | ✓ |
| Hardcoded only | Simplest — one constant, no override path. Tests mock the fetch call directly. Change requires a new release. | |
| Env var only (no hardcoded default) | URL must be set explicitly. Fine for internal tools, but breaks zero-config for end users. | |

**User's choice:** Hardcoded constant + GOODVIBES_TELEMETRY_URL env var override

---

### Q2: What HTTP method does the client send to the CF Worker?

| Option | Description | Selected |
|--------|-------------|----------|
| POST with empty body | Semantically correct for a write/increment operation. CF Worker ignores the body anyway. Consistent across npm (fetch) and pip (urllib.request). | ✓ |
| GET request | Marginally simpler code. Semantically wrong (read operation), and some proxies cache GETs — risky for a counter. | |

**User's choice:** POST with empty body

---

## Claude's Discretion

None — all areas had clear user selections.

## Deferred Ideas

- Telemetry in `goodvibes update` and `goodvibes doctor` — deferred to v1.3.0
- `goodvibes telemetry disable` command — deferred to v1.3.0
- KV read endpoint to expose counter data via HTTP — not in scope for Phase 13
