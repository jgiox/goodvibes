# Requirements: goodvibes

**Defined:** 2026-06-23 (v1.0 — v1.1.0)
**Updated:** 2026-07-03 (v1.2.0 Growth & Retention)
**Core Value:** One command gives a vibe coder a fully configured project — token efficiency and engineering discipline happen automatically in the background.

## v1.2.0 Requirements (Active)

### Headroom Integration

- [ ] **HDR2-01**: `goodvibes init` reports actual headroom install outcome — installed, already-installed, skipped (no Python), or failed — in the init outro
- [ ] **HDR2-02**: `goodvibes init` reports MCP config outcome separately — written, already-configured, or failed
- [ ] **HDR2-03**: Headroom probe uses `headroom compress --help` (not just `--version`) to catch broken installs
- [ ] **HDR2-04**: All headroom subprocess calls have a hard 10-second timeout
- [ ] **HDR2-05**: `goodvibes doctor` headroom check reflects real functional status (installed + working vs just on PATH)

### Telemetry

- [ ] **TEL-01**: `goodvibes init` sends an anonymous fire-and-forget event to a GDPR-compliant endpoint (no PII, no persistent user ID)
- [ ] **TEL-02**: Telemetry uses a per-invocation `randomUUID()` — never stored on disk
- [ ] **TEL-03**: Opt-out via `DO_NOT_TRACK=1` or `GOODVIBES_NO_TELEMETRY=1`; auto-suppressed when `CI=true`
- [ ] **TEL-04**: One-line disclosure shown in init intro before tasks run
- [ ] **TEL-05**: Telemetry never blocks or slows init — `Promise.race` with 1-second grace after tasks complete

### Update Command

- [ ] **UPD-01**: `goodvibes init` writes `.goodvibes.json` manifest (SHA-256 hash per managed file + goodvibes version)
- [ ] **UPD-02**: `goodvibes update` reads manifest and categorises files: managed (safe to overwrite), user-modified (skip), net-new (write)
- [ ] **UPD-03**: `goodvibes update --dry-run` shows what would change before writing anything
- [ ] **UPD-04**: `goodvibes update` prompts confirmation before overwrites; `--force` skips prompt for CI use
- [ ] **UPD-05**: Projects initialized before v1.2.0 (no manifest) receive a clear actionable message — no silent failure
- [ ] **UPD-06**: `sentinel-merge` guards against SENTINEL_START without SENTINEL_END (prevents CLAUDE.md data-loss)

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

## Previously Validated (v1.0–v1.1.0)

All prior requirements from v1.0–v1.1.0 are validated. See ROADMAP.md phases 01–11 for details.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| HDR2-01 | Phase 12 | Pending |
| HDR2-02 | Phase 12 | Pending |
| HDR2-03 | Phase 12 | Pending |
| HDR2-04 | Phase 12 | Pending |
| HDR2-05 | Phase 12 | Pending |
| TEL-01 | Phase 13 | Pending |
| TEL-02 | Phase 13 | Pending |
| TEL-03 | Phase 13 | Pending |
| TEL-04 | Phase 13 | Pending |
| TEL-05 | Phase 13 | Pending |
| UPD-01 | Phase 14 | Pending |
| UPD-02 | Phase 14 | Pending |
| UPD-03 | Phase 14 | Pending |
| UPD-04 | Phase 14 | Pending |
| UPD-05 | Phase 14 | Pending |
| UPD-06 | Phase 14 | Pending |
