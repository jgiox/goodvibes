# Requirements: goodvibes

**Defined:** 2026-06-23 (v1.0 — v1.1.0)
**Updated:** 2026-09-05 (v1.8.0 Agent Governance & Cross-Tool Enforcement)
**Core Value:** One command gives a vibe coder a fully configured project — token efficiency and engineering discipline happen automatically in the background.

## v1.8.0 Requirements (Active)

### Journal-Gate Enforcement

- [x] **HOOK-01**: `.claude/settings.json` ships a `PreToolUse` hook, implemented as an inline shell command (no separate script file), that blocks `git commit` unless `JOURNAL.md` is in the staged file list
- [x] **HOOK-02**: The hook exempts `--amend`, in-progress merge/rebase (`.git/MERGE_HEAD`, `.git/rebase-merge`, `.git/rebase-apply` present), and the bootstrap commit that adds `JOURNAL.md` itself
- [x] **HOOK-03**: On block, the hook's stderr message states exactly what's missing (`JOURNAL.md` not staged) and how to fix it
- [ ] **HOOK-04**: README/onboarding docs state explicitly that the hook only gates commits Claude Code's own Bash tool runs — not manual `git commit`, not other agents/IDEs

### Cross-Agent Handoff & Binding Wording

- [ ] **AGENT-01**: `JOURNAL.md`, `CLAUDE.md`, and `AGENTS.md` instruct any agent picking up the project to read prior `JOURNAL.md` entries before acting and treat them as binding, not advisory
- [ ] **AGENT-02**: `CLAUDE.md` gains a rule: never ask the user for information already answered in README.md, CLAUDE.md, AGENTS.md, JOURNAL.md, or the codebase itself — with that source list enumerated in the rule text
- [ ] **AGENT-03**: `CLAUDE.md`, `AGENTS.md`, and all per-IDE rule files use directive, non-optional language throughout (no "should"/"consider"/"try to")
- [ ] **AGENT-04**: `.github/copilot-instructions.md` is documented as the authoritative rule file for GitHub Copilot (Copilot ranks it above `AGENTS.md`); `AGENTS.md` is documented as the cross-tool fallback, not a universal guarantee

### context7 MCP

- [ ] **CTX7-01**: `.mcp.json` template ships with `context7` configured at the free/public endpoint (`type: "http"`, no key, no signup)
- [ ] **CTX7-02**: Docs cover the optional `${CONTEXT7_API_KEY}` upgrade path for higher rate limits; no literal key is ever committed
- [ ] **CTX7-03**: Onboarding docs mention the one-time "trust this project's MCP servers" prompt Claude Code shows on first use

### Caveman Default

- [ ] **CAVE-01**: `caveman` skill's default intensity changes from `full` to `ultra`, still user-overridable via `/caveman lite|full|ultra`
- [ ] **CAVE-02**: Onboarding docs add a note explaining what `ultra` does and how to dial it back if output gets too terse/jargon-heavy

### Update Command

- [ ] **UPD-07**: `goodvibes update` gains JSON-aware merge for `settings.json` and `.mcp.json` — preserves user-added keys while adding/updating only the specific keys goodvibes manages (hook block, context7 server entry)

## Deferred to v1.8.x

- Friendly rate-limit messaging if context7 calls start returning 429s — build only once real usage data shows it's needed
- Extending hook-style enforcement to other tools if/when Codex, Cursor, etc. ship an equivalent hook API — none currently do

## v1.2.0 Requirements (Complete)

### Headroom Integration

- [x] **HDR2-01**: `goodvibes init` reports actual headroom install outcome — installed, already-installed, skipped (no Python), or failed — in the init outro
- [x] **HDR2-02**: `goodvibes init` reports MCP config outcome separately — written, already-configured, or failed
- [x] **HDR2-03**: Headroom probe uses `headroom compress --help` (not just `--version`) to catch broken installs
- [x] **HDR2-04**: All headroom subprocess calls have a hard 10-second timeout
- [x] **HDR2-05**: `goodvibes doctor` headroom check reflects real functional status (installed + working vs just on PATH)

### Telemetry

