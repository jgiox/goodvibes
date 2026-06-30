# Phase 8: Multi-IDE Expansion - Research

**Researched:** 2026-06-30
**Domain:** AI IDE rule file formats (Cursor, GitHub Copilot, Windsurf/Devin Desktop, Kiro)
**Confidence:** HIGH (Cursor, Copilot, Windsurf), MEDIUM (Kiro — no size limit found in official docs)

---

## Summary

Phase 8 adds four static template files to the `templates/` directory and extends the `--minimal` filter in both CLIs to include/exclude them correctly. No new runtime dependencies are needed. The existing `fs-extra copy` + `shutil.copytree` machinery already handles nested directory creation, so `.cursor/rules/goodvibes.mdc` and `.kiro/steering/goodvibes.md` require no changes to the copy mechanism — they just need to exist as template files and be walked by the existing code.

The most important design decision is that IDE rule files are NOT sentinel-mergeable (they have no sentinel comment syntax analogous to HTML comments in CLAUDE.md). They therefore obey simple no-clobber logic: write on first run, skip on subsequent runs. This matches the existing behavior of all non-CLAUDE.md template files. The upgrade command's `MANAGED_FIXED` set should NOT include IDE rule files — once a user has an IDE rule file, goodvibes should leave it alone.

Windsurf has rebranded to Devin Desktop (June 2, 2026). The `.windsurfrules` file is still fully supported with no removal timeline announced. It remains the simplest format for a "write once, always active" rule.

**Primary recommendation:** Add four static template files (one per IDE) in the correct paths, extend the `--minimal` guard in `copy-templates.ts` and `copy_templates.py` to exclude only `.github/copilot-instructions.md` (already covered by the existing `.github/` exclusion), and update `MANAGED_FIXED` awareness in `upgrade.ts` to leave IDE rule files untouched after first write.

---

## Project Constraints (from CLAUDE.md)

- **Ponytail (full mode):** Fewest files, shortest diff, no abstractions without need. Deletion over addition.
- **Surgical changes:** Touch only what the task requires. No opportunistic reformats.
- **Fail loud:** No empty catch blocks, no silent failures.
- **Security:** Input validation at trust boundaries. Path traversal guard already exists (`rel.includes('..')`).
- **License:** Apache 2.0 — all template content authored by goodvibes; no third-party content to license.
- **Zero-config:** No user prompts. IDE rule files are written unconditionally (subject to no-clobber).
- **Beginner-first:** Error messages must be plain English.
- **Testing:** Every exported public function gets at least one test. Use vitest (TS) / pytest+pytest-mock (Python). Test names are sentences.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IDE-01 | Write `.cursor/rules/goodvibes.mdc`, `.github/copilot-instructions.md`, `.windsurfrules`, `.kiro/steering/goodvibes.md` during `goodvibes init` | Template files + existing copy machinery handles nested dirs |
| IDE-02 | Each file encodes same principles as CLAUDE.md, adapted to native format | MDC frontmatter for Cursor, plain markdown for Copilot/Windsurf, YAML frontmatter for Kiro |
| IDE-03 | No-clobber: existing user IDE rule files counted as "skipped" | Existing `overwrite: false` + `ignore_fn` logic covers this without code changes |
| IDE-04 | `--minimal` excludes `.github/copilot-instructions.md`; Cursor/Windsurf/Kiro written by `--minimal` | `.github/` exclusion already blocks copilot-instructions; other IDE files need no special handling |
| IDE-05 | README + template repo updated with multi-IDE compatibility table | Additive README section, no code change |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Template file authoring | Static files (templates/) | — | All four IDE rule files are static markdown/MDC; authored once, copied verbatim |
| File copy to user project | CLI (npm + pip copy step) | — | Existing `copyTemplates` / `copy_templates` machinery; no new tier needed |
| No-clobber enforcement | CLI (copy-templates filter) | — | Already handled by `overwrite: false` and `ignore_fn`; IDE files get same treatment as JOURNAL.md |
| --minimal exclusion | CLI (copy-templates filter) | — | Copilot file auto-excluded by existing `.github/` guard; no new filter logic needed |
| README compatibility table | Static docs (README.md) | — | Additive markdown section |

