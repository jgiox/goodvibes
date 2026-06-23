---
phase: 2
slug: npm-cli
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-23
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | shell smoke tests (node --version, npx --yes, bash) |
| **Config file** | scripts/verify-phase2.sh (Wave 0 installs) |
| **Quick run command** | `bash scripts/verify-phase2.sh --quick` |
| **Full suite command** | `bash scripts/verify-phase2.sh` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bash scripts/verify-phase2.sh --quick`
- **After every plan wave:** Run `bash scripts/verify-phase2.sh`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 02-01-T0 | 01 | 0 | NPM-01..11 | — | N/A | shell | `bash scripts/verify-phase2.sh` | ⬜ pending |
| 02-01-T1 | 01 | 1 | NPM-01 | T-02-01 | package.json bin field points to compiled entry | shell | `node -e "const p=require('./packages/npm/package.json');process.exit(p.bin?.goodvibes?0:1)"` | ⬜ pending |
| 02-01-T2 | 01 | 1 | NPM-02 | T-02-02 | Commander init subcommand registers --dry-run and --minimal | shell | `node packages/npm/dist/index.js --help 2>&1 \| grep -q 'init' && echo PASS` | ⬜ pending |
| 02-02-T1 | 02 | 1 | NPM-03 | T-02-03 | files copied, sentinel block present in CLAUDE.md | shell | `test -f /tmp/gv-test/CLAUDE.md && grep -q 'goodvibes:start' /tmp/gv-test/CLAUDE.md && echo PASS` | ⬜ pending |
| 02-02-T2 | 02 | 1 | NPM-04 | — | idempotent: second run does not clobber user edits | shell | manual — requires two-run sequence | ⬜ pending |
| 02-03-T1 | 03 | 1 | HDR-01 | T-02-HDR1 | headroom install skipped gracefully when Python absent | shell | `(PATH=/nonexistent npx --yes goodvibes init 2>&1 \| grep -q 'Python' && echo PASS) \|\| echo SKIP` | ⬜ pending |
| 02-03-T2 | 03 | 1 | HDR-03 | T-02-HDR3 | MCP registration uses absolute path | shell | manual — requires headroom installed | ⬜ pending |
| 02-04-T1 | 04 | 1 | NPM-05 | — | --dry-run prints files without writing | shell | `mkdir -p /tmp/gv-drytest && node packages/npm/dist/index.js init --dry-run 2>&1 \| grep -q 'Would write' && test ! -f /tmp/gv-drytest/CLAUDE.md && echo PASS` | ⬜ pending |
| 02-04-T2 | 04 | 1 | NPM-06 | — | --minimal skips headroom and CI | shell | `node packages/npm/dist/index.js init --minimal 2>&1 \| grep -qv 'headroom' && echo PASS` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/verify-phase2.sh` — smoke test runner for NPM-01 through NPM-11 and HDR-01 through HDR-06
- [ ] `packages/npm/package.json` — stub with name, version, bin field (makes subsequent NPM-01 verification possible)
- [ ] `packages/npm/tsconfig.json` — TypeScript config for the npm CLI package
- [ ] `packages/npm/tsup.config.ts` — tsup build config (ESM + CJS, single entry)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Second run preserves user edits outside sentinel blocks | NPM-04 | Requires two-run sequence with manual file edit between runs | Run init, edit CLAUDE.md outside sentinel, run init again, confirm edit preserved |
| headroom MCP registered in Claude Code | HDR-03 | Requires headroom installed + Claude Code running | Install headroom, run init, check ~/.claude.json or claude mcp list |
| `npx goodvibes init` resolves from npm registry | NPM-11 | Requires publish step | Publish to npm, run npx in clean env, confirm resolves |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
