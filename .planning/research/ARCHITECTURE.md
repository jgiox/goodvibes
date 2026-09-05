# Architecture Research: v1.8.0 Agent Governance & Cross-Tool Enforcement

**Domain:** Adding a new hooks/MCP config surface to an existing generic template-copy pipeline (goodvibes CLI, npm + pip)
**Researched:** 2026-09-05
**Confidence:** HIGH (all claims verified against the actual source in this repo, plus official Claude Code hooks docs and Context7 setup docs)

## Central Finding

**The existing copy/manifest/update pipeline is already fully generic and file-tree-driven — it has zero hardcoded file lists.** `copyTemplates`/`copy_templates` walk the whole `templates/` directory with `fs-extra copy()` / `shutil.copytree()` and a filter/ignore callback that special-cases exactly three things: `CLAUDE.md` (sentinel merge), `.github/`+`docs/` (`--minimal` exclusion), and the three `ci-*.yml` variants (project-type selection). `write-manifest.ts`/`write_manifest.py` hash whatever file list they're handed. `update.ts`/`update_cmd.py`'s `categorise()` diffs `listTemplateFiles(templateDir)` against the manifest generically.

This means **`.mcp.json` and a new `.claude/hooks/<script>` file require zero pipeline code changes** — dropping them into `templates/` is sufficient for them to be copied, no-clobbered, dry-run-listed, manifest-hashed, and update-diffed correctly, exactly like every other template file (`.windsurfrules`, `.kiro/steering/goodvibes.md`, etc.) already is.

The one file that is **not** wholly new is `.claude/settings.json` — it already exists in `templates/.claude/settings.json` today (permissions-only, no `hooks` key) and already flows through this same generic pipeline with no special-casing. Adding a `hooks` block to it is a **content edit to an existing file**, not a new pipeline component.

```
templates/.claude/settings.json   → EXISTS today, permissions-only → content edit (add "hooks" key)
templates/.claude/hooks/<script>  → NEW file → zero pipeline code needed, flows through generic copy
templates/.mcp.json               → NEW file → zero pipeline code needed, flows through generic copy
```

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  templates/  (single source of truth, repo root)                     │
│  ┌────────────┐ ┌──────────────────┐ ┌───────────┐ ┌──────────────┐  │
│  │ CLAUDE.md  │ │.claude/settings  │ │ .mcp.json │ │.claude/hooks/│  │
│  │ (sentinel- │ │.json (EXISTS —   │ │  (NEW)    │ │journal-gate  │  │
│  │  merged)   │ │ add hooks key)   │ │           │ │.sh (NEW)     │  │
│  └─────┬──────┘ └────────┬─────────┘ └─────┬─────┘ └──────┬───────┘  │
└────────┼─────────────────┼─────────────────┼──────────────┼──────────┘
         │                 │  generic fs-extra copy()/shutil.copytree()  │
         │                 │  (no per-file special-casing beyond the 3   │
         │                 │   filters: CLAUDE.md, --minimal, ci variant)│
         ▼                 ▼                 ▼              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  copy-templates.ts / copy_templates.py                                │
│  filter/ignore callback: CLAUDE.md → skip (sentinel merge handles it) │
│                          minimal && (.github|docs) → skip             │
│                          ci-*.yml non-selected variant → skip         │
│                          dest file already exists → skip (no-clobber) │
└───────────────────────────────┬────────────────────────────────────┘
                                 ▼
                    written[] / skipped[]  (destDir-relative paths)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  write-manifest.ts / write_manifest.py                                │
