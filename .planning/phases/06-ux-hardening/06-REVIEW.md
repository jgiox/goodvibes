---
phase: 06-ux-hardening
reviewed: 2026-06-26T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - packages/npm/src/commands/init.test.ts
  - packages/npm/src/commands/init.ts
  - packages/npm/src/steps/copy-templates.test.ts
  - packages/npm/src/steps/copy-templates.ts
  - packages/pip/src/goodvibes_cli/commands/init_cmd.py
  - packages/pip/src/goodvibes_cli/steps/copy_templates.py
  - packages/pip/tests/conftest.py
  - packages/pip/tests/test_copy_templates.py
  - packages/pip/tests/test_init_cmd.py
  - packages/pip/tests/test_main.py
findings:
  critical: 3
  warning: 5
  info: 2
  total: 10
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-06-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Ten files reviewed across the npm and pip packages for the UX hardening phase. The implementations add
non-empty directory detection, written/skipped split reporting, dry-run preview, minimal mode, and
structured error messages.

Three blockers were found. First, the EACCES error code is silently erased inside `copy-templates.ts`
when the error is re-wrapped in a plain `Error`, making the friendly permission-denied message in
`init.ts` permanently unreachable in production — the UX-03 test only appears to exercise this path
because it mocks `tasks()` directly with `.code` already set. Second, both the TypeScript and Python
implementations allow the selected CI variant file (e.g. `ci-node.yml`) to be re-copied from the
template on every run after the first, leaving an orphaned variant file in the destination that is never
cleaned up. Third, the `test_dry_run_no_files_written` test in `test_main.py` patches
`list_template_files` on the wrong module namespace, so the mock is never called on the non-minimal
dry-run path; the assertion uses an `or "Dry run"` short-circuit that makes the file-list check
vacuous.

Five warnings cover dead code (an unused `log_copy` closure), a UX inconsistency (dry-run preview names
differ from written file names), a Windows path-separator mismatch in a hardcoded string, fragile
`importlib.resources` usage, and a code-duplication between two near-identical walk functions in
TypeScript.

## Critical Issues

### CR-01: EACCES error code is erased before reaching the friendly-message branch in `init.ts`

**File:** `packages/npm/src/steps/copy-templates.ts:98-103`

**Issue:** When `fs-extra.copy()` throws an `EACCES` or `EPERM` error, the catch block in
`copyTemplates` wraps it in `new Error(...)` — a plain `Error` with no `.code` property:

```typescript
throw new Error(`Cannot copy template files: ${err.message}. ${hint}`)
```

This error then propagates through `tasks()` and is caught in `init.ts` at lines 88-95. Because the
re-wrapped error has no `.code`, the check `err.code === 'EACCES' || err.code === 'EPERM'` is always
`false`, and users always see the generic `"Setup failed: Cannot copy template files: EACCES..."` message
instead of the beginner-friendly `"Cannot write files to ... Fix: chmod u+w ..."` message. The
permission-error UX path added in this phase is completely unreachable in production.

The UX-03 test (`init.test.ts:365-391`) passes only because it mocks `tasks()` to reject with an error
that already has `.code = 'EACCES'` set — bypassing the real error chain entirely.

**Fix:** Preserve `.code` when re-throwing, either by attaching it to the new error or by not
discarding it:

```typescript
// In copy-templates.ts catch block:
const wrappedErr = new Error(`Cannot copy template files: ${err.message}. ${hint}`) as NodeJS.ErrnoException
wrappedErr.code = err.code
throw wrappedErr
```

Or, simpler — do not re-wrap; just augment the message and re-throw:

```typescript
err.message = `Cannot copy template files: ${err.message}. ${hint}`
throw err
```

---

### CR-02: Selected CI variant file is re-copied and orphaned on every run after the first (both implementations)

**File:** `packages/npm/src/steps/copy-templates.ts:80-116` and `packages/pip/src/goodvibes_cli/steps/copy_templates.py:54-101`

**Issue:** On the first run with `project_type='node'`:
1. The filter/`ignore_fn` passes `ci-node.yml` through (it is the selected variant).
2. `ci-node.yml` is written to `dest/.github/workflows/ci-node.yml`.
3. The rename step renames it to `ci.yml`.

On the second run:
1. `ci-node.yml` no longer exists in `dest` (it was renamed).
2. The no-clobber guard (`overwrite: false` in TypeScript; `dest_candidate.is_file()` in Python)
   does not fire because `ci-node.yml` is absent.
3. `ci-node.yml` is re-copied from the template.
4. The rename step finds `ci.yml` already exists → skips rename → `ci-node.yml` is left orphaned in
   `dest/.github/workflows/ci-node.yml`.

