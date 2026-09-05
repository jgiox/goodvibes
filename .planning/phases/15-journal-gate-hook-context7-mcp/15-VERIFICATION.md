---
phase: 15-journal-gate-hook-context7-mcp
verified: 2026-09-05T19:24:46Z
status: gaps_found
score: 6/8 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Running `git commit` via Claude Code's Bash tool without JOURNAL.md staged is blocked with an actionable stderr message (HOOK-01 / Roadmap SC1)"
    status: failed
    reason: >
      Independently reproduced against the actual shipped hook command (extracted live from
      templates/.claude/settings.json, not from the test suite) two adversarial-input defects
      that the phase's own code review (15-REVIEW.md CR-01/CR-02) already found and that the
      9-scenario integration test suite does not cover: (1) a genuine, non-amend commit whose
      message text merely contains the substring "--amend" (e.g. `git commit -am "note about
      --amend flag"`) is incorrectly exempted and allowed through with exit 0 even though
      JOURNAL.md was never staged — a direct bypass of the guardrail the whole feature exists
      to provide; (2) an unrelated, read-only command whose arguments merely contain the
      substring "git ... commit" (e.g. `git log --grep="please git commit later"`) is
      misidentified as a commit and incorrectly blocked with exit 2. Both stem from the hook
      doing raw substring/regex matching on the full unparsed command string (including inside
      quoted arguments) rather than parsing actual argv. This means the hook does not reliably
      do what HOOK-01/HOOK-02 and Roadmap Phase 15 Success Criterion 1 claim under realistic,
      non-contrived input — a developer or LLM writing an ordinary commit message that mentions
      "--amend" silently defeats the entire guardrail.
    artifacts:
      - path: "templates/.claude/settings.json"
        issue: "hooks.PreToolUse[0].hooks[0].command extracts and matches on raw command text via sed/grep without stripping quoted spans first, allowing both a false-negative bypass and a false-positive block"
      - path: ".claude/settings.json"
        issue: "identical command string, same bypass/false-positive reproduced at repo root"
    missing:
      - "Strip quoted substrings from $CMD before matching for --amend and for the git-commit-subcommand pattern (per 15-REVIEW.md CR-01/CR-02 fix suggestion), or replace regex substring matching with real argv tokenization"
      - "New integration test scenarios covering: (a) non-amend commit message containing the literal text \"--amend\", (b) non-commit command whose arguments contain the substring \"git ... commit\" — both scenarios must resolve to the correct exit code before this truth can be marked verified"
deferred: []
human_verification: []
---

# Phase 15: Journal-Gate Hook & context7 MCP Verification Report

**Phase Goal:** Claude Code users get a real commit-time guardrail that enforces the existing "update JOURNAL.md every task" rule, and every goodvibes project ships with context7 MCP wired at the free/public tier by default
**Verified:** 2026-09-05T19:24:46Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Running `git commit` via Claude Code's Bash tool without JOURNAL.md staged is blocked with an actionable stderr message | ✗ FAILED | Reproduced bypass and false-positive directly against the shipped hook command (see Gaps below and Behavioral Spot-Checks) |
| 2 | Committing with JOURNAL.md staged, or using `--amend`, or mid-merge/rebase, succeeds normally (hook exits 0) | ✓ VERIFIED | All 9 scripted scenarios in `journal-gate-hook.integration.test.ts` / `test_journal_gate_hook.py` pass (10/10 vitest incl. mcp test, 10/10 pytest); independently re-ran the full suites and confirmed green |
| 3 | The goodvibes repo's own `.claude/settings.json` enforces the same hook it ships to users (dogfooding, D-01) | ✓ VERIFIED (with caveat) | `diff templates/.claude/settings.json .claude/settings.json` confirms both carry the identical `hooks.PreToolUse` block; repo-root file also carries a pre-existing (not introduced by this phase) `Bash(rm -rf *)` grant and a hardcoded absolute path — see Anti-Patterns |
| 4 | A fresh `goodvibes init` (npm or pip) ships `.mcp.json` with context7 configured at the free/public HTTP endpoint, no key required | ✓ VERIFIED | `templates/.mcp.json` contains `mcpServers.context7 = {type: "http", url: "https://mcp.context7.com/mcp"}`, no `headers` key; `packages/npm/templates/.mcp.json` mirror regenerates identically via `npm run prebuild` |
| 5 | The goodvibes repo's own root has a `.mcp.json` with context7 configured (dogfooding, D-02) | ✓ VERIFIED | `diff templates/.mcp.json .mcp.json` — byte-identical |
| 6 | A developer reading docs/getting-started.md learns the journal-gate hook only gates Claude Code's own Bash tool | ✓ VERIFIED | `## About the journal-gate hook` section present, contains "only gates" language naming Claude Code's Bash tool, in both `docs/getting-started.md` and `templates/docs/getting-started.md` (byte-identical) |
| 7 | A developer reading docs/getting-started.md learns how to add a context7 API key later via `${CONTEXT7_API_KEY}` without ever committing a literal key | ✓ VERIFIED | `## What is context7?` section contains fenced JSON snippet with `"Authorization": "Bearer ${CONTEXT7_API_KEY}"` and explicit "Never commit a literal key" sentence; no literal-looking secret found in either file |
| 8 | A developer reading docs/getting-started.md learns Claude Code will show a one-time "trust this project's MCP servers" prompt | ✓ VERIFIED | Closing sentence of "What is context7?" section states this explicitly in both files |

