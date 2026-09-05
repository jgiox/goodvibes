# Phase 15: Journal-Gate Hook & context7 MCP - Research

**Researched:** 2026-09-05
**Domain:** Claude Code `PreToolUse` hooks (JSON schema, stdin payload, exit-code/JSON decision protocol) + MCP `.mcp.json` static HTTP server config
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Phase Boundary:** Two independent, no-shared-files deliverables:
1. **Journal-gate hook** — a `PreToolUse` hook (inline shell command, no separate script file) in `.claude/settings.json` that blocks Claude Code's Bash tool from running `git commit` unless `JOURNAL.md` is staged. Exempts `--amend`, in-progress merge/rebase, and any commit where `JOURNAL.md` is already staged (which trivially covers the "bootstrap commit that adds `JOURNAL.md`" case).
2. **context7 MCP** — a `.mcp.json` template shipping `context7` wired to the free/public HTTP endpoint (no key, no signup), plus docs for the optional `${CONTEXT7_API_KEY}` upgrade path and the one-time "trust this project's MCP servers" prompt.

Both ship into `templates/`, `packages/npm/templates/`, and `packages/pip/` template equivalents (existing generic copy/manifest pipeline from Phases 1-14 — no new pipeline needed). `goodvibes update` propagation is explicitly out of scope (Phase 16, depends on this phase's exact key shapes).

**Dogfooding:**
- **D-01:** Apply the journal-gate hook to goodvibes' own repo root `.claude/settings.json` in this phase, not just the shipped templates. Root settings.json today only has a `permissions` block — extend it with the `PreToolUse` hook.
- **D-02:** Also create a root `.mcp.json` with context7 configured, for the same reason — dogfood both deliverables together, don't split them across when they land in this repo.

**Block message wording:**
- **D-03:** stderr message is a copy-pasteable fix, not a terse one-liner — e.g. `BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md`. Matches CLAUDE.md's own "error messages must be actionable and specific enough to debug" rule.
- **D-04:** Fix only, no "why" clause — don't add a policy explanation referencing CLAUDE.md in the message itself. Keep hook stderr to the actionable fix.

**Doc placement (HOOK-04, CTX7-02, CTX7-03):**
- **D-05:** HOOK-04's caveat (hook only gates Claude Code's own Bash tool — not manual commits, not other agents/IDEs) goes in `docs/getting-started.md`, not README.md. New short section, same file/pattern as the existing "What is headroom?" section.
- **D-06:** CTX7-02 (optional `${CONTEXT7_API_KEY}` upgrade path, no literal key ever committed) and CTX7-03 (one-time "trust this project's MCP servers" prompt) get their own new section in `docs/getting-started.md` — "What is context7?" — mirroring the existing "What is headroom?" section, not spread elsewhere.

**Canonical references (do not re-litigate):**
- `.planning/REQUIREMENTS.md` §"Journal-Gate Enforcement" (HOOK-01..04) and §"context7 MCP" (CTX7-01..03) are the exact, numbered acceptance criteria.
- `.planning/STATE.md` "[v1.8.0 roadmap]" entries: hook is an inline shell command in settings.json (no separate script file, avoids jq/exec-bit questions); Phase 15 and Phase 17 split by risk profile, no shared files, can run in parallel; Phase 16 (update JSON merge) depends on Phase 15's exact key shapes.
- `packages/npm/src/steps/configure-mcp.ts` is headroom's *runtime* `claude mcp add` pattern — do NOT follow this pattern for context7, which must be a *static* `.mcp.json` template file per CTX7-01's explicit wording.

**Existing code insights:**
- `templates/.claude/settings.json`, `packages/npm/templates/.claude/settings.json` — existing template settings files with a `permissions` block only; the hook is a net-new top-level key (`hooks.PreToolUse`) added alongside `permissions`, not a new file.
- `.claude/settings.json` (repo root) — same shape, currently minimal; this is the dogfood target.
- `docs/getting-started.md` — has a "What is headroom?" section (line ~29) that's the direct pattern to mirror.
- No `.mcp.json` exists anywhere in the codebase today (npm, pip, or root) — CTX7-01 is a net-new file, not an edit to an existing one.

