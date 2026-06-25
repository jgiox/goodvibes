# Phase 5: Upgrade Command & Template Repo — Research

**Researched:** 2026-06-25
**Domain:** CLI subcommand design, version-stamp diffing, GitHub template repo publishing
**Confidence:** HIGH

---

## Summary

Phase 5 implements `goodvibes upgrade` — a command that re-syncs goodvibes-managed files
(CLAUDE.md sentinel block, skill files, CI workflows) to the version bundled in the currently
installed package — and publishes the `jgiox/goodvibes-template` GitHub repo as the click-to-fork
zero-install entry point.

The core mechanics already exist: `mergeClaude`/`merge_claude` handle CLAUDE.md sentinel
replacement, `copyTemplates`/`copy_templates` handle file copying, and `detectProjectType`/
`detect_project_type` handle CI variant selection. The upgrade command is a thin orchestration
layer on top of these, with two differences from `init`: (a) overwrite-on-update semantics for
goodvibes-managed files (skill files and CI workflows are replaced, not skipped), and (b)
a diff-style summary printed before applying changes.

No new npm or pip dependencies are required. Everything upgrade needs is already in the
installed dependency graph.

**Primary recommendation:** Add an `upgrade` subcommand to both CLIs that reuses existing
step modules with `overwrite: true` for managed files and adds a pre-flight diff summary.
The GitHub template repo is a simple git push of the validated `templates/` directory
into a separate `jgiox/goodvibes-template` repo marked as a GitHub Template.

---

## Project Constraints (from CLAUDE.md)

- **License:** Apache 2.0 — no new deps unless they are MIT/BSD-compatible
- **Zero-config:** `goodvibes upgrade` must work without any arguments
- **Beginner-first:** Output must be plain English; no git diffs shown raw
- **Ponytail full:** Shortest working diff wins; no abstractions with one implementation
- **Unit tests mock all external calls:** Filesystem ops are real in integration tests only
- **Test naming:** Sentences describing expected behavior (`it('preserves user content outside sentinel blocks')`)
- **Fail loud:** No empty catch blocks; error messages must be actionable
- **No shell:true in subprocess calls** — args as arrays

---

## Phase Requirements

<phase_requirements>

| ID | Description | Research Support |
|----|-------------|------------------|
| UPG-01 | `npx goodvibes upgrade` / `goodvibes upgrade` re-syncs CLAUDE.md, skill files, and CI workflows to latest published version | Reuse `mergeClaude` (sentinel update), extend `copyTemplates` with overwrite mode for managed paths |
| UPG-02 | Upgrade uses template version stamps to detect what was installed vs what is current | `extractVersion` / `extract_version` already parse `# goodvibes: v1.0.0`; read installed CLAUDE.md stamp vs bundled template stamp |
| UPG-03 | Upgrade preserves user edits in CLAUDE.md outside sentinel blocks | Existing Case C in `mergeClaude` / `merge_claude` already does this; sentinel block is replaced, surrounding content is untouched |
| UPG-04 | Upgrade prints a diff-style summary of what changed before applying | New logic: compare template content vs destination content per managed file; print `changed / unchanged / new` summary before writing |

