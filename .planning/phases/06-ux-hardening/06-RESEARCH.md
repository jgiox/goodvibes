# Phase 6: UX Hardening — Research

**Researched:** 2026-06-26
**Domain:** CLI UX — init hardening, --minimal scope, --dry-run combination, error surfacing
**Confidence:** HIGH (all findings derived from direct code reading + verified prior milestone research)

---

## Summary

Phase 6 is a pure bug-fix and polish phase. Every change targets existing code in exactly four
files (two per CLI package). No new runtime dependencies are introduced. No new modules are
needed. The planner should resist the temptation to add abstractions — all fixes are in-place.

The six requirements split cleanly into three implementation groups:

1. **UX-01 + UX-02**: Non-empty-directory notice + written/skipped split. Both require changing
   the return type of `copyTemplates` / `copy_templates` from `string[]` to `{written, skipped}`.
   This is the single structural change of Phase 6 and the one that has the widest ripple (into
   call sites and all existing tests that assert on the return shape).

2. **UX-03 + UX-04**: Error surfacing + ci.yml rename guard. These are independent of group 1.
   UX-03 adds try/catch wrappers; UX-04 adds one `existsSync(ciPath)` check before `rename()`.
   Both are surgical, zero-ripple changes.

3. **MIN-01 + MIN-02**: Expand `--minimal` filter from `.github/workflows/` to all of `.github/`
   and `docs/`, then thread `minimal` into the dry-run preview path. Both are one-line filter
   changes in `copyTemplates` / `copy_templates` plus a parallel fix in the dry-run branch of
   `init.ts` / `init_cmd.py`.

**Primary recommendation:** Land group 1 first (return-type change + tests). It is the only
change with ripple effects. Groups 2 and 3 are independent and can follow in any order or be
batched in parallel.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | `goodvibes init` in a non-empty directory prompts/notices before proceeding — no silent overwrite | Non-empty check via `readdir(cwd)` before `tasks()` in `init.ts`; `os.listdir` in `init_cmd.py`; display via `@clack/prompts` `note()` / Rich `console.print()` |
| UX-02 | Completion summary reports "X files written, Y files skipped" separately — not all dest files listed | Change `copyTemplates` return from `string[]` to `{written: string[], skipped: string[]}`; ripples into `init.ts` note calls and all existing tests |
| UX-03 | Common failures print plain-English remediation message and exit 1 — no raw stack traces | Wrap `tasks()` call in `init.ts` try/catch using `@clack/prompts` `cancel()`; wrap `shutil.copytree()` in `copy_templates.py` try/except; wrap init body in `init_cmd.py` |
| UX-04 | Existing `ci.yml` is not silently overwritten — rename step checks before replacing | Add `existsSync(ciPath)` guard in TS before `rename()`; `ci_path.exists()` guard in Python before `variant_path.rename(ci_path)` |
| MIN-01 | `--minimal` skips all of `.github/` and `docs/` — not just `.github/workflows/` | Expand filter from `.includes('.github/workflows')` to `.includes('.github')` plus add `.includes('docs')` check; same in Python `ignore_fn` |
| MIN-02 | `--dry-run --minimal` shows only files `--minimal` would actually write | Pass `minimal` into the dry-run file-list filter in `init.ts`; same in `init_cmd.py` |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Simplicity first:** Use minimum code. No abstractions with one implementation, no new framework layers.
- **Surgical changes:** Touch only what the task requires. Diffs narrow. No opportunistic reformats.
- **Fail loud:** No empty catch blocks. Error messages must be actionable and specific.
- **Unit tests:** Mock all external calls. File: `src/steps/foo.ts` → `src/steps/foo.test.ts`. Use vitest (TS) or pytest + pytest-mock (Python).
- **Test naming:** Names are sentences describing expected behavior.
- **TypeScript pinned to ^5.5** — do not bump to ^6.x.
- **No new runtime dependencies** for Phase 6 (confirmed in STATE.md decisions).
- **Zero-config for the end user** — any notice for non-empty dir must be informational, not a prompt that requires input.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Non-empty dir detection | CLI (init command) | — | `readdir(cwd)` is a command-level pre-flight check, not a step concern |
| Written/skipped tracking | CLI step (copy-templates) | CLI command (display) | Data is produced in `copyTemplates`; surface in `init.ts` caller |
| ci.yml rename guard | CLI step (copy-templates) | — | The rename lives in `copyTemplates`; the guard belongs in the same function |
| Error surfacing | CLI command (init) | CLI step (copy-templates) | Step wraps its own I/O errors; command wraps the task runner |
| --minimal filter | CLI step (copy-templates) | CLI command (dry-run path) | Filter lives in `copyTemplates`; dry-run path in `init.ts` must mirror it |