**Specific ideas:**
- Block message exact text: `BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md` (or planner's closest equivalent achieving the same copy-paste-fix intent).
- New doc sections in `docs/getting-started.md`: one covering the hook's Claude-Code-Bash-tool-only scope (HOOK-04), one titled "What is context7?" covering the upgrade path and trust prompt (CTX7-02, CTX7-03) — same file, mirroring the existing "What is headroom?" section style.

### Claude's Discretion
- Exact hook matcher pattern for intercepting `git commit` invocations (covering variants like `git commit -am`, `git -C path commit`) — technical implementation detail, not a vision question. **Resolved by this research: use a bare `"matcher": "Bash"` (no `if` field) with an in-script regex — see Architecture Patterns Pattern 2 and Common Pitfalls #1.**
- Exact JSON shape of the `PreToolUse` hook block within `settings.json` and the `mcpServers` block within `.mcp.json` — researcher/planner determine the correct schema. **Resolved by this research: see Code Examples.**
- context7's exact free-tier HTTP endpoint URL — researcher confirms current value from context7's own docs. **Resolved: `https://mcp.context7.com/mcp`.**

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. (`goodvibes update` propagation of these same keys is already correctly scoped to Phase 16, per STATE.md — not re-discussed here.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOOK-01 | `.claude/settings.json` ships a `PreToolUse` hook, inline shell command, blocks `git commit` unless `JOURNAL.md` is staged | Architecture Patterns (Pattern 2, 3), Code Examples — full verified hook JSON and detection regex |
| HOOK-02 | Hook exempts `--amend`, in-progress merge/rebase, and the bootstrap commit that adds `JOURNAL.md` itself | Pattern 3 (exemption checks), Common Pitfalls #2 (amend-spoofing limitation), verified 8-scenario test matrix |
| HOOK-03 | On block, stderr states exactly what's missing and how to fix it | Code Examples (exact stderr string matches CONTEXT.md D-03), Validation Architecture test map |
| HOOK-04 | Docs state the hook only gates Claude Code's own Bash tool | Architectural Responsibility Map (scoping rationale), Doc placement per D-05 |
| CTX7-01 | `.mcp.json` ships context7 at free/public HTTP endpoint, no key, no signup | Code Examples (default `.mcp.json` snippet), Sources (context7 endpoint + no-key policy confirmed) |
| CTX7-02 | Docs cover optional `${CONTEXT7_API_KEY}` upgrade path, no literal key ever committed | Code Examples (upgrade-path snippet), Common Pitfalls #5 (why headers must be omitted by default) |
| CTX7-03 | Onboarding docs mention the one-time "trust this project's MCP servers" prompt | Sources (code.claude.com/docs/en/mcp trust-prompt mechanics), System Architecture Diagram |
</phase_requirements>

## Summary

Both deliverables are configuration-only — no new runtime dependencies, no new source files beyond JSON/Markdown. The journal-gate hook is a single inline shell string embedded as the `command` value of a `PreToolUse` hook entry in `.claude/settings.json`; it needs no `jq` and no separate script file. I built and executed the exact hook logic against 8 real scenarios in a throwaway git repo (see Code Examples) — it works correctly with a pure `sed -E`/`grep -E` extraction of the JSON `command` field, with no JSON parser required. The context7 deliverable is a static `.mcp.json` template using Claude Code's documented HTTP transport shape (`"type": "http"`), pointed at context7's official public endpoint `https://mcp.context7.com/mcp`, shipped **without** a `headers` block by default (so the "no key, no signup" promise in CTX7-01 is never at risk of a malformed/empty auth header breaking anonymous access).

The one open risk worth flagging to the planner: Claude Code's own permission-rule syntax (`Bash(git commit *)`) is a *weaker* filter than what the hook script itself can do — a rule-based `if` filter would miss `git -C <path> commit`. I found and verified a self-contained regex inside the hook script that catches this variant without needing the `if` field at all, so the recommendation is: use a bare `"matcher": "Bash"` (no `if`), and let the script's own regex decide.

**Primary recommendation:** Ship the hook as a single `PreToolUse` → `matcher: "Bash"` entry with an inline `command` string that (1) regex-matches `git ... commit ...` as a whitespace-tokenized subcommand (not a naive substring), (2) exits 0 immediately for `--amend`, in-progress merge/rebase, or JOURNAL.md already staged, and (3) otherwise exits 2 with the exact stderr message from CONTEXT.md D-03. Ship context7 as a headers-free `.mcp.json` entry pointed at `https://mcp.context7.com/mcp`, and document the `${CONTEXT7_API_KEY}` upgrade path as an *addition* the user makes themselves, not a default that ships (unset-variable) in the template.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Commit-time journal enforcement | Claude Code hook runtime (local, per-session) | Git (working-tree/index state source of truth) | The hook is a client-side guardrail evaluated by Claude Code before it spawns the Bash tool call; git itself has no hook here (no `.git/hooks/pre-commit` involved) — this is intentionally scoped to Claude Code's own tool-use layer, not the repo's git hooks, per HOOK-04's explicit "only gates Claude Code's own Bash tool" framing |
| Documentation lookup / library docs | context7 MCP server (remote HTTP, Upstash-hosted) | Claude Code MCP client (local) | context7 owns retrieval and indexing; Claude Code only owns transport config (`.mcp.json`) and the one-time trust decision |
| Template distribution | Repo-root `templates/` (canonical source) | `packages/npm/templates/` (gitignored prebuild artifact), pip package data | Existing Phase 1-14 pipeline already owns copy/sync — this phase adds two file edits/creates, no new plumbing |
| Secret handling (`CONTEXT7_API_KEY`) | Local shell environment / CI secret store | `.mcp.json` (`${VAR}` reference only, never a literal) | Claude Code's own `.mcp.json` env-expansion mechanism is the established, secretless config method — no goodvibes-side vault or wrapper needed |

## Standard Stack

### Core
| Tool | Version | Purpose | Why Standard |
|---|---|---|---|
| Claude Code `PreToolUse` hooks | Claude Code v2.1.x (current) | Intercepts Bash tool calls before execution | The only hook event that runs *before* a tool call and can deny it; documented, stable API `[CITED: code.claude.com/docs/en/hooks]` |
| POSIX `sed -E` / `grep -E` | GNU sed 4.9 / GNU grep (verified in this sandbox: `sed (GNU sed) 4.9`, `ugrep 7.8.4`) `[VERIFIED: local `sed --version`/`grep --version``]` | Extracts the `command` field from the hook's stdin JSON without a JSON parser | Ships with every git-capable environment relevant here (see Environment Availability) |
| `.mcp.json` `type: "http"` transport | Claude Code MCP schema (current) | Declares context7 as a project-scoped remote MCP server | Documented, first-class transport type; alias `"streamable-http"` also accepted `[CITED: code.claude.com/docs/en/mcp]` |

### Supporting
| Tool | Version | Purpose | When to Use |
|---|---|---|---|
| `git rev-parse --git-dir` | any (project already requires git) | Resolves the real `.git` directory (handles worktrees/submodules where `.git` is a file, not a directory) | Always — more robust than hardcoding `.git/MERGE_HEAD` |
| `git diff --cached --name-only` | any | Lists staged files, repo-root-relative, regardless of the hook's cwd | Confirmed via direct test: run from a subdirectory, still returns repo-root-relative paths (see Code Examples) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline `sed -E`/`grep -E` JSON field extraction | `jq -r '.tool_input.command'` | `jq` is the "correct" way per Claude Code's own official examples, but the phase's locked decision (STATE.md `[v1.8.0 roadmap]`) explicitly avoids it to sidestep an unverified-availability question on end-user machines; `sed`/`grep` are guaranteed present alongside git (see Environment Availability) |
| Bare `"matcher": "Bash"` + in-script regex | `"if": "Bash(git commit *)"` permission-rule filter | The `if` prefix-rule syntax does **not** match `git -C <path> commit` (verified — see Common Pitfalls); the in-script regex does. Using `if` would also require Claude Code to already parse `tool_input.command` a second time for its own rule engine — no savings, less coverage |
| Separate `.claude/hooks/journal-gate.sh` file | Inline `command` string (chosen, per lock) | A separate file needs `chmod +x` and is a second file to keep in sync across `templates/`, `packages/npm/templates/`, pip package data; inline avoids exec-bit questions entirely (already the locked rationale in STATE.md) |
| Static `.mcp.json` with `headers` referencing `${CONTEXT7_API_KEY}` shipped by default | No `headers` key at all by default (chosen) | Unset env vars leave the literal, unexpanded `${CONTEXT7_API_KEY}` text in the header value `[CITED: code.claude.com/docs/en/mcp]` — sending a malformed `Authorization` header on every free-tier request risks turning "no key, no signup" into "silently broken auth header on every call." Omitting `headers` entirely by default is safer and simpler; CTX7-02's docs show users how to add the block themselves |

**Installation:** No new packages. This phase only writes/edits JSON and Markdown template files.

**Version verification:** Not applicable — no npm/PyPI packages are introduced by this phase.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages (no `npm install`, no `pip install`). It only adds/edits `.claude/settings.json`, a new `.mcp.json`, and two Markdown doc files. The Package Legitimacy Gate protocol is skipped per its own scope condition ("whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
Claude Code session (Bash tool about to run)
        |
        v
  tool_input.command = "git commit -am \"...\""
        |
        v
+-----------------------------------------------+
|  PreToolUse hook (matcher: "Bash")             |
|  1. stdin = JSON session/tool payload          |
|  2. sed -E extracts tool_input.command string  |
|  3. grep -E: is this a "git ... commit ..."?   |
|       no  -> exit 0 (let it run, no decision)  |
|       yes -> continue                          |
|  4. grep: contains "--amend"?                  |
|       yes -> exit 0 (exempt)                   |
|  5. git rev-parse --git-dir; check              |
|     MERGE_HEAD / rebase-merge / rebase-apply   |
|       present -> exit 0 (exempt)               |
|  6. git diff --cached --name-only              |
|     contains "JOURNAL.md"?                     |
|       yes -> exit 0 (allow — bootstrap commit  |
|              case falls out of this same check)|
|       no  -> print BLOCKED message to stderr,  |
|              exit 2 (hard block)               |
+-----------------------------------------------+
        |
        v
  Claude Code: exit 2 => tool call is prevented,
  message surfaced to the model/user

Separately, at project load time:
Claude Code reads .mcp.json -> sees context7 (type: http,
url: https://mcp.context7.com/mcp) -> prompts one-time
project-MCP-trust approval (interactive sessions only) ->
approved -> context7 tools available for doc lookups
```

### Recommended Project Structure
```
templates/
├── .claude/
│   └── settings.json      # existing file — add hooks.PreToolUse alongside existing permissions block
├── .mcp.json               # new file — context7 http entry, no headers by default
└── docs/
    └── getting-started.md  # add "What is context7?" + hook-scope-caveat sections (mirror both into repo-root docs/getting-started.md)

.claude/settings.json        # repo root — same hook addition, dogfood (D-01)
.mcp.json                    # repo root — new file, same context7 entry, dogfood (D-02)
```
`packages/npm/templates/` is a gitignored prebuild artifact — after editing `templates/`, run `cd packages/npm && npm run prebuild` (existing project convention, see CLAUDE.md "Template sync" section). The pip package resolves the same root `templates/` dir via `importlib.resources` at build time — confirm its packaging step (setup/hatch build hook, per STATE.md "`[Phase ?]: D-11: hatchling build hook`") also needs no changes since it copies the whole `templates/` tree.

### Pattern 1: JSON field extraction without a JSON parser
**What:** A `sed -E` regex that extracts a single string field's value from compact JSON, correctly handling escaped characters within the string (so a commit message containing `\"` doesn't truncate the match early).
**When to use:** Any `PreToolUse` hook that must read `tool_input.command` (or any other string field) without depending on `jq` being installed.
**Example — verified working, exit codes confirmed by direct execution:**
```bash
# Source: derived and verified in this research session (no official doc shows the jq-free form)
IN=$(cat)
CMD=$(printf '%s' "$IN" | sed -E 's/.*"command"[[:space:]]*:[[:space:]]*"((\\.|[^"\\])*)".*/\1/')
```
Tested against a payload containing an escaped, nested-quote commit message and correctly extracted the raw (still-JSON-escaped) command text.