</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Version detection (installed vs current) | CLI command layer | sentinel-merge utility | Read CLAUDE.md stamp from CWD; compare to bundled template stamp using existing `extractVersion` |
| CLAUDE.md upgrade | sentinel-merge utility | copy-templates step | Case C already handles this; upgrade calls `mergeClaude` with the new template content |
| Skill file upgrade | copy-templates step (extended) | — | Need an `upgradeTemplates` variant that overwrites `.claude/skills/goodvibes-*` and caveman/* |
| CI workflow upgrade | copy-templates step (extended) | detect-project-type utility | Re-run `detectProjectType`, then overwrite `ci.yml`, `security.yml`, etc. |
| Diff summary | upgrade command layer | — | Before writing, compare file-by-file; emit human-readable change list |
| GitHub template repo | Manual GitHub operation | CI/CD (optional automation) | Mark repo as template; push validated `templates/` content |

---

## Standard Stack

### Core — No New Dependencies Required

All required capabilities come from packages already installed in prior phases.

| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| `commander` | ^15 [VERIFIED: npm registry] | `upgrade` subcommand registration | Already in `package.json` |
| `@clack/prompts` | ^1 [VERIFIED: npm registry] | Spinner + output formatting | Already in `package.json` |
| `fs-extra` | ^11 [VERIFIED: npm registry] | File copy with overwrite | Already in `package.json`; `copy()` accepts `overwrite: true` |
| `node:fs/promises` | stdlib | `readFile`, `writeFile` for diff computation | Already used in sentinel-merge.ts |
| `typer` | ^0.15 [VERIFIED: PyPI] | `upgrade` subcommand (pip CLI) | Already in `pyproject.toml` |
| `rich` | ^14 [VERIFIED: PyPI] | Terminal output (pip CLI) | Already in `pyproject.toml` |
| `shutil` / `pathlib` | stdlib | Python file ops | Already used in copy_templates.py |

**No `npm install` or `pip install` step needed for this phase.**

### Package Legitimacy Audit

> All packages used in this phase were already installed and audited in Phases 2 and 3.
> No new packages are being introduced.

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| commander | npm | [OK — verified Phase 2] | Approved (pre-existing) |
| @clack/prompts | npm | [OK — verified Phase 2] | Approved (pre-existing) |
| fs-extra | npm | [OK — verified Phase 2] | Approved (pre-existing) |
| execa | npm | [OK — verified Phase 2] | Approved (pre-existing) |
| typer | PyPI | [OK — slopcheck verified 2026-06-25] | Approved (pre-existing) |
| rich | PyPI | [OK — slopcheck verified 2026-06-25] | Approved (pre-existing) |

*Note: slopcheck cross-ecosystem false-positives: @clack/prompts and execa were flagged [SLOP] when checked against PyPI — this is expected; they are npm packages and do not exist on PyPI. They were verified correct on npm registry via `npm view`. [VERIFIED: npm registry]*

**Packages removed due to slopcheck [SLOP] verdict:** none (false positives were cross-ecosystem check errors)

---

## Architecture Patterns

### System Architecture Diagram

```
goodvibes upgrade
       │
       ├─ [1] Read installed version
       │        └─ read CWD/CLAUDE.md → extractVersion()  ← sentinel-merge utility
       │
       ├─ [2] Read bundled version
       │        └─ read templates/CLAUDE.md → extractVersion()  ← resolveTemplatesDir()
       │
       ├─ [3] Compute diff summary (per managed file)
       │        ├─ CLAUDE.md: sentinel block changed? (compare blocks)
       │        ├─ .claude/skills/goodvibes-*/: file content changed?
       │        ├─ .claude/skills/caveman*/: file content changed?
       │        └─ .github/workflows/ci.yml, security.yml, …: content changed?
       │                                      ↓
       │                   print: "N files will be updated / M unchanged"
       │
       ├─ [4] Apply changes
       │        ├─ CLAUDE.md → mergeClaude() (Case C: replace sentinel, preserve user content)
       │        ├─ skill files → copy with overwrite=true
       │        └─ CI workflows → copy with overwrite=true (re-detect project type)
       │
       └─ [5] Print result
                └─ list of updated files
```

### Recommended Project Structure

```
packages/npm/src/
├── commands/
│   ├── init.ts          (existing)
│   └── upgrade.ts       (new — mirrors init.ts structure)
├── steps/
│   └── copy-templates.ts  (extend: add upgradeTemplates() or overwrite flag)
└── utils/
    └── sentinel-merge.ts  (existing — no changes needed)

packages/pip/src/goodvibes_cli/
├── commands/
│   ├── init_cmd.py        (existing)
│   └── upgrade_cmd.py     (new — mirrors init_cmd.py)
└── steps/
    └── copy_templates.py  (extend: add upgrade_templates() or overwrite flag)
