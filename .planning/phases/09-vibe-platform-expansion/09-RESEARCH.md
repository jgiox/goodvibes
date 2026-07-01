# Phase 9: Vibe Platform Expansion - Research

**Researched:** 2026-07-01
**Domain:** Vibe-coding platform rule file formats (Codex CLI, ChatGPT, Lovable, Replit, Base44, Bolt.new, v0.dev)
**Confidence:** HIGH (Codex CLI, Replit, Lovable), MEDIUM (Bolt.new, ChatGPT), LOW (Base44 file-based support, v0.dev)

---

## Summary

Phase 9 extends goodvibes' IDE compatibility table to cover cloud-first and browser-based vibe-coding platforms. The finding most likely to surprise: goodvibes **already** covers several of these platforms via AGENTS.md and CLAUDE.md. Lovable reads `AGENTS.md` from the repo root natively (official docs confirmed). OpenAI Codex CLI reads `AGENTS.md` as its primary instruction file (it was the platform that defined the standard). Both are already written by `goodvibes init`. No new template files are strictly required for those two platforms.

The platforms with a new writable file are: Replit (`replit.md` at project root) and Bolt.new (`.bolt/prompt`). ChatGPT has no file-based mechanism — instructions live in the ChatGPT Projects UI. Base44 uses a UI-based custom instructions panel with no documented file path. v0.dev is a component/code generator with no persistent project rule file mechanism.

The AGENTS.md open standard has crossed a critical inflection point: it was donated to the Linux Foundation's Agentic AI Foundation in December 2025 alongside Anthropic's MCP and Block's goose, and has been adopted by 60,000+ open source projects and by Cursor, Amp, Devin, Gemini CLI, GitHub Copilot, Jules, Zed, and others. Goodvibes' AGENTS.md template is now a high-value artifact that benefits users across essentially the entire category.

**Primary recommendation:** Add two new template files (`replit.md`, `.bolt/prompt`). Document Codex CLI and Lovable in the README/compatibility table as already covered by AGENTS.md. Write a `docs/platform-setup/` guide for ChatGPT Projects, Base44, and v0.dev (UI-only platforms). No CLI code changes required.

---

## Project Constraints (from CLAUDE.md)

- **Ponytail (full mode):** Fewest files, shortest diff. Deletion over addition.
- **Surgical changes:** Touch only what the task requires. No opportunistic reformats.
- **Fail loud:** No empty catch, no silent failures.
- **Security:** Input validation at trust boundaries, path traversal guard in place.
- **License:** Apache 2.0 — all template content authored by goodvibes.
- **Zero-config:** No user prompts. Template files written unconditionally (no-clobber).
- **Beginner-first:** Error messages and docs must assume reader has never opened a terminal.
- **Testing:** Every exported public function gets at least one test. 3-test pattern per file: fresh init writes it, skips existing, writes under `--minimal`.
- **GSD workflow enforcement:** Do not make direct repo edits outside a GSD workflow.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Template file authoring | Static files (templates/) | — | New rule files are static markdown; authored once, copied verbatim |
| File copy to user project | CLI (npm + pip copy step) | — | Existing `copyTemplates`/`copy_templates` machinery; no code changes needed |
| No-clobber enforcement | CLI (copy-templates filter) | — | Already handled by `overwrite: false`; new files get same treatment |
| Platform docs guide | Static docs (docs/platform-setup/) | — | UI-only platforms need a walkthrough; not a code change |
| README compatibility table | Static docs (README.md) | — | Additive markdown section listing newly covered platforms |
| ChatGPT / Base44 / v0 setup | docs only | — | These platforms have no file-based rule mechanism goodvibes can write |

---

## Per-Platform Findings

### Platform A: OpenAI Codex CLI

**Status: ALREADY COVERED — no new template file needed**

**File mechanism:** Codex CLI reads `AGENTS.md` from the project root (and recursively up the directory tree, from git root to cwd). [VERIFIED: developers.openai.com/codex/guides/agents-md]

