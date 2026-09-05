# Stack Research

**Domain:** Claude Code enforcement hooks + context7 MCP wiring (goodvibes v1.8.0)
**Researched:** 2026-09-05
**Confidence:** HIGH (hooks schema, MCP schema, context7 config all verified against current official docs; MEDIUM on the Windows shell-availability assumption, flagged below)

## Recommended Stack

### Core Technologies

No new runtime technology is required. This milestone is **two static template files plus the existing copy/manifest pipeline** — not a new dependency.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code `settings.json` hooks (`PreToolUse` event) | Current schema, verified against code.claude.com/docs/en/hooks (2026) | Blocks `git commit` unless `JOURNAL.md` is staged | It is the only enforcement primitive Claude Code exposes; `exit 2` is a hard block Claude cannot talk its way past, unlike an advisory CLAUDE.md instruction |
| `.mcp.json` project-scope file | Current schema, verified against code.claude.com/docs/en/mcp (2026) | Registers context7 MCP server for the project | Project-scoped `.mcp.json` is version-controlled and auto-picked-up by any teammate/agent that opens the repo — matches goodvibes' "copy a file, get the behavior" model used everywhere else in the template |
| context7 remote MCP endpoint (`https://mcp.context7.com/mcp`, `type: "http"`) | N/A (hosted service, MIT-licensed server, Upstash) | Gives Claude Code (and any MCP-compatible tool) live, version-aware library docs instead of stale training data | Zero-signup, zero-API-key, zero local process — no `npx` download, no Python/Node subprocess to manage. Directly satisfies the "stay zero-dependency" constraint |

### Supporting Libraries

None. Do not add any npm or pip package for this milestone.

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| — | — | — | Not needed: the hook is a `git` one-liner, not a script requiring a parser/runtime |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `git` (already a hard prerequisite of goodvibes) | Runs the actual staged-file check inside the hook | `git diff --cached --name-only` / `git diff --cached --quiet -- JOURNAL.md` — no `jq`, no `grep` required, keeps the hook shell-agnostic |
| Existing `copy-templates.ts` / `copy_templates.py` recursive walk | Ships the two new files with zero code changes | Confirmed (`packages/npm/src/steps/copy-templates.ts`): `listTemplateFiles`/`walkDir` recursively enumerate every file under `templates/`, so dropping `templates/.mcp.json` and `templates/.claude/hooks/check-journal.sh` (or equivalent) in place is sufficient — no new entries to register anywhere |
| Existing `write-manifest.ts` / `write_manifest.py` | Tracks the new files in `.goodvibes.json` for `goodvibes update` | Manifest is built from `writtenFiles` (the same recursive list), so new files are automatically SHA-256-tracked; no manifest schema change needed |

## Installation

No install step. This is template content, not a package dependency.

```bash
# 1. Add the two new files under the repo-root templates/ directory (source of truth)
#    templates/.claude/settings.json   — add a "hooks" block (edit existing file)
#    templates/.mcp.json               — new file
#    templates/.claude/hooks/check-journal.sh  — new file (hook script)

# 2. Sync into packages/npm/templates/ before building/testing the npm package
cd packages/npm && npm run prebuild

# 3. pip package reads templates from repo-root templates/ directly (verify path in
#    packages/pip/src/goodvibes_cli — no separate prebuild step there per existing pattern)
```

### `templates/.claude/settings.json` — hooks addition

Merge into the existing `permissions` object (do not replace it):

```json
{
  "permissions": {
    "allow": ["Read(**)", "Edit(**)", "Write(**)", "Bash(git add *)", "Bash(git commit*)"],
    "deny": ["Bash(git push --force*)", "Bash(git reset --hard*)"]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(git commit *)",
            "shell": "bash",
            "command": "git diff --cached --quiet -- JOURNAL.md && { echo 'Blocked: stage JOURNAL.md before committing (see CLAUDE.md \"Journal\" rule).' >&2; exit 2; }; exit 0"
          }
        ]
      }
    ]
  }
}
```