```

### Pattern 1: Upgrade Subcommand Structure (TypeScript)

```typescript
// Source: mirrors packages/npm/src/commands/init.ts pattern
export function registerUpgradeCommand(program: Command): void {
  program
    .command('upgrade')
    .description('Update goodvibes-managed files to the latest version')
    .option('--dry-run', 'Preview what would change without writing')
    .action(async (options: { dryRun: boolean }) => {
      const cwd = process.cwd()
      const templateDir = resolveTemplatesDir()
      const projectType = detectProjectType(cwd)

      intro('goodvibes upgrade')

      // Step 1: detect installed version from CWD/CLAUDE.md
      const installedVersion = await detectInstalledVersion(cwd)
      const bundledVersion = await detectBundledVersion(templateDir)

      if (installedVersion && bundledVersion && versionGte(installedVersion, bundledVersion)) {
        outro(`Already up to date (v${installedVersion})`)
        return
      }

      // Step 2: compute diff summary
      const changes = await computeChanges(templateDir, cwd, projectType)
      note(formatChangeSummary(changes), 'What will change')

      if (options.dryRun) {
        outro('Run without --dry-run to apply these changes.')
        return
      }

      // Step 3: apply
      const updated = await upgradeTemplates(templateDir, cwd, projectType)
      note(updated.join('\n'), 'Files updated')
      outro('Upgrade complete!')
    })
}
```

### Pattern 2: Version Detection

```typescript
// Read the installed version from the project's CLAUDE.md sentinel block
async function detectInstalledVersion(cwd: string): Promise<string | null> {
  const claudePath = join(cwd, 'CLAUDE.md')
  if (!(await pathExists(claudePath))) return null
  const content = await readFile(claudePath, 'utf-8')
  return extractVersion(content)  // reuse existing utility
}
```

The `extractVersion` function in `sentinel-merge.ts` already handles this — it searches for
`# goodvibes: v([\d.]+)` anywhere in a block. [VERIFIED: codebase grep]

### Pattern 3: Overwrite-Mode File Copy

The key difference between `init` (no-clobber) and `upgrade` (overwrite managed files):

```typescript
// In copy-templates.ts — add upgradeTemplates() using overwrite:true for managed files
await copy(templateDir, destDir, {
  overwrite: true,   // upgrade DOES overwrite (vs init: overwrite: false)
  filter: (src: string) => {
    if (src.endsWith('CLAUDE.md')) return false  // always handled by mergeClaude
    // Managed paths — allow overwrite:
    if (src.includes('.claude/skills/')) return true
    if (src.includes('.github/workflows/')) return true
    if (src.includes('.github/ISSUE_TEMPLATE/')) return false  // user may have customized
    if (src.includes('.github/PULL_REQUEST_TEMPLATE')) return false
    // Non-managed docs — never overwrite:
    if (src.endsWith('JOURNAL.md')) return false
    if (src.endsWith('CHANGELOG.md')) return false
    if (src.endsWith('CONTRIBUTING.md')) return false
    if (src.endsWith('SECURITY.md')) return false
    return false  // default: don't touch unknown files
  },
})
```

### Pattern 4: Diff Summary (Human-Readable, Not Git-Format)

UPG-04 says "diff-style summary" — given the beginner audience and Ponytail minimalism,
implement as a file-change list, not a raw unified diff:

```
  ~ CLAUDE.md (sentinel block updated: v1.0.0 → v1.1.0)
  ~ .claude/skills/goodvibes-hygiene/SKILL.md (content changed)
  = .claude/skills/caveman/SKILL.md (unchanged)
  ~ .github/workflows/ci.yml (updated)
```

This avoids adding a `diff` npm package (Ponytail ladder rung 5: avoid new deps for what
a few lines can do). Implementation: read template content, read destination content, compare
with `===`. Mark changed (`~`), unchanged (`=`), new (`+`), not-managed (skip).

### Pattern 5: Managed vs Unmanaged Files