---

## Standard Stack

### Core (already installed — no new packages)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@clack/prompts` | ^0.9 | `note()`, `cancel()`, `outro()` for UX-01/UX-02/UX-03 display | `cancel()` used for fatal errors before exit 1 |
| `fs-extra` | ^11 | `copy()` already in use | No new methods needed |
| `node:fs/promises` | stdlib | `readdir()` for non-empty check | Already imported in `copy-templates.ts` |
| `node:fs` | stdlib | `existsSync()` for ci.yml guard | Already imported in `copy-templates.ts` |
| `rich` (Python) | ^14 | `console.print()` for error panels | Already in use in `init_cmd.py` |
| `typer` | ^0.15 | `typer.Exit(1)` for Python error exit | Already in use |

**Installation:** No installs required. All libraries are already declared dependencies.

---

## Package Legitimacy Audit

No new packages are introduced in Phase 6. All changes use already-installed dependencies.

**Packages removed due to slopcheck:** none
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### Recommended Project Structure (unchanged)

```
packages/npm/src/
  steps/
    copy-templates.ts   <- return type change + ci.yml guard + error wrap
  commands/
    init.ts             <- non-empty notice + display skipped + try/catch + dry-run minimal fix

packages/pip/src/goodvibes_cli/
  steps/
    copy_templates.py   <- return type change + ci.yml guard + error wrap
  commands/
    init_cmd.py         <- non-empty notice + display skipped + try/except + dry-run minimal fix
```

### Pattern 1: `copyTemplates` Return Type Change (UX-02)

**What:** Change return from `string[]` to `{ written: string[]; skipped: string[] }` (TS) / `tuple[list[str], list[str]]` (Python).

**TS approach — snapshot pre-existing files before copy:**

```typescript
// Source: direct codebase analysis — packages/npm/src/steps/copy-templates.ts
// Before copy(), snapshot which target paths already exist
const existingBefore = new Set<string>()
// ... populate by walking destDir if it exists
// After copy() + rename, classify each dest file against snapshot
const written = destFiles.filter(f => !existingBefore.has(f))
const skipped = destFiles.filter(f => existingBefore.has(f))
return { written, skipped }
```

**Python approach — capture skipped inside `ignore_fn` closure:**

```python
# Source: direct codebase analysis — packages/pip/src/goodvibes_cli/steps/copy_templates.py
skipped: list[str] = []  # mutable outer-scope list; ignore_fn appends to it

def ignore_fn(directory: str, contents: list[str]) -> set[str]:
    ignored: set[str] = set()
    for name in contents:
        # ...existing logic...
        dest_candidate = dest_dir / rel
        if dest_candidate.exists():
            ignored.add(name)
            skipped.append(str(dest_candidate.relative_to(dest_dir)))  # capture
    return ignored
# After copytree, return (written, skipped)
# written = [files in dest_dir now] minus skipped
```

**Call-site change in `init.ts`:**

```typescript
// Before (current):
const files = await copyTemplates(templateDir, cwd, false, minimal, projectType)
createdFiles.push(...files)

// After:
const { written, skipped } = await copyTemplates(templateDir, cwd, false, minimal, projectType)
createdFiles.push(...written)
// skippedFiles captured separately for display
```

### Pattern 2: Non-Empty Directory Notice (UX-01)

**What:** Before calling `tasks()`, detect if `cwd` has any files. If yes, print an informational note. This is NOT a prompt — zero-config must be preserved.

```typescript
// Source: Node.js stdlib + @clack/prompts note() — already in init.ts
import { readdirSync } from 'node:fs'
// ...
const existingEntries = readdirSync(cwd)
if (existingEntries.length > 0) {
  note('Existing files will not be overwritten.', 'Non-empty project detected')
}
```

```python
# Source: Python stdlib — already available in init_cmd.py
existing = list(cwd.iterdir())
if existing:
    console.print(Panel("Existing files will not be overwritten.", title="Non-empty project detected"))
```

**Key constraint:** `readdirSync` is synchronous and suitable here (one read before tasks begin). Do not use `await readdir` — the action handler is already async but sync here is simpler and the read is fast.