---

## IDE Rule File Formats

### Cursor: `.cursor/rules/goodvibes.mdc`

**Format:** MDC (Markdown with YAML frontmatter). Extension must be `.mdc`. [CITED: cursor.com/docs/rules]

**Frontmatter fields:** [CITED: cursor.com/docs/rules]
```yaml
---
description: <string>   # required for "agent-requested" mode; ignored when alwaysApply:true
globs: <pattern|array>  # file patterns; required for "auto-attach" mode
alwaysApply: <bool>     # true = inject into every request
---
```

**Four activation modes** (determined by field combination):
| Mode | alwaysApply | globs | description |
|------|------------|-------|-------------|
| Always Apply | `true` | any | any |
| Auto-Attach | `false` | set | any |
| Agent-Requested | `false` | absent | set |
| Manual only | `false` | absent | absent |

**For goodvibes:** Use `alwaysApply: true`. The engineering rules must always be in context — equivalent to CLAUDE.md's always-on behavior. [ASSUMED]

**Size guidance:** Best-practice recommendation is under 500 lines per file; keep always-apply rules under 200 words to minimize token cost. No hard character limit documented. [CITED: cursor.com/docs/rules, medium.com/@ror.venkat/mastering-mdc-files-in-cursor]

**Deprecation:** `.cursorrules` (legacy, single root file) is deprecated as of Cursor 0.43. `.cursor/rules/*.mdc` is the current system (Cursor 0.45+). [CITED: flowql.com/en/blog/guides/cursor-rules-deprecated-libraries]

**Directory creation:** The `fs-extra copy` function and `shutil.copytree` both create intermediate directories. The template file at `templates/.cursor/rules/goodvibes.mdc` will cause `.cursor/rules/` to be created in the destination. No CLI code changes needed. [VERIFIED: confirmed by reading copy-templates.ts — `copy(templateDir, destDir, { overwrite: false })` recurses the full directory tree]

**No-clobber with existing `.cursor/rules/`:** The filter in `copy-templates.ts` skips files that already exist at the destination (`overwrite: false`). If a user already has `.cursor/rules/goodvibes.mdc`, it will be skipped and reported as such. If they have other `.mdc` files, those are untouched (goodvibes only touches its own file). [VERIFIED: reading copy-templates.ts lines 82-98]

---

### GitHub Copilot: `.github/copilot-instructions.md`

**Format:** Plain Markdown, no frontmatter for repository-wide instructions. Natural language instructions. [CITED: docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot]

**Activation:** Automatically applied to all Copilot Chat requests in VS Code when the file exists at `.github/copilot-instructions.md`. No user configuration needed in VS Code settings (enabled by default). [CITED: docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot]

**Character limit:** Hard limit of 4,000 characters was removed as of June 2026. Best-practice recommendation: keep under 1,000 lines for quality. [CITED: github.com/github/docs/issues/42761, docs.github.com]

**`--minimal` behavior:** The existing filter `rel.startsWith('.github')` in `copy-templates.ts` already excludes `.github/copilot-instructions.md` under `--minimal`. IDE-04 is satisfied without any code change to the filter. [VERIFIED: reading copy-templates.ts line 89]

**Note:** The `.github/` exclusion under `--minimal` means that if a user runs `--minimal`, they get Cursor, Windsurf, and Kiro rules but NOT the Copilot instructions. This is exactly what IDE-04 requires.

---

### Windsurf / Devin Desktop: `.windsurfrules`

**Format:** Free-form Markdown, **no frontmatter**. Plain text instructions applied to every Cascade conversation in the workspace. [CITED: skillwright.app/blog/windsurf-rules-guide]