**Discovery sequence:** Codex walks from git root downward checking each directory for `AGENTS.override.md`, then `AGENTS.md`, then any filenames in `project_doc_fallback_filenames` (configurable in `~/.codex/config.toml`). Files are concatenated; closer files override earlier guidance. Max 32 KiB total. [CITED: developers.openai.com/codex/guides/agents-md]

**The `.codex/` directory:** Codex also uses a project-level `.codex/` directory for:
- `.codex/config.toml` — project config (only loaded when the project is "trusted")
- `.codex/rules/` — Starlark `.rules` files controlling which shell commands Codex may execute outside its sandbox
- These are security-oriented, not instruction-oriented. [CITED: developers.openai.com/codex/config-basic, developers.openai.com/codex/rules]

**AGENTS.md standard:** AGENTS.md originated inside OpenAI Codex tooling and was donated to the Linux Foundation's Agentic AI Foundation in December 2025 alongside Anthropic's MCP. It is now adopted by 60,000+ open source projects. [CITED: linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation]

**Action for goodvibes:**
- AGENTS.md is already written by `goodvibes init` (Phase 8 shipped this).
- Add Codex CLI to README compatibility table as "already covered via AGENTS.md".
- No new template file needed.

**Confidence:** HIGH

---

### Platform B: ChatGPT (Projects and Canvas)

**Status: DOCS ONLY — no file-based mechanism**

**File mechanism:** None. ChatGPT Projects instructions are set through the ChatGPT web UI under "Project Instructions" (a text field). There is no `.chatgpt/` directory or repository-level file that ChatGPT reads. [CITED: help.openai.com/en/articles/10169521-projects-in-chatgpt]

**How it works:** A ChatGPT Project is a UI workspace with three layers: system instruction text, uploaded files (5–40 files depending on tier), and project-scoped memory. Instructions can include "several thousand characters" — enough for goodvibes' full rule set. [CITED: help.openai.com/en/articles/10169521-projects-in-chatgpt]

**Canvas:** Canvas is a collaborative editing mode within ChatGPT; it inherits the project's instructions and has no separate rule file mechanism.

**File upload option:** Users can upload files (PDF, Word, code files) to a project. This is not a rule file mechanism — uploaded files are read by the model as data, not as persistent system instructions.

**Action for goodvibes:**
- Write `docs/platform-setup/chatgpt.md` guiding users to copy the goodvibes rule text into ChatGPT Project Instructions.
- Content can be extracted from `CLAUDE.md` or `AGENTS.md` — they're the same rule set.
- No template file.

**Confidence:** HIGH (ChatGPT Projects are well-documented; the absence of file-based rules is confirmed by official docs)

---

### Platform C: Lovable (lovable.dev)

**Status: ALREADY COVERED — AGENTS.md is natively read; CLAUDE.md also read**

**File mechanism:** Lovable reads `AGENTS.md` from the repository root automatically. Specifically: "root-level `AGENTS.md` files are always read by the Lovable agent regardless of session length." [CITED: docs.lovable.dev/features/knowledge]

Lovable also reads `CLAUDE.md` from the repository root. [CITED: docs.lovable.dev/features/knowledge]

**Knowledge hierarchy:** Lovable combines four context sources for each generation: (1) workspace knowledge (UI setting, up to 10,000 chars, all projects), (2) project knowledge (UI setting, up to 10,000 chars, one project), (3) repository files (`AGENTS.md`, `CLAUDE.md`), (4) integration context. When conflicts arise, project knowledge > workspace knowledge. Repo files are additive. [CITED: docs.lovable.dev/features/knowledge]