| File/Path | Upgrade Behavior | Rationale |
|-----------|-----------------|-----------|
| `CLAUDE.md` sentinel block | Update via `mergeClaude` | Preserves user content outside sentinel |
| `.claude/skills/goodvibes-*/` | Overwrite | goodvibes-owned; user edits belong in separate skills |
| `.claude/skills/caveman*/` | Overwrite | goodvibes-owned fork; caveman upstream may update |
| `.github/workflows/ci.yml` | Overwrite | goodvibes-managed CI; re-detect project type |
| `.github/workflows/security.yml` | Overwrite | goodvibes-managed |
| `.github/workflows/dependency-review.yml` | Overwrite | goodvibes-managed |
| `.github/dependabot.yml` | Overwrite | goodvibes-managed |
| `.github/ISSUE_TEMPLATE/` | Skip | User likely customized |
| `.github/PULL_REQUEST_TEMPLATE.md` | Skip | User likely customized |
| `JOURNAL.md` | Never touch | User data |
| `CHANGELOG.md` | Never touch | User data |
| `CONTRIBUTING.md` | Never touch | User data |
| `SECURITY.md` | Never touch | User data |
| `docs/onboarding.md` | Never touch | User may have customized |

### Anti-Patterns to Avoid

- **Showing raw unified diff output:** Beginners cannot read `@@` hunk headers; use the
  human-readable `~ / = / +` summary instead.