**Current status:** Windsurf rebranded to Devin Desktop on June 2, 2026. The `.windsurfrules` file at the workspace root is still fully read and supported. The new `.devin/rules/` directory format exists alongside it for more granular control, but `.windsurfrules` requires no migration. [CITED: docs.devin.ai/desktop/devin-desktop-faq]

**Hard character limit:** 12,000 characters per workspace rule file. Global rules limited to 6,000 characters. Windsurf silently drops content beyond the limit. [CITED: skillwright.app/blog/windsurf-rules-guide]

**For goodvibes:** Use `.windsurfrules` (root file, no frontmatter, always-on). The goodvibes rule content is well under 12,000 characters. The directory-based `.devin/rules/` approach is more flexible but adds complexity for no benefit — `.windsurfrules` is simpler and still fully supported. [ASSUMED: choosing .windsurfrules over .devin/rules/ for simplicity]

**No `.devinrules` equivalent exists** — there is no single-file `.devinrules` analogue to `.windsurfrules`. The `.windsurfrules` file is the correct choice for the simple, always-on use case. [CITED: docs.devin.ai/desktop/devin-desktop-faq]

---

### Kiro: `.kiro/steering/goodvibes.md`

**Format:** Markdown with YAML frontmatter. Extension is `.md`. [CITED: kiro.dev/docs/steering/]

**Frontmatter schema:** [CITED: kiro.dev/docs/steering/]
```yaml
---
inclusion: always        # always | fileMatch | manual | auto
# For fileMatch mode (not used by goodvibes):
# fileMatchPattern: "src/**/*.ts"
# For auto mode (not used by goodvibes):
# name: rule-name
# description: "what the rule does"
---
```

**Inclusion modes:**
| Mode | Required fields | When loaded |
|------|----------------|-------------|
| `always` | `inclusion` only | Every request |
| `fileMatch` | `inclusion`, `fileMatchPattern` | When editing matching files |
| `manual` | `inclusion` only | Only when explicitly referenced |
| `auto` | `inclusion`, `name`, `description` | When agent decides it's relevant |

**For goodvibes:** Use `inclusion: always`. Engineering rules must always be active. [ASSUMED]

**Size limit:** Not documented in official Kiro docs. No hard character limit found after checking kiro.dev/docs/steering/ and related community sources. [ASSUMED: no limit, but keep content concise per the ponytail ruleset]

**File location:** `.kiro/steering/` at workspace root. Global steering goes in `~/.kiro/steering/` but goodvibes writes project-scoped files only. [CITED: kiro.dev/docs/steering/]

**Directory creation:** Same as Cursor — `templates/.kiro/steering/goodvibes.md` causes the copy machinery to create `.kiro/steering/` in the destination. [VERIFIED: same mechanism as .cursor/rules/]

---

## Standard Stack

This phase adds **no new dependencies**. All implementation uses:

| Component | Already Present | Version |
|-----------|----------------|---------|
| `fs-extra copy` | Yes | ^11.3.6 (npm) |
| `shutil.copytree` | Yes | stdlib (Python) |
| Template directory walk | Yes | existing `walkDir` / `rglob` |
| No-clobber logic | Yes | `overwrite: false` + `ignore_fn` |

### Package Legitimacy Audit

No new packages are being installed in Phase 8. Existing packages verified:

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| `fs-extra` | npm (v11.3.6) | — (existing) | Approved — already in use |
| `execa` | npm (v9.6.1) | — (existing) | Approved — already in use |
| `commander` | npm (v15.0.0) | — (existing) | Approved — already in use |
| `typer` | PyPI (v0.26.8) | — (existing) | Approved — already in use |
| `rich` | PyPI (v15.0.0) | — (existing) | Approved — already in use |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
goodvibes init
      │
      ▼