│  SHA-256(content) per written file → .goodvibes.json                  │
│  (treats every file as opaque bytes — no JSON-aware merge logic)      │
└───────────────────────────────┬────────────────────────────────────┘
                                 ▼
                    .goodvibes.json { version, files: { path: sha256 } }
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  update.ts / update_cmd.py — categorise()                             │
│  manifest hash == current dest hash → overwrite (safe, unmodified)    │
│  manifest hash != current dest hash → skip (user-modified, preserve)  │
│  template file not in manifest → net-new (add it)                    │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Change needed for v1.8.0 |
|-----------|----------------|---------------------------|
| `templates/.claude/settings.json` | Ships default Claude Code permissions + (new) hooks config | **Modify** — add `hooks.PreToolUse` block alongside existing `permissions` |
| `templates/.claude/hooks/<script>` | Executable script the hook invokes to gate `git commit` on staged `JOURNAL.md` | **New file** |
| `templates/.mcp.json` | Ships context7 MCP server config (free public endpoint) at project scope | **New file** |
| `copy-templates.ts` / `copy_templates.py` | Generic recursive copy with no-clobber + 3 filters | **No change** — new/modified files flow through unmodified |
| `write-manifest.ts` / `write_manifest.py` | SHA-256 hash of whatever `written[]` contains | **No change** — new files auto-included since they appear in `written[]` |
| `update.ts` / `update_cmd.py` (`categorise`) | Diffs manifest vs. dest vs. template tree | **No change** — new/modified files are picked up generically as net-new or overwrite |
| `init.ts` / `init_cmd.py` dry-run file list | Lists `listTemplateFiles(templateDir)` minus ci-variant/`--minimal` filters | **No change** — no hardcoded file list to update |
| `configure-mcp.ts` / `configure_mcp.py` | Registers **headroom** as a *global, user-scope* MCP server via `claude mcp add -s user` | **No change, no conflict** — this writes to the user's global `~/.claude.json`/CLI-managed config, never to a project-level `.mcp.json`. The new `templates/.mcp.json` is a separate, project-scoped file copied like any other template. |
| `templates/CLAUDE.md`, `AGENTS.md`, `JOURNAL.md`, per-IDE rule files, `caveman/SKILL.md` | Wording/default-intensity content | **Content-only edit** — already copied by the existing pipeline; no code touches these paths specially except CLAUDE.md's sentinel merge (which is a merge algorithm, not content-aware of *what* changed) |

## Integration Points (explicit)

### 1. `.claude/settings.json` hooks block

- **File already exists** at `templates/.claude/settings.json` today:
  `{"permissions":{"allow":[...],"deny":[...]}}` — no `hooks` key yet.
- **Change required:** add a `hooks` top-level key alongside the existing `permissions` key (do not replace the file). Verified schema (Claude Code official docs, code.claude.com/docs/en/hooks):
  ```json
  {
    "permissions": { "...": "...(unchanged)" },
    "hooks": {
      "PreToolUse": [
        {
          "matcher": "Bash",
          "hooks": [
            { "type": "command", "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/journal-gate.sh" }
          ]
        }
      ]
    }
  }
  ```