- **Requiring `--force` to overwrite managed files:** Upgrade always overwrites managed files
  (that's the whole point); adding a gate defeats the purpose.
- **Silently overwriting user-modified JOURNAL.md or CHANGELOG.md:** These are user data;
  always skip them.
- **Re-installing headroom during upgrade:** Headroom install is already idempotent via
  `configure-mcp.ts`; `upgrade` should only handle file sync, not headroom.
- **Cross-CLI confusion:** A project initialized by pip CLI and upgraded by npm CLI (or
  vice versa) works fine because both CLIs share the same `templates/` directory and the
  same sentinel format. The CLI that runs `upgrade` does not matter — the output is identical.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version comparison | Custom semver parser | Existing `versionGte()` in sentinel-merge.ts | Already handles multi-component integer comparison correctly |
| CLAUDE.md merge | Custom block replacer | Existing `mergeClaude()` / `merge_claude()` | 4 cases already handled and tested |
| Unified diff output | `diff` package or `git diff` subprocess | `~` / `=` / `+` string markers | Beginners can't read unified diff; Ponytail: no new dep for 3 lines |
| File enumeration | Custom walker | Existing `listTemplateFiles()` | Already handles recursive walk |

**Key insight:** The upgrade command is ~80 lines of new code — it orchestrates existing
utilities and adds one new concern (diff summary). Do not create new abstractions.

---

## Research Answers to Key Questions

### Q1: How does upgrade discover the installed version?

Read `CWD/CLAUDE.md` and call `extractVersion()` on the full content (not just the sentinel
block — the function uses regex search, not block-scoped parsing). [VERIFIED: codebase grep]

The `# goodvibes: v1.0.0` stamp appears inside the sentinel block, so any project initialized
by goodvibes will have a parseable version. Projects with no CLAUDE.md or no sentinel block
are treated as "unversioned" — upgrade proceeds and installs current version (same as init).

Do not rely on the npm/pip package version alone — the installed package version and the
version stamp in the project's CLAUDE.md may differ (user ran older CLI). The stamp is the
authoritative source of "what was installed in this project."

### Q2: What files does upgrade manage vs leave alone?

See Pattern 5 table above. Summary: goodvibes-owned files (skills, CI workflows, CLAUDE.md
sentinel) are updated; user-data files (JOURNAL.md, CHANGELOG.md, CONTRIBUTING.md, SECURITY.md,
docs/onboarding.md, issue templates, PR template) are never touched.

### Q3: How should the diff-style summary work?

Print a `~ / = / +` change list before writing. No raw unified diff. No confirmation prompt
(Ponytail: zero-config; UPG-04 says "prints ... before applying", not "asks for confirmation").
The `--dry-run` flag shows the summary without applying — same as `init --dry-run`.

### Q4: Should upgrade re-run detectProjectType to pick the right CI variant?

Yes. Re-running `detectProjectType(cwd)` at upgrade time is correct — the project type may
have changed since init (e.g., user added `pyproject.toml` to a previously node-only project).
This is a one-line call using the existing utility. [VERIFIED: codebase grep]

### Q5: GitHub template repo workflow?

The `jgiox/goodvibes-template` repo is a separate GitHub repository (not a fork of the
goodvibes monorepo). It contains only the contents of `templates/` — i.e., what a user
gets when they run `goodvibes init` in a blank directory. Steps:

1. Create `jgiox/goodvibes-template` repo on GitHub
2. Push the contents of `templates/` as the repo root (not the `templates/` directory itself
   as a subdirectory — the CLAUDE.md should be at the repo root)
3. In GitHub Settings → check "Template repository"
4. A user can then click "Use This Template," clone the result, and CLAUDE.md rules are
   immediately active in Claude Code

Keeping it in sync: a CI job or manual step after each npm/pip publish copies `templates/`
content into `jgiox/goodvibes-template`. This is a one-time setup plus a human checkpoint
in the phase. [ASSUMED — no official GitHub docs verification done, based on GitHub template
repo feature knowledge from training data]

### Q6: No-clobber (init) vs overwrite (upgrade)?

- `init`: `overwrite: false` (skip existing files) — protects user data on re-run
- `upgrade`: `overwrite: true` for managed files only — the whole purpose is to update them

The managed/unmanaged split (Pattern 5) is the key design decision.

### Q7: Cross-CLI upgrade (pip init, npm upgrade)?

Both CLIs copy the same `templates/` directory. Both use the same sentinel format
(`<!-- goodvibes:start -->` / `# goodvibes: v1.0.0`). Upgrading with either CLI produces
the same result. No special handling needed. [VERIFIED: codebase grep — both CLIs share
templates/ symlink via prebuild and hatchling hook]

### Q8: How are skill files upgraded?

Full overwrite of `.claude/skills/goodvibes-hygiene/` and `.claude/skills/caveman*/`.
These are goodvibes-owned files. User customizations to goodvibes skills should live in
separate skill files (e.g., `.claude/skills/my-project/`), which upgrade never touches.
This is consistent with the "surgical changes" engineering rule.

### Q9: Version parsing concerns?

The `# goodvibes: v1.0.0` stamp format is clean. `extractVersion()` uses
`/# goodvibes: v([\d.]+)/` — handles any number of dot-separated integer components.
`versionGte()` pads shorter versions with zeros for comparison (e.g., `1.0` vs `1.0.0`).
No concerns. [VERIFIED: codebase grep of sentinel-merge.ts and sentinel_merge.py]

### Q10: GitHub template repo vs npm/pip publish coordination?

These are independent. npm/pip are triggered by `npm-v*` / `pip-v*` git tags. The
GitHub template repo is updated manually (or via a separate `template-v*` tag trigger).
For v1.0.0 the planner should include a human checkpoint: "push templates/ to
jgiox/goodvibes-template and mark as GitHub Template repo." [ASSUMED — no GH API
verification of exact steps]

---

## Common Pitfalls

### Pitfall 1: Overwriting User-Modified CI Workflows Without Warning
**What goes wrong:** User customized their `ci.yml` (added a step); upgrade silently replaces it.
**Why it happens:** CI workflows are "managed" files but users do modify them.
**How to avoid:** The diff summary (UPG-04) shows the user what will change before it happens.
Since `--dry-run` exists, power users can preview. For v1 this is acceptable; v2 could add
a sentinel pattern to CI files, but that's out of scope.
**Warning signs:** Test that the diff summary correctly shows `~` for changed CI files.

