# Cross-Repo Governance Gap Review

**Date:** 2026-09-24
**Scope:** Agent-instruction files (CLAUDE.md, AGENTS.md, AGENT.md, replit.md, `.claude/settings.json`, hooks) in 16 private repositories owned by the maintainer, compared against what goodvibes v1.7.1 ships.
**Purpose:** Find rules and guardrails that real projects had to invent on their own, so the next goodvibes release can ship them by default.

Repository names are withheld because they are private. Each is described by type only.

## Method

1. Listed every git repository under the maintainer's WSL home directory and every agent-instruction file in them.
2. For the five repositories that already run goodvibes, removed the goodvibes sentinel block and read only what each project added on top.
3. For the other eleven, read their governance sections (rules, definition of done, git, security, testing); skipped stack and architecture tables.
4. Compared every rule against `templates/CLAUDE.md`, `templates/AGENTS.md`, the per-IDE rule files, `templates/.claude/settings.json`, and the CI workflow templates.
5. Removed anything already planned in Phases 15-17.

Repositories reviewed, by type: a regulated-fintech data publisher; a grants-and-contracts pipeline dashboard; two credit-risk modelling projects; an immigration-data SaaS; two trading/hedging systems; a custodial-account strategy pipeline; a quant strategy research repo; a project with long-form engineering rules; a property-search app; a phone-scam lookup app; four static marketing sites.

## Already planned, not repeated here

| Finding | Where it is planned |
|---|---|
| "Every line is an order" enforcement wording, MUST/NEVER throughout | Phase 17 |
| Read JOURNAL.md first; never re-ask for information already on file | Phase 17 |
| Commit-time journal gate hook | Phase 15 |
| context7 MCP wired by default | Phase 15 |
| JSON-aware merge for settings.json / .mcp.json | Phase 16 |

## Defects found in goodvibes

### D1 — `goodvibes update` loses user edits on its second run (data loss)

`update` sorts manifest files into overwrite / skip (user-modified) / net-new, then rewrites `.goodvibes.json` with **only** the files it wrote. Skipped files drop out of the manifest. On the next `update`, those files are no longer in the manifest, so they are classed as net-new and copied over with `overwrite: true`. A user's edits survive the first run and are destroyed by the second.

Same logic in both CLIs: `packages/npm/src/commands/update.ts` and `packages/pip/src/goodvibes_cli/commands/update_cmd.py`.

A related effect: CLAUDE.md always contains project content outside the goodvibes block, so its whole-file hash never matches and the first `update` skips it, even though `mergeClaude` exists to replace just the block safely.

*Correction to the first draft of this review:* three projects show a `1.7.1` manifest with a `v1.7.0` CLAUDE.md stamp. That turned out to be a release-ordering artifact (the package version was bumped six minutes before the template stamp on release day), not evidence of D1.

### D2 — Permissions template auto-approves deploy and publish commands

`templates/.claude/settings.json` allows `Bash(npx*)`, `Bash(uv*)` and `Bash(node*)`. That lets `npx wrangler deploy`, `npx vercel --prod` or `uv publish` run with no prompt, contradicting the template's own Action tiers rule ("Deploy/publish: explicit human approval required"). Claude Code evaluates permission rules deny → ask → allow, so an `ask` list closes the gap without narrowing the useful `allow` rules. One reviewed project had already added its own `ask` list.

### D3 — CI templates contradict "Fail loud"

- `ci-python.yml` has no lint step. `ci-node.yml` runs `npm run lint --if-present`, which skips silently when there is no lint script.
- `uv sync --all-extras 2>/dev/null || uv sync` throws away the error message.
- "No tests found" is printed as a plain log line and the job passes green.
- `security.yml` runs CodeQL only; nothing scans for committed secrets.

## Rules that projects invented on their own

Ranked by how many of the 16 repositories wrote the rule independently.