**Score:** 6/8 truths verified (2 sub-truths merged: truths 6-8 belong to Plan 03's single artifact and all pass; truth 1 is the sole failure but it is the core guardrail truth the whole phase goal depends on)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `templates/.claude/settings.json` | `hooks.PreToolUse` block, matcher=Bash | ⚠️ VERIFIED-BUT-DEFECTIVE | Exists, valid JSON, substantive, present in shipped template — but the command logic itself is faulty (see gaps) |
| `.claude/settings.json` | Same hook merged into narrower dev permissions | ⚠️ VERIFIED-BUT-DEFECTIVE | Identical hook block present; `permissions.allow`'s 3 pre-existing entries untouched as required (confirmed via `git show a46c114:.claude/settings.json` — the `rm -rf *` grant predates this phase, not introduced by it) |
| `packages/npm/src/steps/journal-gate-hook.integration.test.ts` | 9-scenario real-subprocess test | ✓ VERIFIED | 9 `it(...)` blocks present, real `execa('sh', ...)` subprocess calls, no mocking (`grep -c "vi.mock"` = 0), all pass |
| `packages/pip/tests/test_journal_gate_hook.py` | mirrored 9-scenario pytest | ✓ VERIFIED | 9 `def test_...` functions present, real `subprocess.run`, no mocking, all pass |
| `templates/.mcp.json` | context7 http entry, no headers | ✓ VERIFIED | Exact shape confirmed |
| `.mcp.json` | dogfood copy | ✓ VERIFIED | Byte-identical to templates/.mcp.json |
| `packages/npm/src/steps/mcp-json.test.ts` | shape assertions | ✓ VERIFIED | Present, passes |
| `packages/pip/tests/test_mcp_json.py` | mirrored shape assertions | ✓ VERIFIED | Present, passes |
| `docs/getting-started.md` / `templates/docs/getting-started.md` | two new sections | ✓ VERIFIED | Byte-identical, both sections present with required phrases |
| `packages/npm/templates/*` (gitignored prebuild mirror) | in sync with `templates/` | ✓ VERIFIED | Was stale at verification time (expected — gitignored build artifact); `npm run prebuild` regenerates it byte-identical to `templates/`; not a functional gap since `resolveTemplatesDir()` falls back to repo-root `templates/` in dev/test mode |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `templates/.claude/settings.json` | `hooks.PreToolUse[0].hooks[0].command` | JSON key path, matcher=Bash | ✓ WIRED | `"matcher": "Bash"` present at the expected path |
| hook command | `git diff --cached --name-only` | JOURNAL.md staged check | ✓ WIRED (present) / ✗ UNRELIABLE (logic) | The staged-check line exists and works correctly in isolation, but is reachable via a bypassed "is this a commit" gate (see gaps) |
| `templates/.mcp.json` | `mcpServers.context7.url` | static JSON value | ✓ WIRED | Exact match `https://mcp.context7.com/mcp` |
| `docs/getting-started.md` | HOOK-04 scope caveat | "only gates" wording | ✓ WIRED | Present |
| `docs/getting-started.md` | CTX7-02 upgrade path | `CONTEXT7_API_KEY` reference | ✓ WIRED | Present |
| `docs/getting-started.md` | CTX7-03 trust prompt | "trust" wording | ✓ WIRED | Present |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Block: `git commit -am "fix"` with JOURNAL.md unstaged | Extracted hook command piped scripted payload | exit 2, exact stderr message | ✓ PASS |
| Exempt: `git commit --amend --no-edit` | Same | exit 0 | ✓ PASS |
| **Adversarial: non-amend commit with message text containing "--amend"** | `{"tool_input":{"command":"git commit -am \"note about --amend flag\""}}` piped to live hook command, JOURNAL.md unstaged | **exit 0 — bypassed, should have been exit 2** | ✗ FAIL |
| **Adversarial: read-only command whose args contain "git ... commit"** | `{"tool_input":{"command":"git log --grep=\"please git commit later\""}}` piped to live hook command | **exit 2 with BLOCKED message — should have been exit 0 (not a commit)** | ✗ FAIL |
| Full npm suite (vitest, journal-gate + mcp-json) | `npx vitest run` | 10/10 pass | ✓ PASS (does not cover adversarial cases above) |
| Full pip suite (pytest, journal-gate + mcp-json) | `uv run pytest` | 10/10 pass | ✓ PASS (does not cover adversarial cases above) |

Both adversarial failures were run directly by this verifier against the live command string extracted from `templates/.claude/settings.json` (not against the test suite), independently reproducing `15-REVIEW.md`'s CR-01 and CR-02 findings.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| HOOK-01 | 15-01 | PreToolUse hook, inline command, blocks git commit unless JOURNAL.md staged | ✗ BLOCKED | Bypassable via commit-message substring match; see gaps |
| HOOK-02 | 15-01 | Exempts --amend, MERGE_HEAD, rebase-merge, rebase-apply, JOURNAL.md-already-staged | ⚠️ PARTIAL | Exempt logic correct for real exempt cases, but --amend exemption also fires on non-exempt commits due to substring matching (over-exemption = under-enforcement) |
| HOOK-03 | 15-01 | Exact copy-pasteable stderr fix message | ✓ SATISFIED | `BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md` confirmed verbatim |
| HOOK-04 | 15-03 | Docs state hook only gates Claude Code's Bash tool | ✓ SATISFIED | Section present, verified |
| CTX7-01 | 15-02 | `.mcp.json` ships context7 free/public endpoint | ✓ SATISFIED | Verified |
| CTX7-02 | 15-03 | Docs cover optional `${CONTEXT7_API_KEY}` upgrade path, no literal key committed | ✓ SATISFIED | Verified, no literal secret found |
| CTX7-03 | 15-03 | Docs mention one-time MCP trust prompt | ✓ SATISFIED | Verified |

All 7 requirement IDs declared in PLAN frontmatter (HOOK-01..04, CTX7-01..03) are present and mapped to Phase 15 in `.planning/REQUIREMENTS.md`. No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `templates/.claude/settings.json` (+ `.claude/settings.json`) | hook command | Raw substring/regex matching on unparsed shell text for both the `--amend` exemption and "is this a commit" detection | 🛑 Blocker | Enables a real bypass (false negative) and a real false-positive block, independently reproduced — see gaps |
| `.claude/settings.json` | `permissions.allow` | `Bash(rm -rf *)` unconditional grant + hardcoded absolute path `/home/ygiokas/GoodVibes/...` | ⚠️ Warning | Pre-existing (introduced in commit `a46c114`, months before this phase; confirmed via `git show`), not modified by this phase's tasks, which explicitly scoped to leave `permissions.allow` untouched (D-01). Still present in the file this phase's dogfood truth points at and violates CLAUDE.md's least-privilege rule for every future contributor. Recommend a follow-up task (out of this phase's stated scope) to remove/scope `rm -rf *` and move the dev-specific node path entry to a gitignored `settings.local.json`. |
| `templates/.claude/settings.json` | `permissions.allow` | `Bash(node*)`, `Bash(python*)`, `Bash(npx*)`, `Bash(uv*)` unrestricted | ℹ️ Info | Pre-existing broad grant, same as 15-REVIEW.md WR-01; not introduced by this phase, noted for awareness only |
| — | — | No TBD/FIXME/XXX markers found in any file touched by this phase | — | Debt-marker gate: clean |