### Pattern 2: Robust "is this a git commit" detection (no `jq`, no permission-rule `if`)
**What:** Token-aware regex matching `git ... commit ...` that correctly handles `git -C <path> commit`, `git --git-dir=<x> commit`, and rejects false positives like `git commit-tree` or `echo commit`.
**Verified test matrix (8 scenarios, all correct):**
| Input command | Expected | Result |
|---|---|---|
| `git commit -am "fix"` (JOURNAL.md unstaged) | BLOCK, exit 2 | ✅ Blocked |
| `git commit -am "fix"` (JOURNAL.md staged) | Allow, exit 0 | ✅ Allowed |
| `git commit --amend --no-edit` | Allow (exempt), exit 0 | ✅ Allowed |
| `git status` | Allow (not a commit), exit 0 | ✅ Allowed |
| `git commit -am "m"` with `.git/MERGE_HEAD` present | Allow (exempt), exit 0 | ✅ Allowed |
| `git -C /tmp/test-repo commit -am "x"` (JOURNAL.md unstaged) | BLOCK, exit 2 | ✅ Blocked |
| `git commit-tree abc123 -m x` | Allow (not a real commit) | ✅ Allowed |
| `git commit -am "m"` with `.git/rebase-merge/` present | Allow (exempt), exit 0 | ✅ Allowed |