| # | Missing rule | Repos |
|---|---|---|
| 1 | Update every Markdown file the change made untrue before closing; add a CHANGELOG entry every task (goodvibes ships CHANGELOG.md but no rule to update it) | 9 |
| 2 | Model / metric regression gate when ML or scoring is present: baseline, regression test, revert on degradation | 8 |
| 3 | Definition of done as a hard gate: tests, docs, journal, changelog, pushed, open risks listed; blockers reported as what / why / risk / next action | 6 |
| 4 | `.env` never committed; `.env.example` updated in the same change; no secrets in logs, screenshots or test fixtures | 5 |
| 5 | Lint as a hard gate (no unused imports/variables, no bare or broad `except`, chained exceptions) | 5 |
| 6 | Dependency discipline: review Dependabot PRs (changelog, advisories, lockfile, licences); no mass upgrades | 5 |
| 7 | Never fabricate data: no synthetic or placeholder numbers in production paths; every figure traceable to a source | 4 |
| 8 | After pushing, confirm CI is green before saying "done"; report branch and commit SHA | 3 |
| 9 | Stage exact paths; never `git add -A` / `git add .` | 3 |
| 10 | Never state a guess as fact — run a command first | 3 |
| 11 | Security review questions (attacker-controlled input, trust boundary, blast radius if it fails open) | 3 |
| 12 | Documentation-lookup data handling: never send secrets, personal data or private code to context7 or web search | 3 |
| 13 | Branch hygiene: naming prefixes; delete only when `git log origin/main..<branch>` is empty; `git reflog` recovery | 2 |
| 14 | Performance safety: measure first, avoid N+1, batch and cache | 2 |
| 15 | A "What this is / Core value / Constraints" section for the project to fill in | 12 |

Mechanical enforcement seen in the wild:

- A SessionStart hook that runs `goodvibes doctor` and surfaces failures (one repo, hand-written).
- A PreToolUse gate that blocks implementation edits outside a planning workflow (tied to GSD; not suitable for goodvibes).
- A read-time prompt-injection scanner (global, from GSD).

Deliberately not adopted: project-specific rules (regulatory copy, cloud runbooks, domain invariants, external-artifact intake), and "docstrings on every function", which conflicts with goodvibes' comment-only-the-WHY rule.

## Changes shipped with this review (quick task 260924-mh9)

| Item | Change |
|---|---|
| D1 | `update` keeps skipped files' previous manifest hashes, so they stay protected on every later run; CLAUDE.md is always routed through `mergeClaude` (block-only replacement). npm and pip. Regression tests committed RED before the fix. |
| D2 | `ask` rules for `git push`, npm/uv/twine publish, and the common deploy CLIs (wrangler, vercel, netlify, firebase) in `templates/.claude/settings.json`. |
| D3 | ruff lint step in the Python CI templates; `uv sync` errors no longer hidden; missing tests / missing lint script raise a visible `::warning::`; gitleaks secret-scan job in `security.yml`. |
| Rules 1, 3, 4, 7, 8, 9, 12 | Added tersely to `templates/CLAUDE.md`, `templates/AGENTS.md` and every per-IDE rule file. |

**Release note:** existing projects only receive the new CLAUDE.md rules after a version bump and publish, because `mergeClaude` skips a block whose stamp is already equal to the template's. The version bump is left to the maintainer (publish tier).

## Deferred, with a trigger for picking each up

| Item | Pick up when |
|---|---|
| Rule 2 (ML / metric regression, dormant unless ML present) | Next content phase — decide whether the token cost is worth it for non-ML users |
| Rules 6, 10, 11, 13, 14 | Fold into Phase 17's directive rewrite so wording is done once |
| Rule 15 (project section stub outside the sentinel) | Next `init` UX pass |
| SessionStart `goodvibes doctor` hook | After deciding how to behave when goodvibes is not installed globally (`npx` on every session start is slow) |
| Read-time prompt-injection scanner | Own design pass — listed out of scope for v1.8.0 |