copyTemplates(templateDir, destDir, minimal, projectType)
      │
      ├─ filter: minimal && rel.startsWith('.github') → skip
      │   (catches .github/copilot-instructions.md — IDE-04)
      │
      ├─ overwrite: false (fs-extra copy)
      │   walks templates/ tree recursively
      │   creates dirs as needed (.cursor/rules/, .kiro/steering/)
      │
      ├─ new template file: .cursor/rules/goodvibes.mdc ─────→ dest
      ├─ new template file: .github/copilot-instructions.md ─→ dest (skipped if --minimal)
      ├─ new template file: .windsurfrules ──────────────────→ dest
      └─ new template file: .kiro/steering/goodvibes.md ────→ dest
                                    │
                                    ▼
                         written[] / skipped[]
```

The only code change in the CLIs is **none at all** for the copy path — the existing machinery already handles it. The only CLI changes are:
1. `upgrade.ts` `MANAGED_FIXED` set: IDE rule files should NOT be added (leave user-edited after first install)
2. `upgrade.ts` `computeChanges`: no change needed (IDE files not in managed set)

### Recommended Template File Additions

```
templates/
├── .cursor/
│   └── rules/
│       └── goodvibes.mdc        ← NEW
├── .github/
│   └── copilot-instructions.md  ← NEW (excluded by --minimal via existing .github/ guard)
├── .kiro/
│   └── steering/
│       └── goodvibes.md         ← NEW
├── .windsurfrules               ← NEW
└── (existing files unchanged)
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subdirectory creation during copy | Manual `mkdirSync` before copy | Existing `fs-extra copy` | Already creates intermediate dirs recursively |
| File existence check for no-clobber | Custom guard per file | Existing `overwrite: false` + `ignore_fn` | Pattern already handles all template files; IDE files get it for free |
| IDE-specific merge logic | Sentinel merge for .mdc/.md files | Simple no-clobber (skip if exists) | IDE rule files have no standard sentinel comment syntax; users who customize them should keep their edits |

**Key insight:** This phase is almost entirely content (template files), not code. The planner should resist the temptation to add new code paths — the existing copy machinery already does what's needed.

---

## Common Pitfalls

### Pitfall 1: Adding IDE rule files to `MANAGED_FIXED` in upgrade.ts

**What goes wrong:** If `.cursor/rules/goodvibes.mdc`, `.windsurfrules`, and `.kiro/steering/goodvibes.md` are added to `MANAGED_FIXED`, the upgrade command would overwrite user-customized rule files on every `goodvibes upgrade` run.

**Why it happens:** CLAUDE.md is treated as managed (sentinel merge preserves user content). IDE rule files have no sentinel mechanism — overwriting them would silently destroy user edits.

**How to avoid:** Do NOT add IDE rule files to `MANAGED_FIXED`. The upgrade command should ignore them after first install. The `computeChanges` function only computes changes for files in the managed set — IDE files stay out of it.

**Warning signs:** Any plan task that says "add IDE paths to MANAGED_FIXED" is wrong.

---

### Pitfall 2: Checking for `.cursorrules` (legacy) before writing `.cursor/rules/goodvibes.mdc`

**What goes wrong:** If goodvibes checks for the presence of `.cursorrules` and uses that to decide whether to skip writing `.cursor/rules/goodvibes.mdc`, users with the legacy format get no Cursor rules at all.

**Why it happens:** IDE-03 says "does not overwrite existing rules" — a reader might interpret "existing rules" as any Cursor rule file.

**How to avoid:** No-clobber applies to the specific destination file (`.cursor/rules/goodvibes.mdc`). If the user has `.cursorrules`, goodvibes still writes `.cursor/rules/goodvibes.mdc` (both can coexist). Only skip if `.cursor/rules/goodvibes.mdc` itself already exists. The existing `overwrite: false` behavior already does this correctly — it checks the exact destination path.

---

### Pitfall 3: Frontmatter order in Kiro steering files

**What goes wrong:** Kiro requires frontmatter to be the very first content in the file — no blank lines before the opening `---`. If the template file has any whitespace or content before the frontmatter, Kiro will not parse the inclusion mode and the rule may not activate.