```bash
# Source: derived and verified in this research session
printf '%s' "$CMD" | grep -qE '(^|[[:space:]])git([[:space:]]+[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)' || exit 0
```

### Pattern 3: Full inline hook `command` string (JSON-embedded, verified round-trip)
**What:** The complete hook logic as one shell string, verified by writing it into an actual `settings.json` via `JSON.stringify`, reading it back via `JSON.parse`, and executing it with `sh -c`.
**Verified result:** Correct `exit=2` + exact stderr message when JOURNAL.md unstaged; `exit=0` when staged.
```bash
# Source: derived and verified in this research session — see full JSON in Code Examples
IN=$(cat); CMD=$(printf "%s" "$IN" | sed -E "s/.*\"command\"[[:space:]]*:[[:space:]]*\"((\\\\.|[^\"\\\\])*)\".*/\\1/"); printf "%s" "$CMD" | grep -qE "(^|[[:space:]])git([[:space:]]+[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)" || exit 0; printf "%s" "$CMD" | grep -qE -- "(^|[[:space:]])--amend([[:space:]]|$)" && exit 0; GITDIR=$(git rev-parse --git-dir 2>/dev/null) || exit 0; { [ -f "$GITDIR/MERGE_HEAD" ] || [ -d "$GITDIR/rebase-merge" ] || [ -d "$GITDIR/rebase-apply" ]; } && exit 0; git diff --cached --name-only | grep -qx "JOURNAL.md" && exit 0; echo "BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md" >&2; exit 2
```

