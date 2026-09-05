---
phase: 15-journal-gate-hook-context7-mcp
reviewed: 2026-09-05T19:18:31Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - .claude/settings.json
  - .mcp.json
  - docs/getting-started.md
  - packages/npm/src/steps/journal-gate-hook.integration.test.ts
  - packages/npm/src/steps/mcp-json.test.ts
  - packages/npm/templates/docs/getting-started.md
  - packages/pip/tests/test_journal_gate_hook.py
  - packages/pip/tests/test_mcp_json.py
  - templates/.claude/settings.json
  - templates/.mcp.json
  - templates/docs/getting-started.md
findings:
  critical: 3
  warning: 3
  info: 1
  total: 7
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-09-05T19:18:31Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the journal-gate PreToolUse hook, the context7 `.mcp.json`, their npm/pip test
coverage, and the new `getting-started.md` docs. All 20 existing tests (10 vitest + 10 pytest)
pass against the shipped `templates/.claude/settings.json` hook command.

However, direct manual testing of the *actual shipped hook command* (not just the scripted
test scenarios) surfaced two real logic bugs in the regex-based command-text matching that the
existing test suite does not cover: an `--amend` bypass triggered by ordinary commit message
text, and a false-positive block on unrelated git commands whose arguments merely contain the
substring "git ... commit". Both were reproduced by piping payloads through the literal hook
command extracted from `templates/.claude/settings.json`.

Separately, the newly-committed repo-root `.claude/settings.json` (used for dogfooding) grants
an unconditional `Bash(rm -rf *)` permission and hardcodes one developer's absolute home path —
this file is tracked in git and will affect every contributor who opens the repo in Claude Code.

## Critical Issues

### CR-01: Journal-gate hook is bypassed by ordinary commit messages containing "--amend"

**File:** `templates/.claude/settings.json:16` (identical copy at `.claude/settings.json:16`)
**Issue:** The hook detects an amend commit with a pure substring/token match on the raw
command text: `grep -qE -- "(^|[[:space:]])--amend([[:space:]]|$)"`. It does not parse actual
argv, so any brand-new (non-amend) commit whose **message** happens to contain the word
`--amend` will skip the JOURNAL.md gate entirely — even though the commit is not an amend at
all and JOURNAL.md was never staged.

Reproduced directly against the shipped hook command:
```
$ payload: {"tool_name":"Bash","tool_input":{"command":"git commit -am \"note about --amend flag\""}}
$ echo "$payload" | sh -c "$HOOK_COMMAND"
exit=0   # allowed — but JOURNAL.md was never staged
```
This is a real, easily-triggered bypass of the enforcement the whole feature exists for (an LLM
or human writing a commit message that references "amend" defeats the gate).

**Fix:** Don't rely on whole-line substring matching for flag detection. At minimum, strip
quoted spans (`-m "..."`, `-am "..."`) before searching for flags, e.g. pipe `$CMD` through a
step that removes double-quoted substrings first:
```sh
UNQUOTED=$(printf "%s" "$CMD" | sed -E 's/"([^"\\]|\\.)*"//g')
printf "%s" "$UNQUOTED" | grep -qE -- "(^|[[:space:]])--amend([[:space:]]|$)" && exit 0
```
Apply the same fix to the "is this a commit" detection in CR-02.

### CR-02: Journal-gate hook false-positives on unrelated git commands whose arguments contain "git ... commit"

**File:** `templates/.claude/settings.json:16` (identical copy at `.claude/settings.json:16`)
**Issue:** The "is this a commit" check is also a raw substring match over the entire command
line, including inside quoted arguments: `grep -qE "(^|[[:space:]])git([[:space:]]+[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)"`.
A completely unrelated, read-only command is misidentified as a commit if its arguments happen
to contain that text.

Reproduced directly against the shipped hook command:
```
$ payload: {"tool_name":"Bash","tool_input":{"command":"git log --grep=\"please git commit later\""}}
$ echo "$payload" | sh -c "$HOOK_COMMAND"
BLOCKED: JOURNAL.md not staged. Update JOURNAL.md, then: git add JOURNAL.md
exit=2   # a `git log --grep` search is incorrectly blocked
```
This will unexpectedly block legitimate, non-mutating git commands (e.g. anyone searching log
history for the word "commit"), which is disruptive and incorrect behavior for a hook whose
stated purpose is to gate `git commit` specifically.

**Fix:** Same as CR-01 — strip quoted substrings before pattern-matching for the "commit"
subcommand, or parse `tool_input.command` with a real tool (`jq`, `python3 -c`, `node -e`)
into actual argv and check `argv[1] == "commit"` / `-C <path> commit` rather than doing
whole-string regex matching on unparsed shell text.