- **Copy pipeline:** already flows through `copyTemplates`/`copy_templates` unmodified today (this file is not special-cased anywhere in the filter/ignore callbacks — confirmed by reading both implementations). No code change needed to add the `hooks` key.
- **No-clobber implication (real limitation, not a bug):** on `goodvibes init` in a project that *already has* `.claude/settings.json` (e.g. a returning user, or Claude Code auto-created one), the whole file is skipped — the hook will **not** be injected. This is identical behavior to how `.cursorrules`/`.windsurfrules` are already handled (documented precedent from Phase 8, IDE-03). The only path that adds the hook to an *existing* project is `goodvibes update`.
- **Manifest/update path is the real delivery mechanism for existing projects:** since `.claude/settings.json` is already manifest-tracked (it's already a template file, already hashed into every prior `.goodvibes.json`), `goodvibes update`'s `categorise()` will see the template hash change and classify it as:
  - **overwrite** (safe) if the user's on-disk `settings.json` still matches the *old* manifest hash (i.e. they never touched it) → they get the hook automatically on next `update`.
  - **skip** (preserved) if the user customized `settings.json` (e.g. added their own permission rules) → the hook is **not** added; this must be documented (README/CHANGELOG note: "if you've customized `.claude/settings.json`, add the hook block manually — see docs/...").
  - This is the existing, already-battle-tested manifest semantics (Phase 14/UPD-01–06) — no new merge logic needed or wanted (ponytail: a JSON-aware deep-merge for settings.json would be a new abstraction for a single file; the existing hash-based overwrite/skip model already does the right thing).
- **`--minimal` scope:** `.claude/` is never in the `--minimal` exclusion list (only `.github/` and `docs/` are, confirmed in both `copy-templates.ts` line 93 and `copy_templates.py` line 73). Consistent with the Phase 8 precedent that AI-configuration files (IDE rule files, CLAUDE.md) are never stripped by `--minimal` — only CI/docs scaffolding is. **No code change needed**; `.claude/settings.json` and `.mcp.json` should both stay outside minimal's exclusion by simply not adding them to it.

### 2. `.mcp.json`

- **New file**, does not exist in `templates/` today (`find -iname "*.mcp*"` returned nothing).
- Recommended zero-config content (verified against Context7's official remote endpoint, no API key required for the free tier):
  ```json
  { "mcpServers": { "context7": { "url": "https://mcp.context7.com/mcp" } } }
  ```
- **No conflict with existing headroom MCP registration.** `configureMcp`/`configure_mcp` registers headroom via `claude mcp add -s user` (**user/global scope**, writes to Claude's global CLI-managed config) — it explicitly never touches a project-level `.mcp.json` (confirmed by source comment: "Never writes to ~/.claude.json or ~/.claude/ directly" combined with the `-s user` flag). The new `templates/.mcp.json` is project-scoped and copied like any other template file. These are two independent mechanisms serving two different servers (headroom = global CLI registration; context7 = project file).
- **Pipeline:** flows through the generic copy/no-clobber/manifest/update path with zero code changes, same as `.windsurfrules` or `GEMINI.md` today.
- **Existing-project no-clobber caveat (same as above):** if a project already has `.mcp.json` (e.g. user added their own MCP servers), `init` skips it entirely; `update` will only overwrite it if unmodified since the last goodvibes-written version, otherwise skip. Document the same manual-merge fallback as for `settings.json`.

### 3. Hook script executable bit (verified, not assumed)

Tested directly in this environment: both `fs.copyFileSync` (which `fs-extra copy()` uses) and Python's `shutil.copytree` (default `copy2`) **preserve the Unix executable bit** across the copy. Also verified for the npm prebuild step (`cpSync({recursive:true})` preserves mode). This means:
- The hook script just needs to be **committed to git with the executable bit set** (`chmod +x templates/.claude/hooks/journal-gate.sh` before `git add`) — git tracks the exec bit as part of the blob mode (100755), and every copy step in the pipeline (dev, npm prebuild `cpSync`, pip's hatch build hook `shutil.copytree`) preserves it through to the destination project.
- **One unverified point (flag for phase-specific validation):** whether hatchling's wheel-zip packaging preserves the Unix mode bit through `pip install` extraction is not confirmed in this research (zip external_attr handling varies by build backend/version). Recommend a smoke test in the Phase 12-style "human verification checkpoint" pattern this project already uses: `pip install` the built wheel into a fresh venv, run `goodvibes init`, and confirm `ls -la .claude/hooks/journal-gate.sh` shows `-rwxr-xr-x`. If not preserved, the pip `init_cmd.py`/`copy_templates.py` needs one `os.chmod(dest, 0o755)` call after copy for files under `.claude/hooks/` — small, targeted fix, not a redesign.

### 4. Hook script implementation constraint

Verified via official Claude Code hooks docs: `PreToolUse` hooks receive JSON on stdin with `tool_input.command` containing the raw Bash command string, and block via **exit code 2** (message = stderr) or a structured `hookSpecificOutput.permissionDecision: "deny"` JSON on stdout with exit 0. Anthropic's own examples use `jq` to parse stdin — **do not follow that pattern here**: goodvibes targets complete beginners and cannot assume `jq` is installed. Use a portable approach instead:
- Match narrowly with the hook `matcher: "Bash"` (or the optional `if` permission-rule filter, e.g. `"if": "Bash(git commit*)"`) so the script only runs for commit-shaped commands, then inside the script use `grep`/`case` on the raw stdin JSON string (or Python/Node one-liner already required by goodvibes' own stack) rather than requiring `jq` as a new runtime dependency.
- Check-staged-JOURNAL logic itself: `git diff --cached --name-only | grep -q '^JOURNAL.md$'` — cheap, already the mechanism named in `PROJECT.md`'s Key Decisions table ("Journal-gate hook over broader static-analysis hooks").
- Use `${CLAUDE_PROJECT_DIR}` (documented Claude Code variable) in the `command` field of `settings.json`, not a hardcoded absolute path — required because `templates/` gets copied into an arbitrary user project root at an unknown filesystem location.

### 5. Content-only edits (no pipeline changes)

These files already exist in `templates/` and are already copied by the generic pipeline today — the wording/default-intensity pass touches file **content** only, never the copy/manifest/update code:

| File | Change |
|------|--------|
| `templates/CLAUDE.md` | Directive-language rewrite (sentinel-merged into projects — the merge algorithm is unaffected by *what* text is inside the sentinel block) |
| `templates/AGENTS.md` | Directive-language rewrite; strengthen "read JOURNAL.md first, treat prior entries as binding" instruction |
| `templates/JOURNAL.md` | Strengthen cross-agent handoff instructions at top of file |
| `templates/.claude/skills/caveman/SKILL.md` (+ README.md) | Default intensity `full` → `ultra` (confirmed current default is `full` at line 17 of SKILL.md) |
| `templates/.cursor/rules/*`, `.github/copilot-instructions.md`, `.windsurfrules`, `.kiro/steering/*`, `.clinerules/*`, `.continue/rules/*`, `.devin/rules/*`, `.amazonq/rules/*`, `GEMINI.md`, `docs/platform-setup/*.md`, `.bolt/prompt`, `replit.md` | Directive-language rewrite (remove "should"/"consider"/"try to") |

Because these are pre-existing manifest-tracked files, the **same update-diffing semantics apply**: users who never touched these files get the new wording on `goodvibes update`; users who customized them keep their edits (skip). This is expected and requires no new code — it's the intended behavior of the manifest system these files already participate in.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Building a JSON-aware merge for `.claude/settings.json` / `.mcp.json`
**What people might do:** Write a special "deep-merge JSON" step (like `sentinel-merge.ts` but for JSON) so a user's customized `settings.json` still gets the new `hooks` key even if they've edited `permissions`.
**Why it's wrong:** This is a new abstraction for two files, contradicts ponytail ("no unrequested abstractions... shortest working diff wins"), and the codebase's own precedent is that only `CLAUDE.md` gets a bespoke merge (because it's the one file every project touches most). Every other template file — including seven+ IDE rule files already — uses whole-file overwrite/skip via the manifest hash.
**Instead:** Keep the existing hash-based overwrite/skip model. Document the manual-merge fallback for power users who've customized these two files.

### Anti-Pattern 2: Hardcoding `.mcp.json` / hook script paths into `copyTemplates`/`copy_templates`
**What people might do:** Add an explicit `if (rel === '.mcp.json') {...}` or `if (rel.startsWith('.claude/hooks/')) {...}` branch to the filter/ignore callback, "just to be safe."
**Why it's wrong:** The whole point of the current design is that new template files need zero pipeline code. Adding file-specific branches for files that need no special treatment increases the diff and creates a maintenance trap (the next new template file added six months from now will look at this precedent and add its own unnecessary branch).
**Instead:** Just add the files under `templates/`. Verify with existing tests (`copy-templates.test.ts` / `test_copy_templates.py`) that a new arbitrary file appears in `written[]` — it already will.

### Anti-Pattern 3: Depending on `jq` inside the hook script
**What people might do:** Copy Anthropic's own hook examples verbatim, which use `jq -r '.tool_input.command'`.
**Why it's wrong:** goodvibes explicitly targets complete beginners with zero-config philosophy; `jq` is not guaranteed to be installed, and a missing binary would make the gate hook error out non-blockingly (exit code + malformed output = "hook error" notice, not a clean pass/fail) — confusing for a beginner.
**Instead:** Use the `matcher`/`if` fields in `settings.json` to narrow to Bash/`git commit*` at the config level, and parse stdin with `grep`/`sed` or the shell's own string handling inside the script — no new external binary dependency.

## Build Order Recommendation

Given the dependency structure above, and this project's existing wave-based phase-planning convention:

1. **`.mcp.json` template file + `templates/.claude/settings.json` hooks key + hook script** (touch the copy pipeline in the sense that they are new/modified template *content* the pipeline must carry — though no *code* changes are required, these should land first because...)
2. **Test coverage extension** — extend `copy-templates.test.ts`/`test_copy_templates.py` and `update.test.ts`/`test_update_cmd.py` with assertions that the new files appear in `written[]`/dry-run listing/manifest/update net-new categorisation, mirroring the Phase 8 pattern (`08-02-PLAN.md` added IDE-file assertions to the same generic suites without touching pipeline code). This should follow immediately after step 1 since it's the proof the "no code change" claim holds.
3. **Executable-bit smoke test (pip wheel path)** — verify the one MEDIUM-confidence unverified point above before calling the hook shippable via `pip install`.
4. **Wording/directive-language pass across CLAUDE.md, AGENTS.md, JOURNAL.md, all per-IDE rule files, caveman default intensity** — pure content edits, zero dependency on steps 1-3, can be built and merged in parallel with them (no file conflicts: different files, same generic pipeline). Do this last only in the sense of "no urgency to sequence it before the new-file work" — it could equally run in parallel as its own wave, consistent with how this project already parallelizes no-file-conflict work (see Phase 8 Wave 1a/1b, Phase 13 Wave 1).

Rationale for this order: the new-file work (`.mcp.json`, hook script, settings.json hooks key) is the only piece with a genuine unverified technical risk (wheel exec-bit preservation) and the only piece that needs new test assertions proving the "generic pipeline, zero code change" claim — so it should be validated early. The wording pass carries no technical risk and no pipeline dependency, so it can run independently and does not gate or block the new-file work.

## Sources

- Repo source (read directly, HIGH confidence): `packages/npm/src/steps/copy-templates.ts`, `packages/pip/src/goodvibes_cli/steps/copy_templates.py`, `packages/npm/src/steps/write-manifest.ts`, `packages/pip/src/goodvibes_cli/steps/write_manifest.py`, `packages/npm/src/commands/update.ts`, `packages/npm/src/commands/init.ts`, `packages/npm/src/steps/configure-mcp.ts`, `packages/pip/hatch_build.py`, `packages/npm/package.json` (prebuild script), `templates/.claude/settings.json`, `templates/.claude/skills/caveman/SKILL.md`
- Empirical verification in this session (HIGH confidence): `fs.copyFileSync`, `fs.cpSync({recursive:true})`, and Python `shutil.copytree` all preserve the Unix executable bit — tested directly with `chmod 755` fixtures.
- [Claude Code Hooks reference — code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks) (HIGH confidence, official docs, fetched directly) — `PreToolUse` schema, `matcher`/`if` fields, stdin JSON shape, exit-code-2 blocking semantics, `${CLAUDE_PROJECT_DIR}` variable
- Context7 MCP setup (MEDIUM confidence — WebSearch aggregation, not fetched from context7.com directly, but multiple independent sources converge on the same free public endpoint and JSON shape): `https://mcp.context7.com/mcp` remote HTTP endpoint, no API key required for basic tier
- `.planning/PROJECT.md` — v1.8.0 milestone scope, Key Decisions table (journal-gate hook mechanism, context7 free-tier decision)
- `.planning/ROADMAP.md` — prior phase build-order conventions (Wave-based parallelization for no-file-conflict work, e.g. Phase 8 Wave 1a/1b)

---
*Architecture research for: goodvibes v1.8.0 Agent Governance & Cross-Tool Enforcement*
*Researched: 2026-09-05*