**Why it happens:** Careless template authoring.

**How to avoid:** Ensure `templates/.kiro/steering/goodvibes.md` starts with `---` on line 1.

---

### Pitfall 4: Windsurf character limit silent truncation

**What goes wrong:** If `.windsurfrules` content exceeds 12,000 characters, Windsurf silently drops the rest. No error is shown to the user.

**Why it happens:** Windsurf enforces a hard 12,000 character limit per workspace rule file.

**How to avoid:** Keep `.windsurfrules` content under 3,000 characters (well within limit). The ponytail ruleset content from CLAUDE.md translated to Windsurf format should be under 1,500 characters.

---

### Pitfall 5: MDC file named without `.mdc` extension

**What goes wrong:** Cursor ignores files in `.cursor/rules/` that do not have the `.mdc` extension. A file named `goodvibes.md` would not be loaded.

**Why it happens:** The file looks like markdown but the extension is different.

**How to avoid:** Template file must be `templates/.cursor/rules/goodvibes.mdc` (not `.md`).

---

### Pitfall 6: --minimal test coverage gap

**What goes wrong:** The existing `--minimal` tests check that `.github/ISSUE_TEMPLATE` and `docs/` are skipped. They do NOT test that `.github/copilot-instructions.md` is skipped by `--minimal` or that `.cursor/rules/goodvibes.mdc` is written by `--minimal`.

**Why it happens:** Tests were written before IDE files existed.

**How to avoid:** Phase 8 plans must add new unit tests covering: (a) `--minimal` skips `.github/copilot-instructions.md`, (b) `--minimal` writes `.cursor/rules/goodvibes.mdc`, `.windsurfrules`, and `.kiro/steering/goodvibes.md`.

---

## Content Design: CLAUDE.md → IDE Rule Adaptation

Each IDE rule file must encode the same principles as CLAUDE.md but NOT be a verbatim copy (IDE-02). The adaptation rules:

### What to preserve
- Ponytail ladder (7 rungs) — the most actionable part
- Fail loud (no empty catch, no silent retries)
- Surgical changes (narrow diffs, no opportunistic reformats)
- Security checklist (the "flag immediately" list)
- Think before coding (state assumptions)

### What to omit / adapt
- The HTML sentinel comments (`<!-- goodvibes:start -->`) — remove entirely from IDE files; they serve no purpose in Cursor/Windsurf/Kiro
- The version stamp (`# goodvibes: v1.3.0`) — not needed in IDE files (no sentinel-merge machinery)
- Testing conventions (vitest/pytest) — these are Claude Code-specific; IDE rule files should focus on coding principles
- Journal requirement — Claude Code-specific workflow

### Format per IDE
| IDE | Format | Frontmatter | Activation |
|-----|--------|-------------|------------|
| Cursor `.cursor/rules/goodvibes.mdc` | MDC | `alwaysApply: true` | Every Cursor AI request |
| Copilot `.github/copilot-instructions.md` | Plain markdown | None | All Copilot Chat requests |
| Windsurf `.windsurfrules` | Plain markdown | None | Every Cascade conversation |
| Kiro `.kiro/steering/goodvibes.md` | Markdown + YAML frontmatter | `inclusion: always` | Every Kiro agent request |

---

## Code Examples

### Cursor MDC frontmatter (verified format)

```
---
alwaysApply: true
---

## Engineering Rules — goodvibes

### Simplicity first
...
```
[CITED: cursor.com/docs/rules]

### Kiro steering frontmatter (verified format)

```
---
inclusion: always
---

## Engineering Rules — goodvibes

### Simplicity first
...
```
[CITED: kiro.dev/docs/steering/]

### Windsurf format (no frontmatter)

```markdown
## Engineering Rules — goodvibes

### Simplicity first
...
```
[CITED: skillwright.app/blog/windsurf-rules-guide]

### Copilot instructions (no frontmatter for repo-wide file)