### CR-03: Repo-root `.claude/settings.json` grants unconditional `rm -rf *` and hardcodes a developer's absolute path

**File:** `.claude/settings.json:3-7`
**Issue:** This new file (committed to the shared repository, not gitignored) contains:
```json
"allow": [
  "Bash(rm -rf *)",
  "Bash(node /home/ygiokas/GoodVibes/packages/npm/dist/index.js init)",
  "Bash(echo \"EXIT:$?\")"
]
```
`Bash(rm -rf *)` grants Claude Code blanket, unconfirmed permission to recursively delete files
in this repository for **every contributor** who opens it — not just the original author. This
directly violates the project's own stated security requirement ("Apply least privilege for
tokens, roles, and permissions", CLAUDE.md). The second entry hardcodes
`/home/ygiokas/GoodVibes/...`, an absolute path specific to one machine/user; it is dead weight
for every other contributor and reveals a local username/directory layout in a public repo.

**Fix:** Remove `Bash(rm -rf *)` entirely (or scope it to a specific throwaway test directory,
e.g. `Bash(rm -rf /tmp/gv-test-*)`). Move the developer-specific dogfooding permissions (the
hardcoded `node .../dist/index.js init` entry) into `.claude/settings.local.json`, which Claude
Code supports precisely for personal, non-committed overrides, and gitignore it.

## Warnings

### WR-01: Shipped template grants unrestricted code-execution permissions with no confirmation

**File:** `templates/.claude/settings.json:14-24`
**Issue:** The `allow` list includes `Bash(node*)`, `Bash(python*)`, `Bash(npx*)`, `Bash(uv*)`
with no argument restriction, letting the AI run `node -e "<anything>"`, `python -c "<anything>"`,
or `npx <any-package>` without ever prompting the user for confirmation. This is a broad grant
of arbitrary code execution for a product whose target audience is explicitly "complete
beginners" (CLAUDE.md) and which claims to follow least-privilege.
**Fix:** If this breadth is intentional (to keep the "zero-config, everything happens
automatically" promise), document the trade-off explicitly in `getting-started.md` so users
understand what they are approving. Otherwise scope these to safer subsets (e.g.
`Bash(npm run*)`, `Bash(pytest*)`) and require confirmation for raw interpreter invocation.

### WR-02: `deny` list for force-push does not cover the common `-f` short flag

**File:** `templates/.claude/settings.json:27-30`
**Issue:** `"Bash(git push --force*)"` matches `--force` and `--force-with-lease`, but not the
equally common short flag `git push -f`. `git push` is not currently in the `allow` list, so
this is latent today, but CLAUDE.md instructs "push to GitHub after every completed task",
making it likely someone will add `Bash(git push*)` to `allow` in a future change — at which
point `-f` silently bypasses the intended safety deny.
**Fix:** Add `"Bash(git push -f*)"` alongside `"Bash(git push --force*)"`.

### WR-03: Journal-gate hook parses JSON with a hand-rolled sed regex instead of a JSON parser

**File:** `templates/.claude/settings.json:16`
**Issue:** `tool_input.command` is extracted from the JSON payload with a single sed
substitution rather than a real JSON parser. This is the root cause of CR-01 and CR-02: text
extraction followed by unparsed substring matching can't distinguish an actual CLI token from
the same text appearing inside a quoted string argument.
**Fix:** Where `jq` can be assumed present (or ship a tiny embedded Python/Node one-liner,
both of which are already required dependencies of this project), extract with
`jq -r '.tool_input.command'` for robustness, and consider tokenizing the command (e.g. via
`set -- $CMD` after quote-stripping) rather than doing regex substring search on raw text.

## Info

### IN-01: `getting-started.md` is duplicated verbatim in two tracked locations

**File:** `docs/getting-started.md`, `templates/docs/getting-started.md`
**Issue:** Both files are byte-identical and both are tracked in git (this is expected —
`docs/getting-started.md` appears to be the result of dogfooding `goodvibes init` on this repo,
copying `templates/docs/getting-started.md`). This is not a bug, but it is a manually-maintained
duplication: future edits to `templates/docs/getting-started.md` will not automatically
propagate to `docs/getting-started.md` unless `goodvibes update`/`upgrade` is re-run on the repo
itself, and there is nothing enforcing that sync.
**Fix:** No action required if this is intentional dogfooding; consider a CI check or a
comment noting that `docs/getting-started.md` at repo root is a generated/synced copy, not a
hand-edited source of truth.

---

_Reviewed: 2026-09-05T19:18:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