### Pattern 3: Error Surfacing (UX-03)

**TS: wrap `tasks()` in `init.ts`:**

```typescript
// Source: @clack/prompts docs — cancel() prints and clears spinner
import { cancel } from '@clack/prompts'
try {
  await tasks(taskList)
} catch (e) {
  const msg = (e as NodeJS.ErrnoException).code === 'EACCES' || (e as NodeJS.ErrnoException).code === 'EPERM'
    ? `Cannot write files to ${cwd}.\nWhy: You do not have write permission.\nFix: chmod u+w ${cwd}  (macOS/Linux) or check folder properties (Windows)`
    : `Setup failed: ${(e as Error).message}\nRun: npx goodvibes@latest init`
  cancel(msg)
  process.exit(1)
}
```

**TS: wrap `copy()` in `copy-templates.ts`:**

```typescript
try {
  await copy(templateDir, destDir, { overwrite: false, errorOnExist: false, filter })
} catch (e) {
  const err = e as NodeJS.ErrnoException
  const hint = err.code === 'EACCES' ? 'Check directory permissions.' : 'Check available disk space.'
  throw new Error(`Cannot copy template files: ${err.message}. ${hint}`)
}
```

**Python: wrap `shutil.copytree()` in `copy_templates.py`:**

```python
try:
    shutil.copytree(str(template_dir), str(dest_dir), ignore=ignore_fn, dirs_exist_ok=True)
except PermissionError as e:
    raise PermissionError(
        f"Cannot write files to {dest_dir}.\n"
        f"Why: Permission denied.\n"
        f"Fix: chmod u+w {dest_dir}  (macOS/Linux) or check folder properties (Windows)"
    ) from e
except OSError as e:
    raise OSError(f"Cannot copy template files: {e}. Check available disk space.") from e
```

**Python: wrap init body in `init_cmd.py`:**

```python
try:
    # ... existing init body ...
except (PermissionError, OSError) as e:
    console.print(f"[red]Error:[/red] {e}")
    raise typer.Exit(1)
except Exception as e:
    console.print(f"[red]Unexpected error:[/red] {e}")
    raise typer.Exit(1)
```

### Pattern 4: ci.yml Rename Guard (UX-04)

**TS — add `existsSync(ciPath)` check (line 90–93 of current `copy-templates.ts`):**

```typescript
// Source: direct codebase reading — copy-templates.ts lines 88–94
if (!minimal) {
  const variantPath = join(destDir, '.github', 'workflows', selectedVariant)
  const ciPath = join(destDir, '.github', 'workflows', 'ci.yml')
  if (existsSync(variantPath)) {
    if (existsSync(ciPath)) {
      // ponytail: UX-04 — skip rename, existing ci.yml preserved
      skippedForOutput.push('.github/workflows/ci.yml')
    } else {
      await rename(variantPath, ciPath)
    }
  }
}
```

**Python — add `ci_path.exists()` check:**

```python
if not minimal:
    variant_path = dest_dir / ".github" / "workflows" / selected_variant
    ci_path = dest_dir / ".github" / "workflows" / "ci.yml"
    if variant_path.exists():
        if ci_path.exists():
            skipped.append(".github/workflows/ci.yml")  # ponytail: UX-04
        else:
            variant_path.rename(ci_path)
```

### Pattern 5: --minimal Filter Expansion (MIN-01)

**TS — change filter in `copy()` callback:**

```typescript
// Current (line 77):
if (minimal && src.includes('.github/workflows')) return false

// After (MIN-01):
if (minimal && src.includes('.github')) return false
if (minimal && src.includes('docs')) return false
```

**Note:** `docs/` contains only `onboarding.md` currently. Checking `src.includes('docs')` is safe because no template file outside of `docs/` has "docs" in its path. However, the more precise check is `src.includes(join('docs', ''))` or checking the relative path — verify against the path separator on each platform.

**Safer TS approach using relative path:**

```typescript
const rel = relative(templateDir, src)
if (minimal && (rel.startsWith('.github') || rel.startsWith('docs'))) return false
```

**Python — change `ignore_fn` filter:**

```python
# Current (lines 68-69):
if minimal and ".github" in rel.parts and "workflows" in rel.parts:
    ignored.add(name)

# After (MIN-01):
if minimal and (".github" in rel.parts or "docs" in rel.parts):
    ignored.add(name)
```