**Why this exact shape:**
- `matcher: "Bash"` scopes the hook to the Bash tool only (cheap — no per-Read/Write overhead).
- `if: "Bash(git commit *)"` is a permission-rule filter evaluated on the actual command text, so the hook only runs on real commit attempts, not every `git` invocation (`git diff`, `git add`, `git status` all pass through untouched).
- `git diff --cached --quiet -- JOURNAL.md` exits `1` if `JOURNAL.md` has staged changes, `0` if it does not — so the shell logic is a single git plumbing command, no `jq`/`grep`/JSON-stdin parsing needed even though `PreToolUse` hooks always receive a JSON stdin payload (the hook simply never reads stdin, which is valid).
- `exit 2` is a **hard block**: per official docs, exit 2 blocks the tool call "regardless of any JSON printed," and the message on stderr is shown back to the model as the reason. `exit 0` (no JSON, no stderr) falls through to normal permission handling, i.e., the commit proceeds.
- `"shell": "bash"` pins the interpreter explicitly rather than relying on Claude Code's platform default, so the same `command` string behaves identically on macOS/Linux (native bash) and Windows (Git Bash) — see the Windows caveat below.

### `templates/.mcp.json` — context7 wiring

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

That is the entire free-tier default — no API key, no signup, no local process. Document the opt-in upgrade path in `docs/` (not in the shipped file) as an env-var override:

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

Document, do not ship, this variant — instruct users who want higher rate limits to get a free key at context7.com/dashboard, export `CONTEXT7_API_KEY`, and either hand-edit `.mcp.json` or add the `headers` block themselves. `${VAR}` expansion in `.mcp.json` is a native Claude Code feature (confirmed in official docs) — if `CONTEXT7_API_KEY` is unset, Claude Code loads the config anyway and just leaves the literal `${CONTEXT7_API_KEY}` unexpanded with a warning in `claude mcp list`/`/mcp`, it does not hard-fail. This means it is technically safe to ship the header variant by default with an unset var — but goodvibes should still default to the keyless URL-only form, since an unresolved `${VAR}` in a fresh clone is a confusing first-run signal for a beginner audience.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| `.mcp.json` type `"http"` pointing at `https://mcp.context7.com/mcp` | `type: "stdio"`, `command: "npx"`, `args: ["-y", "@upstash/context7-mcp"]` | Only if a user's environment blocks outbound MCP-over-HTTP (corporate proxy) but allows npx; costs a network fetch of the npm package on every fresh `npx` invocation and requires Node on PATH, which goodvibes cannot assume (see Windows note below) |
| Static `.mcp.json` template file (project scope, checked into repo) | `claude mcp add --scope user context7 https://mcp.context7.com/mcp` invoked via `execa` at `init` time (the pattern goodvibes already uses for headroom in `configure-mcp.ts`) | Use the `execa`/`claude mcp add` pattern only if the config needs to be **user-scope** (machine-wide, not repo-shared) or needs runtime conditionals; context7 has no such need, so a plain checked-in file is strictly simpler and matches the "fork the repo, get everything" delivery path (execa-based registration only works for the `npx goodvibes init` path, not the git-fork path) |
| Shell-form `command` string in the hook (`"command": "git diff ... && ..."`) | Exec-form (`"command": "node", "args": ["hook.js"]`) or a dedicated `.sh` file invoked via `bash "${CLAUDE_PROJECT_DIR}/.claude/hooks/check-journal.sh"` | Use a separate `.sh` file (still invoked via explicit `bash` in exec form) once the check logic grows past one line — e.g., if a future milestone wants to also validate JOURNAL.md's diff isn't a no-op edit. For a single git-plumbing command, inlining in `settings.json` avoids shipping/tracking an extra file |
| `if: "Bash(git commit *)"` permission-rule filter | Parsing `tool_input.command` from stdin JSON with a script (`jq -r '.tool_input.command'`) | Only needed if the block condition depends on the *content* of the commit (e.g., commit message text), not just "is this a commit command" — `if` already handles the latter natively and needs no JSON parser dependency |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| A native `git` `pre-commit` hook (`.git/hooks/pre-commit`) instead of/in addition to the Claude Code hook | `.git/hooks/` is **not version-controlled** by default (lives outside the tracked tree), so `goodvibes init`/`goodvibes update` copying a file there would silently do nothing for anyone who already has a `.git` dir with hooks configured via `core.hooksPath`, and it does nothing for non-git-CLI commit paths (e.g., GUI clients, other agents' tool calls) — it also does not integrate with Claude Code's block-and-explain-to-the-model flow | Claude Code `PreToolUse` hook in `.claude/settings.json`, which is both trackable via the existing template/manifest system and gives the model an explanit stderr reason it can act on immediately |
| `jq` inside the hook command | Adds an implicit dependency goodvibes cannot verify is installed (esp. on Windows, where `jq` is not preinstalled); also unnecessary since the `if` matcher already filters to `git commit` calls, so the hook body never needs to inspect `tool_input.command` at all | Plain `git diff --cached --quiet -- JOURNAL.md` (git is already assumed present) |
| `npx @upstash/context7-mcp` (stdio/local process) as the shipped default | Requires Node.js on PATH at MCP-connection time, which is **no longer guaranteed** — Claude Code shipped a Node-free native installer in Oct 2025 and it is the recommended install path as of 2026, so a beginner running Claude Code natively may have no `node`/`npx` at all; it also triggers an npm registry fetch on first connect, which fails silently offline | The keyless remote `type: "http"` endpoint, which needs nothing but network access Claude Code already requires |
| Baking a hard-coded `CONTEXT7_API_KEY` value into the shipped `.mcp.json` | Secret-in-template is exactly the kind of leaked-credential pattern the project's own CLAUDE.md security rules forbid ("Keep secrets out of code, commits, and logs") | Ship the keyless URL-only config; document the `${CONTEXT7_API_KEY}` env-var upgrade path as an opt-in doc, never a committed value |
| Assuming the hook's default shell (bash on POSIX, silent PowerShell fallback on Windows) without pinning it | Claude Code silently falls back to PowerShell if Git Bash isn't found, and a bash one-liner (`&&`, `-q`, stderr redirect) is not valid PowerShell syntax — an un-pinned hook would work on the author's machine and silently misbehave (either erroring or no-op'ing) for a Windows user without Git Bash | Explicit `"shell": "bash"` in the hook definition, **plus** a documented (not silently swallowed) prerequisite: "Git for Windows" installs Git Bash by default, which is what makes this safe to assume given goodvibes already requires `git` |