## Gaps Summary

The phase delivered 6 of 8 must-have truths cleanly: the context7 `.mcp.json` template and dogfood copy (CTX7-01, D-02) are correct and well-tested, and all three documentation truths (HOOK-04, CTX7-02, CTX7-03) are accurately and completely written in both `docs/getting-started.md` and its template mirror.

The journal-gate hook itself — the truth the phase goal is actually named after ("a real commit-time guardrail that enforces...") — has a verified, reproducible logic defect that the 9-scenario test suite does not catch: because the hook matches `--amend` and the `git ... commit` pattern via raw substring/regex search over the full unparsed command text (including inside quoted commit-message arguments) rather than parsing real argv, (a) an ordinary, plausible commit message that happens to mention "--amend" completely bypasses the JOURNAL.md gate on a genuine non-amend commit, and (b) an unrelated read-only git command (e.g. `git log --grep="...commit..."`) is incorrectly blocked. This was independently reproduced by this verifier by extracting the live command string from `templates/.claude/settings.json` and piping adversarial payloads through it directly — it is not merely a code-review claim, it is an executable, repeatable fact about the shipped artifact. This directly contradicts Roadmap Phase 15 Success Criterion 1 ("Claude Code's own Bash tool is blocked from running `git commit` when JOURNAL.md is not in the staged file list") under realistic, non-contrived input, and HOOK-01/HOOK-02 as currently implemented do not reliably provide the guardrail they claim to.

This is a BLOCKER: the core deliverable of the phase does not reliably do what it says. Recommended fix path is documented in `15-REVIEW.md` CR-01/CR-02 (strip quoted spans before regex matching, or tokenize argv) and should be closed before this phase is considered done. New integration test scenarios covering both adversarial cases should be added alongside the fix so the existing 9-scenario suite would have caught this.

Separately, the repo-root `.claude/settings.json`'s pre-existing `Bash(rm -rf *)` grant and hardcoded path (CR-03) are real security/hygiene issues but predate this phase (confirmed via git history) and were correctly left untouched per this phase's explicit scope (D-01: merge, don't replace). Flagged as a WARNING for a follow-up cleanup, not counted against this phase's score.

---

_Verified: 2026-09-05T19:24:46Z_
_Verifier: Claude (gsd-verifier)_