### Pattern 6: --dry-run --minimal Fix (MIN-02)

**TS — thread `minimal` into dry-run path in `init.ts`:**

```typescript
// Current (line 24–28):
if (dryRun) {
  const files = await listTemplateFiles(templateDir)
  // ...

// After (MIN-02): filter the list before display
if (dryRun) {
  const allFiles = await listTemplateFiles(templateDir)
  const files = minimal
    ? allFiles.filter(f => !f.startsWith('.github') && !f.startsWith('docs'))
    : allFiles.filter(f => !ciVariants.some(v => f.endsWith(v) && v !== `ci-${projectType}.yml`))
  // ...
```

**Python — same fix in `init_cmd.py`:**

```python
if dry_run:
    files = list_template_files(template_dir)
    if minimal:
        files = [f for f in files if not f.startswith(".github") and not f.startswith("docs")]
    # ...
```

### Anti-Patterns to Avoid

- **Interactive prompts for non-empty dir:** UX-01 is a notice, NOT a confirm prompt. Adding `confirm()` from `@clack/prompts` would break the zero-config principle and NPM-02.
- **New error module/registry:** Do not create a centralized error catalog. Inline error strings at the point of failure, as already done in `install-headroom.ts`.
- **Walking `destDir` to compute `written`:** Walking the whole dest dir post-copy and comparing to a pre-copy snapshot is O(n) but n is small (under 30 files). Acceptable. Do not add database-style change tracking.
- **Changing `listTemplateFiles` signature:** `listTemplateFiles` is also used by `upgrade.ts`. Do not add a `minimal` parameter to it. Instead filter the result at the call site in `init.ts`.
- **Logging to stdout vs stderr:** `@clack/prompts` uses stderr internally. Do not split output manually — defer to the library.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pre-existing file detection | Custom recursive walker | `readdirSync(cwd)` — one-level read is sufficient | Only need to know "is cwd empty?", not a full tree |
| Error pretty-printing (TS) | Custom formatter | `@clack/prompts` `cancel()` | Already in use; handles spinner cleanup + stderr |
| Error pretty-printing (Python) | Custom formatter | Rich `console.print()` with `[red]` markup | Already in use in `init_cmd.py` |
| Return type serialization | TypedResult class | Plain `{ written, skipped }` object (TS) / `tuple[list, list]` (Python) | No serialization needed; local function return |

**Key insight:** Every tool needed for Phase 6 is already installed and already used in the codebase. This phase adds no surface area — it only corrects behavior within existing surfaces.

---

## Common Pitfalls

### Pitfall 1: Return Type Ripple Breaks Existing Tests

**What goes wrong:** Changing `copyTemplates` return from `string[]` to `{ written, skipped }` breaks every existing test that calls `copyTemplates` and asserts on the returned value. The TS compiler catches the `init.ts` call site but does NOT catch the test file assertions (tests use `vi.mocked().mockResolvedValue(['CLAUDE.md', ...])`).

**Why it happens:** Mocked return values in `init.test.ts` are typed as `string[]` (lines 78, 119, 172). After the return type changes, these mocks need to return `{ written: [...], skipped: [] }`. TypeScript will flag the mock calls if `copyTemplates` is properly typed.

**How to avoid:** Update `init.test.ts` mocks first, then change the implementation. The failing tests confirm the change is applied correctly (TDD order: update test mocks → update implementation → green).

**Specifically in `init.test.ts`:**
- Line 78: `vi.mocked(copyTemplates).mockResolvedValue(['CLAUDE.md', 'README.md'])` → `{ written: ['CLAUDE.md', 'README.md'], skipped: [] }`
- Line 119: same pattern
- Line 172: same pattern

**Warning signs:** `expect(fileListCall![0]).toContain('CLAUDE.md')` test still passes even with the wrong mock shape if `init.ts` does not destructure correctly — test may pass for wrong reasons. Verify the note title changes too.

**In Python:** `test_copy_templates.py` tests assert `isinstance(result, list)`. After the change, they must assert `isinstance(result, tuple)` or the function returns a named tuple / dataclass. Decide the Python return shape before updating tests.

### Pitfall 2: Python Return Shape Decision (tuple vs dataclass vs TypedDict)

**What goes wrong:** Python has no equivalent to TS's inline object return. Options: named tuple, dataclass, plain tuple `(written, skipped)`, or dict.

