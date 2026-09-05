# Pitfalls Research

**Domain:** Agent governance / cross-tool enforcement for a beginner-facing, zero-config scaffolding CLI (goodvibes v1.8.0)
**Researched:** 2026-09-05
**Confidence:** HIGH (hook mechanics, .mcp.json approval flow, context7 rate limits, jq/Windows issue — all verified against official Claude Code docs and multiple independent sources dated 2026); MEDIUM (predictions about beginner comprehension of caveman `ultra` and directive-language overreach — reasoned from documented LLM behavior, not a goodvibes-specific post-mortem)

## Critical Pitfalls

### Pitfall 1: Hook script written in bash+jq breaks silently on Windows

**What goes wrong:**
The obvious way to write a `PreToolUse` hook that inspects `.tool_input.command` is a bash script piping through `jq`. `jq` is not installed by default on Windows (including inside Git Bash), and Claude Code's own official hook examples use `jq` without a Windows install path. When the hook errors out on a malformed/missing-binary exit code (not exit code 2), Claude Code treats it as a **non-blocking error** — the `git commit` proceeds anyway, with only an easy-to-miss `<hook name> hook error` notice.

**Why it happens:**
goodvibes' target audience is described as people who "have never opened a terminal before" and is explicitly Windows-inclusive (WSL/Windows path handling is already called out as MEDIUM-confidence risk in STACK.md). Bash+jq is the pattern in every public Claude Code hooks tutorial, so it's the path of least resistance to copy.