Result: every subsequent `goodvibes init` leaves a stale, user-visible `ci-node.yml` (or `ci-both.yml`
/ `ci-python.yml`) next to `ci.yml`. This will confuse beginners. No test detects the orphaned file.

**Fix:** Add the selected variant path to the skip check during copy (not just non-selected variants),
and only copy it when the rename target (`ci.yml`) does not yet exist:

```typescript
// In the filter function:
// Skip the selected variant if ci.yml already exists at dest — it was already renamed.
const destCiPath = join(destDir, '.github', 'workflows', 'ci.yml')
if (ciVariants.includes(path.basename(src)) && existsSync(destCiPath)) return false
```

Python equivalent:

```python
# In ignore_fn, after the ci_variants check:
if name == selected_variant and (dest_dir / ".github" / "workflows" / "ci.yml").is_file():
    ignored.add(name)
```

---

### CR-03: `test_dry_run_no_files_written` mocks the wrong module; file-list assertion is vacuously true

**File:** `packages/pip/tests/test_main.py:38-51`

**Issue:** The test patches `goodvibes_cli.commands.init_cmd.list_template_files` but invokes
`goodvibes init --dry-run` without `--minimal`. In `init_cmd.py`, the non-minimal dry-run path
calls `copy_templates(dry_run=True, ...)`, which in turn calls `list_template_files` from
`goodvibes_cli.steps.copy_templates` — a different module namespace than the one patched. The mock is
never called. `copy_templates` runs against the real (empty) `tmp_path`, returning an empty list.

The assertion `"CONTRIBUTING.md" in result.output or "Dry run" in result.output` short-circuits on
`"Dry run"` (which always appears in the panel title), so the test passes regardless of the file
list. The test provides no real coverage of the dry-run file preview content.

**Fix:** Either patch `copy_templates` entirely on the `init_cmd` namespace, or use `--minimal` to
exercise the `list_template_files` path that the mock was intended for:

```python
# Option A: mock the function the non-minimal dry-run path actually calls
mocker.patch(
    "goodvibes_cli.commands.init_cmd.copy_templates",
    return_value=(["CONTRIBUTING.md", "CLAUDE.md"], []),
)
result = runner.invoke(app, ["init", "--dry-run"])
assert "CONTRIBUTING.md" in result.output
assert list(tmp_path.iterdir()) == []

# Option B: use --minimal to match the mocked code path
result = runner.invoke(app, ["init", "--dry-run", "--minimal"])
assert "CONTRIBUTING.md" in result.output
```

---

## Warnings

### WR-01: `log_copy` closure is defined but never passed to `copy_templates` (dead code)

**File:** `packages/pip/src/goodvibes_cli/commands/init_cmd.py:61-67`

**Issue:** Lines 62-63 define a `log_copy` closure that updates the Rich status spinner. The function
is never passed as an argument to `copy_templates` (which does not accept a callback anyway). The
closure captures `status` but is unreachable. It misleads maintainers into thinking progress
messages are being forwarded during the copy step.

```python
with console.status("Copying template files") as status:
    def log_copy(msg: str) -> None:  # defined here...
        status.update(msg)
    written, skipped = copy_templates(...)  # ...but never passed here
```

**Fix:** Delete `log_copy`. If live progress messages from `copy_templates` are wanted in the future,
the step function signature must be extended to accept a callback first.

---

### WR-02: Dry-run preview shows variant filenames (`ci-node.yml`) but actual write produces `ci.yml`

**File:** `packages/npm/src/commands/init.ts:35-38` and `packages/pip/src/goodvibes_cli/steps/copy_templates.py:45-50`

**Issue:** In both the TypeScript and Python implementations, the dry-run path filters out
non-selected CI variants but keeps the selected one by its variant name (e.g. `ci-node.yml`). The
preview therefore says `"Would write: .github/workflows/ci-node.yml"`. However, the actual write
renames the file to `ci.yml`. A beginner following the dry-run output would not see `ci.yml` anywhere
in the preview, and would be confused when it appears after a real run.

**Fix:** In the dry-run file list, replace the selected variant filename with the renamed target name:

```typescript
// TypeScript — in the dry-run filter result:
const files = minimal
  ? allFiles.filter(...)
  : allFiles
      .filter(f => !ciVariants.some((v) => f.endsWith(v) && v !== selectedVariant))
      .map(f => f.endsWith(selectedVariant) ? f.replace(selectedVariant, 'ci.yml') : f)
```

```python
# Python — in copy_templates dry_run branch:
all_files = [
    p.replace(selected_variant, "ci.yml") if p.endswith(selected_variant) else p
    for p in list_template_files(template_dir)
    if not any(p.endswith(v) and v != selected_variant for v in ci_variants)
]
```