### Anti-Patterns to Avoid
- **Relying on `"if": "Bash(git commit *)"` alone for scoping:** verified to miss `git -C <path> commit` — see Common Pitfalls.
- **Shipping a `headers` block with `${CONTEXT7_API_KEY}` by default:** an unset variable becomes literal, unexpanded text in the header, risking a malformed auth header on every anonymous request `[CITED: code.claude.com/docs/en/mcp]`.
- **Hand-typing the JSON-escaped hook string directly in `settings.json`:** the nested-quote escaping is extremely error-prone by hand (verified: the naive one-liner becomes ~650 characters with triple-backslash sequences once JSON-escaped). Generate it programmatically (e.g., a one-off `node -e 'fs.writeFileSync(..., JSON.stringify(...))'` or Python `json.dump`) during the implementation task rather than typing escaped quotes manually.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting merge/rebase in progress | Custom state-tracking file | `git rev-parse --git-dir` + check `MERGE_HEAD`/`rebase-merge`/`rebase-apply` | These are git's own canonical markers; no state to maintain, no drift risk |
| Blocking a tool call | Wrapping/aliasing the `git` binary, or a real `.git/hooks/pre-commit` | Claude Code's own `PreToolUse` exit-2 protocol | `.git/hooks/pre-commit` isn't committed to the repo by default (untracked) and wouldn't scope to "Claude Code's Bash tool only" per HOOK-04's explicit requirement; the PreToolUse hook is the documented mechanism for exactly this |
| MCP server registration for a static, keyless remote server | A `postinstall`/init-time `claude mcp add` call (like headroom's pattern in `configure-mcp.ts`) | A checked-in `.mcp.json` template file | CTX7-01 explicitly calls for a static template file, and CONTEXT.md's canonical_refs section explicitly says not to copy `configure-mcp.ts`'s runtime-registration pattern here — different mechanism by design |

**Key insight:** Everything this phase needs (git state detection, JSON field extraction, MCP transport config) already has a documented, stable primitive. The only genuine engineering here is regex precision in the hook script, which is now verified against 8 concrete scenarios.

## Common Pitfalls

### Pitfall 1: `if`-field permission-rule scoping misses `git -C <path> commit`
**What goes wrong:** Using `"if": "Bash(git commit *)"` to pre-filter which Bash calls spawn the hook process seems like free scoping, but Claude Code's rule matcher requires `commit` to be the literal next token after `git` (per its own docs: "`git` is the program and `log` is the subcommand... Claude Code matches everything before the first `*` as written"). `git -C /path commit -am "x"` does not match `Bash(git commit *)`.
**Why it happens:** The permission-rule syntax is a prefix matcher, not a tokenizing parser.
**How to avoid:** Don't use `if` for this. Use a bare `"matcher": "Bash"` and let the script's own regex (Pattern 2 above) do the detection — verified to correctly handle `-C`/`--git-dir` variants.
**Warning signs:** A commit made via `git -C <path> commit` (or any variant that puts flags before the subcommand) silently bypasses the gate.

### Pitfall 2: Commit-message content can spoof the `--amend` exemption
**What goes wrong:** The `--amend` exemption check is a substring/regex match against the raw extracted command text, not a real shell-argument parse. A commit message containing the literal text `--amend` (e.g., `git commit -m "docs: explain --amend flag"`) will falsely trigger the exemption and skip the JOURNAL.md check.
**Why it happens:** Distinguishing "a real `--amend` flag" from "the string `--amend` inside a quoted `-m` argument" requires actual shell tokenization respecting quotes, which is exactly the class of complexity the locked decision (no `jq`, no separate script) is trying to avoid.
**How to avoid:** Accept this as a known, low-severity limitation — document it, don't build a tokenizer for it. This is a guardrail against forgetting the journal, not a security boundary (see Security Domain below); worst case is a rare, self-inflicted skip, not an exploit against another user.
**Warning signs:** None visible to the user — this is a documentation/acceptance item for the planner, not a runtime symptom to detect.

### Pitfall 3: Windows shell-form hooks may run under PowerShell if Git Bash is missing
**What goes wrong:** `sed -E`/`grep -E` syntax is bash/POSIX-specific. If the hook ran under native PowerShell, this script would fail outright.
**Why it happens / why it's actually fine here:** Claude Code's own docs state: *"When Claude Code runs a shell-form command hook, one without `args`, it spawns `sh -c` on macOS and Linux, **Git Bash on Windows**, or PowerShell when Git Bash isn't installed by default."* `[CITED: code.claude.com/docs/en/hooks]` Since this hook's entire purpose is gating `git commit`, any machine that can trigger it already has Git for Windows installed, which bundles Git Bash — so the PowerShell fallback path is effectively unreachable for this specific hook's use case.
**How to avoid:** No action needed, but document the dependency (Git for Windows / Git Bash) explicitly in case a user has a non-standard git install without Git Bash (e.g., some `scoop`/`chocolatey` minimal git packages). List this in Environment Availability below.
**Warning signs:** Hook silently never blocks anything on a specific Windows machine — instruct such users to check `git --version` was installed via the standard Git for Windows installer.

### Pitfall 4: `sed -E` alternation/backreference syntax differs slightly between GNU sed (Linux) and BSD sed (macOS)
**What goes wrong:** The extraction regex was verified against GNU sed 4.9 in this sandbox. BSD sed (shipped on macOS) supports POSIX ERE via `-E` too, but has historically had subtle differences in escaped-character-class handling.
**Why it happens:** Different sed implementations, same `-E` flag, slightly different regex engines.
**How to avoid:** This is flagged as **[ASSUMED — needs macOS verification]**: the pattern *should* work identically since it uses only POSIX ERE constructs (no GNU-only extensions like `\+` outside `-E` mode), but was not tested on actual BSD sed in this research session. Recommend the plan include a manual verification step (or CI job) on macOS before shipping.
**Warning signs:** Hook works in CI (likely Linux runners) but misbehaves on a contributor's Mac.

### Pitfall 5: Shipping `.mcp.json` with a default `headers` block breaks the "no key, no signup" promise silently
**What goes wrong:** If the template ships `"headers": {"Authorization": "Bearer ${CONTEXT7_API_KEY}"}` and the user never sets the env var, Claude Code substitutes nothing and sends the literal string `Bearer ${CONTEXT7_API_KEY}` as the header value on every request.
**Why it happens:** Per Claude Code's own docs: *"If a referenced variable is unset and has no default, the config still loads... and uses the literal, unexpanded `${VAR}` text."* `[CITED: code.claude.com/docs/en/mcp]`
**How to avoid:** Ship the default `.mcp.json` **without** a `headers` key at all. Document the upgrade path (CTX7-02) as an edit the user makes themselves when they get a key.
**Warning signs:** context7 requests failing/erroring for a project that never opted into an API key.

## Code Examples

### Full `settings.json` hook block (verified via JSON round-trip + execution)
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "IN=$(cat); CMD=$(printf \"%s\" \"$IN\" | sed -E \"s/.*\\\"command\\\"[[:space:]]*:[[:space:]]*\\\"((\\\\\\\\.|[^\\\"\\\\\\\\])*)\\\".*/\\\\1/\"); printf \"%s\" \"$CMD\" | grep -qE \"(^|[[:space:]])git([[:space:]]+[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)\" || exit 0; printf \"%s\" \"$CMD\" | grep -qE -- \"(^|[[:space:]])--amend([[:space:]]|$)\" && exit 0; GITDIR=$(git rev-parse --git-dir 2>/dev/null) || exit 0; { [ -f \"$GITDIR/MERGE_HEAD\" ] || [ -d \"$GITDIR/rebase-merge\" ] || [ -d \"$GITDIR/rebase-apply\" ]; } && exit 0; git diff --cached --name-only | grep -qx \"JOURNAL.md\" && exit 0; echo \"BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md\" >&2; exit 2"
          }
        ]
      }
    ]
  }
}
```
This exact structure was produced with `JSON.stringify()` (not hand-typed), then re-parsed and executed via `sh -c` against real stdin payloads — see Pattern 3. Recommend the implementation task generate this file the same way (script-generate the JSON, don't hand-escape it) to avoid transcription errors in the quote-escaping.

### `.mcp.json` — context7, no key, default template
```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp"
    }
  }
}
```
`[CITED: code.claude.com/docs/en/mcp for schema shape (type/url fields); CITED: context7.com/docs/api-guide + github.com/upstash/context7 for the endpoint URL and "no API key required" policy]`. Note: no official context7 doc page shows this exact combined JSON snippet for Claude Code specifically (context7's own docs only show `claude mcp add --transport http ...` CLI commands for Claude Code) — this snippet is a synthesis of Claude Code's documented `.mcp.json` schema + context7's documented endpoint, not a literal copy from a single source. **Recommend the planner verify this exact file by running `claude mcp add --transport http context7 https://mcp.context7.com/mcp --scope project` once in a scratch project and diffing the generated `.mcp.json` against this hand-written version**, since that command is guaranteed to produce whatever shape the installed Claude Code version actually expects.