**How to avoid:**
Write the hook as a Node.js script (`.claude/hooks/journal-gate.mjs` or similar) invoked via exec form: `"command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/journal-gate.mjs"]`. Node is a hard dependency of the npm CLI path already and is required by Claude Code itself on every OS, so this adds zero new dependencies and needs no executable bit (sidesteps Pitfall 2's git-checkout permission issue too). Parse the hook's JSON stdin with `JSON.parse` (Node stdlib) instead of `jq`.

**Warning signs:**
Any hook example in code review that pipes `cat` into `jq -r`. A test project on a fresh Windows machine (no WSL, no manually-installed jq) where `git commit` succeeds without a JOURNAL.md diff and no error is shown.

**Phase to address:**
The phase implementing the commit-blocking hook — must ship the hook as a `.mjs` script from day one, not "bash now, Node later."

---

### Pitfall 2: The hook blocks (or fails to block) on git commit edge cases the "staged JOURNAL.md" check doesn't account for

**What goes wrong:**
A naive implementation checks `git diff --cached --name-only` for `JOURNAL.md` before letting `git commit` through. Several real commit shapes break this:
- **First commit in a fresh repo** (`git rev-parse HEAD` fails, no parent) — a brand-new goodvibes project's very first commit has no "prior session" to log yet; blocking it is a hard stop on hour one for a total beginner.
- **`git commit -a` / `-am`** auto-stages already-tracked modified files *as part of the commit itself* — the index at hook-execution time (before the real commit runs) does not yet reflect what `-a` will stage. A naive `--cached` check will false-block a legitimate `git commit -am "fix typo"` that *does* update JOURNAL.md on disk but never explicitly `git add`ed it.
- **`git commit --amend`** and **merge commits** (`git merge` auto-invoking commit) typically shouldn't require a fresh journal entry every time.
- **Bypass paths outside the Bash tool**: an agent could construct the commit via `git commit --file=msg.txt`, a wrapper script, `git -c` config overrides, or simply ask the user to click "Commit" in their IDE's Source Control panel — none of which invoke Claude Code's `Bash` tool, so the hook never fires at all (see Pitfall 3).
- Per Claude Code's own docs, the `if` matcher used to detect "this Bash call is a git commit" is explicitly **best-effort**, not authoritative — dynamic/`$VAR`-driven commands can dodge detection or over-trigger.

**Why it happens:**
"Check if JOURNAL.md is staged" sounds like a one-line `git diff --cached` check, but git has at least four different ways to get content into a commit, and the hook fires *before* git resolves any of them.

**How to avoid:**
- Special-case "no prior commits" (`git rev-parse HEAD` exit != 0) → allow through unconditionally.
- Detect `-a`/`--all`/`-am` flags in the command string and, if present, check the **working tree diff** (`git status --porcelain`) for JOURNAL.md instead of the index.
- Skip the gate on `--amend` and on commits invoked by `git merge`/`git rebase --continue` (best-effort — detect via command string, don't try to be perfect).
- Document explicitly and prominently (README/onboarding) that this is a **speed bump for one agent in one tool**, not a git-level guarantee — see Pitfall 3.

**Warning signs:**
A beginner's very first `git commit` in a fresh clone fails with a cryptic denial and no clear next step. A user reports "I DID update the journal but it still says I didn't" after using `git commit -am`.

**Phase to address:**
The commit-blocking hook phase — write the edge cases above as explicit test cases (regression-test style, one per bullet) before considering the feature done.

---

### Pitfall 3: The hook creates a false sense of enforcement it cannot actually provide

**What goes wrong:**
`.claude/settings.json` hooks only run inside Claude Code, and only when Claude Code's own `Bash` tool executes the command. Any of the following silently bypass the "enforced" journal gate: using Codex, Cursor, Copilot, Windsurf, or any other of the 10+ tools goodvibes targets; running `git commit` directly in a terminal outside Claude Code; using an IDE's built-in Source Control / Git panel; running Claude Code in a Docker/CI/headless context where `.claude/settings.json` hooks are present but the human never sees the block reason. The milestone's own framing ("operationalizes... instead of trusting the agent to remember") risks being read by users as "my commits are now guaranteed to include a journal entry," which is false for the other 9 supported tools and for manual commits.

**Why it happens:**
Hooks are a genuinely strong mechanism *within* Claude Code, so it's tempting to describe the feature in absolute terms ("blocks commits without a journal entry") in docs/marketing rather than the true scope ("blocks commits made *by Claude Code's own Bash tool* without a journal entry").

**How to avoid:**
Every user-facing description of this feature (README, CHANGELOG, onboarding doc, the hook's own denial message) must name the actual boundary: "Claude Code only — other tools rely on the strengthened CLAUDE.md/AGENTS.md wording instead." This is already correctly captured in PROJECT.md's Constraints section ("Hooks are Claude Code-only... those tools get the strengthened-wording fallback only, never silent enforcement they can't actually run") — the risk is that this nuance gets lost when writing shorter marketing copy or the denial message shown to the beginner.

**Warning signs:**
Draft copy that says "goodvibes enforces journal updates" without a "(Claude Code only)" qualifier anywhere nearby.

**Phase to address:**
Cross-agent handoff hardening phase (docs) — write the qualifier once into JOURNAL.md's own header and README, then reference it rather than restating it in each file.

---

### Pitfall 4: The manifest/no-clobber system cannot merge JSON files the way it merges CLAUDE.md — hooks and MCP config get silently dropped on update

**What goes wrong:**
goodvibes' existing `goodvibes update` command (verified in `packages/npm/src/commands/update.ts`) categorizes every template file as **overwrite** (unmodified since last manifest snapshot → whole-file replace), **skip** (hash differs from manifest → treat as user-modified, never touch), or **net-new**. Only `CLAUDE.md` gets special sentinel-based merging (`mergeClaude`); every other file, including `.claude/settings.json` and the new `.mcp.json`, is copied wholesale or skipped wholesale — there is no JSON-aware merge. This produces two failure modes for this milestone specifically:
1. **A user who used Claude Code's own `/hooks` UI or manually edited `.claude/settings.json`** (e.g., to add their own permission rule) now has a file whose hash differs from the manifest → classified "user-modified" → `goodvibes update` will **never** deliver the new journal-gate hook or the `context7` MCP entry to that project, forever, with no warning that anything was skipped for that reason.
2. **A user who never touched `.claude/settings.json`** gets it fully overwritten on `update` — if the *new* template version reorders keys or the user is on `--force`, any local key that happens to collide (e.g. a permission `deny` entry) is replaced with the template's version, since it is a full-file swap, not a JSON deep-merge.

The same applies to `.mcp.json`: a user who adds their own MCP server entry to `.mcp.json` (e.g., a personal Postgres MCP) makes the whole file "user-modified," and future context7 config bumps (a new endpoint, updated args) never reach that project via `update`.

**Why it happens:**
The manifest system was designed for markdown/text template files where "did the user touch this" is a meaningful yes/no signal for full-file safety. Hook and MCP config files are inherently *additive/composable* (multiple settings.json scopes already merge inside Claude Code itself — see official docs) but goodvibes' own update mechanism does not model that.

**How to avoid:**
Before shipping, decide and document one of:
- Give `.claude/settings.json` and `.mcp.json` a dedicated JSON-merge step (deep-merge `hooks`/`mcpServers` keys, similar in spirit to `mergeClaude`'s sentinel block) instead of routing them through the generic manifest overwrite/skip categorization.
- Or explicitly scope this milestone to **fresh `init` only** and document in FAQ.md/README that existing projects must delete-and-recreate (or manually add) the hook/MCP block to receive it via `update` — do not silently claim `update` delivers it.
Given the "Journal-gate hook over broader static-analysis hooks" decision already prioritizes cheap mechanisms, a documented `update` limitation is more consistent with goodvibes' ponytail minimalism than building a generic JSON merge engine — but it must be a **stated decision**, not an unnoticed gap.

**Warning signs:**
No regression test exists today covering `goodvibes update` behavior for `.claude/settings.json` specifically (verified: `update.test.ts` categorizes generically, no settings.json-specific case). Absence of such a test is itself the warning sign.

**Phase to address:**
Whichever phase ships the hook/`.mcp.json` template files — must include an explicit `update` compatibility decision and test, not just an `init` test.

---

### Pitfall 5: `.mcp.json` requires a one-time interactive approval dialog the beginner may never see

**What goes wrong:**
Claude Code treats **project-scoped MCP servers defined in `.mcp.json`** as untrusted-by-default: the first time a user opens an interactive Claude Code session in that project folder, they get a one-time approval prompt, and until approved the server shows as "⏸ Pending approval" in `claude mcp list`/`/mcp` — it does not connect. Critically, **a repo cannot approve its own servers**: settings/config committed into the project are ignored until the human accepts the trust dialog in that specific session. A `goodvibes init` run (which just writes the file) never triggers this dialog itself — it only fires the next time `claude` is opened interactively in that directory. Users who exclusively drive Claude Code non-interactively (`-p`/print mode, CI, another IDE's embedded terminal that doesn't surface the dialog) will never see context7 actually load, with zero error message pointing at the cause — it just looks like context7 "doesn't do anything."

**Why it happens:**
This is a deliberate Claude Code security boundary (a `.mcp.json` arriving via `git clone`/fork should not silently execute arbitrary commands), but it directly collides with goodvibes' zero-config promise: the tool cannot make context7 "just work" the way it makes CLAUDE.md or CI workflows just work, because Anthropic's own product requires a human-in-the-loop click that goodvibes cannot script around.

**How to avoid:**
Document this explicitly in the onboarding doc and in the `goodvibes init` outro output itself ("context7 is configured — open Claude Code in this folder and approve it when prompted"). Do not word the feature as "context7 is ready to use" in CLI output; word it as "context7 is configured — approve it the first time you open Claude Code here." Consider a `goodvibes doctor` check that reports `.mcp.json` present but unapproved (best-effort via `claude mcp list` parsing) rather than silently assuming success.

**Warning signs:**
A support/FAQ pattern of "I have goodvibes' context7 set up but library docs never seem to load" — exactly the shape of prior real issues (an existing FAQ entry already documents a similarly invisible failure mode for the npm→pip package migration).

**Phase to address:**
The `.mcp.json` shipping phase — the outro/doctor messaging must be written alongside the file, not left to a later polish pass.

---

### Pitfall 6: context7's free/anonymous tier has low and recently-cut rate limits — a zero-config default that can silently degrade

**What goes wrong:**
Context7's own FAQ states the no-API-key tier has "low rate limits and no custom configuration." As of January 2026, Context7 cut its free tier from roughly 6,000 requests/month to 500/month (bumped to ~1,000/month after user pushback days later) — a documented ~92% reduction reported independently of Context7's own materials. A goodvibes project shipping `.mcp.json` wired to the anonymous endpoint by default means every project this milestone touches shares no visibility into how close it is to that shared, unauthenticated ceiling, and a beginner has no way to diagnose "context7 stopped returning results" as a rate limit rather than a bug.

**Why it happens:**
The zero-config default (documented in PROJECT.md's Key Decisions: "context7 shipped via `.mcp.json` at the free/public tier... account/API-key upgrade documented as opt-in, not required") was reasonable when free tiers were generous; the January 2026 cut changes the cost/benefit of defaulting to the anonymous tier specifically, and pricing/limits for third-party services can change again without goodvibes' knowledge.

**How to avoid:**
Keep the zero-config default (consistent with the rest of goodvibes — do not require an account to get a working init), but (1) surface the free-API-key upgrade path prominently in the onboarding doc as a two-minute optional step with a concrete benefit ("higher limits, no cost"), and (2) treat context7 rate-limit errors as an expected, documented condition in any troubleshooting doc rather than an unexplained failure. Do not hardcode a request count or "generous free tier" claim in goodvibes' own docs — those numbers are Context7's to change and already moved twice within weeks.

**Warning signs:**
Any goodvibes doc copy that asserts a specific context7 quota number as fact — that number has already changed multiple times in early 2026 and will likely change again.

**Phase to address:**
`.mcp.json` shipping phase — write the upgrade-path doc alongside the file; treat the exact limit as out of goodvibes' control and avoid quoting a number that will go stale.

---

### Pitfall 7: "Never ask what it already knows" is written broadly enough to suppress legitimate clarifying questions

**What goes wrong:**
The new rule ("never ask the user for anything already answered in README/CLAUDE.md/JOURNAL.md/the codebase") is easy to phrase in a way a model over-generalizes into "never ask questions" — directly contradicting the existing, already-shipped "Think before coding" rule ("do not silently choose one interpretation when multiple materially different interpretations exist... if the assumption is security-sensitive, data-sensitive, or schema-sensitive, do not proceed silently"). LLMs are documented to follow the more recently-emphasized or more absolute-sounding instruction when two rules conflict; a beginner cannot referee that conflict themselves, and the failure mode (an agent silently guessing on a genuinely ambiguous, undocumented, security-sensitive decision because it was told "never ask") is exactly the kind of mistake goodvibes' existing rules were written to prevent.

**Why it happens:**
The milestone's own directive-language mandate ("remove hedging... for imperative, non-optional phrasing") pushes toward short, absolute wording, which is the same pressure that risks dropping the necessary scope qualifier ("...that is already documented" / "...that isn't security-sensitive or ambiguous").

**How to avoid:**
Scope the new rule tightly and explicitly to information retrieval, not decision-making: "Never ask the user to repeat information already stated in README.md, CLAUDE.md, JOURNAL.md, or discoverable by reading the codebase. This does not override the requirement to flag security-sensitive, schema-sensitive, or genuinely ambiguous decisions before proceeding." Place the new rule adjacent to (or as a bullet under) the existing "Think before coding" section rather than as a free-standing rule, so the scope boundary is structurally visible, not just verbally implied.

**Warning signs:**
Any draft of the new rule that is a single unqualified sentence with no cross-reference to "Think before coding" / "Security" sections.

**Phase to address:**
The CLAUDE.md rule-authoring phase — write this rule as an addition to the existing "Think before coding" section, not a new top-level rule.

---

### Pitfall 8: `caveman` defaulting to `ultra` degrades comprehension for the exact audience goodvibes targets

**What goes wrong:**
`caveman`'s `ultra` intensity abbreviates ordinary prose words ("DB/auth/config/req/res/fn/impl") and strips conjunctions/articles beyond what `full` already does, explicitly trading readability for token count. goodvibes' stated audience is "complete beginners... who have never opened a terminal before." A beginner who doesn't yet know that "impl" means "implementation" or "req/res" means "request/response" now has to parse compressed jargon *in addition to* learning to code — the opposite of "quietly guided" the Core Value statement promises. `caveman` is also self-effacing by design ("No self-reference. Never name or announce the style.") — the beginner has no way to know a compression mode is even active, so they cannot ask "what does this abbreviation mean" in context; they just experience Claude Code as terser and more jargon-heavy than before, with no explanation.

**Why it happens:**
`ultra` was designed to maximize token savings for users who already know the domain vocabulary (the caveman skill's own audience assumption). Changing goodvibes' *default* (not the ceiling — `full` and `ultra` both remain user-selectable) conflates "more compression is better" with "beginner-first," which are in tension specifically at the `ultra` tier.

**How to avoid:**
If this change ships, pair it with either (a) an explicit beginner-facing note in onboarding docs that caveman mode exists and how to turn it down (`/caveman lite`), given caveman's own rule set forbids self-announcing — the *docs* have to carry the disclosure the skill itself is designed to omit — or (b) reconsider defaulting a beginner-first tool to the intensity tier the upstream skill's own table describes as abbreviating ordinary prose. This is a genuine tension with the "Beginner-first" constraint in PROJECT.md and should be called out as a tradeoff decision, not treated as a drop-in token-efficiency win.

**Warning signs:**
No onboarding doc update accompanying the `caveman` default change; a beginner user report along the lines of "the AI's answers got harder to understand" after an unrelated goodvibes update.

**Phase to address:**
The `caveman` default-change phase — must ship together with an onboarding doc note, not as a silent config bump.

---

### Pitfall 9: Directive-language rewrite across 10+ independently-maintained files has no automated consistency check, so partial rollout is invisible

**What goes wrong:**
CLAUDE.md, AGENTS.md, and the per-IDE files (Cursor `.mdc`, Copilot instructions, `.windsurfrules`, `.clinerules`, `.continue`, `.kiro`, `.devin`, `.amazonq`, GEMINI.md, `.bolt/prompt`, `replit.md`) are separately authored files, not generated from one canonical source — JOURNAL.md's own history shows this rewrite pattern already happened once for v1.7.0 ("Applied three product changes... to all 11 IDE rule files... plus the repo's own CLAUDE.md," listed by hand, file by file). A manual multi-file wording pass is exactly the kind of change where one file gets missed (verified: no `hedg`/`directive`/`consisten` test exists anywhere in `packages/npm/src` or `packages/pip` today — there is currently zero automated enforcement that these files stay in wording-sync). Missing one file means that tool's users get weaker ("should"/"consider") language while every other tool gets "must"/imperative language, quietly defeating the milestone's stated goal of binding "any coding agent/tool, not just Claude Code."

**Why it happens:**
No single source of truth: unlike CLAUDE.md's sentinel-merge mechanism, the 10+ IDE files are hand-maintained duplicates with per-IDE frontmatter/format differences, so there is no compile step that would catch drift.

**How to avoid:**
Add a lightweight repo-level test (not a new dependency — a grep-based vitest/pytest case) asserting no banned hedge words (`\bshould\b`, `\bconsider\b`, `\btry to\b`, `\bmight want to\b`) appear in any of the shipped template rule files, run in CI. This directly prevents regression on both the current rewrite and any future one.

**Warning signs:**
Absence of this test today (confirmed) combined with a rewrite PR whose diff touches fewer than all ~13 files it should touch.

**Phase to address:**
The directive-language rewrite phase — add the grep-based consistency test as part of the same phase, not a follow-up.

---

### Pitfall 10: "Binding" wording in AGENTS.md is aspirational, not technically enforced, on at least one major tool

**What goes wrong:**
AGENTS.md is a cross-vendor convention (now stewarded by the Agentic AI Foundation), and most tools honor nearest-file-wins precedence — but GitHub Copilot is documented to rank AGENTS.md **below its own native instruction file formats**, meaning a rule goodvibes writes into AGENTS.md specifically to bind Copilot is the rule Copilot weighs least among the files it reads. Cursor's handling of AGENTS.md is also explicitly under-documented by Cursor itself relative to its native `.mdc` rules. Strengthening AGENTS.md's wording to say instructions are "binding... for any tool" overstates what goodvibes can actually guarantee for Copilot users specifically — goodvibes already correctly writes a separate `.github/copilot-instructions.md` file (Phase 8), so the real fix is making sure that file (not AGENTS.md) carries the hardened wording for Copilot users, since that's the file Copilot actually prioritizes.

**Why it happens:**
"AGENTS.md is the cross-tool standard" is true in general but has at least one well-documented exception; writing milestone copy that treats it as universally authoritative papers over that exception.

**How to avoid:**
Keep the per-IDE native files (Copilot's own instructions file, Cursor's `.mdc`, etc.) as the primary carriers of hardened wording for each tool, and describe AGENTS.md as the fallback/catch-all for tools without a dedicated goodvibes file, not as a guarantee that overrides a tool's own precedence rules. Do not claim in docs that AGENTS.md alone "binds" Copilot.

**Warning signs:**
Marketing/README copy for this milestone that says "AGENTS.md ensures every tool follows these rules" without qualification.

**Phase to address:**
Cross-agent handoff hardening phase — the AGENTS.md content update and the copy describing it should be reviewed together for this overclaim.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Ship hook/`.mcp.json` for `init` only, skip `goodvibes update` JSON-merge support | Ships this milestone without building a JSON merge engine | Existing projects silently never receive the hook/MCP config via `update`; users must know to re-run `init` or hand-edit | Acceptable only if explicitly documented in FAQ.md/CHANGELOG as a known `update` limitation — never acceptable silently |
| Detect `git commit` via simple string matching (`includes('git commit')`) instead of full shell parsing | Fast to write, covers the common case | Misses `-a`/`--amend`/merge-commit edge cases (Pitfall 2); either over-blocks or under-blocks | Acceptable for v1 of the hook if edge cases are explicitly tested and documented as "best effort," never acceptable if presented as airtight |
| Reuse `full`→`ultra` caveman swap without an onboarding doc update | Small diff, one-line config change | Beginner confusion with no attributable cause (caveman is self-effacing by design) | Never acceptable — the onboarding note is cheap and directly mitigates the only real cost |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code `PreToolUse` hooks | Assuming exit code 1 blocks the action (it doesn't — only exit 2 or a JSON `permissionDecision: "deny"` on exit 0 blocks; exit 1 is a non-blocking error and the action proceeds) | Use exit 2 with a stderr reason, or JSON `hookSpecificOutput.permissionDecision: "deny"` on exit 0 — never rely on exit 1 |
| `.mcp.json` project scope | Assuming writing the file is sufficient for context7 to be "configured and ready" | Document the one-time interactive approval step; a repo cannot self-approve its own MCP servers |
| goodvibes' manifest-based `update` | Assuming the existing overwrite/skip/net-new model applies cleanly to JSON config files the way it applies to markdown | Either add a JSON-merge path for `.claude/settings.json`/`.mcp.json`, or explicitly scope this milestone's delivery to fresh `init` and document the `update` gap |
| context7 MCP server | Treating the free-tier request quota as a fixed, documentable number | Point users to context7's own dashboard/FAQ for current limits rather than hardcoding a number that has already changed twice in early 2026 |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Hook script does its own git subprocess calls (e.g. `git status --porcelain`) on every single Bash tool invocation, not just `git commit` | Every Bash command (`npm test`, `ls`, etc.) pays a subprocess-spawn cost if the `matcher`/`if` scoping is too broad | Scope the hook with `"matcher": "Bash"` + a tight `"if": "Bash(git commit *)"` so the hook body only runs for actual commit attempts | Noticeable on machines with many small Bash tool calls per session (typical vibe-coding session) — even 50-100ms per call adds up over a long session |
| `.mcp.json`/context7 configured but unapproved (Pitfall 5) causing every session start to show a pending-approval hint | Minor, but repeated friction on every session until approved | Surface an explicit one-time "approve context7" callout in `goodvibes init`'s own output rather than letting it recur silently in every Claude Code session start | Not a scale issue — a first-run UX issue that compounds if never resolved |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating `.claude/settings.json` hooks as a security control rather than a UX nudge | A user or docs page overstates the hook as "prevents undocumented commits" — false confidence that could matter if journal entries are ever relied on for compliance/audit purposes | State plainly in docs that hooks are advisory-with-friction, scoped to Claude Code's own Bash tool, not a security boundary |
| Committing an `.mcp.json` that later gains an API key or auth token field (once a user follows the "optional account/API-key upgrade" path) directly into the file, then committing it to a public repo | Leaked context7 API key in git history | Document the API-key upgrade as an environment-variable-based config (Claude Code supports env var expansion in `.mcp.json`), never as a literal key pasted into a committed file; the free/public-endpoint default (no key) sidesteps this entirely, which is itself a reason to keep the anonymous default rather than defaulting to "come get a key" |
| Hook script trusts `tool_input.command` string matching for authorization decisions | The documented `if` best-effort matching can be gamed by dynamic command construction (`$VAR git commit`), same class of issue as any shell-based allow/deny list | Do not extend this mechanism beyond its stated cheap-nudge purpose (per the "journal-gate hook over broader static-analysis hooks" decision already on record) — do not repurpose it later as a security gate for something more sensitive |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|------------------|
| Hook denial message is a raw stderr string with no next step | Beginner sees a scary red error and doesn't know to open JOURNAL.md and add an entry | Denial message must say exactly what to do: "Add a JOURNAL.md entry for this session, then commit again. See JOURNAL.md's template at the top of the file." |
| `caveman` `ultra` silently changes response style with no attribution (by the skill's own design) | Beginner thinks something broke or that Claude got "worse" at explaining things | Cover this explicitly in onboarding docs since the skill itself won't self-disclose |
| `.mcp.json` "configured" language implies "working" | Beginner believes context7 is active when it's pending approval or rate-limited | `goodvibes init` outro and docs must distinguish "file written" from "server active" (mirrors the existing, already-solved pattern for headroom's install/MCP-registration outcome reporting in Phase 12 — reuse that outcome-reporting pattern here) |

## "Looks Done But Isn't" Checklist

- [ ] **Commit-blocking hook:** Often missing edge-case handling for first commit, `-a`/`-am`, `--amend`, and merge commits — verify with one regression test per case, not just the happy path (`git add JOURNAL.md && git commit`)
- [ ] **`.mcp.json` shipped:** Often missing the "approve on first interactive session" documentation — verify the onboarding doc and `init` outro both mention it, not just the README
- [ ] **Directive-language rewrite:** Often missing one or more of the 10+ IDE files — verify with a grep-based test across every shipped rule file, not a manual file-by-file read-through
- [ ] **`caveman` default bump:** Often missing the corresponding onboarding doc note — verify docs/onboarding.md references the new default and how to downgrade it
- [ ] **`goodvibes update` compatibility:** Often missing any test for how `.claude/settings.json`/`.mcp.json` behave on `update` (only `init` gets tested) — verify a categorise()/update test exists for both new file types

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|-----------------|
| Hook false-blocks a legitimate first commit | LOW | User can `git commit --no-verify`-style workaround doesn't apply here (this isn't a git hook) — instead, temporarily disable via Claude Code's own hook-skip mechanisms or just add the trivial JOURNAL.md entry the gate is asking for; document this as the intended "recovery," not a bug |
| `update` silently skipped a user's already-customized `.claude/settings.json` | MEDIUM | Publish an FAQ.md entry (mirrors the existing npm→pip package-name migration FAQ entry) walking users through manually merging the new hook block into their existing settings.json |
| context7 hitting rate limits mid-session | LOW | Point to the free-API-key signup (context7.com/dashboard) in the error/troubleshooting doc; no code change needed since goodvibes doesn't control the limit |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| jq/Windows hook breakage (1) | Commit-blocking hook phase | Hook implemented in Node (`.mjs`), zero bash/jq dependency; test on a Windows CI runner or document manual Windows verification |
| Commit edge cases (2) | Commit-blocking hook phase | One regression test per edge case (first commit, `-a`, `--amend`, merge) |
| False sense of enforcement (3) | Cross-agent handoff docs phase | Denial message + README + onboarding doc all state "Claude Code only" |
| Manifest/JSON-merge gap (4) | Hook/`.mcp.json` shipping phase | `update.test.ts`-equivalent case for `.claude/settings.json` and `.mcp.json`, plus an explicit decision recorded in PROJECT.md Key Decisions |
| `.mcp.json` approval UX (5) | `.mcp.json` shipping phase | `init` outro message + onboarding doc mention the one-time approval step |
| context7 rate limits (6) | `.mcp.json` shipping phase | Onboarding doc links to context7's own dashboard/FAQ instead of hardcoding a number |
| "Never ask" rule overreach (7) | CLAUDE.md rule-authoring phase | New rule is written as a sub-bullet of "Think before coding," not a standalone absolute statement |
| caveman `ultra` beginner harm (8) | caveman default-change phase | Onboarding doc updated in the same PR/commit as the default change |
| Directive-language partial rollout (9) | Directive-language rewrite phase | New grep-based CI test covering all 13 shipped rule files for banned hedge words |
| AGENTS.md overclaim on Copilot (10) | Cross-agent handoff docs phase | Copilot-specific hardened wording lives in `.github/copilot-instructions.md`, not asserted as guaranteed via AGENTS.md alone |

## Sources

- [Claude Code Hooks reference — code.claude.com](https://code.claude.com/docs/en/hooks) — HIGH confidence, official docs, fetched directly (exit-code semantics, matcher/`if` syntax, cross-platform shell resolution, settings-file merge behavior, workspace-trust interaction)
- [Claude Code MCP scopes / approval flow — multiple 2026 sources](https://github.com/anthropics/claude-code/issues/63308), [informgrowth.com](https://informgrowth.com/blog/claude-code-mcp-scopes-reference), [repello.ai](https://repello.ai/blog/claude-code-mcp-name-keyed-trust) — MEDIUM-HIGH confidence (community-verified, cross-referenced against a GitHub issue in the anthropics/claude-code repo itself)
- [Context7 free tier rate limit change, Jan 2026 — Dev Genius](https://blog.devgenius.io/context7-quietly-slashed-its-free-tier-by-92-16fa05ddce03), Context7's own FAQ (context7mcp.com/faq) — MEDIUM confidence (numbers self-reported by a third party but consistent with Context7's own FAQ wording and dated close to research date)
- [jq/Windows hook dependency issue — anthropics/claude-code#14817, #29321, #29268](https://github.com/anthropics/claude-code/issues/14817) — HIGH confidence, filed directly against the anthropics/claude-code repo
- [AGENTS.md spec and precedence across tools — morphllm.com, codersera.com, multiple 2026 guides](https://www.morphllm.com/agents-md-guide) — MEDIUM confidence (community-documented convention, not a single normative spec; Copilot-ranking claim corroborated across two independent write-ups)
- [CLAUDE.md bloat / instruction-slot degradation — official Claude Code best-practices docs + independent analyses](https://code.claude.com/docs/en/best-practices) — MEDIUM-HIGH confidence (official docs confirm the phenomenon qualitatively; exact "150-200 instruction slot" figure is one blogger's model, flagged as such)
- Repo inspection: `/home/ygiokas/GoodVibes/packages/npm/src/commands/update.ts`, `write-manifest.ts`, `copy-templates.ts`, `steps/configure-mcp.ts`, `.claude/skills/caveman/SKILL.md`, `JOURNAL.md`, `.planning/PROJECT.md` — HIGH confidence, direct code/doc reading, not inference

---
*Pitfalls research for: goodvibes v1.8.0 Agent Governance & Cross-Tool Enforcement*
*Researched: 2026-09-05*