### Pitfall 2: detectInstalledVersion Returns null on Uninitialized Project
**What goes wrong:** User runs `goodvibes upgrade` in a project that was never initialized;
no CLAUDE.md exists; `detectInstalledVersion` returns null; code throws on null comparison.
**Why it happens:** null-vs-string comparison without guard.
**How to avoid:** When installedVersion is null, treat as "version 0.0.0" or proceed as
a fresh install. Log: "No goodvibes installation detected — running init instead" and
delegate to the init flow (or simply call `upgradeTemplates` unconditionally).
**Warning signs:** Unit test: `it('runs full upgrade when CLAUDE.md is absent')`.

### Pitfall 3: CI Variant Mismatch After Project Type Change
**What goes wrong:** Project was initialized as "node"; user adds pyproject.toml; upgrade
is run; `detectProjectType` returns "both"; upgrade writes `ci-both.yml` as `ci.yml` but
the old `ci.yml` (node-only) is still there with different content.
**Why it happens:** The rename step (`ci-both.yml → ci.yml`) works correctly, but the
diff summary must account for the rename. Comparing `templates/ci-both.yml` to
`dest/.github/workflows/ci.yml` by filename would miss the match.
**How to avoid:** The diff comparison for `ci.yml` must compare the *selected variant's
content* against the existing `ci.yml` content (not by filename). The rename logic in
`copyTemplates` already handles this for init — upgrade must follow the same pattern.
**Warning signs:** Integration test with a "both" project type after "node" init.

### Pitfall 4: Blank CLAUDE.md Outside Sentinel Block After Upgrade
**What goes wrong:** User has content before and after the sentinel block; a bug in the
`before + templateBlock + after` slicing drops leading/trailing content.
**Why it happens:** Off-by-one in slice indices.
**How to avoid:** The existing `mergeClaude` tests cover this (Case C). No new code needed
for CLAUDE.md — `mergeClaude` is already correct. The risk is only if someone reimplements
it instead of calling it.
**Warning signs:** Reuse `mergeClaude` directly; never copy-paste its logic.

### Pitfall 5: GitHub Template Repo Contains Monorepo Cruft
**What goes wrong:** Pushing the full goodvibes repo as the template gives users
`packages/`, `.planning/`, `.github/workflows/publish-npm.yml`, etc.
**Why it happens:** Confusing "the repo" with "the templates/ directory."
**How to avoid:** The template repo contains ONLY the contents of `templates/` at its
root. A separate push step (or CI job) extracts exactly those files.
**Warning signs:** Verify that `jgiox/goodvibes-template` has CLAUDE.md at the root,
not at `templates/CLAUDE.md`.

---

## Code Examples

### Diff Summary Helper (TypeScript)

```typescript
// Source: derived from existing copy-templates.ts patterns — no new dependency
interface FileChange {
  path: string
  status: 'changed' | 'unchanged' | 'new'
}

async function computeChanges(
  templateDir: string,
  destDir: string,
  projectType: ProjectType,
): Promise<FileChange[]> {
  const MANAGED_PREFIXES = ['.claude/skills/', '.github/workflows/']
  const managed = await listManagedTemplateFiles(templateDir, projectType)
  const changes: FileChange[] = []
  for (const rel of managed) {
    const destPath = join(destDir, rel)
    if (!(await pathExists(destPath))) {
      changes.push({ path: rel, status: 'new' })
      continue
    }
    const templateContent = await readFile(join(templateDir, rel), 'utf-8')
    const destContent = await readFile(destPath, 'utf-8')
    changes.push({ path: rel, status: templateContent === destContent ? 'unchanged' : 'changed' })
  }
  return changes
}
```

### Upgrade Command Registration (TypeScript)

```typescript
// Source: mirrors packages/npm/src/commands/init.ts — registerUpgradeCommand
import { registerInitCommand } from './commands/init.js'
import { registerUpgradeCommand } from './commands/upgrade.js'
// ...
registerInitCommand(program)
registerUpgradeCommand(program)
```