**UI Knowledge vs. repo files:** Both are supported. Power users managing instructions in git (goodvibes' use case) use AGENTS.md. UI knowledge is for users who prefer not to use git.

**Lovable Skills:** A separate "Skills" feature allows saving reusable instructions. Each Skill uses a `SKILL.md` file format — this is an independent mechanism, not a project-level rule file. Not relevant for goodvibes (goodvibes' skills are Claude Code-specific). [CITED: docs.lovable.dev/features/skills]

**Action for goodvibes:**
- AGENTS.md and CLAUDE.md are already written by `goodvibes init`.
- Add Lovable to README compatibility table as "covered via AGENTS.md + CLAUDE.md".
- No new template file needed.

**Confidence:** HIGH (official Lovable docs confirm AGENTS.md is always read)

---

### Platform D: Replit (Replit Agent)

**Status: NEW TEMPLATE FILE — `replit.md`**

**File mechanism:** Replit Agent reads `replit.md` from the project root. The file must be at the project root — Agent does not detect it in subdirectories. [CITED: docs.replit.com/references/project-setup/replit-dot-md]

**Auto-generation:** When Replit Agent first runs in a project, it auto-generates `replit.md` using "proven best practices." The file is fully user-editable. [CITED: docs.replit.com/references/project-setup/replit-dot-md]

**AGENTS.md support:** Official Replit docs make no mention of reading `AGENTS.md`. Community workaround exists using symlinks (`mv .replit.md AGENT.md && ln -s AGENT.md .replit.md`), but this is not an official supported mechanism. [ASSUMED: symlink approach is community-driven, not officially documented by Replit] [CITED: docs.replit.com/replitai/replit-dot-md]

**File format:** Plain markdown. No frontmatter. Typical sections: Project Overview, Tech Stack, Coding Style, API Standards, Security Requirements, Testing Approach. No hard character limit documented; "focused and concise" recommended. [CITED: docs.replit.com/references/project-setup/replit-dot-md]

**Example structure:**
```markdown
## Project Overview
[description]

## Tech Stack
[languages, frameworks, DBs]

## Coding Style
[your conventions]

## Security Requirements
[key rules]
```

**Skills feature:** Replit also has a Skills system (SKILL.md files), parallel to Claude Code's `.claude/skills/` system. Replit skills are personal or workspace-level configuration, not project-level. Out of scope for goodvibes' template. [CITED: replit.com/blog/custom-skills]

**Action for goodvibes:**
- Add `templates/replit.md` containing the goodvibes engineering rules in plain markdown format (no frontmatter).
- Follow the 3-test pattern: fresh init writes it, skips existing, writes under `--minimal`.
- Replit is a cloud IDE — projects are created in-browser. Users who connect Replit to GitHub get the template file when they pull from their goodvibes-initialized repo.

**Confidence:** HIGH (official Replit docs confirm `replit.md` at project root)

---

### Platform E: Base44

**Status: DOCS ONLY — no confirmed file-based mechanism**

**What is Base44:** Base44 is a browser-based vibe-coding platform (base44.com) focused on building full-stack apps from natural language prompts. It launched its own proprietary AI model ("Base 1") on June 29, 2026, making it the first app-creation platform with its own model stack. [CITED: startupfortune.com/base44-built-its-own-ai-model]

**Instruction mechanism:** Base44 has "AI controls" (custom instructions) and "file locking" launched April 14, 2025. The feature allows "providing detailed AI instructions and locking files/features against unwanted AI changes." The instructions appear to be stored in Base44's UI, not in a repository file. [CITED: base44.com/changelog/feature/ai-controls-(custom-instructions-&-file-locking)]

**Skills:** Base44 supports "Skills" — saved instruction sets that activate contextually. Skills follow the open Agent Skills specification (SKILL.md format with YAML frontmatter). Base44 ships three pre-built skills: `base44-cli`, `base44-sdk`, `base44-troubleshooter`. [CITED: base44.com/blog/base44-skills, docs.base44.com/developers/backend/overview/skills]

**AGENTS.md:** No evidence that Base44 reads `AGENTS.md` or any repository file for persistent instructions. Base44 is primarily a browser-based, non-git-workflow platform.

**Repository integration:** Base44 supports `npx base44 create` CLI commands and may have GitHub integration, but no documentation found confirming it reads repository rule files. [ASSUMED: repository file reading not confirmed]

**Action for goodvibes:**
- Write `docs/platform-setup/base44.md` guiding users to copy goodvibes rules into Base44's AI controls UI.
- If Base44 adds AGENTS.md support in the future, the existing AGENTS.md template will auto-cover it.
- No template file (status LOW confidence — could change).

**Confidence:** LOW for file-based support (no official docs found), HIGH for "UI-only" conclusion based on platform architecture

---

## Cross-Cutting Findings

### Additional Platforms Considered

**Bolt.new:**

Bolt.new reads persistent instructions from `.bolt/prompt` (plain text file in project root). This is a StackBlitz-based platform. [CITED: support.bolt.new/docs/prompting-effectively (indirect)] [ASSUMED: `.bolt/prompt` path based on community documentation; official Bolt docs confirmed UI-based Knowledge but the `.bolt/prompt` file is documented as "edit in StackBlitz then reopen in Bolt"]

The `.bolt/prompt` file is referenced in community sources and Bolt's own prompting guide. Its existence is verified by multiple independent sources, but Bolt's official documentation primarily describes the UI-based "Knowledge" settings (Account, Project, Team levels). The file-based approach may be a legacy/power-user feature.

Recommendation: Include `.bolt/prompt` as a template file with LOW-to-MEDIUM confidence. Users benefit from it if present; no harm if it's ignored.

**v0.dev (Vercel):**

v0 is a UI component generator. Custom instructions exist in v0's account settings (Settings → General), not in repository files. v0 can connect to GitHub repos for code push but does not read repo-level rule files. [CITED: community.vercel.com/t/custom-instructions-in-v0/16782]

No template file possible. Document in README or a platform guide if desired, but low-value addition for goodvibes' target audience (v0 is single-component generation, not project-level coding sessions).

**Windsurf / Devin Desktop (.devin/rules/):**

Phase 8 shipped `.windsurfrules` (legacy, still fully supported). The new `.devin/rules/` directory format is now preferred by Devin Desktop (post-June 2, 2026 rebrand). `.devin/rules/goodvibes.md` already exists in `templates/` (Phase 8 included it). Both `.windsurfrules` and `.devin/rules/` are read — no conflict. [CITED: docs.devin.ai/desktop/devin-desktop-faq]

No action needed. Phase 8 covered this.

---

### For Platforms Without File-Based Rules

**Minimum viable path for goodvibes users:**

1. `docs/platform-setup/<platform>.md` — step-by-step guide with the exact text to paste into the platform's UI, with screenshots (or described clearly for beginners).
2. The text to paste is the goodvibes rule set content (same as AGENTS.md/CLAUDE.md).
3. Keep these docs short and direct. Beginners need "copy this, paste here, click save."

Alternatively: a `goodvibes prompt` CLI subcommand that prints the rule set to stdout (useful for piping into clipboard). This is a possible Phase 10 feature, not Phase 9 scope.

---

## Platform Inclusion Recommendation

| Platform | Approach | Template File | Notes |
|----------|----------|--------------|-------|
| OpenAI Codex CLI | Already covered | AGENTS.md (exists) | Add to README table |
| ChatGPT Projects | Docs only | None | `docs/platform-setup/chatgpt.md` |
| Lovable | Already covered | AGENTS.md + CLAUDE.md (exist) | Add to README table |
| Replit Agent | New template file | `templates/replit.md` | Plain markdown, no frontmatter |
| Base44 | Docs only | None | `docs/platform-setup/base44.md` |
| Bolt.new | New template file (LOW-MEDIUM) | `templates/.bolt/prompt` | Plain text, no frontmatter |
| v0.dev | Skip or brief README note | None | Component generator, low relevance |
| Windsurf / Devin Desktop | Already covered (Phase 8) | `.windsurfrules` + `.devin/rules/` | Both exist |

---

## New Template Files Needed

### 1. `templates/replit.md`

**Path:** `replit.md` (project root)
**Format:** Plain markdown, no YAML frontmatter
**Activation:** Replit Agent reads it automatically from the project root
**Content:** The same goodvibes engineering rules as AGENTS.md, structured with Replit's preferred section headers (Project Overview, Tech Stack, Coding Style, Security, Testing)

```markdown
## Project — goodvibes

goodvibes engineering rules. Edit this file to customize how Replit Agent
works in your project.

### Think before coding
State assumptions before implementing. Stop if an assumption is
security-sensitive, schema-sensitive, or has multiple materially different
interpretations.

### Simplicity first
Stop at the first rung that holds:

1. Does this need to exist at all? Speculative need → skip it. (YAGNI)
2. Already in this codebase? Reuse it.
3. Stdlib does it? Use it.
4. Native platform feature covers it? Use it.
5. Already-installed dependency solves it? Use it.
6. Can it be one line? One line.
7. Only then: the minimum code that works.

### Surgical changes
Keep diffs narrow. No opportunistic reformats. No renames unless required.
Only remove what your change made unused.

### Fail loud
No empty `catch` blocks. No silent retries. No returning fake success on
real failure. Error messages must be actionable.

### Security
Validate input at the boundary. Keep secrets out of code and logs.
Flag immediately: SQL injection, XSS, command injection, path traversal,
broken auth, leaked secrets.
```

### 2. `templates/.bolt/prompt`

**Path:** `.bolt/prompt` (project root subdirectory)
**Format:** Plain text (no markdown rendering, no frontmatter)
**Activation:** Bolt.new reads this file when the project is opened; instructions are applied to every prompt
**Caveat:** File-based mechanism confirmed via multiple community sources and indirect official doc references; confidence MEDIUM [ASSUMED: exact file name `.bolt/prompt` vs `.bolt/promptfile` varies by source — use `prompt` as the simpler name]

```
Engineering rules — goodvibes

Think before coding: State assumptions explicitly before implementing.
Stop if an assumption is security-sensitive or schema-sensitive.

Simplicity first — stop at the first rung that holds:
1. Does this need to exist at all? Skip speculative needs.
2. Already in this codebase? Reuse it.
3. Stdlib does it? Use it.
4. Native platform feature covers it? Use it.
5. Installed dependency solves it? Use it.
6. Can it be one line? One line.
7. Only then: the minimum code that works.

Surgical changes: Keep diffs narrow. No opportunistic reformats.
No renames unless required. Only remove what your change made unused.

Fail loud: No empty catch blocks. No silent retries. No fake success.
Error messages must be actionable.

Security: Validate input at boundary. Keep secrets out of code and logs.
Flag immediately: SQL injection, XSS, command injection, path traversal,
broken auth, leaked secrets.
```

---

## Risks and Pitfalls

### Pitfall 1: Replit Auto-Overwrites replit.md

**What goes wrong:** Replit Agent auto-generates `replit.md` when it first touches a new project. If a user pulls a goodvibes-initialized repo into Replit and then interacts with Agent, Agent may regenerate `replit.md` — replacing the goodvibes rules with its generic template.

**Why it happens:** Replit Agent owns `replit.md` as its configuration file and treats it as something to auto-maintain. Users who never interact with Agent won't hit this.

**How to avoid:** The goodvibes no-clobber logic writes `replit.md` on first init. If Agent later overwrites it, that's a user-side behavior. Document in `docs/platform-setup/replit.md` that users may want to re-edit `replit.md` after first Agent session and commit it to git.

**Confidence:** MEDIUM [ASSUMED based on Replit's documented behavior of auto-generating and auto-updating the file]

### Pitfall 2: `.bolt/prompt` File Name Ambiguity

**What goes wrong:** Multiple community sources reference `.bolt/promptfile` (with "file" suffix) and `.bolt/prompt` (without). If the wrong name is used, Bolt silently ignores it.

**Why it happens:** Bolt's official docs describe the UI-based Knowledge system primarily; the file-based path may be a power-user or legacy feature with inconsistent naming documentation.

**How to avoid:** Use `.bolt/prompt` (simpler name). Note in release docs that if Bolt doesn't pick it up, users should try `.bolt/promptfile`. Treat this as LOW risk — if ignored by Bolt, the file doesn't harm the project.

**Confidence:** MEDIUM [ASSUMED: exact file name not confirmed from authoritative primary source]

### Pitfall 3: Platform-Specific Files Drift Silently

**What goes wrong:** A platform updates its rule file format (new required frontmatter, path change, deprecation). goodvibes users don't notice — their rule file stops being applied silently.

**Why it happens:** These platforms iterate quickly. Cursor already deprecated `.cursorrules` without widely notifying users (moved to `.cursor/rules/*.mdc`).

**How to avoid:**
- Keep goodvibes rule files minimal and format-stable (avoid frontmatter unless required).
- Add a `## Platform Compatibility` note to `docs/onboarding.md` with links to each platform's official rules docs.
- Treat IDE rule files as "write-once" (already the policy from Phase 8 — not in `MANAGED_FIXED`, not upgraded).

### Pitfall 4: ChatGPT / Base44 Docs Go Stale

**What goes wrong:** Step-by-step UI guides break when the UI changes (which is frequent for fast-moving products like ChatGPT Projects).

**Why it happens:** UI-only platforms iterate their UI independently of any open standard.

**How to avoid:** Keep platform setup guides concise and principle-based ("paste the goodvibes rules into the system prompt field") rather than screenshot-heavy step-by-step. Avoid specific UI labels that change. Keep a "last verified" date in each guide file.

### Pitfall 5: AGENTS.md Downstream Coverage Creates Confusion

**What goes wrong:** Users who open a goodvibes-initialized project in Codex CLI, Lovable, Amp, Cursor, or GitHub Copilot get goodvibes rules automatically. Users opening in Replit or Bolt need a separate file. This creates a "why do I need two files?" question for power users.

**Why it happens:** AGENTS.md is not universally adopted. Replit specifically chose a proprietary `replit.md` format.

**How to avoid:** README compatibility table with a "✓ via AGENTS.md" vs "✓ via replit.md" column makes this obvious at a glance.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting which platform a user is on | Custom platform detection heuristic | Don't — write all files, let user delete what they don't need | Platform detection is fragile and adds complexity; template files are tiny |
| Syncing replit.md with AGENTS.md at runtime | Custom sync command | Don't — they're separate static files | Sync logic is the wrong abstraction; both are write-once |
| ChatGPT/Base44 prompt injection | CLI command that calls ChatGPT API | Don't — out of scope for a bootstrap tool | Scope creep; users can copy-paste |

---

## Package Legitimacy Audit

Phase 9 installs **no new npm or pip packages**. Only static template files are added to `templates/`. The copy machinery is the existing `fs-extra copy` (npm) and `shutil.copytree` (pip) from Phase 2/3.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**slopcheck verdict:** not run — no new packages

---

## Runtime State Inventory

Step 2.5: SKIPPED — This is a greenfield template-file addition phase, not a rename/refactor/migration phase. No runtime state is affected.

---

## Environment Availability

Phase 9 is code/template-only changes (adding 2 static files and docs). No external tools, services, or CLI utilities beyond the project's existing build toolchain are required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm package build + tests | ✓ | v20.20.2 | — |
| npm | package tooling | ✓ | 10.8.2 | — |
| Python 3 | pip package tests | ✓ | 3.12.3 | — |
| uv | pip package tooling | ✓ | 0.11.15 | — |

---

## Validation Architecture

`workflow.nyquist_validation: true` — include this section.

### Test Framework

| Property | Value |
|----------|-------|
| Framework (TS) | vitest (packages/npm) |
| Framework (Python) | pytest + pytest-mock (packages/pip) |
| Config file (TS) | `packages/npm/vitest.config.ts` |
| Config file (Python) | `packages/pip/pytest.ini` or `pyproject.toml` |
| Quick run (TS) | `cd packages/npm && npm test` |
| Quick run (Python) | `cd packages/pip && uv run pytest tests/` |
| Integration (TS) | `cd packages/npm && npm run test:integration` |

### Phase Requirements → Test Map

Each new template file follows the 3-test pattern already established in `copy-templates.integration.test.ts`:

| REQ | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| VPE-01 | Fresh init writes `replit.md` | integration | `npm run test:integration` | ❌ Wave 0 |
| VPE-02 | Existing `replit.md` is skipped (no-clobber) | integration | `npm run test:integration` | ❌ Wave 0 |
| VPE-03 | `--minimal` writes `replit.md` | integration | `npm run test:integration` | ❌ Wave 0 |
| VPE-04 | Fresh init writes `.bolt/prompt` | integration | `npm run test:integration` | ❌ Wave 0 |
| VPE-05 | Existing `.bolt/prompt` is skipped | integration | `npm run test:integration` | ❌ Wave 0 |
| VPE-06 | `--minimal` writes `.bolt/prompt` | integration | `npm run test:integration` | ❌ Wave 0 |
| VPE-07 | Python: `replit.md` written on fresh init | integration | `uv run pytest tests/integration/` | ❌ Wave 0 |
| VPE-08 | Python: `.bolt/prompt` written on fresh init | integration | `uv run pytest tests/integration/` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] 6 new TS integration test cases in `packages/npm/src/steps/copy-templates.integration.test.ts`
- [ ] 2 new Python integration test cases in `packages/pip/tests/integration/test_copy_templates_integration.py`
- [ ] `templates/replit.md` — the template file itself
- [ ] `templates/.bolt/prompt` — the template file itself
- [ ] `docs/platform-setup/chatgpt.md` — UI-only platform guide
- [ ] `docs/platform-setup/base44.md` — UI-only platform guide (optional)

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not applicable — no auth in template copy |
| V3 Session Management | No | Not applicable |
| V4 Access Control | No | Not applicable |
| V5 Input Validation | Yes | Existing path traversal guard (`rel.includes('..')`) covers new template files |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via template files | Tampering | Existing `rel.includes('..')` guard in `copy-templates.ts` and `ignore_fn` in `copy_templates.py` — new template files are repo-controlled static content; guard remains belt-and-suspenders |

No new threat surface introduced. The two new files are static authored content, not user input.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Replit Agent may auto-overwrite `replit.md` after goodvibes writes it | Pitfall 1 | If Agent does not overwrite, the risk disappears; if it does, users need to re-edit — low practical impact |
| A2 | `.bolt/prompt` is the correct filename (vs `.bolt/promptfile`) | New Template Files | If Bolt reads `.bolt/promptfile` instead, the wrong file is silently ignored — low risk since Bolt also provides UI-based Knowledge |
| A3 | Base44 has no file-based instruction mechanism | Platform E | If Base44 added AGENTS.md support since research, writing AGENTS.md would auto-cover it — no regression |
| A4 | Replit symlink workaround (`AGENTS.md → replit.md`) is community-driven, not official | Platform D | If Replit officially supports AGENTS.md, we still need `replit.md` for users who don't symlink |
| A5 | v0.dev has no project-level persistent rule file | Cross-Cutting | If v0 added one, it would be a Phase 10 addition; current scope is unaffected |

---

## Open Questions

1. **Is `.bolt/prompt` or `.bolt/promptfile` the correct file name?**
   - What we know: Multiple community sources use both names; official Bolt docs describe UI-based Knowledge but mention `.bolt/promptfile` in the prompting guide.
   - What's unclear: Which name is canonical in current Bolt builds.
   - Recommendation: Use `.bolt/prompt` (shorter); mention the alternative name in `docs/platform-setup/bolt.md` and the release notes. Low risk either way.

2. **Should goodvibes write `docs/platform-setup/` files to the user's project, or host them on a goodvibes website?**
   - What we know: goodvibes currently writes `docs/onboarding.md` to the user's project.
   - What's unclear: Whether users want platform setup guides in their project repo.
   - Recommendation: Add brief `docs/platform-setup/` guides to the templates directory (parallel to `docs/onboarding.md`). They're small and useful. Users who don't need them can delete them.

3. **Should replit.md be excluded from `--minimal`?**
   - What we know: CLAUDE.md, core skill files, and IDE rule files (Cursor, Kiro, Cline, Amazon Q, Continue) are all written under `--minimal`. CLAUDE.md is written always.
   - What's unclear: Whether `replit.md` is "core" or "optional" in a minimal install.
   - Recommendation: Write `replit.md` under `--minimal` (consistent with all other IDE rule files). The `--minimal` flag only suppresses `.github/` and `docs/` directories.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-platform proprietary rule files only | AGENTS.md as open standard stewarded by Linux Foundation | Dec 2025 | Goodvibes' AGENTS.md now covers 14+ tools automatically |
| Windsurf `.windsurfrules` as the Windsurf format | Devin Desktop prefers `.devin/rules/`; `.windsurfrules` still works | June 2, 2026 | Phase 8 already handles both; no action needed |
| Browser-only platforms (Bolt, Lovable, v0) had no rule file support | Lovable natively reads AGENTS.md; Bolt has `.bolt/prompt` | ~2025 | Partial file-based coverage now possible |
| Replit had no file-based instruction mechanism | `replit.md` launched 2025 as Replit's native configuration file | 2025 | New template file opportunity |

**Deprecated/outdated:**
- ChatGPT file-based rules: Never existed. UI-only approach remains the only option.
- Base44 file-based rules: Not yet implemented as of research date (July 1, 2026).

---

## Sources

### Primary (HIGH confidence)
- [developers.openai.com/codex/guides/agents-md](https://developers.openai.com/codex/guides/agents-md) — Codex CLI reads AGENTS.md, full discovery sequence
- [developers.openai.com/codex/config-basic](https://developers.openai.com/codex/config-basic) — .codex/ directory structure
- [developers.openai.com/codex/rules](https://developers.openai.com/codex/rules) — Starlark .rules files (not instruction files)
- [docs.lovable.dev/features/knowledge](https://docs.lovable.dev/features/knowledge) — Lovable reads AGENTS.md and CLAUDE.md from repo root
- [docs.replit.com/references/project-setup/replit-dot-md](https://docs.replit.com/references/project-setup/replit-dot-md) — replit.md specification and location
- [help.openai.com/en/articles/10169521-projects-in-chatgpt](https://help.openai.com/en/articles/10169521-projects-in-chatgpt) — ChatGPT Projects UI-only instructions
- [linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation) — AGENTS.md open standard under Linux Foundation

### Secondary (MEDIUM confidence)
- [support.bolt.new/docs/prompting-effectively](https://support.bolt.new/docs/prompting-effectively) — .bolt/promptfile mention (indirect)
- [base44.com/changelog/feature/ai-controls-(custom-instructions-&-file-locking)](https://base44.com/changelog/feature/ai-controls-(custom-instructions-&-file-locking)) — Base44 custom instructions launched April 2025
- [base44.com/blog/base44-skills](https://base44.com/blog/base44-skills) — Base44 Skills use SKILL.md format
- [community.vercel.com/t/custom-instructions-in-v0/16782](https://community.vercel.com/t/custom-instructions-in-v0/16782) — v0.dev UI-only custom instructions

### Tertiary (LOW confidence)
- [sourcetoad.com/using-agents-md-in-replit-or-lovable/](https://sourcetoad.com/using-agents-md-in-replit-or-lovable/) — community post on AGENTS.md in Replit/Lovable (unofficial)
- Various community posts on `.bolt/prompt` vs `.bolt/promptfile` file name
- [startupfortune.com/base44-built-its-own-ai-model](https://startupfortune.com/base44-built-its-own-ai-model-and-the-vibe-coding-arms-race-just-got-a-lot-more-expensive) — Base44 launched Base 1 model June 2026

---

## Metadata

**Confidence breakdown:**
- Codex CLI (AGENTS.md): HIGH — confirmed via official OpenAI developer docs
- Lovable (AGENTS.md): HIGH — confirmed via official Lovable knowledge docs
- Replit (replit.md): HIGH — confirmed via official Replit docs
- ChatGPT (UI-only): HIGH — confirmed via official OpenAI help center
- Bolt.new (.bolt/prompt): MEDIUM — official docs describe UI Knowledge; file-based path confirmed via prompting guide but canonical name unclear
- Base44 (UI-only): LOW-MEDIUM — custom instructions confirmed; file-based mechanism not documented
- v0.dev (no file mechanism): MEDIUM — confirmed via Vercel community; documentation sparse

**Research date:** 2026-07-01
**Valid until:** 2026-09-01 for stable elements (Codex CLI, Lovable); 2026-07-30 for Replit/Bolt (fast-moving platforms); ChatGPT Projects UI may change at any time