## Stack Patterns by Variant

**If a user is on Windows without Git Bash on PATH (rare, but possible with minimal git installs via `winget`/`scoop --no-bash` style setups):**
- The `"shell": "bash"` hook will fail to spawn (no interpreter found) rather than silently doing the wrong thing — Claude Code surfaces a hook-execution error to the user, which is loud, not silent, satisfying the project's "fail loud" rule.
- Document this explicitly in the goodvibes onboarding doc as a known limitation of the hook layer (already flagged as a project-level constraint: "hooks have no equivalent in Codex, Cursor, Copilot, Windsurf, etc.").
- Do not attempt to auto-detect and dual-ship a PowerShell variant of the same hook in this milestone — Claude Code has no OS-conditional hook dispatch, so shipping both would mean both fire and one always errors; scope this to a follow-up if Windows-without-Git-Bash reports come in.

**If a user forks the repo (template path) vs. runs `npx goodvibes init` (installer path):**
- Both paths get identical files, because both source from `templates/.mcp.json` and `templates/.claude/settings.json` — the fork path needs nothing extra since it's a plain git clone; the installer path needs nothing extra either, since this is a static copy, not an `execa`-driven `claude mcp add` call (unlike headroom's MCP registration, which does need the installer's execa step because it registers a local absolute path that only exists post-install).