**Recommendation:** Plain two-tuple `(list[str], list[str])` — mirrors what the existing `ignore_fn` closure already accumulates. No import needed. One-liner destructure: `written, skipped = copy_templates(...)`.

**Do not use a dataclass** — that would be an abstraction for which there is one use case. Ponytail says no.

**Warning sign:** If `test_copy_templates.py` checks `isinstance(result, list)` (line 57: `assert isinstance(result, list)`), update it to `isinstance(result, tuple)`.

### Pitfall 3: `docs/` Filter Path Separator on Windows

**What goes wrong:** `src.includes('docs')` matches the string `'docs'` anywhere in the path. On Windows, `src` uses backslashes. A template file at `.claude\skills\caveman\docs_reference.md` (hypothetical) would be falsely excluded.

**How to avoid:** Use path-relative comparison:
```typescript
const rel = relative(templateDir, src)
if (minimal && (rel.startsWith('.github') || rel.startsWith('docs' + sep))) return false
```
Or check `rel.split(sep)[0] === 'docs'` for the top-level directory only.

**Current template inventory:** The only file under `docs/` is `docs/onboarding.md`. No other template path contains "docs" as a segment. The simpler `rel.startsWith('docs')` is safe for the current template set but may break if future templates add `docs/` in nested paths. Either approach is acceptable; document the choice with a `ponytail:` comment.

### Pitfall 4: `readdirSync` Includes `.git` and `.DS_Store`

**What goes wrong:** In any git-initialized directory, `readdirSync(cwd)` returns `['.git']`. The notice fires for every git-initialized project, including fresh `git init` dirs that have no user files yet.

**How to avoid:** Filter out dot entries or known git artifacts before deciding "non-empty":
```typescript
const existingEntries = readdirSync(cwd).filter(e => e !== '.git' && e !== '.DS_Store')
if (existingEntries.length > 0) { ... }
```

Or more precisely: "any non-hidden entry exists" — though `.github/` is hidden and goodvibes writes there. The simplest correct check: ignore only `.git` specifically. `.DS_Store` is worth ignoring too on macOS.

### Pitfall 5: `cancel()` Terminates Without Calling `process.exit()`

**What goes wrong:** `@clack/prompts` `cancel()` prints the message and calls `process.exit(1)` internally — OR it does not, depending on version. If it does not, the code after `cancel(msg)` continues executing.

**How to avoid:** Always follow `cancel(msg)` with explicit `process.exit(1)`. This is belt-and-suspenders and matches the existing pattern in `configure-mcp.ts` where explicit exits are used.

**Verified behavior from codebase:** `install-headroom.ts` does not use `cancel()` — it uses the `log` callback to report failures softly. Phase 6 error handling in `init.ts` is a harder failure path (file system errors) that warrants `process.exit(1)`.

### Pitfall 6: Python `ignore_fn` Captures Wrong Relative Path

**What goes wrong:** Inside `ignore_fn`, the `directory` argument is the absolute path of the directory being processed, not the template root. To compute a relative path from `dest_dir`, the code must compute `dest_candidate = dest_dir / rel` where `rel` is computed from `template_dir`, not from `directory`.

**The existing code in `copy_templates.py` (lines 62-65) already does this correctly** using `full.relative_to(template_dir)`. The skipped-path capture must also use `dest_candidate.relative_to(dest_dir)` to produce a path consistent with the written-files list.

**Warning sign:** If `skipped` paths use `dest_dir`-relative paths but `written` paths use something else, the final display will show inconsistent formats.

### Pitfall 7: next-steps note for --minimal (UX requirement from ROADMAP)

**Scope clarification:** The ROADMAP Phase 6 success criterion #3 states: "the completion next-steps block notes what was skipped and how to add it later." This is not an explicit requirement ID but is implied by UX-01 + MIN-01. The planner should include a next-steps note variation for `--minimal` runs: add a line "CI workflows and docs were skipped. Run `goodvibes init` without --minimal to add them." This was identified as pitfall M2 in PITFALLS.md and maps directly to the ROADMAP success criterion.

---

## Code Examples

### Verified Pattern: `@clack/prompts` `cancel()` usage

```typescript
// Source: @clack/prompts readme — packages/npm/node_modules/@clack/prompts/README.md
// cancel() prints with a red X prefix and exits the spinner context cleanly
import { cancel } from '@clack/prompts'

cancel('Something went wrong — check permissions and try again.')
process.exit(1)
```