### Python Upgrade Command (pip CLI)

```python
# Source: mirrors packages/pip/src/goodvibes_cli/commands/init_cmd.py
def upgrade_cmd(
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Preview changes without writing")] = False,
) -> None:
    """Re-sync goodvibes-managed files to the latest version."""
    template_dir = resolve_templates_dir()
    cwd = pathlib.Path.cwd()
    project_type = detect_project_type(cwd)
    # ... same pattern as init_cmd but calls upgrade_templates()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npm update` for scaffold updates | Dedicated `upgrade` subcommand | N/A (new) | User intent is clear; no confusion with npm package updates |
| Manual file replacement | Sentinel-aware merge | Phase 1 | User edits preserved |
| Full file overwrite on re-run | No-clobber on init, overwrite on upgrade | Phase 5 | Correct semantics per operation |

**Relevant precedents:**
- `create-react-app` has no upgrade command (big complaint in community) — goodvibes will
  be better
- `yeoman` generators have `yo --update` but it's complex; goodvibes keeps it simple

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20+ | npm CLI | ✓ | v20.x (CI-verified Phase 2) | — |
| Python 3.10+ | pip CLI | ✓ | 3.x (CI-verified Phase 3) | — |
| GitHub CLI (`gh`) | Template repo setup | [ASSUMED] | — | Manual GitHub UI |
| Git | Template repo push | ✓ | (present in WSL2) | — |

**Missing dependencies with no fallback:** None (template repo setup is a human checkpoint).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (TS) | vitest ^4 |
| Config file (TS) | `packages/npm/package.json` scripts.test |
| Quick run (TS) | `cd packages/npm && npm test` |
| Framework (Py) | pytest ^9 + pytest-mock ^3 |
| Config file (Py) | `packages/pip/pyproject.toml` [tool.pytest.ini_options] |
| Quick run (Py) | `cd packages/pip && python -m pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| UPG-01 | upgrade re-syncs CLAUDE.md sentinel | unit | `npm test` / `pytest` | ❌ Wave 0 |
| UPG-01 | upgrade re-syncs skill files | integration | `npm test` / `pytest` | ❌ Wave 0 |
| UPG-01 | upgrade re-syncs CI workflows | integration | `npm test` / `pytest` | ❌ Wave 0 |
| UPG-02 | version stamp detection works | unit | `npm test` / `pytest` | ❌ Wave 0 |
| UPG-02 | up-to-date project skips upgrade | unit | `npm test` / `pytest` | ❌ Wave 0 |
| UPG-03 | user content outside sentinel is preserved | unit | `npm test` / `pytest` | ❌ Wave 0 (reuse mergeClaude Case C test) |
| UPG-04 | diff summary printed before apply | unit | `npm test` / `pytest` | ❌ Wave 0 |
| UPG-04 | --dry-run shows summary without writing | unit | `npm test` / `pytest` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd packages/npm && npm test` and `cd packages/pip && python -m pytest`
- **Per wave merge:** Full suite for both CLIs
- **Phase gate:** Both test suites green + `scripts/verify-phase5.sh` passing

### Wave 0 Gaps

- [ ] `packages/npm/src/commands/upgrade.ts` — new command file
- [ ] `packages/npm/src/commands/upgrade.test.ts` — unit tests (mock fs, sentinel-merge, copy-templates)
- [ ] `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py` — new command file
- [ ] `packages/pip/tests/test_upgrade_cmd.py` — unit tests (mock sentinel_merge, copy_templates)
- [ ] `scripts/verify-phase5.sh` — smoke harness

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Path traversal guard (already in copy-templates filter); validate `--dry-run` is boolean only |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via template filename | Tampering | Existing `relative(templateDir, src).includes('..')` filter — already present in `copyTemplates`, must be preserved in `upgradeTemplates` |
| Overwriting files outside CWD | Tampering | `destDir` is always `process.cwd()` (or `pathlib.Path.cwd()`); all writes use `join(destDir, rel)` with the rel path coming only from the bundled template tree |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | GitHub template repo setup requires only marking the repo as "Template repository" in GitHub settings | Q5 / Pitfall 5 | Low — this is a well-known GitHub feature; if wrong, human checkpoint catches it |
| A2 | `jgiox/goodvibes-template` will be a separate repo with templates/ contents at root, updated manually after each release | Q5 | Low — this is the standard GitHub template repo pattern |
| A3 | User-modified issue templates and PR template should NOT be overwritten by upgrade | Pattern 5 | Medium — if wrong, users lose their customizations; conservative choice is correct |
| A4 | GitHub CLI (`gh`) is available in the dev environment for template repo operations | Environment Availability | Low — human checkpoint covers manual fallback |