**If a project wants higher context7 rate limits:**
- Point users to `context7.com/dashboard` for a free API key, then either hand-edit `.mcp.json`'s `headers` block or export `CONTEXT7_API_KEY` and add the `${CONTEXT7_API_KEY}`-templated `headers` block themselves per the documented upgrade snippet above. goodvibes does not prompt for this at `init` time — it stays a docs-only opt-in, consistent with the zero-config default.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Claude Code hooks `"hooks"` schema (this doc) | Claude Code CLI supporting `PreToolUse` + `if` permission-rule filters + `hookSpecificOutput` | This is a relatively recent schema shape (the `if` field and `shell` field are newer additions layered onto the original matcher-only hooks system) — goodvibes should document a minimum Claude Code version in its onboarding doc and note graceful degradation: an older Claude Code that doesn't understand `if`/`shell` will likely ignore those fields or the whole hook block rather than error, but this was not independently verified against an old version and should be spot-checked before ship (flag for phase-specific research) |
| `.mcp.json` `type: "http"` | Claude Code versions supporting Streamable HTTP MCP transport (current as of 2026; SSE is deprecated/being removed) | Do not ship `type: "sse"` for context7 — SSE is explicitly called out as deprecated in favor of `http` in both Claude Code's own MCP docs and context7's client docs |
| context7 remote endpoint (`mcp.context7.com/mcp`) | Any MCP client speaking Streamable HTTP (Claude Code, Cursor, Windsurf, etc.) | Not Claude-Code-specific — the same `.mcp.json`-shaped config (mutatis mutandis for each tool's own MCP config file/format) could theoretically be reused for other IDE templates in a later milestone, but that is out of scope for v1.8.0 per PROJECT.md (hooks are explicitly Claude-Code-only; this milestone's `.mcp.json` scope is Claude Code only too) |

## Sources

- Context7 library search — `/websites/code_claude` (Claude Code, 6911 snippets, high reputation) — confirmed hook/MCP schema exists in indexed docs; used as a pointer, primary verification done via official docs fetch below
- [Hooks reference — Claude Code Docs](https://code.claude.com/docs/en/hooks) — fetched directly; verified `hooks` JSON schema, `PreToolUse` event, matcher vs. `if` permission-rule syntax, exit-code 0/1/2 semantics, stdin JSON shape, shell-vs-exec form, and the Windows Git-Bash/PowerShell fallback + `.cmd`/`.bat` exec-form caveat — HIGH confidence
- [MCP documentation — Claude Code Docs](https://code.claude.com/docs/en/mcp) — fetched directly; verified `.mcp.json` project-scope file location, `mcpServers` schema, `type: "http"`/`"stdio"`/`"sse"`/`"ws"` transports, `headers`/`headersHelper` auth, and `${VAR}`/`${VAR:-default}` env expansion — HIGH confidence
- [MCP Clients — Context7 Docs](https://context7.com/docs/resources/all-clients) — fetched directly; confirmed Claude Code CLI snippets for both keyless-remote and API-key variants — HIGH confidence
- WebSearch (multiple sources incl. mcp.directory, augmentcode.com, deepwiki.com/upstash/context7) — cross-confirmed context7 is free/no-signup by default, MIT-licensed, API key only raises rate limits, SSE deprecated in favor of HTTP — MEDIUM-HIGH confidence (verified against 3+ independent sources plus official docs)
- WebSearch (morphllm.com, claudefast.com, nxcode.io, thepromptshelf.dev, vanja.io) — cross-confirmed Claude Code's Node-free native installer became the recommended install path as of ~May 2026, meaning Node.js/npx cannot be assumed present on a user's machine — MEDIUM confidence (multiple independent sources agree, no single canonical Anthropic blog post fetched directly, flagged for spot-check before final ship copy)
- Direct repo inspection — `/home/ygiokas/GoodVibes/packages/npm/src/steps/copy-templates.ts`, `write-manifest.ts`, `packages/npm/package.json` (`prebuild` script) — confirmed the existing recursive-walk copy + hash-manifest pipeline requires zero code changes to pick up new template files, and that `templates/` at repo root is the single source of truth synced via `npm run prebuild` — HIGH confidence (read directly, not inferred)
- Direct repo inspection — `/home/ygiokas/GoodVibes/packages/npm/src/steps/configure-mcp.ts` — confirmed the existing headroom MCP registration pattern (`execa` + `claude mcp add -s user`) is deliberately **not** the right pattern to reuse for context7, since it's user-scope/runtime-registered for a path that only exists post-install, whereas context7 needs no such indirection — HIGH confidence

---
*Stack research for: Claude Code enforcement hooks + context7 MCP config (goodvibes v1.8.0)*
*Researched: 2026-09-05*