- [x] **TEL-01**: `goodvibes init` sends an anonymous fire-and-forget event to a GDPR-compliant endpoint (no PII, no persistent user ID)
- [x] **TEL-02**: Telemetry uses a per-invocation `randomUUID()` — never stored on disk
- [x] **TEL-03**: Opt-out via `DO_NOT_TRACK=1` or `GOODVIBES_NO_TELEMETRY=1`; auto-suppressed when `CI=true`
- [x] **TEL-04**: One-line disclosure shown in init intro before tasks run
- [x] **TEL-05**: Telemetry never blocks or slows init — `Promise.race` with 1-second grace after tasks complete

### Update Command

- [x] **UPD-01**: `goodvibes init` writes `.goodvibes.json` manifest (SHA-256 hash per managed file + goodvibes version)
- [x] **UPD-02**: `goodvibes update` reads manifest and categorises files: managed (safe to overwrite), user-modified (skip), net-new (write)
- [x] **UPD-03**: `goodvibes update --dry-run` shows what would change before writing anything
- [x] **UPD-04**: `goodvibes update` prompts confirmation before overwrites; `--force` skips prompt for CI use
- [x] **UPD-05**: Projects initialized before v1.2.0 (no manifest) receive a clear actionable message — no silent failure
- [x] **UPD-06**: `sentinel-merge` guards against SENTINEL_START without SENTINEL_END (prevents CLAUDE.md data-loss)

## Deferred to v1.3.0

- User-modified file detection beyond manifest hashing (3-way merge, conflict markers)
- Telemetry in `goodvibes update` and `goodvibes doctor` runs
- `goodvibes telemetry disable` command
- `--force` flag for init re-runs (overwrite existing files)
- `.gitignore` line-by-line dedup merge
- `--debug` flag for stack trace output

## Out of Scope

- Telemetry with any user-identifiable properties (OS, version, IP, persistent ID)
- Interactive telemetry opt-in prompt — breaks zero-config, opt-in rates below 3%
- 3-way merge for update command — beginners cannot resolve conflict markers
- `goodvibes update` walking the project directory beyond managed template files
- Building a new LLM or agent framework
- Language-specific boilerplate beyond minimal CI examples
- Broader static-analysis enforcement hooks (empty `catch`, missing tests, secret scanning, etc.) — journal-gate is the one cheap, unambiguous hook this milestone ships; generic rule-violation detection needs its own design pass
- Requiring a context7 account/API key at `init` time — breaks the zero-config, no-signup promise
- Auto-suppressing Claude Code's first-run MCP trust prompt — it's a legitimate security control, not a defect to work around
- A goodvibes-operated caching/relay layer in front of context7 — premature without usage data on how often the free-tier cap is hit
- Extending enforcement hooks to tools other than Claude Code — no other tool researched exposes an equivalent hook API to build against

## Previously Validated (v1.0–v1.1.0)

All prior requirements from v1.0–v1.1.0 are validated. See ROADMAP.md phases 01–11 for details.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| HDR2-01 | Phase 12 | Complete |
| HDR2-02 | Phase 12 | Complete |
| HDR2-03 | Phase 12 | Complete |
| HDR2-04 | Phase 12 | Complete |
| HDR2-05 | Phase 12 | Complete |
| TEL-01 | Phase 13 | Complete |
| TEL-02 | Phase 13 | Complete |
| TEL-03 | Phase 13 | Complete |
| TEL-04 | Phase 13 | Complete |
| TEL-05 | Phase 13 | Complete |
| UPD-01 | Phase 14 | Complete |
| UPD-02 | Phase 14 | Complete |
| UPD-03 | Phase 14 | Complete |
| UPD-04 | Phase 14 | Complete |
| UPD-05 | Phase 14 | Complete |
| UPD-06 | Phase 14 | Complete |
| HOOK-01 | Phase 15 | Planned |
| HOOK-02 | Phase 15 | Planned |
| HOOK-03 | Phase 15 | Planned |
| HOOK-04 | Phase 15 | Planned |
| AGENT-01 | Phase 17 | Planned |
| AGENT-02 | Phase 17 | Planned |
| AGENT-03 | Phase 17 | Planned |
| AGENT-04 | Phase 17 | Planned |
| CTX7-01 | Phase 15 | Planned |
| CTX7-02 | Phase 15 | Planned |
| CTX7-03 | Phase 15 | Planned |
| CAVE-01 | Phase 17 | Planned |
| CAVE-02 | Phase 17 | Planned |
| UPD-07 | Phase 16 | Planned |