---

## Open Questions (RESOLVED)

1. RESOLVED: **Should upgrade also re-run headroom install/configure-mcp?**
   - What we know: headroom install is idempotent (configure-mcp checks before registering)
   - What's unclear: whether a headroom upgrade (new headroom-ai version) should be triggered
   - Recommendation: Keep upgrade focused on file sync only (UPG-01 says "CLAUDE.md, skill files, CI workflows"). Headroom upgrade is a separate concern; v1 skips it.

2. RESOLVED: **Should CONTRIBUTING.md, SECURITY.md, docs/onboarding.md get a sentinel pattern in v2?**
   - What we know: v1 treats them as never-touch (user data)
   - What's unclear: whether users want these updated (e.g., onboarding improvements)
   - Recommendation: Out of scope for v1. Deferred.

3. RESOLVED: **CI job for template repo sync vs manual checkpoint?**
   - What we know: manual checkpoint is simpler and sufficient for v1's release cadence
   - What's unclear: whether a `template-v*` tag trigger is worth the automation effort
   - Recommendation: Manual checkpoint for v1. The planner should include a human step.

---

## Sources

### Primary (HIGH confidence)

- Codebase: `packages/npm/src/utils/sentinel-merge.ts` — extractVersion, versionGte, mergeClaude, 4-case logic [VERIFIED: codebase grep]
- Codebase: `packages/pip/src/goodvibes_cli/utils/sentinel_merge.py` — Python port, identical 4 cases [VERIFIED: codebase grep]
- Codebase: `packages/npm/src/steps/copy-templates.ts` — copyTemplates, overwrite:false pattern, CI variant rename [VERIFIED: codebase grep]
- Codebase: `packages/pip/src/goodvibes_cli/steps/copy_templates.py` — Python port [VERIFIED: codebase grep]
- Codebase: `packages/npm/src/utils/detect-project-type.ts` — detectProjectType [VERIFIED: codebase grep]
- npm registry: commander@15.0.0, @clack/prompts@1.6.0, fs-extra@11.3.5, execa@9.6.1 [VERIFIED: npm registry]
- PyPI registry: typer@0.26.7, rich@15.0.0 [VERIFIED: PyPI via pip index versions]
- slopcheck: typer [OK], rich [OK], commander [OK on PyPI — irrelevant], fs-extra [OK on PyPI — irrelevant] [VERIFIED: slopcheck 2026-06-25]

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — UPG-01 through UPG-04 requirement text [CITED: project file]
- `.planning/ROADMAP.md` — Phase 5 success criteria [CITED: project file]
- `CLAUDE.md` — Ponytail minimalism rules, test conventions [CITED: project file]

### Tertiary (LOW confidence)

- GitHub template repository feature mechanics — training knowledge, not verified via GitHub docs [ASSUMED: A1, A2]

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; all existing packages verified on correct registries
- Architecture: HIGH — derived directly from existing codebase patterns; upgrade is a thin orchestration layer
- Pitfalls: HIGH — derived from code reading and test analysis, not speculation
- GitHub template repo setup: MEDIUM — training knowledge; human checkpoint covers uncertainty

**Research date:** 2026-06-25
**Valid until:** 2026-09-25 (stable domain; no fast-moving external APIs)
