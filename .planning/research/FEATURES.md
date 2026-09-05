# Feature Research

**Domain:** AI coding agent governance & cross-tool rule enforcement (beginner-facing scaffolding CLI)
**Researched:** 2026-09-05
**Confidence:** MEDIUM-HIGH — Claude Code hook mechanics verified against official docs (HIGH); AGENTS.md ecosystem and context7 findings verified across multiple independent sources (MEDIUM); memory-bank/handoff pattern and "ask-first compliance" stats rest on fewer sources (LOW-MEDIUM, flagged inline)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete relative to what the AI-coding-agent ecosystem already converged on.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Vendor-neutral cross-tool instructions file (AGENTS.md) | AGENTS.md is now a Linux Foundation–stewarded open spec, natively read by 20+ tools (Cursor, Windsurf, Aider, Codex, Gemini CLI, Devin, Zed, etc.) and adopted by 60,000+ repos as of Dec 2025 — goodvibes already ships this, but v1.8.0 must not regress it while strengthening wording | LOW | Already shipped (`templates/AGENTS.md`); v1.8.0 work is a content/wording pass, not a new file |
| Tiered "always do / ask first / never do" rule structure | AGENTS.md best-practice guides converge on this exact three-tier structure as what stops agents from asking unnecessary permission questions | LOW | goodvibes already has this as the "Action tiers" table in CLAUDE.md/AGENTS.md — the v1.8.0 anti-redundant-question rule extends it, doesn't replace it |
| Secrets kept out of committed MCP config via `${ENV_VAR}` interpolation | `.mcp.json` at repo root is committed to git by design (shared team config) — Claude Code docs and community guides are unanimous that hardcoded keys in a committed file is a leak vector | LOW | Applies directly to the context7 `.mcp.json` — ship the keyless remote/stdio config by default; if docs show an API-key variant, it must use `${CONTEXT7_API_KEY}`, never a literal key |
| Explicit disclosure of where enforcement does and doesn't apply | Claude Code hooks fire only on tool calls Claude Code itself makes (Bash, Edit, MCP tools) — confirmed in official docs: there is "no mechanism... for intercepting commands a human runs manually" or that another agent (Codex, Cursor) runs, since those tools have no equivalent hook API | LOW | Must be stated plainly in docs/CLAUDE.md: the journal-gate hook only protects commits Claude Code itself runs. A human typing `git commit` in a raw terminal, or Cursor/Codex committing on the user's behalf, is not gated. Overstating "enforcement" here is a credibility risk for a beginner-trust product |

### Differentiators (Competitive Advantage)