### Verified Pattern: Python tuple return destructure

```python
# Source: Python stdlib — no import needed
written, skipped = copy_templates(template_dir, cwd, dry_run=False, minimal=minimal, project_type=project_type)
```

### Verified Pattern: `existsSync` before rename (already present in codebase)

```typescript
// Source: packages/npm/src/steps/copy-templates.ts line 91 (existing pattern)
if (existsSync(variantPath)) {
  await rename(variantPath, ciPath)
}
// After UX-04: add inner guard
if (existsSync(variantPath) && !existsSync(ciPath)) {
  await rename(variantPath, ciPath)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `copyTemplates` returns all dest files | `copyTemplates` returns `{written, skipped}` | Phase 6 | Enables accurate "X written, Y skipped" display |
| `--minimal` skips only `.github/workflows/` | `--minimal` skips all `.github/` and `docs/` | Phase 6 | Matches user mental model of "minimal = CLAUDE.md + skills only" |
| `--dry-run --minimal` shows CI files | `--dry-run --minimal` shows only minimal file set | Phase 6 | Dry-run preview is accurate |
| ci.yml rename silently clobbers | ci.yml rename skipped if dest exists | Phase 6 | Prevents overwriting custom CI configs |
| Raw exceptions surface to terminal | Caught, plain-English message, exit 1 | Phase 6 | Beginner-safe error output |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `readdirSync(cwd)` (synchronous) is acceptable in the async action handler before `tasks()` | Pattern 2 | If cwd is a very large directory, sync read blocks the event loop momentarily — acceptable for a CLI tool |
| A2 | `docs/` filter using `rel.startsWith('docs')` is safe for current template set | Pitfall 3 | If future templates add a file with "docs" in a non-top-level path segment, the filter may over-exclude |
| A3 | `.git` and `.DS_Store` are the only entries worth filtering from the non-empty check | Pitfall 4 | Other hidden files (e.g., `.env`, `.node_version`) also exist in real projects; filtering only `.git` may still trigger the notice in common cases |
| A4 | Python plain tuple `(list[str], list[str])` is the correct return shape for `copy_templates` | Pitfall 2 | If a future caller needs named fields, the tuple is harder to refactor than a dataclass — but YAGNI applies here |

---

## Open Questions

1. **Non-empty dir: notice vs warning severity**
   - What we know: ROADMAP says "shows a notice before any files are written" (not a prompt, not abort)
   - What's unclear: Should the notice appear before `intro()` or after? Currently `intro('goodvibes init')` is the first output.
   - Recommendation: Place the notice after `intro()` but before `tasks()` — this matches the flow of: greet → warn → proceed.

2. **`skipped` count for CLAUDE.md**
   - What we know: CLAUDE.md is handled via sentinel merge, not direct copy. If a CLAUDE.md already exists and is merged (Case D: same version — no change), should it appear in `written` or `skipped`?
   - Recommendation: Treat CLAUDE.md as "written" if `mergeClaude` made any change, "skipped" otherwise. For simplicity in Phase 6, treat it as always "written" — the sentinel merge is not a no-op to the user even when idempotent.

3. **`--force` flag for power users (deferred)**
   - Already deferred to v1.2 in STATE.md. Do not implement in Phase 6.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 6 is purely in-code changes to existing files using already-installed dependencies. No external tools, services, or CLIs beyond what Phase 2-5 already verified.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| TS Framework | vitest v4.1.9 |
| TS Config file | packages/npm/vitest.config.ts (or inline package.json) |
| TS Quick run | `npm run test --prefix packages/npm` |
| TS Full suite | `npm run test --prefix packages/npm` (same — no separate integration) |
| Python Framework | pytest + pytest-mock |
| Python Quick run | `cd packages/pip && uv run pytest tests/ -q` |
| Python Full suite | `cd packages/pip && uv run pytest tests/ -q` |

**Baseline (verified 2026-06-26):**
- TS: 8 test files passed, 1 skipped, 60 tests passed — no failures
- Python: all tests passed (excluding test_main.py + test_upgrade_cmd.py which require installed package)

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | File | Automated Command |
|--------|----------|-----------|------|-------------------|
| UX-01 | Non-empty dir prints notice, not abort | unit | `src/commands/init.test.ts` | `npm run test --prefix packages/npm` |
| UX-01 | Non-empty dir notice — Python equivalent | unit | `packages/pip/tests/test_init_cmd.py` (new) | `uv run pytest tests/ -q` |
| UX-02 | `copyTemplates` returns `{written, skipped}` tuple | unit | `src/steps/copy-templates.test.ts` (update) | `npm run test --prefix packages/npm` |
| UX-02 | note() called twice — "Files written" + "Files skipped" | unit | `src/commands/init.test.ts` (update) | `npm run test --prefix packages/npm` |
| UX-02 | `copy_templates` returns `(written, skipped)` tuple | unit | `tests/test_copy_templates.py` (update) | `uv run pytest tests/ -q` |
| UX-03 | EACCES error → `cancel()` + exit 1, no stack trace | unit | `src/commands/init.test.ts` | `npm run test --prefix packages/npm` |
| UX-03 | PermissionError → Rich error panel + typer.Exit(1) | unit | `packages/pip/tests/test_init_cmd.py` (new) | `uv run pytest tests/ -q` |
| UX-04 | Existing `ci.yml` skipped, not overwritten | unit | `src/steps/copy-templates.test.ts` (new case) | `npm run test --prefix packages/npm` |
| UX-04 | Existing `ci.yml` skipped — Python | unit | `tests/test_copy_templates.py` (new case) | `uv run pytest tests/ -q` |
| MIN-01 | `--minimal` skips `.github/ISSUE_TEMPLATE/` | unit | `src/steps/copy-templates.test.ts` (new case) | `npm run test --prefix packages/npm` |
| MIN-01 | `--minimal` skips `docs/` | unit | `src/steps/copy-templates.test.ts` (new case) | `npm run test --prefix packages/npm` |
| MIN-01 | `--minimal` keeps CLAUDE.md and skills | unit | `src/steps/copy-templates.test.ts` (new case) | `npm run test --prefix packages/npm` |
| MIN-01 | Python equivalent — all three cases | unit | `tests/test_copy_templates.py` (new cases) | `uv run pytest tests/ -q` |
| MIN-02 | `--dry-run --minimal` output excludes `.github/` | unit | `src/commands/init.test.ts` (new case) | `npm run test --prefix packages/npm` |
| MIN-02 | `--dry-run --minimal` output excludes `docs/` | unit | `src/commands/init.test.ts` (new case) | `npm run test --prefix packages/npm` |
| MIN-02 | Python dry-run + minimal combination | unit | `packages/pip/tests/test_init_cmd.py` (new) | `uv run pytest tests/ -q` |

### Wave 0 Gaps

The following test cases do not currently exist and must be added before or alongside implementation:

- [ ] `src/commands/init.test.ts` — case: `--dry-run --minimal` does NOT include `.github/` or `docs/` files in preview
- [ ] `src/commands/init.test.ts` — case: non-empty dir triggers informational note before tasks
- [ ] `src/commands/init.test.ts` — case: `note()` called with both "Files written" and "Files skipped" titles (after return type change)
- [ ] `src/steps/copy-templates.test.ts` — case: returns `{ written, skipped }` shape (update existing return assertions)
- [ ] `src/steps/copy-templates.test.ts` — case: existing `ci.yml` preserved when rename would clobber it
- [ ] `src/steps/copy-templates.test.ts` — case: `--minimal` skips `.github/ISSUE_TEMPLATE/` (not just workflows)
- [ ] `src/steps/copy-templates.test.ts` — case: `--minimal` skips `docs/`
- [ ] `packages/pip/tests/test_init_cmd.py` — new file covering: non-empty notice, written/skipped display, error exit, dry-run+minimal
- [ ] `packages/pip/tests/test_copy_templates.py` — update `isinstance(result, list)` assertions to `isinstance(result, tuple)` (or equivalent)
- [ ] `packages/pip/tests/test_copy_templates.py` — new cases: ci.yml guard, minimal skips .github, minimal skips docs

**Framework install:** Not needed — vitest and pytest are already installed and passing.

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`. Phase 6 is a UX-only change with no new input surfaces, no authentication, no network calls, and no secrets handling. ASVS categories applicable to this phase:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Partial | Path traversal guard already in `copy-templates.ts` line 79 and `copy_templates.py` lines 54-58; preserve these guards in the refactored version |
| V6 Cryptography | No | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via template file names | Tampering | Existing guard: `relative(templateDir, src).includes('..')` check (TS) and `full.resolve().relative_to(template_dir.resolve())` (Python) — preserve in refactor |

