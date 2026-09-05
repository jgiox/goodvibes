# Project Research Summary

**Project:** goodvibes v1.8.0 — Agent Governance & Cross-Tool Enforcement
**Domain:** Claude Code enforcement hooks + context7 MCP wiring + cross-tool rule-file hardening, for a beginner-facing, zero-config, dual-package (npm/pip) scaffolding CLI
**Researched:** 2026-09-05
**Confidence:** MEDIUM-HIGH overall — the underlying platform mechanics (Claude Code hooks, `.mcp.json`, context7, the existing copy/manifest pipeline) are verified HIGH against official docs and direct repo inspection; the four research files disagree with each other on **how** to implement the one genuinely new mechanism (the journal-gate hook), which is the single most important thing to resolve before requirements lock.

## Executive Summary

This milestone adds exactly one new *technical* enforcement primitive (a Claude Code `PreToolUse` hook that blocks `git commit` unless `JOURNAL.md` is staged) plus a project-scoped `context7` MCP config, and otherwise is a content/wording pass across already-shipped files (CLAUDE.md, AGENTS.md, 13 per-IDE rule files, `caveman`'s default intensity). All four researchers independently confirm the existing copy → manifest → update pipeline is fully generic and file-tree-driven: dropping `.mcp.json` and a hook file/config block into `templates/` requires **zero pipeline code changes**. That part of the research is unanimous and HIGH confidence.

Where the research disagrees is the shape of the hook implementation itself. STACK.md and FEATURES.md recommend an inline shell command embedded directly in `settings.json` (no separate script file, no `jq`, filtered at the config level via `if: "Bash(git commit*)"`). ARCHITECTURE.md's diagrams and build-order recommendation instead reference a separate `.claude/hooks/journal-gate.sh` file invoked via `${CLAUDE_PROJECT_DIR}`, which requires the executable bit to survive git checkout, npm's `cpSync` prebuild, and — critically, unverified — hatchling's wheel packaging for the pip path. PITFALLS.md rejects both of those and recommends a third shape, a Node.js `.mjs` script, on the grounds that bash+`jq` breaks silently on Windows — but its own justification ("Node is required by Claude Code itself on every OS") directly contradicts STACK.md's own finding that Claude Code shipped a Node-free native installer in 2025-2026 and that npx/Node availability can no longer be assumed. This three-way conflict, and the internal contradiction about Node availability, is the single decision that must be locked before requirements/roadmap work proceeds — see Open Decisions below for the recommended resolution.

Beyond that core conflict, the research is largely convergent and unusually self-aware about scope limits: all four files agree the hook only protects commits Claude Code's own Bash tool makes (not Codex/Cursor/Copilot/manual commits), that `goodvibes update` cannot safely JSON-merge `.claude/settings.json`/`.mcp.json` the way it merges `CLAUDE.md` (and that documenting this gap, not building a merge engine, is the ponytail-consistent choice), and that `.claude/`/`.mcp.json` should never be added to the `--minimal` exclusion list (already true by omission — no code change needed). The main residual risks are UX/trust risks rather than technical ones: the `.mcp.json` first-run approval dialog a beginner won't understand without explicit messaging, context7's already-twice-cut free-tier rate limit, and — flagged only in PITFALLS.md but genuinely unaddressed elsewhere — whether defaulting `caveman` to `ultra` actively harms the exact "never opened a terminal before" audience this project targets.

## Key Findings

### Recommended Stack

No new runtime dependency is required (STACK.md, ARCHITECTURE.md agree). The two new/changed artifacts are:
- **`templates/.claude/settings.json`** — modify existing file, add a `hooks.PreToolUse` block. Existing file, existing pipeline, no code change.
- **`templates/.mcp.json`** — new file, `{"mcpServers":{"context7":{"type":"http","url":"https://mcp.context7.com/mcp"}}}`, keyless, no signup, no local process. SSE is deprecated in favor of `type: "http"` — do not ship SSE.

**Core technologies:**
- Claude Code `PreToolUse` hook (`exit 2` = hard block) — the only enforcement primitive Claude Code exposes; advisory markdown cannot be "talked past" the way this can.
- `.mcp.json` project scope, `type: "http"` — version-controlled, auto-picked-up, zero subprocess/npx dependency (explicitly safer than `type: "stdio"` + `npx @upstash/context7-mcp`, which assumes Node/npx on PATH — an assumption STACK.md itself says is no longer safe).
- Existing `git` CLI (already a hard prerequisite) — sufficient for the staged-file check; no `jq` needed if the `if` permission-rule filter does the command-matching instead of in-script JSON parsing.

### Expected Features

**Must have (table stakes / P1, per FEATURES.md):**
- Journal-gate `PreToolUse` hook, with explicit exceptions for `--amend`, in-progress merge/rebase, `-a`/`-am` (working-tree, not index, diff), and the bootstrap first-commit.
- Cross-agent JOURNAL.md/CLAUDE.md/AGENTS.md wording strengthened so any agent reads and honors prior entries.
- "Never ask what's already known" CLAUDE.md rule with an enumerated source list (README, CLAUDE.md, AGENTS.md, JOURNAL.md, codebase).
- `.mcp.json` shipped with context7 configured keyless by default; API-key upgrade documented, never required, never hardcoded into a committed file.

**Should have (P2, bundle into same milestone):**
- Directive-language rewrite (remove "should"/"consider"/"try to") across CLAUDE.md, AGENTS.md, and all 13 shipped per-IDE rule files.

**Defer (v1.8.x / v2+, per FEATURES.md):**
- Friendly context7 429/rate-limit-hit messaging — build only once real usage data shows beginners actually hit the cap.
- Broader static-analysis enforcement hooks (empty-catch detection, secret scanning, etc.) — explicitly out of scope this milestone per PROJECT.md's own Key Decision.

### Architecture Approach

The existing `copy-templates` → `write-manifest` → `update`/`categorise()` pipeline is generic and file-tree-driven with exactly three special cases today (CLAUDE.md sentinel-merge, `--minimal` exclusion of `.github/`+`docs/` only, ci-variant selection). Nothing about `.mcp.json` or the hook needs a new special case — this is the one point of unanimous, HIGH-confidence agreement across all four files.

**Major components:**
1. `templates/.claude/settings.json` — existing file, content-edit only (add `hooks` key alongside `permissions`).
2. `templates/.mcp.json` — new file, flows through the generic pipeline unmodified.
3. Hook implementation artifact (inline command vs. `.sh` vs. `.mjs`) — **the one open architectural decision**, see below.
4. `goodvibes update`'s `categorise()` — no code change, but its existing overwrite/skip/net-new semantics mean a user who has ever hand-edited `settings.json`/`.mcp.json` will **never** receive the new hook/MCP config via `update`; this must be a documented, stated decision (not a silent gap).

### Critical Pitfalls

1. **Hook implementation shape breaks on some platform if chosen carelessly** — bash+`jq` fails silently on Windows (no blocking exit code, commit proceeds); a `.sh` file needs an executable bit unverified through pip's wheel packaging; a Node `.mjs` script assumes Node is always present, which STACK.md's own research says is no longer guaranteed. Resolve explicitly, don't default to "whatever the first draft used."
2. **Naive "staged JOURNAL.md" check false-blocks or false-passes on real commit shapes** — first commit in a fresh repo, `git commit -a`/`-am` (working-tree vs. index diff), `--amend`, and merge commits all break a one-line `git diff --cached` check. Must be tested as explicit regression cases, not just the happy path.
3. **Overstating what the hook enforces** — it only fires for commits Claude Code's own Bash tool makes. Every user-facing description (README, denial message, onboarding) must say "Claude Code only," not "goodvibes enforces journal updates."
4. **`goodvibes update` cannot safely deliver the hook/MCP config to existing projects that touched those files** — no JSON-aware merge exists (only `CLAUDE.md` gets one). Must be an explicit, documented decision (ship init-only, document the update gap) rather than an unnoticed silent failure.
5. **`.mcp.json` requires a one-time human approval dialog** Claude Code shows on first interactive session — a repo cannot self-approve its own MCP servers. `goodvibes init` writing the file is not the same as context7 being "active"; outro/doctor messaging must say so explicitly.

## Cross-File Agreement, Conflict, and Open Decisions

### Where all four files agree (settled, no further decision needed)
- The copy/manifest/update pipeline needs zero code changes for `.mcp.json` or new hook-related content — just add files under `templates/`.
- `.claude/` and `.mcp.json` are never in the `--minimal` exclusion list (only `.github/`/`docs/` are) — confirmed directly in both `copy-templates.ts` and `copy_templates.py`. No code change required; just don't add them to the exclusion list.
- Do not build a JSON-aware deep-merge for `settings.json`/`.mcp.json` — document the `goodvibes update` limitation instead (ARCHITECTURE.md's Anti-Pattern 1 and PITFALLS.md's Pitfall 4 reach the same conclusion independently). **Gap:** this decision is not yet recorded in PROJECT.md's Key Decisions table — add it before requirements lock.
- context7 ships keyless/free by default; API-key upgrade is docs-only, never an `init`-time prompt, never a hardcoded number (STACK, FEATURES, PITFALLS all converge; the exact quota has already changed twice in early 2026 and will likely change again).
- The hook is a UX nudge, not a security boundary — must never be marketed or documented as a compliance/audit guarantee.

### Conflict #1 (must resolve before requirements lock): Hook implementation shape

| Source | Recommendation | Rationale given |
|---|---|---|
| STACK.md | Inline shell command in `settings.json`, no separate file, filtered via `"if": "Bash(git commit *)"`, no `jq`, `"shell": "bash"` pinned | Simplest, no new file to track, avoids `jq` dependency entirely since the `if` filter (not in-script JSON parsing) does the command matching |
| FEATURES.md | Same inline shape (`git diff --cached --name-only \| grep -q JOURNAL.md`, `exit 2`) | Cheapest mechanism that directly operationalizes the existing rule |
| ARCHITECTURE.md | Separate `.claude/hooks/journal-gate.sh` file invoked via `${CLAUDE_PROJECT_DIR}/.claude/hooks/journal-gate.sh` | Diagrams and build-order center on this shape; flags the wheel exec-bit question as an explicit unverified risk needing a smoke test |
| PITFALLS.md | Separate `.claude/hooks/journal-gate.mjs` Node script, exec form (`"command": "node", "args": [...]`) | bash+`jq` silently breaks on Windows (no blocking exit code on missing binary); claims "Node is required by Claude Code itself on every OS" |

**Contradiction inside the research itself:** PITFALLS.md's Node recommendation rests on Node being universally present, but STACK.md's own "What NOT to Use" section explicitly documents that Claude Code shipped a Node-free native installer (~May 2026) and that npx/Node can no longer be assumed on a user's machine — this is *why* STACK.md rejects `npx @upstash/context7-mcp` as the MCP transport. The same reasoning applies to a Node-based hook script: it introduces exactly the dependency assumption STACK.md just finished ruling out for a different file.

**Recommended resolution:** Use STACK.md/FEATURES.md's inline shell-command shape, but extend the command to cover PITFALLS.md's edge cases (first commit, `-a`/`-am`, `--amend`, merge) inline rather than deferring them — this avoids introducing `jq` (already ruled out) *and* avoids the unverified wheel exec-bit question *and* avoids assuming Node is present. This does not eliminate the Windows-without-Git-Bash risk STACK.md itself flags, but that risk is already accepted as a documented, loud-failure (not silent) limitation consistent with the project's "fail loud" rule — whereas the Node-dependency assumption is not currently reconciled anywhere in the research and would need its own validation. **This is a decision for the roadmapper/requirements phase to lock explicitly, not infer.**

### Conflict #2 (minor, timing only): context7 rate-limit messaging

FEATURES.md defers all rate-limit-messaging *code* to "v1.8.x, after real usage data" (P3, explicitly out of scope for launch). PITFALLS.md's Pitfall 6 says the upgrade-path *doc* must be written "alongside the file" in the same phase that ships `.mcp.json`. These are compatible, not contradictory, once scoped precisely: **documentation** (onboarding note pointing to context7.com/dashboard, no hardcoded quota number) ships in v1.8.0 with the `.mcp.json` file; **code** (friendly 429 handling, a `goodvibes doctor` check) is deferred. Requirements should state this split explicitly so it isn't read as a full contradiction.

### Open question raised only in PITFALLS.md, unaddressed elsewhere: `caveman` default → `ultra`

PROJECT.md's Active requirements list this as settled ("ships with `ultra` as default intensity"), and STACK/ARCHITECTURE/FEATURES treat it as a simple content edit (confirm current default is `full`, change to `ultra`). Only PITFALLS.md (Pitfall 8) raises a substantive risk: `ultra` abbreviates ordinary prose ("DB/auth/config/req/res/fn/impl") for an audience explicitly defined as people who have never opened a terminal before, and `caveman` is self-effacing by design (never announces itself), so a beginner has no way to know why responses got terser and more jargon-heavy. This is a real tension with the "Beginner-first" constraint in PROJECT.md that no other research file weighs in on. **Recommendation:** ship the default change together with an explicit onboarding-doc note (how to `/caveman lite` back down) in the same commit — do not treat it as a silent config bump, per PITFALLS.md's own "Looks Done But Isn't" checklist item.

### Open question: AGENTS.md "binding" wording risks overclaiming for Copilot

PITFALLS.md (Pitfall 10) is the only file to flag that GitHub Copilot ranks AGENTS.md below its own native `.github/copilot-instructions.md`, so hardened "binding for any tool" wording written only into AGENTS.md would in practice never reach Copilot's highest-priority instruction source. The fix goodvibes already has available (a dedicated `copilot-instructions.md`, shipped since Phase 8) just needs to be the file that carries the hardened wording for Copilot specifically, with AGENTS.md described as a fallback/catch-all rather than a universal guarantee.

## Implications for Roadmap

Given the dependency structure and the two waves of largely-independent work identified by ARCHITECTURE.md, the research supports **two parallel phases** (no shared files, consistent with this project's existing Wave 1a/1b precedent from Phase 8/13) rather than a long serial chain:

### Phase 1: Journal-Gate Hook + context7 MCP (the enforcement mechanism)
**Rationale:** This is the only work item with a genuinely open technical decision (hook implementation shape) and unverified risk (wheel exec-bit, if a separate script file is chosen) — sequence it first so the decision and its test coverage land before anything depends on it.
**Delivers:**
- Hook implementation decision locked (recommend: inline shell command in `settings.json`, covering first-commit/`-a`/`-am`/`--amend`/merge edge cases in the same initial implementation — not "happy path now, edge cases later")
- `templates/.claude/settings.json` — `hooks.PreToolUse` block added
- `templates/.mcp.json` — context7 keyless config
- `goodvibes init` outro + `goodvibes doctor` messaging: MCP one-time-approval notice, "Claude Code only" enforcement-scope disclosure, denial message with an actionable next step (not a raw stderr string)
- Explicit `goodvibes update` compatibility decision recorded in PROJECT.md's Key Decisions table (init-only delivery, documented gap — no JSON merge engine)
- Test coverage: generic copy/manifest/update assertions (mirrors Phase 8's IDE-file pattern) + one regression test per commit edge case + an `update`-categorise test specific to `.claude/settings.json`/`.mcp.json`
**Addresses:** FEATURES.md's P1 items (journal-gate hook, context7 bundling)
**Avoids:** PITFALLS.md #1, #2, #4, #5, #6

### Phase 2: Cross-Tool Wording & Governance Rules (can run in parallel with Phase 1)
**Rationale:** Pure content edits to already-shipped, already-manifest-tracked files; zero technical risk, zero dependency on Phase 1's hook-shape decision — can be planned, executed, and merged independently.
**Delivers:**
- Directive-language rewrite across CLAUDE.md, AGENTS.md, and all 13 per-IDE rule files, **plus** a grep-based hedge-word (`should`/`consider`/`try to`/`might want to`) CI consistency test added in the *same* phase, not a follow-up — this directly closes the gap PITFALLS.md flags (no automated check exists today, and the last manual rewrite pass in v1.7.0 already shows this is error-prone at 11+ files)
- JOURNAL.md/CLAUDE.md/AGENTS.md cross-agent binding-contract wording, explicitly qualified as "Claude Code hook enforcement; other tools rely on this wording only"
- New "never ask what's already known" CLAUDE.md rule, written as a sub-bullet of the existing "Think before coding" section (not a free-standing absolute rule) so it cannot be read as overriding the existing ambiguity/security-sensitivity escalation rule
- AGENTS.md wording that describes itself as a fallback/catch-all, with Copilot-specific hardened wording placed in `.github/copilot-instructions.md` instead
- `caveman` default `full`→`ultra` change, shipped together with an onboarding-doc note in the same commit
**Addresses:** FEATURES.md's P1 "never-ask" rule and P2 directive-language rewrite; PROJECT.md's remaining Active requirements
**Avoids:** PITFALLS.md #3, #7, #8, #9, #10

### Phase Ordering Rationale
- Phase 1 goes first (or at minimum, has priority for the hook-shape decision) because it is the only phase with unresolved technical risk; Phase 2 has none and can run concurrently once phases are split into parallel work.
- Splitting by *risk profile* (technical/new-file work vs. pure content edits) rather than by *feature* mirrors ARCHITECTURE.md's explicit build-order recommendation and this project's own Phase 8/13 wave-parallelization precedent.
- PITFALLS.md's repeated instruction ("ship X together with Y in the same phase/commit," e.g. edge-case tests with the hook, the consistency test with the wording rewrite, the onboarding note with the caveman bump) is folded directly into each phase's deliverables above rather than treated as separate follow-up phases — this is the direct reconciliation of ARCHITECTURE.md's ordering with PITFALLS.md's "don't defer edge cases" warnings.

### Research Flags

Needs research (`--research-phase`) during planning:
- **Phase 1** — the hook-implementation-shape conflict is not fully resolved by this synthesis; phase planning should either validate the inline-bash approach against a real Windows-without-Git-Bash environment and a pip-wheel install (to close the exec-bit question if a script file is chosen anyway), or explicitly re-litigate the Node-dependency question with a decision on record. Also verify the minimum Claude Code version supporting `if`/`shell` fields, flagged MEDIUM-confidence in STACK.md and not independently verified.

Standard patterns (skip research-phase):
- **Phase 2** — directive-language content edits, a grep-based CI test, and markdown wording changes are unambiguous, well-precedented (v1.7.0 already did a similar pass), and carry no technical uncertainty.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH (with one flagged MEDIUM sub-point) | Hooks/`.mcp.json` schema verified directly against official Claude Code docs; the Windows shell-availability assumption and minimum-version compatibility are explicitly flagged MEDIUM by STACK.md itself |
| Features | MEDIUM-HIGH | Claude Code hook mechanics HIGH; AGENTS.md ecosystem and context7 findings MEDIUM (multiple independent sources); the "ask-first compliance" statistic is explicitly flagged LOW-MEDIUM by FEATURES.md itself, treat as directional only |
| Architecture | HIGH (with one explicit open verification item) | All claims verified against actual repo source or empirical testing in-session; the one unverified point (Unix exec-bit survival through hatchling's wheel packaging) is explicitly named and given a concrete verification plan, not silently assumed |
| Pitfalls | HIGH (mechanics) / MEDIUM (predictive claims) | Hook exit-code semantics, `.mcp.json` approval flow, and context7 rate-limit history verified against official docs and multiple sources; predictions about beginner comprehension of `caveman ultra` and directive-language overreach are reasoned, not observed, and explicitly flagged MEDIUM by PITFALLS.md itself |

**Overall confidence:** MEDIUM-HIGH. The platform mechanics are solid; the one real gap is a design decision (hook implementation shape) that the four research files did not converge on and that contains an internal contradiction (Node-availability) that must be resolved by an explicit call during requirements/roadmap work, not left to whichever file a planner reads last.

### Gaps to Address

- **Hook implementation shape is unresolved** (Conflict #1 above) — resolve explicitly in requirements before Phase 1 planning; recommended default is the inline-bash-command shape, but this must be a stated decision, not an inferred one.
- **PROJECT.md's Key Decisions table does not yet record** the "`goodvibes update` documents the JSON-merge gap rather than building one" decision, despite all research converging on it — add it during requirements so it isn't silently re-litigated later.
- **Executable-bit survival through pip wheel packaging is unverified** — only relevant if a separate script file (not an inline command) is chosen; needs a concrete smoke test (`pip install` the built wheel, `ls -la` the hook file) before that path can be called shippable.
- **Minimum Claude Code version supporting the `if`/`shell` hook fields is not verified** — STACK.md flags this as needing a spot-check; goodvibes should document a minimum version in onboarding rather than assume universal support.
- **`caveman` default bump to `ultra` has no resolution beyond PITFALLS.md's caution** — requirements should explicitly decide whether to ship as-is with an onboarding note (PITFALLS.md's preferred mitigation) or revisit the default; currently only one of four research files even raises this as a risk.
- **Windows-without-Git-Bash prevalence is unknown** — accepted by STACK.md as an edge case with a loud-failure fallback; no data exists on how common this actually is among goodvibes' beginner audience, flag for post-launch monitoring rather than blocking.

## Sources

### Primary (HIGH confidence)
- [Hooks reference — Claude Code Docs](https://code.claude.com/docs/en/hooks) — `PreToolUse` schema, exit-code semantics, `matcher`/`if` fields, `${CLAUDE_PROJECT_DIR}`, shell resolution/Windows fallback
- [MCP documentation — Claude Code Docs](https://code.claude.com/docs/en/mcp) — `.mcp.json` schema, transport types, `${VAR}` expansion, approval flow
- [MCP Clients — Context7 Docs](https://context7.com/docs/resources/all-clients) — keyless-remote and API-key config variants
- [Context7 MCP — GitHub (upstash/context7)](https://github.com/upstash/context7) — MIT license, keyless config confirmed
- [Git - githooks Documentation (git-scm.com)](https://git-scm.com/docs/githooks) — `pre-merge-commit`/`post-rewrite` semantics informing edge-case handling
- Direct repo inspection: `packages/npm/src/steps/copy-templates.ts`, `write-manifest.ts`, `packages/npm/src/commands/update.ts`, `init.ts`, `configure-mcp.ts`; `packages/pip/src/goodvibes_cli/steps/copy_templates.py`, `write_manifest.py`, `hatch_build.py`; `templates/.claude/settings.json`, `templates/.claude/skills/caveman/SKILL.md`; `.planning/PROJECT.md`
- Empirical in-session verification: `fs.copyFileSync`/`fs.cpSync`/`shutil.copytree` all preserve Unix executable bit (ARCHITECTURE.md)

### Secondary (MEDIUM confidence)
- [AGENTS.md — official site](https://agents.md/) and [agentsmd/agents.md — GitHub](https://github.com/agentsmd/agents.md) — spec ownership, adoption figures
- [Context7 Quietly Slashed Its Free Tier by 92% — Dev Genius](https://blog.devgenius.io/context7-quietly-slashed-its-free-tier-by-92-16fa05ddce03) and [upstash/context7 issues #2145, #808, #206](https://github.com/upstash/context7) — free-tier rate-limit history
- [jq/Windows hook dependency issue — anthropics/claude-code#14817, #29321, #29268](https://github.com/anthropics/claude-code/issues/14817)
- [Claude Code MCP scopes / approval flow — anthropics/claude-code#63308, informgrowth.com, repello.ai](https://github.com/anthropics/claude-code/issues/63308)
- WebSearch aggregation (morphllm.com, claudefast.com, nxcode.io, thepromptshelf.dev, vanja.io) — Claude Code's Node-free native installer trend, cross-confirmed across independent sources but not a single canonical Anthropic post

### Tertiary (LOW confidence)
- ["Your AI Agent Doesn't Care About Your README" — DAPLab](https://daplab.cs.columbia.edu/general/2026/03/31/your-ai-agent-doesnt-care-about-your-readme.html) — single-source rule-compliance percentage, treat as directional only
- PITFALLS.md's predictive claims about beginner comprehension of `caveman ultra` and directive-language rule conflicts — reasoned from documented LLM behavior, not a goodvibes-specific post-mortem

---
*Research completed: 2026-09-05*
*Ready for roadmap: yes, contingent on locking the hook-implementation-shape decision (Conflict #1) during requirements*