### `.mcp.json` — upgrade path documentation snippet (for docs/getting-started.md, not the shipped default)
```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "Authorization": "Bearer ${CONTEXT7_API_KEY}"
      }
    }
  }
}
```
User sets `CONTEXT7_API_KEY` in their shell/CI environment; no literal key is ever committed. `[CITED: code.claude.com/docs/en/mcp — `${VAR}` expansion syntax]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| context7 unauthenticated free tier ~6,000 req/month | Free tier reportedly cut to a much lower monthly cap (third-party blog reports figures ranging 500-1,000/month with a 60/hour cap; context7's own docs give no exact number, only "low rate limits") | Reported around January 2026 per third-party sources `[LOW confidence — see Assumptions Log]` | Doesn't block CTX7-01 (still no-key, no-signup access exists), but worth a one-line doc caveat that heavy usage may hit limits faster than expected — already explicitly deferred in REQUIREMENTS.md ("Deferred to v1.8.x: Friendly rate-limit messaging") |
| Claude Code hook JSON output field `"decision"` | `hookSpecificOutput.permissionDecision` | Current schema (docs show only the new field name) | Not used by this phase's design (we use exit-code-2 blocking, no JSON stdout needed) — mentioned for completeness in case the planner considers the JSON-output style instead |

**Deprecated/outdated:** None directly relevant — this is all current-generation Claude Code hook/MCP schema.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The combined `.mcp.json` JSON snippet (`type: "http"` + context7 URL, no headers) is the exact shape Claude Code's installed version expects, even though no single official source shows this literal combination for Claude Code specifically | Code Examples / Standard Stack | Low — worst case the file needs a one-key correction (e.g. `type` value spelling); recommend verifying via `claude mcp add --transport http` once and diffing, as noted inline |
| A2 | `sed -E` extraction regex behaves identically on BSD sed (macOS) as it does on the GNU sed 4.9 tested in this sandbox | Common Pitfalls #4 | Medium — if it silently fails to extract the command on macOS, the hook would either never block (safe-but-useless) or could error out; needs a manual macOS test before shipping |
| A3 | Third-party-reported context7 free-tier numeric rate limits (500-1,000 req/month) are current and accurate | State of the Art | Low — context7's own docs don't commit to a number either way, and this doesn't change CTX7-01's implementation (which only requires "no key, no signup," not a specific quota) |
| A4 | No goodvibes user's environment lacks Git Bash on Windows (i.e., all Windows users install git via the standard Git for Windows installer) | Common Pitfalls #3 | Low — if wrong, hook silently no-ops on that one machine (PowerShell can't parse the bash script, hook exits with a shell error, which per docs "doesn't block on its own" unless combined with exit 2 — actual behavior of a shell syntax error under PowerShell is unverified) |

## Open Questions

1. **Exact numeric context7 free-tier rate limit**
   - What we know: context7's own docs say "low rate limits, no custom configuration" for the no-key tier, with no number.
   - What's unclear: whether it's generous enough that a typical solo dev workflow never notices, or tight enough to need the (already-deferred) friendly-429-messaging feature sooner than planned.
   - Recommendation: Not a blocker for this phase (CTX7-01 only requires "no key, no signup" access exists, which is confirmed) — proceed, and let the already-deferred v1.8.x rate-limit-messaging backlog item pick this up if real usage data shows a problem.

2. **Whether a PowerShell shell-syntax error inside a `PreToolUse` hook blocks or silently no-ops**
   - What we know: exit code 2 is the documented blocking signal; a script that fails to *parse* under the wrong shell would presumably exit non-zero/non-two with no valid JSON.
   - What's unclear: the exact Claude Code behavior for "hook process failed to even run the script" (distinct from "ran and exited 1").
   - Recommendation: Low priority given Pitfall 3's reasoning (Git Bash is present wherever `git commit` works) — not worth blocking the plan on; add a one-line doc caveat instead if the planner wants extra safety.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git | Hook logic (`git diff --cached`, `git rev-parse --git-dir`) | ✓ (verified in this sandbox) | 2.43.0 | None needed — git is already a hard project prerequisite |
| GNU sed / BSD sed with `-E` | Hook's JSON field extraction | ✓ on Linux (verified: GNU sed 4.9); assumed present on macOS (BSD sed ships with macOS by default) | 4.9 (Linux, verified) | None — POSIX `-E` is used, no GNU-only extensions |
| grep with `-E`/`-q` | Hook's regex matching | ✓ (verified: ugrep 7.8.4, POSIX-compatible mode) | 7.8.4 (Linux, verified) | None — `-E`/`-q` are POSIX-standard flags |
| Git Bash (Windows) | Hook execution shell on Windows | Not testable in this sandbox (Linux) | — | Ships with Git for Windows, which is already required for `git commit` to work at all on that machine — see Pitfall 3 |
| Claude Code CLI (any recent version) | Both deliverables (`PreToolUse` hooks, `.mcp.json` HTTP transport) | Not directly probed (out of scope for a template-authoring phase) | Current docs describe v2.1.x-era schema | None — this is the tool the whole project targets |

**Missing dependencies with no fallback:** None identified.
**Missing dependencies with fallback:** None — all dependencies here are already hard prerequisites of using Claude Code + git at all.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (npm package), pytest (pip package) — both already configured |
| Config file | `packages/npm/vitest.config.ts`, `packages/pip/pyproject.toml` |
| Quick run command | `cd packages/npm && npm test -- --run journal-gate` (or equivalent new test file name); `cd packages/pip && uv run pytest tests/test_journal_gate_hook.py` |
| Full suite command | `cd packages/npm && npm test`; `cd packages/pip && uv run pytest tests/` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOOK-01 | Hook blocks `git commit` when JOURNAL.md unstaged | integration (real temp git repo, no mocks — matches project convention) | `npm run test:integration` (new file) | ❌ Wave 0 |
| HOOK-02 | Exempts `--amend`, merge-in-progress, rebase-in-progress | integration | same new file, additional `it()` blocks per exemption | ❌ Wave 0 |
| HOOK-03 | Exact stderr message on block | integration | assert stderr equals `BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md` | ❌ Wave 0 |
| HOOK-04 | Docs state Bash-tool-only scope | manual-only (doc content, no automated assertion needed beyond a grep-for-phrase smoke check) | `grep -q "only gates" docs/getting-started.md` (optional smoke test) | ❌ Wave 0 (optional) |
| CTX7-01 | `.mcp.json` ships context7 at free/public HTTP endpoint, no key | unit (static JSON assertion) | `npm test -- --run mcp-json` (new file) — `JSON.parse` + assert `mcpServers.context7.type === "http"`, `.url === "https://mcp.context7.com/mcp"`, no `headers` key | ❌ Wave 0 |
| CTX7-02 | Docs cover `${CONTEXT7_API_KEY}` upgrade path, no literal key committed | manual-only + smoke grep for `${CONTEXT7_API_KEY}` string presence in docs, and a negative-assertion grep across the repo for anything resembling a literal context7 API key pattern | `grep -rn "CONTEXT7_API_KEY" docs/` | ❌ Wave 0 (optional) |
| CTX7-03 | Docs mention one-time trust prompt | manual-only | n/a (doc content review) | n/a |

### Sampling Rate
- **Per task commit:** run the new integration test file directly (`vitest run <file>` / `pytest <file>`)
- **Per wave merge:** `npm test` (npm package) and `uv run pytest tests/` (pip package) full suite
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/npm/src/steps/journal-gate-hook.integration.test.ts` (new) — extracts the `command` string from the actual shipped `templates/.claude/settings.json`, executes it via `execa('sh', ['-c', cmd], { input: jsonPayload, cwd: tmpGitRepo })` against the 8 scenarios verified in this research (staged/unstaged, `--amend`, merge, rebase, `git -C` variant, non-commit command)
- [ ] `packages/npm/src/steps/mcp-json.test.ts` (new) — `JSON.parse` on `templates/.mcp.json`, assert shape (`type`, `url`, absence of `headers`)
- [ ] Mirror both as `packages/pip/tests/test_journal_gate_hook.py` and `packages/pip/tests/test_mcp_json.py` — pip's `copy_templates.py` resolves the same root `templates/` tree, so the same fixture files apply
- [ ] No new test framework/config needed — vitest and pytest are both already fully configured in this repo

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase has no user auth surface |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes (narrow) | The hook parses an untrusted-ish JSON payload (Claude Code-generated, but reachable via prompt injection against the model — see Known Threat Patterns). Mitigation: extraction regex uses non-greedy, escape-aware matching (Pattern 1) rather than naive splitting; no `eval` of any extracted content |
| V6 Cryptography | No | N/A — no crypto in this phase |
| V14 Configuration / Secrets Management | Yes | `${CONTEXT7_API_KEY}` referenced by env-var substitution only; never a literal key in any committed file (CTX7-02). Verified this is Claude Code's documented, supported mechanism, not a goodvibes-invented convention `[CITED: code.claude.com/docs/en/mcp]` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection crafting a commit command to spoof the `--amend` exemption (e.g., embedding the literal string `--amend` inside a commit message to bypass the journal-gate) | Tampering (against the guardrail itself, not against another user/tenant) | Accepted, documented limitation (Common Pitfall #2) — the hook is explicitly scoped as "gates Claude Code's own Bash tool," not a hard security boundary (HOOK-04's own wording already sets this expectation for users) |
| Command injection via unquoted variable expansion inside the hook script itself | Tampering / Elevation of Privilege | The verified script quotes every variable expansion (`"$CMD"`, `"$IN"`, `"$GITDIR"`) and never calls `eval` — confirmed by direct inspection of the tested script |
| Literal API key committed to `.mcp.json` or docs | Information Disclosure | CTX7-02's explicit requirement + this research's recommendation to ship `headers`-free by default (Pitfall 5) both prevent this; a CI secret-scan (already part of the project's existing quality gates, per CLAUDE.md) would catch a regression |

## Sources

### Primary (HIGH confidence)
- https://code.claude.com/docs/en/hooks — PreToolUse JSON schema, stdin payload shape, exit-code/JSON decision protocol, Windows shell-form behavior (Git Bash vs PowerShell fallback)
- https://code.claude.com/docs/en/hooks-guide — hook setup walkthrough, matcher event table, shell-spawn behavior on Windows/macOS/Linux
- https://code.claude.com/docs/en/permissions — `Bash(...)` permission-rule wildcard/prefix-matching semantics (used to determine the `if`-field limitation)
- https://code.claude.com/docs/en/mcp — `.mcp.json` schema for HTTP-transport servers, `${VAR}`/`${VAR:-default}` env-expansion syntax, one-time project-MCP trust-prompt mechanics, `enabledMcpjsonServers`/`enableAllProjectMcpServers`/`disabledMcpjsonServers` config knobs
- Direct execution in this sandbox: git behavior (`git diff --cached --name-only` from a subdirectory returns repo-root-relative paths), the full 8-scenario hook test matrix, and the JSON round-trip (`JSON.stringify` → `JSON.parse` → `sh -c` execution)

### Secondary (MEDIUM confidence)
- https://context7.com/docs/api-guide — "no API key required" policy for basic access, qualitative rate-limit tiers ("low" without key, "higher" with key)
- https://github.com/upstash/context7 (README) — confirms `https://mcp.context7.com/mcp` as the public HTTP endpoint and the `Authorization: Bearer` header convention
- https://context7.com/docs/resources/all-clients — confirms Claude Code's documented setup is CLI-command-only (`claude mcp add --transport http ...`), no literal `.mcp.json` JSON snippet is published for Claude Code specifically (hence A1 in Assumptions Log)

### Tertiary (LOW confidence)
- Third-party blog claiming context7 cut its free tier from ~6,000 to 500-1,000 req/month in January 2026 (numbers not corroborated by context7's own docs) — flagged in State of the Art / Assumptions Log, not load-bearing for this phase's requirements

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — hook schema and `.mcp.json` schema both confirmed against current official Claude Code docs; core hook logic additionally verified by direct execution against 8 scenarios
- Architecture: HIGH — no new architecture, existing template-copy pipeline reused as-is
- Pitfalls: HIGH for hook-script pitfalls (all verified by execution); MEDIUM for the macOS BSD-sed compatibility claim (untested on actual macOS) and the exact numeric context7 rate limit (third-party sourced only)

**Research date:** 2026-09-05
**Valid until:** 2026-10-05 (30 days — Claude Code hook/MCP schema is actively evolving per the docs' own version-gated notes; re-verify schema details if this phase slips past that window)