**No new threat surface introduced by Phase 6.** The error messages must not include the raw exception stack trace (UX-03 requirement) — this also avoids leaking internal file paths in production output.

---

## File Change Map (complete)

| File | Status | Requirements | Nature of Change |
|------|--------|--------------|-----------------|
| `packages/npm/src/steps/copy-templates.ts` | MODIFY | UX-02, UX-04, MIN-01 | Return `{written, skipped}`; ci.yml guard; expand minimal filter |
| `packages/npm/src/commands/init.ts` | MODIFY | UX-01, UX-02, UX-03, MIN-02 | Non-empty notice; destructure return; try/catch; dry-run minimal fix |
| `packages/npm/src/steps/copy-templates.test.ts` | MODIFY | UX-02, UX-04, MIN-01 | Update return shape assertions; add ci.yml guard test; add minimal scope tests |
| `packages/npm/src/commands/init.test.ts` | MODIFY | UX-01, UX-02, UX-03, MIN-02 | Update mock return shapes; add new test cases |
| `packages/pip/src/goodvibes_cli/steps/copy_templates.py` | MODIFY | UX-02, UX-04, MIN-01 | Return `(written, skipped)` tuple; ci.yml guard; expand minimal filter |
| `packages/pip/src/goodvibes_cli/commands/init_cmd.py` | MODIFY | UX-01, UX-02, UX-03, MIN-02 | Non-empty notice; unpack return; try/except; dry-run minimal fix |
| `packages/pip/tests/test_copy_templates.py` | MODIFY | UX-02, UX-04, MIN-01 | Update return shape assertions; add new cases |
| `packages/pip/tests/test_init_cmd.py` | NEW | UX-01, UX-02, UX-03, MIN-02 | Full coverage of init_cmd changes |