Features that set goodvibes apart from other scaffolders/agent-rule ecosystems. Not required, but valuable, and each aligns with the Core Value (quietly guide the agent, enforce hygiene without the user configuring anything).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `PreToolUse` hook gating `git commit` on `JOURNAL.md` being staged | Turns one specific rule from advisory markdown into something the tool physically cannot skip when Claude Code itself runs the commit — verified mechanism: an `exit 2` from a `PreToolUse` handler matched on `Bash` blocks the call unconditionally, even overriding any JSON `"allow"` decision. No comparable scaffolding tool researched (spec-kit, shadcn, create-t3-app) ships an equivalent enforcement hook | LOW | Implementation: `.claude/settings.json` → `hooks.PreToolUse` → `matcher: "Bash"`, `if: "Bash(git commit*)"`, `command` runs `git diff --cached --name-only \| grep -q JOURNAL.md`, exits 2 with an actionable stderr message on failure. Must explicitly exclude `git commit --amend`, `git merge` (which invokes `pre-merge-commit`), and empty/initial commits — see Anti-Features below |
| Cross-agent handoff contract explicitly wired into JOURNAL.md + CLAUDE.md + AGENTS.md | Formalizes a pattern the ecosystem already values informally (Cline's memory-bank / self-authoring rules pattern shows real demand for "a new agent picks up work without a lengthy briefing") but ties it to a file goodvibes already ships everywhere, rather than adding a new `memory-bank/` folder or MCP server most competitors use | MEDIUM | Cline's implementation uses a dedicated `memory-bank/` folder or an MCP server; goodvibes' approach (strengthen JOURNAL.md's existing role) is lighter-weight and consistent with "language-agnostic, zero extra files" constraint. This is a reasonable but partly novel design choice — flag MEDIUM confidence since no other tool researched formalizes "JOURNAL.md is binding" quite this way |
| Named "don't ask what you already know" CLAUDE.md rule with an enumerated source list | Widely recommended in AGENTS.md best-practice guides as *why* front-loading instructions matters (a team that moved recurring chat context into AGENTS.md reportedly saw reduced prompt length within two weeks because the agent stopped re-asking), but it's usually implicit in "ask-first" tiering rather than a standalone, explicitly-named rule | LOW | Make it concrete and checkable: "Before asking the user anything, check README.md, CLAUDE.md, AGENTS.md, JOURNAL.md, and the codebase itself. Only ask if the answer isn't in any of those." Concrete source list is what makes this enforceable-in-spirit rather than a vague admonition |
| context7 MCP bundled by default, keyless, zero account required | Researched comparably-scoped scaffolders (shadcn CLI 3.0, create-t3-app, Wrangler) either don't ship MCP by default or require the developer to hand-create `.mcp.json`/`.cursor/mcp.json` themselves per editor. Shipping it pre-wired is a genuine "zero-config" differentiator matching goodvibes' existing headroom/caveman bundling philosophy | LOW | Config: `{"mcpServers":{"context7":{"url":"https://mcp.context7.com/mcp"}}}` (remote, no key) or the `npx -y @upstash/context7-mcp@latest` stdio form — both are keyless-capable. See Anti-Features for the rate-limit caveat that must be documented, not hidden |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for a zero-config, beginner-facing tool.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Hook gate that also fires on `git merge`, `git commit --amend`, `git rebase`, and empty/WIP commits | Feels "more thorough" — every commit should have a journal entry | Well-documented false-positive pattern: `pre-merge-commit` re-runs pre-commit-style checks mid-merge, producing confusing validation errors mid-operation for both CLI and IDE-driven merges (`conventional-pre-commit` maintainers had to add a `--skip-merge-commits` escape hatch after user complaints). The very first commit in a fresh goodvibes project also can't satisfy "JOURNAL.md staged" without a bootstrap exception, since the file may not exist yet as a tracked change | Scope the `if` matcher / grep logic to skip when the command contains `--amend`, when `git merge`/`git rebase` is in progress (`.git/MERGE_HEAD` exists), and treat the very first repo commit (that adds JOURNAL.md itself) as satisfying the rule by definition |
| Generic static-analysis enforcement hooks (block on empty `catch`, missing tests, `console.log`, etc.) | Since one enforcement hook works, "why not enforce everything CLAUDE.md says" | Explicitly out of scope per this milestone's own Key Decision ("journal-gate hook over broader static-analysis hooks... detecting rule violations like empty catch blocks generically is out of scope"); each additional check multiplies false-positive surface and requires language-specific parsing goodvibes' language-agnostic constraint doesn't support cheaply | Leave broader static analysis to the CI workflows goodvibes already ships (CodeQL, lint/test gates from Phase 04); the hook stays narrowly scoped to the one rule that's cheap and unambiguous to check (`grep` on staged file list) |
| Requiring a context7 account/API key as part of `goodvibes init` | Higher rate limits (1,000 calls/month + key vs. much lower unauthenticated) look objectively better, so "why not just require it" | Breaks the zero-config, no-signup promise that is this project's Core Value; context7's free tier has been cut sharply over time (one report: ~6,000/month down to 1,000/month, plus an added 60/hour cap) and unauthenticated usage is reported to hit "rate limited" errors quickly (multiple open upstash/context7 GitHub issues: #2145, #808, #206) — a mandatory signup step for a beginner installer is real friction, not a minor one | Ship keyless by default (works, just capped); document the free API-key upgrade as an optional docs section only, never an init-time prompt — consistent with the "account/API-key upgrade documented as opt-in, not required" decision already recorded in PROJECT.md |
| Auto-suppressing or working around Claude Code's first-run "trust this project's MCP servers?" prompt | Feels more "zero-config" if the user never sees a security prompt | Claude Code intentionally shows this prompt before loading any project-scoped `.mcp.json` server the first time, specifically because the file could contain commands from someone else's codebase; there's no supported way to pre-approve it from the shipped files, and trying to script around it is itself a security anti-pattern for a tool whose audience has never used a terminal | Document the one-time prompt in onboarding docs ("the first time you open this project, Claude Code will ask to trust the context7 tool — say yes") rather than trying to eliminate it |

## Feature Dependencies

```
JOURNAL.md (already shipped)
    └──requires──> PreToolUse commit-gate hook (v1.8.0)
                       └──requires──> .claude/settings.json hooks field (extends existing file)

CLAUDE.md + AGENTS.md wording pass (directive language)
    └──enhances──> Cross-agent JOURNAL.md handoff contract
    └──enhances──> Anti-redundant-question rule (consistent imperative tone)

context7 .mcp.json (new file)
    └──enhances──> Anti-redundant-question rule (agent has a real doc-lookup tool instead of guessing or asking)

Anti-redundant-question rule
    └──conflicts──> none identified — purely additive to existing Action-tiers table
```

### Dependency Notes

- **PreToolUse hook requires the existing `.claude/settings.json`:** goodvibes already ships this file with `permissions.allow`/`deny`. The hook is an additive `hooks` key in the same file — no new file, no new mechanism to introduce to users.
- **Cross-agent contract enhances, doesn't require, the directive-language rewrite:** the JOURNAL.md/CLAUDE.md/AGENTS.md wording strengthening can ship independently, but doing the directive-language pass at the same time avoids a second wording pass later — do them together for one clean diff.
- **context7 enhances the anti-redundant-question rule:** part of "don't ask what you already know" is "look it up instead of guessing" — context7 gives the agent a documentation-lookup path so it has somewhere to look instead of asking the user or hallucinating an API signature.
- **No conflicts identified** between the four target features — they touch four largely independent surfaces (one hook, three markdown files' wording, one skill's default value, one new config file).

## MVP Definition

### Launch With (v1.8.0)

- [ ] `PreToolUse` hook blocking `git commit` unless `JOURNAL.md` is in the staged file list, with explicit exceptions for `--amend`, in-progress merges/rebases, and the bootstrap commit that adds JOURNAL.md itself — this is the one genuinely new *enforcement* mechanism, essential to the milestone's stated goal ("make rules actually binding")
- [ ] JOURNAL.md/CLAUDE.md/AGENTS.md wording strengthened so any agent reads JOURNAL.md before acting and treats prior entries as binding — this is the cross-agent continuity mechanism and the milestone's second stated goal
- [ ] Anti-redundant-question CLAUDE.md rule with an enumerated source list (README, CLAUDE.md, AGENTS.md, JOURNAL.md, codebase) — cheap, directly requested, aligns with documented AGENTS.md best practice
- [ ] `.mcp.json` shipped with context7 configured keyless/free by default, docs covering the optional API-key upgrade via `${CONTEXT7_API_KEY}` — directly requested, matches existing zero-config bundling pattern (headroom, caveman)

### Add After Validation (v1.8.x)

- [ ] Friendly rate-limit messaging if context7 calls start returning 429s — only worth building once real users report hitting the unauthenticated cap, per the documented GitHub issues; premature to build proactively without usage data
- [ ] Revisit hook coverage if/when Codex, Cursor, or other tools ship an equivalent PreToolUse-style hook API — none currently do, so there is nothing to extend to yet

### Future Consideration (v2+)

- [ ] Broader static-analysis enforcement hooks (secret scanning, empty-catch detection, etc.) — explicitly deferred per this milestone's own Key Decision; needs its own design pass to avoid the false-positive problems documented for merge/amend gating, at a larger scale
- [ ] A goodvibes-operated caching/relay layer in front of context7 to buffer free-tier rate limits — meaningful infra investment; premature before knowing how often beginner users actually hit the cap

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Journal-gate `PreToolUse` hook (with merge/amend/bootstrap exceptions) | HIGH | LOW | P1 |
| Cross-agent JOURNAL.md/CLAUDE.md/AGENTS.md binding-contract wording | HIGH | LOW | P1 |
| Anti-redundant-question rule with enumerated sources | MEDIUM | LOW | P1 |
| context7 `.mcp.json` bundled keyless by default | HIGH | LOW | P1 |
| Directive-language rewrite across CLAUDE.md/AGENTS.md/all IDE files | MEDIUM | MEDIUM | P2 |
| context7 rate-limit-hit friendly messaging | LOW | MEDIUM | P3 |
| Broader static-analysis enforcement hooks | MEDIUM | HIGH | P3 (explicitly out of scope this milestone) |

**Priority key:**
- P1: Must have for v1.8.0 launch
- P2: Should have, bundle into the same milestone if time allows (already scheduled per PROJECT.md Active list)
- P3: Nice to have, future consideration — do not build speculatively

## Competitor Feature Analysis

| Feature | GitHub spec-kit | Cline (memory-bank pattern) | shadcn CLI 3.0 (MCP) | goodvibes v1.8.0 approach |
|---------|------------------|------------------------------|------------------------|----------------------------|
| Cross-agent handoff record | `constitution.md` — a "read this first" gate before spec/plan/tasks commands run | `memory-bank/` folder (or dedicated MCP server) the agent self-authors and re-reads each session | Not applicable — no handoff concept | Strengthen the already-shipped `JOURNAL.md`, read via CLAUDE.md/AGENTS.md pointer — no new file, works with every tool that already reads AGENTS.md |
| Hard enforcement beyond markdown | None found — agent-context files are advisory; spec-kit's own AGENTS.md is opt-in, not enforced by tooling | None — relies on the agent choosing to read/write memory files; newer Cline+Hindsight integration uses lifecycle hooks for *memory recall*, not rule enforcement | Not applicable | Claude Code `PreToolUse` hook physically blocks `git commit` missing a journal entry — the one point of real, non-advisory enforcement researched across all three comparators |
| MCP bundled by default | No | No — the memory-bank MCP variant is itself opt-in/manual install | No — shadcn's MCP server requires the developer to hand-write `.mcp.json`/`.cursor/mcp.json` per editor | Yes — `context7` ships pre-wired, keyless, in `.mcp.json` at repo root |

## Sources

- [Claude Code Hooks — official docs (code.claude.com)](https://code.claude.com/docs/en/hooks) — HIGH confidence: `PreToolUse` matcher/`if`/exit-code semantics, settings.json schema, and the "only fires for Claude Code's own tool calls" limitation, verified directly against vendor documentation
- [Feature Request: Hooks for Git Workflow Automation — anthropics/claude-code#4834](https://github.com/anthropics/claude-code/issues/4834) — MEDIUM: community discussion confirming PreToolUse-over-PostToolUse preference for commit gating
- [Agent bypasses git pre-commit hooks using --no-verify, stash, quiet flags — anthropics/claude-code#40117](https://github.com/anthropics/claude-code/issues/40117) — MEDIUM: documented real-world case of an agent circumventing hook-adjacent enforcement; informs the merge/amend-exception design rather than an unconditional block
- [How to stop AI agents from bypassing pre-commit hooks — pydevtools.com](https://pydevtools.com/handbook/how-to/how-to-stop-ai-agents-from-bypassing-pre-commit-hooks/) — MEDIUM
- [AGENTS.md — official site](https://agents.md/) and [agentsmd/agents.md — GitHub](https://github.com/agentsmd/agents.md) — HIGH: spec ownership (Linux Foundation Agentic AI Foundation), 60,000+ repo adoption, 20+ supporting tools
- [AGENTS.md Spec (2026) — morphllm.com](https://www.morphllm.com/agents-md-guide) — MEDIUM: tiered always/ask-first/never rule structure recommendation
- ["Your AI Agent Doesn't Care About Your README" — DAPLab](https://daplab.cs.columbia.edu/general/2026/03/31/your-ai-agent-doesnt-care-about-your-readme.html) — LOW-MEDIUM: single-source claim that rule-file compliance is ~25-40% without an enforcement layer; treat as directional, not a hard statistic
- [Cline: Memory Bank blog post — cline.bot](https://cline.bot/blog/memory-bank-how-to-make-cline-an-ai-agent-that-never-forgets) and [Cline Persistent Memory: Lifecycle Hooks Instead of MCP — Hindsight](https://hindsight.vectorize.io/blog/2026/06/09/cline-persistent-memory) — MEDIUM: memory-bank/self-authoring-rules pattern as prior art for cross-session/cross-agent continuity
- [github/spec-kit — AGENTS.md and README](https://github.com/github/spec-kit/blob/main/AGENTS.md) — MEDIUM: `constitution.md` as the closest analog to a "read-first, binding" gate file
- [Context7 MCP — GitHub (upstash/context7)](https://github.com/upstash/context7) — HIGH: MIT license confirmed, keyless stdio/remote config formats confirmed
- [Context7 Pricing & Plans](https://context7.com/plans) and [Context7 Quietly Slashed Its Free Tier by 92% — Dev Genius](https://blog.devgenius.io/context7-quietly-slashed-its-free-tier-by-92-16fa05ddce03) — MEDIUM: free-tier reduction over time (reports converge on ~1,000 calls/month + 60/hour cap, down from a much higher earlier limit)
- [upstash/context7 rate-limit issues #2145](https://github.com/upstash/context7/issues/2145), [#808](https://github.com/upstash/context7/issues/808), [#206](https://github.com/upstash/context7/issues/206) — MEDIUM: recurring user reports of hitting rate limits on unauthenticated/free usage
- [shadcn/ui MCP Server docs](https://ui.shadcn.com/docs/mcp) and [August 2025 changelog — shadcn CLI 3.0 and MCP Server](https://ui.shadcn.com/docs/changelog/2025-08-cli-3-mcp) — HIGH: confirms shadcn's MCP integration requires manual per-editor `mcp.json` creation, not bundled by default
- [Project Scope in .mcp.json vs User Scope — claudecertified.io](https://claudecertified.io/knowledge/domain2/k2-4-1-mcp-server-scope) and [Claude Code MCP Scopes reference — informgrowth.com](https://informgrowth.com/blog/claude-code-mcp-scopes-reference) — MEDIUM: confirms `.mcp.json` at repo root is the correct committed/team-shared scope, first-run trust-prompt behavior, and `${ENV_VAR}` secrets pattern
- [Git - githooks Documentation (git-scm.com)](https://git-scm.com/docs/githooks) — HIGH: `pre-merge-commit` re-invokes `pre-commit`-style checks during merges; `post-rewrite` fires on `--amend`/rebase — informs the hook's merge/amend exception logic
- [compilerla/conventional-pre-commit#103](https://github.com/compilerla/conventional-pre-commit/issues/103) — MEDIUM: real-world false-positive report from merge commits triggering commit-format validation, motivating the `--skip-merge-commits`-style exception pattern

---
*Feature research for: AI coding agent governance & cross-tool enforcement (goodvibes v1.8.0)*
*Researched: 2026-09-05*
