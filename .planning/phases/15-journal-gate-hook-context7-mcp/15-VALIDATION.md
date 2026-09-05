---
phase: 15
slug: journal-gate-hook-context7-mcp
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-05
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (npm package), pytest (pip package) — both already configured |
| **Config file** | `packages/npm/vitest.config.ts`, `packages/pip/pyproject.toml` |
| **Quick run command** | `cd packages/npm && npm test -- --run journal-gate` (or matching new test file name); `cd packages/pip && uv run pytest tests/test_journal_gate_hook.py` |
| **Full suite command** | `cd packages/npm && npm test`; `cd packages/pip && uv run pytest tests/` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `vitest run <file>` / `pytest <file>` for the new file touched
- **After every plan wave:** Run `npm test` (npm package) and `uv run pytest tests/` (pip package) full suite
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | HOOK-01 | — | Hook blocks `git commit` when JOURNAL.md unstaged | integration | `npm run test:integration` (new file) | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | HOOK-02 | — | Exempts `--amend`, merge-in-progress, rebase-in-progress | integration | same new file, additional `it()` blocks per exemption | ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 1 | HOOK-03 | — | Exact stderr message on block | integration | assert stderr equals `BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md` | ❌ W0 | ⬜ pending |
| 15-01-04 | 01 | 1 | HOOK-04 | — | Docs state Bash-tool-only scope | manual-only (optional smoke grep) | `grep -q "only gates" docs/getting-started.md` | ❌ W0 (optional) | ⬜ pending |
| 15-02-01 | 02 | 1 | CTX7-01 | — | `.mcp.json` ships context7 at free/public HTTP endpoint, no key | unit | `npm test -- --run mcp-json` (new file) — `JSON.parse` + assert `mcpServers.context7.type === "http"`, `.url === "https://mcp.context7.com/mcp"`, no `headers` key | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 1 | CTX7-02 | — | Docs cover `${CONTEXT7_API_KEY}` upgrade path, no literal key committed | manual-only + smoke grep | `grep -rn "CONTEXT7_API_KEY" docs/` | ❌ W0 (optional) | ⬜ pending |
| 15-02-03 | 02 | 1 | CTX7-03 | — | Docs mention one-time trust prompt | manual-only | n/a (doc content review) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/npm/src/steps/journal-gate-hook.integration.test.ts` (new) — extracts the `command` string from the actual shipped `templates/.claude/settings.json`, executes it via `execa('sh', ['-c', cmd], { input: jsonPayload, cwd: tmpGitRepo })` against the 8 scenarios verified in research (staged/unstaged, `--amend`, merge, rebase, `git -C` variant, non-commit command)
- [ ] `packages/npm/src/steps/mcp-json.test.ts` (new) — `JSON.parse` on `templates/.mcp.json`, assert shape (`type`, `url`, absence of `headers`)
- [ ] Mirror both as `packages/pip/tests/test_journal_gate_hook.py` and `packages/pip/tests/test_mcp_json.py` — pip's `copy_templates.py` resolves the same root `templates/` tree, so the same fixture files apply
- [ ] No new test framework/config needed — vitest and pytest are both already fully configured in this repo

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Docs state hook only gates Claude Code's own Bash tool | HOOK-04 | Doc-content correctness (accurate scoping claim) is a judgment call, not a structural assertion | Read `docs/getting-started.md`, confirm the caveat is present and accurately scoped (not just present) |
| Docs mention the one-time "trust this project's MCP servers" prompt | CTX7-03 | No automated hook exists to trigger/observe Claude Code's trust-prompt UI | Read `docs/getting-started.md` "What is context7?" section, confirm the trust-prompt behavior is described |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