**New files:** `test_init_cmd.py` (Python) — this test file does not currently exist.
**No new source modules.**

---

## Sources

### Primary (HIGH confidence — direct code reading)

- `packages/npm/src/steps/copy-templates.ts` — full code read; return value, rename guard, minimal filter confirmed
- `packages/npm/src/commands/init.ts` — full code read; dry-run path, task list, note calls confirmed
- `packages/pip/src/goodvibes_cli/steps/copy_templates.py` — full code read; ignore_fn closure, skipped-file tracking mechanism confirmed
- `packages/pip/src/goodvibes_cli/commands/init_cmd.py` — full code read; dry-run path, display calls confirmed
- `packages/npm/src/steps/copy-templates.test.ts` — full read; existing test assertions catalogued
- `packages/pip/tests/test_copy_templates.py` — full read; `isinstance(result, list)` assertion at line 57 catalogued
- `packages/npm/src/commands/init.test.ts` — full read; mock return shapes catalogued
- `templates/` directory listing — confirmed `.github/` structure and `docs/` contents
- `.planning/research/ARCHITECTURE.md` — confirmed file change map and touch points
- `.planning/research/FEATURES.md` — confirmed existing-project hardening patterns and --minimal semantics
- `.planning/research/PITFALLS.md` — confirmed M1 through M8 pitfall details

### Secondary (HIGH confidence — verified milestone research)

- `.planning/STATE.md` decisions section — Phase 06 decisions block confirms: no new deps, return type change scope, minimal filter scope, dry-run bug description, ci.yml overwrite bug
- `.planning/REQUIREMENTS.md` — UX-01 through MIN-02 requirement text verified
- `.planning/ROADMAP.md` — Phase 6 success criteria verified (5 criteria)

---

## Metadata

**Confidence breakdown:**
- Return type change (UX-02): HIGH — code read confirms exact current shape and single call site
- Non-empty dir notice (UX-01): HIGH — `readdirSync` is stdlib; `note()` is already used in init.ts
- ci.yml guard (UX-04): HIGH — `existsSync` already imported; pattern already used on line 91
- Error wrapping (UX-03): HIGH — `cancel()` is already imported in `@clack/prompts` vi.mock list; try/catch is stdlib
- --minimal filter expansion (MIN-01): HIGH — filter is two lines; template inventory confirmed
- --dry-run --minimal fix (MIN-02): HIGH — bug location confirmed in init.ts line 25

**Research date:** 2026-06-26
**Valid until:** 2026-07-26 (stable codebase; only invalidated by changes to the four core files)