```markdown
## Engineering Rules — goodvibes

### Simplicity first
...
```
[CITED: docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot]

### No-clobber behavior (existing, no change needed)

The copy filter in `copy-templates.ts` already handles no-clobber for all template files:

```typescript
// Already in copy-templates.ts — IDE files get this for free
await copy(templateDir, destDir, {
  overwrite: false,        // ← IDE rule files skipped if dest exists
  errorOnExist: false,
  filter: (src: string) => {
    const rel = relative(templateDir, src)
    if (minimal && (rel.startsWith('.github') || rel.startsWith('docs'))) return false
    // .cursor/rules/, .windsurfrules, .kiro/steering/ pass through unfiltered
    return true
  },
})
```

In Python (`copy_templates.py`), the `ignore_fn` skips `dest_candidate.is_file()` — IDE files inherit the same no-clobber behavior.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.cursorrules` (single root file) | `.cursor/rules/*.mdc` | Cursor 0.43 deprecated; 0.45 new system | Must use `.mdc` extension and subdirectory |
| Windsurf brand | Devin Desktop brand | June 2, 2026 | `.windsurfrules` still works; no `.devinrules` single-file equivalent |
| GitHub Copilot 4,000-char limit | No hard character limit | June 2026 | Full rule set can be included without truncation risk |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (TS), pytest + pytest-mock (Python) |
| Config file | `packages/npm/vitest.config.ts`, `packages/pip/pyproject.toml` |
| Quick run command | `npm test` (from `packages/npm/`), `pytest` (from `packages/pip/`) |
| Full suite command | same (no separate integration suite for copy-templates) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IDE-01 | `init` writes all four IDE rule files | unit | `npm test -- --reporter verbose` | ❌ Wave 0 |
| IDE-03 | No-clobber: existing IDE file → skipped | unit | `npm test` | ❌ Wave 0 |
| IDE-04 | `--minimal` skips `.github/copilot-instructions.md` | unit | `npm test` | ❌ Wave 0 |
| IDE-04 | `--minimal` writes `.cursor/rules/goodvibes.mdc` | unit | `npm test` | ❌ Wave 0 |
| IDE-04 | `--minimal` writes `.windsurfrules` | unit | `npm test` | ❌ Wave 0 |
| IDE-04 | `--minimal` writes `.kiro/steering/goodvibes.md` | unit | `npm test` | ❌ Wave 0 |

### Wave 0 Gaps

- [ ] New test cases in `packages/npm/src/steps/copy-templates.test.ts` — IDE file presence assertions
- [ ] New test cases in `packages/pip/tests/test_copy_templates.py` — Python parity
- [ ] Template files themselves: `.cursor/rules/goodvibes.mdc`, `.github/copilot-instructions.md`, `.windsurfrules`, `.kiro/steering/goodvibes.md`

*(The `resolveTemplatesDir()` integration test already picks up new template files automatically — no test change needed for that.)*

---

## Environment Availability

Step 2.6: SKIPPED — Phase 8 is code/template-only changes. No external tools, services, or CLI utilities beyond the project's existing build toolchain are required.

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
| Path traversal via template files | Tampering | Existing `rel.includes('..')` guard in `copy-templates.ts` line 88 and `ignore_fn` in `copy_templates.py` lines 58-62 — new IDE template files are repo-controlled static files; guard remains belt-and-suspenders |

No new threat surface introduced. The IDE rule files are static authored content, not user input.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `alwaysApply: true` is the right mode for `goodvibes.mdc` in Cursor | Code Examples | If users prefer auto-attach or agent-requested mode, they can edit the file after first install (no-clobber protects edits) — low risk |
| A2 | `inclusion: always` is the right mode for Kiro steering file | Code Examples | Same as A1 — user can edit after install |
| A3 | `.windsurfrules` (not `.devin/rules/`) is the right target for Windsurf/Devin Desktop users | IDE Rule File Formats | If Windsurf removes `.windsurfrules` support (no timeline announced), users on Devin Desktop would need to migrate to `.devin/rules/` manually. Low risk given no removal timeline. |
| A4 | Kiro steering files have no hard size limit | IDE Rule File Formats (Kiro section) | If a limit exists and the content exceeds it, the rule may be silently truncated. Mitigated by keeping content under 2,000 characters. |
| A5 | GitHub Copilot activates `.github/copilot-instructions.md` by default with no VS Code setting change needed | IDE Rule File Formats (Copilot section) | If users need to enable a VS Code setting (`github.copilot.chat.codeGeneration.useInstructionFiles`), the README compatibility table (IDE-05) should document this step. |

---

## Open Questions

1. **Does Copilot require a VS Code setting to activate `copilot-instructions.md`?**
   - What we know: The GitHub docs say the file is "automatically applied"; but some sources mention a `useInstructionFiles` setting
   - What's unclear: Whether the setting is enabled by default or must be toggled
   - Recommendation: Document the setting in the README compatibility table (IDE-05) as "check VS Code settings if rules don't activate"

2. **Should `.kiro/steering/goodvibes.md` use `inclusion: auto` instead of `inclusion: always`?**
   - What we know: `auto` mode has Kiro's agent decide when to load the rule; `always` loads it on every request
   - What's unclear: Token cost tradeoff for Kiro users
   - Recommendation: Default to `inclusion: always` (consistent with CLAUDE.md always-on behavior); users can change inclusion mode

3. **Should `goodvibes upgrade` ever update IDE rule files?**
   - What we know: CLAUDE.md is upgraded via sentinel merge; other template files are in MANAGED_FIXED; IDE rule files have no sentinel mechanism
   - What's unclear: User expectation — would they want engineering rule improvements to propagate?
   - Recommendation: Leave IDE rule files out of `MANAGED_FIXED` for now. No-clobber on first install, never touched by upgrade. This is the safest default (avoids destroying user customizations). Can revisit in v1.3.0.

---

## Sources

### Primary (HIGH confidence)
- [cursor.com/docs/rules](https://cursor.com/docs/rules) — official Cursor MDC frontmatter schema
- [docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot) — official Copilot instructions format
- [kiro.dev/docs/steering/](https://kiro.dev/docs/steering/) — official Kiro steering frontmatter schema
- [docs.devin.ai/desktop/devin-desktop-faq](https://docs.devin.ai/desktop/devin-desktop-faq) — Windsurf/Devin Desktop `.windsurfrules` support status

### Secondary (MEDIUM confidence)
- [skillwright.app/blog/windsurf-rules-guide](https://www.skillwright.app/blog/windsurf-rules-guide) — Windsurf 12,000 char limit, format details
- [github.com/github/docs/issues/42761](https://github.com/github/docs/issues/42761) — Copilot 4,000-char limit removed June 2026
- [flowql.com/en/blog/guides/cursor-rules-deprecated-libraries](https://www.flowql.com/en/blog/guides/cursor-rules-deprecated-libraries) — `.cursorrules` deprecated in Cursor 0.43

### Tertiary (LOW confidence)
- Community forum and blog posts on MDC rule sizing (500-line guideline, 200-word always-apply guidance)

---

## Metadata

**Confidence breakdown:**
- Cursor MDC format: HIGH — fetched from cursor.com/docs/rules
- GitHub Copilot format: HIGH — fetched from official GitHub docs
- Windsurf/Devin Desktop: HIGH — confirmed at docs.devin.ai
- Kiro format: MEDIUM — confirmed at kiro.dev/docs/steering/; size limit not documented
- No-clobber behavior analysis: HIGH — directly read from copy-templates.ts and copy_templates.py source
- Upgrade command impact: HIGH — directly read from upgrade.ts MANAGED_FIXED set

**Research date:** 2026-06-30
**Valid until:** 2026-09-30 for stable elements (Kiro/Cursor/Copilot formats); 2026-07-30 for Windsurf/Devin Desktop (rebranding is recent)
