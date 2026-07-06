---
phase: 13-anonymous-telemetry
plan: "01"
subsystem: telemetry-worker
tags: [cloudflare-workers, kv, github-actions, telemetry, gdpr]
dependency_graph:
  requires: []
  provides: [CF Worker counter endpoint, CI deploy workflow]
  affects: []
tech_stack:
  added: [wrangler ^4 (devDep in workers/telemetry)]
  patterns: [KV read-increment-write, path-filtered CI workflow, least-privilege permissions]
key_files:
  created:
    - workers/telemetry/worker.js
    - workers/telemetry/wrangler.toml
    - workers/telemetry/package.json
    - .github/workflows/deploy-worker.yml
  modified: []
decisions:
  - D-01 honored: workers/telemetry/ created as standalone subpackage, not hoisted to root
  - D-02 honored: worker reads only request.method; KV stores total + YYYY-MM-DD only; no IP/body/headers
  - D-03 honored: deploy automated on push to main via wrangler-action@v4
  - T-13-01-IP mitigated: ponytail comment marks the no-PII constraint in worker.js
  - T-13-01-CRED mitigated: CLOUDFLARE_API_TOKEN only as ${{ secrets.X }} in deploy-worker.yml; never in wrangler.toml or worker.js
metrics:
  duration: "2 minutes"
  completed_date: "2026-07-06T17:17:00Z"
  tasks_completed: 2
  files_created: 4
---

# Phase 13 Plan 01: CF Worker Counter + Deploy Workflow Summary

**One-liner:** Cloudflare Worker KV counter (total + per-day YYYY-MM-DD keys) with path-filtered GitHub Actions deploy on push to main.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create workers/telemetry/ with worker.js, wrangler.toml, package.json | 0948c05 | workers/telemetry/{worker.js,wrangler.toml,package.json} |
| 2 | Create .github/workflows/deploy-worker.yml | 5c86dec | .github/workflows/deploy-worker.yml |

## What Was Built

### workers/telemetry/worker.js
A 13-line Cloudflare Worker counter in plain JavaScript (no build step). On POST: increments KV key `total` and the current date key `YYYY-MM-DD`. On non-POST: returns 204 immediately. Reads nothing from the request object beyond `request.method` — no IP, no body, no headers. The constraint is marked with a `ponytail:` comment to prevent future drift.

### workers/telemetry/wrangler.toml
Worker config declaring `name = "goodvibes-telemetry"`, `main = "worker.js"`, `compatibility_date = "2025-01-01"`, `workers_dev = true`. KV namespace binding `INSTALLS` with `id = "PLACEHOLDER_KV_NAMESPACE_ID"` and a comment directing the one-time setup command (`wrangler kv:namespace create INSTALLS`).

### workers/telemetry/package.json
Minimal standalone package (not hoisted to repo root) with `"wrangler": "^4"` as a devDependency. Enables `npx wrangler dev` for local contributor development without requiring a global wrangler install.

### .github/workflows/deploy-worker.yml
GitHub Actions workflow triggered on push to `main` when `workers/telemetry/**` changes. Single `deploy` job on `ubuntu-latest` with `permissions: contents: read` at the job level (project standard). Uses `actions/checkout@v7` and `cloudflare/wrangler-action@v4` with `apiToken` and `accountId` from GitHub Secrets only — no literal values anywhere in the file.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `PLACEHOLDER_KV_NAMESPACE_ID` | workers/telemetry/wrangler.toml | 9 | Intentional — KV namespace ID requires `wrangler kv:namespace create INSTALLS` to be run once. Plan 13-06 resolves this after the CF Worker is deployed and the ID is obtained. |

The stub does not block this plan's goal (providing the Worker source and deploy workflow). The deploy will fail until Plan 13-06 replaces the placeholder with the real ID, which is expected and documented.

## Threat Flags

No new threat surface beyond what was modeled in the plan's `<threat_model>`. All T-13-01 mitigations are in place:
- T-13-01-IP: worker reads only `request.method`; no PII reaches KV
- T-13-01-CRED: credentials appear only as `${{ secrets.X }}` in the deploy workflow

## Self-Check: PASSED

- [x] workers/telemetry/worker.js exists and contains `env.INSTALLS.get` (2 occurrences) and `env.INSTALLS.put` (2 occurrences)
- [x] worker.js returns 204 for non-POST; reads no PII from request
- [x] workers/telemetry/wrangler.toml contains `[[kv_namespaces]]`, `binding = "INSTALLS"`, `PLACEHOLDER_KV_NAMESPACE_ID`
- [x] workers/telemetry/package.json contains `"wrangler"` in devDependencies
- [x] .github/workflows/deploy-worker.yml contains `cloudflare/wrangler-action@v4`, `${{ secrets.CLOUDFLARE_API_TOKEN }}`, `${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`, `contents: read`, `actions/checkout@v7`, path filter `workers/telemetry/**`
- [x] CLOUDFLARE_API_TOKEN absent from wrangler.toml and worker.js
- [x] Commits 0948c05 and 5c86dec exist in git log
