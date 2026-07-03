# Research Summary: goodvibes v1.2.0 — Growth & Retention

**Researched:** 2026-07-03
**Confidence:** HIGH
**Phases proposed:** 3 (phases 12–14)

## Executive Summary

Three targeted features, zero new runtime dependencies. The mechanical complexity is low; the design decisions carry the real risk.

- **Feature 1 (Headroom status):** Both `installHeadroom()` and `configureMcp()` already branch on every outcome — they just return `void`. Return-type change + switch statement in init outro. Lowest risk, immediate UX value.
- **Feature 2 (Telemetry):** Client code is ~20 lines. The blocking decision is the endpoint: it must contractually guarantee no IP logging. PostHog EU is excluded (receives IP before anonymization). Use Plausible Analytics or a Cloudflare Worker.
- **Feature 3 (`goodvibes update`):** The `update` alias already exists (routes to `upgrade`). New work is a SHA-256 manifest (`.goodvibes.json`) written on init and read on update to distinguish managed vs user-modified files.

## Stack Additions

**None.** All three features use existing packages or Node.js stdlib:
- `node:crypto` (built-in): SHA-256 hashing + `randomUUID()` for telemetry
- `fetch()` (Node 20 built-in): fire-and-forget telemetry HTTP
- `fs-extra` (already installed): manifest read/write
- Python: `urllib.request`, `hashlib`, `uuid`, `threading` — all stdlib

## Features

### Must Have
- Headroom install status (`installed / already-installed / skipped / failed`) in init outro
- MCP config status shown separately
- Telemetry opt-out via `DO_NOT_TRACK=1` and `GOODVIBES_NO_TELEMETRY=1`; `CI=true` auto-suppression
- First-run telemetry disclosure in init intro (one line, not a prompt)
- `goodvibes update --dry-run` preview
- `goodvibes update` with confirmation before overwrites; `--force` for CI

### Should Have
- `goodvibes doctor` showing headroom installed/not-installed
- `headroom compress --help` smoke test (not just `--version`) to catch broken installs
- Pre-written `.bak` files before `--force` overwrites of user-modified files

### Defer to v1.3.0
- User-modified file detection (manifest diff with original-install hash vs current)
- Telemetry in `goodvibes update` and `goodvibes doctor` runs
- `goodvibes telemetry disable` command

## Architecture

**Modified components:**
1. `steps/install-headroom.ts` + `steps/configure-mcp.ts` — return discriminated union instead of `void`
2. `commands/init.ts` + `commands/init_cmd.py` — consume return values; emit headroom status `note()` in outro; call `sendTelemetry()` fire-and-forget
3. `utils/telemetry.ts` + `utils/telemetry.py` (NEW) — single exported function, never throws, never awaited at call site
4. `commands/upgrade.ts` + `commands/upgrade_cmd.py` — manifest writer on init path; manifest-aware diff logic on update path
5. `steps/sentinel-merge.ts` + `steps/sentinel_merge.py` — guard for SENTINEL_START without SENTINEL_END (data-loss bug)

**Net new files: 2** (`telemetry.ts`, `telemetry.py`). Everything else is in-place modification.

## Critical Pitfalls

1. **IP address is PII in transit (T1)** — PostHog excluded. Use Plausible or Cloudflare Worker. Add TELEMETRY.md.
2. **Default-on telemetry without disclosure = trust damage (T2)** — GitHub CLI April 2026 incident. First-run disclosure mandatory.
3. **Node.js process exit race drops in-flight fetch (T4)** — start telemetry before task list; `await Promise.race([telemetryDone, new Promise(r => setTimeout(r, 1000))])` after tasks.
4. **Update overwrites user-modified skill files silently (U1)** — manifest-based skip fixes this; add `--force` to bypass.
5. **Sentinel START without END causes CLAUDE.md data loss (U3)** — 4-line guard: if `startIdx !== -1 && endIdx === -1`, treat as Case B (append) and warn.
6. **headroom hangs on Windows + Python 3.13 (H1)** — probe with `headroom compress --help`, hard 10-second subprocess timeout. Upstream confirmed issue #845.

## Proposed Roadmap

### Phase 12: Headroom Status Surfacing
Return-type change in both step functions, surface result in init outro. No infrastructure needed. Lowest risk.

### Phase 13: Anonymous Telemetry
New `utils/telemetry.ts` + `telemetry.py`. **Gated on endpoint selection** (Plausible or Cloudflare Worker — must be decided before implementation). Counter-only (no OS, no version, no properties) to minimize GDPR surface.

### Phase 14: `goodvibes update` with Manifest
`.goodvibes.json` manifest written on init (SHA-256 per managed file). `goodvibes update` reads manifest, shows dry-run preview, applies updates. Sentinel hardening bundled in. Most complex phase.

## Open Gaps (resolve before implementation)

- **Telemetry endpoint:** Plausible account or Cloudflare Worker? Must be decided before Phase 13.
- **Telemetry data posture:** counter-only (recommended) vs `version + os + headroom_status`
- **headroom minimum version:** set at Phase 12 implementation time
- **`goodvibes update` scope boundary:** only managed template files, never walk project directory

## Sources

- Codebase read directly: `install-headroom.ts`, `configure-mcp.ts`, `init.ts`, `upgrade.ts` and Python equivalents
- [Plausible Analytics data policy](https://plausible.io/data-policy) — IP non-logging contractual
- [DO_NOT_TRACK standard](https://donottrack.sh/)
- headroom Windows Python 3.13 hang — upstream issue #845 (confirmed open 2026-07-03)
- GitHub CLI telemetry controversy — April 2026
- [Next.js Telemetry](https://nextjs.org/telemetry) — env-var opt-out reference pattern