---

### WR-03: Hardcoded forward-slash path `.github/workflows/ci.yml` causes classification mismatch on Windows

**File:** `packages/npm/src/steps/copy-templates.ts:112` and `packages/pip/src/goodvibes_cli/steps/copy_templates.py:99`

**Issue:** Both implementations push the literal string `'.github/workflows/ci.yml'` (or
`".github/workflows/ci.yml"`) into the skipped list when an existing `ci.yml` blocks the rename.
On Windows, `path.relative()` (TypeScript) and `pathlib.Path.relative_to()` (Python) produce
backslash-separated strings. The skip-list entry with forward slashes will not match entries in
`allDestFiles` / `all_dest` produced by the OS-native path separator, causing `ci.yml` to appear in
the `written` list even when it was skipped, and potentially appearing in neither list on Windows.

**Fix:** Use `path.join` / `pathlib.Path` to build the skip entry rather than a string literal:

```typescript
// TypeScript:
skippedFiles.push(join('.github', 'workflows', 'ci.yml'))
```

```python
# Python:
skipped_files.append(str(pathlib.Path(".github") / "workflows" / "ci.yml"))
```

---

### WR-04: `importlib.resources.files()` wrapped in `Path(str(...))` is fragile for zip-installed wheels

**File:** `packages/pip/src/goodvibes_cli/steps/copy_templates.py:13-17`

**Issue:** `importlib.resources.files("goodvibes_cli").joinpath("templates")` returns a
`Traversable`, which may point into a zip archive if the package is installed without extraction
(e.g. via `--no-binary` or inside a zipapp). Casting with `Path(str(ref))` produces a path that
`Path.exists()` returns `False` for zip entries, so the code raises
`FileNotFoundError("goodvibes template files not found")` even though the resources are present. The
comment acknowledges this as a compatibility fix but the problem it fixes (`str/PathLike
compatibility`) is distinct from the zip-entry problem it does not fix.

**Fix:** Use `importlib.resources.as_file()` to materialize the directory to a real filesystem
location before passing it to `shutil.copytree`. This requires a context manager in the calling
code, or a temporary-directory extraction at startup.

```python
import contextlib
import importlib.resources

@contextlib.contextmanager
def _templates_as_path():
    ref = importlib.resources.files("goodvibes_cli").joinpath("templates")
    with importlib.resources.as_file(ref) as path:
        yield path
```

---

### WR-05: `walkDir` and the inner `walk` closure in `listTemplateFiles` are near-identical duplicates

**File:** `packages/npm/src/steps/copy-templates.ts:22-53`

**Issue:** `listTemplateFiles` defines an inner recursive `walk(dir)` closure (lines 25-36) that
accumulates relative paths. `walkDir(dir, base)` (lines 41-53) does the same thing with an explicit
`base` argument. Both use `readdir` with `withFileTypes` and recursive calls. `walkDir` is used
only in `copyTemplates` and could be replaced by a call to `listTemplateFiles(base)` (with a
`base`-relative path return already guaranteed). The duplication means any bug fix (e.g. the Windows
separator issue in WR-03) must be applied in two places.

**Fix:** Remove `walkDir` and replace its two call sites with `listTemplateFiles`:

```typescript
// Line 74 (existingBefore):
const beforeFiles = await listTemplateFiles(destDir).catch(() => [])

// Line 125 (after copy):
const allDestFiles = await listTemplateFiles(destDir)
```

---

## Info

### IN-01: Mixed `node:fs/promises` and `fs/promises` import styles in `copy-templates.ts`

**File:** `packages/npm/src/steps/copy-templates.ts:2-3`

**Issue:** Line 2 imports from `'node:fs/promises'` (explicit node: protocol) while line 3 imports
from `'fs/promises'` (bare specifier). Both resolve to the same module, but the inconsistency is
against the project's minimalism conventions and may confuse lint tooling.

**Fix:** Use the `node:` prefix consistently:

```typescript
import { readFile, rename, readdir } from 'node:fs/promises'
```

---

### IN-02: `intro` is destructured but never asserted in most test blocks

**File:** `packages/npm/src/commands/init.test.ts:47, 85, 126, 180, 211`

**Issue:** Several `describe` blocks destructure `intro` from the `@clack/prompts` mock import but
never use it in assertions. TypeScript should emit an unused-variable warning for these. They are
harmless but add visual noise.

**Fix:** Remove unused `intro` from each destructuring that does not assert on it:

```typescript
// Before:
const { intro, outro, note, tasks } = await import('@clack/prompts')
// After (when intro is not asserted):
const { outro, note, tasks } = await import('@clack/prompts')
```

---

_Reviewed: 2026-06-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
