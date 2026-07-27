---
phase: 14-goodvibes-update-with-manifest
reviewed: 2026-07-27T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - packages/npm/src/commands/init.ts
  - packages/npm/src/commands/init.test.ts
  - packages/npm/src/commands/update.ts
  - packages/npm/src/commands/update.test.ts
  - packages/npm/src/commands/upgrade.ts
  - packages/npm/src/index.ts
  - packages/npm/src/steps/write-manifest.ts
  - packages/npm/src/steps/write-manifest.test.ts
  - packages/npm/src/utils/sentinel-merge.ts
  - packages/npm/src/utils/sentinel-merge.test.ts
  - packages/pip/src/goodvibes_cli/commands/init_cmd.py
  - packages/pip/src/goodvibes_cli/commands/update_cmd.py
  - packages/pip/src/goodvibes_cli/main.py
  - packages/pip/src/goodvibes_cli/steps/write_manifest.py
  - packages/pip/tests/conftest.py
  - packages/pip/tests/test_init_cmd.py
  - packages/pip/tests/test_update_cmd.py
  - packages/pip/tests/test_write_manifest.py
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-07-27
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

This phase introduces the `goodvibes update` command (manifest-based file refresh) across both the npm (TypeScript) and pip (Python) packages, plus a `write-manifest` utility, sentinel-merge utilities, and supporting tests. The TypeScript implementation is generally sound. The Python implementation contains a logic error that will corrupt every user's project on the first `update` run. There is also a path-traversal risk in both implementations via unsanitised manifest keys. Two additional warnings cover the `upgrade` command leaving a stale manifest, and a telemetry promise that can surface unexpected errors to users.

---

## Critical Issues

### CR-01: Python `update_cmd` CI variant check is always false — all three variant files written on every update

**File:** `packages/pip/src/goodvibes_cli/commands/update_cmd.py:46-72`

**Issue:** `ci_variants` is a set of bare filenames (`"ci-node.yml"`, `"ci-python.yml"`, `"ci-both.yml"`). `list_template_files()` returns full relative paths (`".github/workflows/ci-node.yml"`, etc.). The membership test `if tf in ci_variants` is therefore always `False` because a full path is never equal to a bare filename.

As a result, the entire filtering branch is dead. All three CI variant files fall through to the `else` branch (`dest_rel = tf`), none of them are in `managed_keys` (the manifest tracks `.github/workflows/ci.yml`, not the variant sources), and all three are appended to `net_new`. On every `goodvibes update` run, `.github/workflows/ci-node.yml`, `.github/workflows/ci-python.yml`, and `.github/workflows/ci-both.yml` are copied into the user's project regardless of their detected project type.

Compare with the TypeScript equivalent (update.ts:57–58) which correctly uses `templateFile.endsWith(v)` to match the filename portion of the full relative path:
```typescript
const isVariant = ciVariants.some(v => templateFile.endsWith(v))
if (isVariant && !templateFile.endsWith(selectedVariantSrc)) continue
```

The Python code also has a second defect in the same block: even if the first check were fixed, `tf != selected_variant_src` (line 68) compares a full path like `.github/workflows/ci-both.yml` against a bare filename like `ci-both.yml` — this comparison is also always `False`.

**Fix:**
```python
# Replace the broken set-membership check with suffix matching, mirroring the TS logic.
for tf in all_template_files:
    if tf == ".goodvibes.json":
        continue
    is_variant = any(tf.endswith(v) for v in ci_variants)
    if is_variant:
        if not tf.endswith(selected_variant_src):
            continue                             # skip unselected variants
        dest_rel = ".github/workflows/ci.yml"   # map selected variant to dest name
    else:
        dest_rel = tf
    if dest_rel not in managed_keys:
        net_new.append(dest_rel)
```

No test in `test_update_cmd.py` exercises the second pass with real CI variant paths because every test mocks `list_template_files` to return `[]`. A regression test that passes `[".github/workflows/ci-node.yml", ".github/workflows/ci-both.yml"]` and asserts only one is added to `net_new` is needed.

---

### CR-02: Path traversal via unsanitised manifest keys in both `update.ts` and `update_cmd.py`

**File:** `packages/npm/src/commands/update.ts:39,135,140,142` and `packages/pip/src/goodvibes_cli/commands/update_cmd.py:51,99,107,109`

**Issue:** Both implementations read `rel` (or `dest_rel`) directly from `manifest["files"]` keys and pass them to file operations without validating that the resulting path stays within `cwd`.

TypeScript:
```typescript
const destPath = join(cwd, rel)   // rel from manifest — never validated
...
await copy(templateSrc, join(cwd, rel), { overwrite: true })
```

Python:
```python
dest_path = cwd / rel            # rel from manifest — never validated
...
dest = cwd / rel
dest.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(str(template_src), str(dest))
```

`.goodvibes.json` is a plain text file committed to the project tree. In a repository hosted on a public forge (GitHub, GitLab), a malicious pull request that modifies `.goodvibes.json` to include a key like `"../../.ssh/authorized_keys"` would cause `goodvibes update` to overwrite that file on the maintainer's machine when they pull and run the command. The `net_new` path (second pass, template-sourced) is lower risk because the attacker would also need to control the installed template directory, but the first-pass `overwrite` path reads the hash from the manifest and categorises any absent file as safe to (re)create at the destination path — which is exploitable.

**Fix (both implementations):** Validate that resolved destination stays inside `cwd` before any file read or write. Add a helper and call it at the start of each loop:

TypeScript:
```typescript
function assertSafe(base: string, rel: string): void {
  const resolved = resolve(base, rel)
  if (!resolved.startsWith(resolve(base) + sep)) {
    throw new Error(`Unsafe manifest key rejected: ${rel}`)
  }
}
// In the first-pass loop and apply loop:
assertSafe(cwd, rel)
```

Python:
```python
def _assert_safe(base: pathlib.Path, rel: str) -> None:
    resolved = (base / rel).resolve()
    if not str(resolved).startswith(str(base.resolve()) + "/"):
        raise ValueError(f"Unsafe manifest key rejected: {rel}")
```

---

## Warnings

### WR-01: `upgrade` command leaves `.goodvibes.json` stale after modifying files

**File:** `packages/npm/src/commands/upgrade.ts` (entire file)

**Issue:** `upgrade.ts` updates template files on disk (via `upgradeTemplates`) but never calls `writeManifest`. After `goodvibes upgrade` runs, the hashes stored in `.goodvibes.json` no longer match the files on disk. When the user subsequently runs `goodvibes update`, every upgraded file's on-disk SHA will differ from the stale manifest SHA, causing the update command to classify every managed file as "user-modified" and skip it. Effectively, `goodvibes update` becomes permanently broken for any project that has run `goodvibes upgrade`.

`upgrade.ts` does not import `write-manifest.js` at all.

**Fix:** After `upgradeTemplates` completes, call `writeManifest` with the list of updated files:
```typescript
import { writeManifest } from '../steps/write-manifest.js'
// ...inside tasks():
const files = await upgradeTemplates(templateDir, cwd, projectType)
updated.push(...files)
const version = getInstalledVersion() ?? 'unknown'
await writeManifest(cwd, files, version)
return `Updated ${files.length} files`
```

---

### WR-02: `upgrade.ts` "Files updated" note over-reports — returns all matching files in `destDir`, not files written this run

**File:** `packages/npm/src/commands/upgrade.ts:129-133`

**Issue:** `upgradeTemplates` computes its return value by walking `destDir` and filtering by prefix, not by tracking which files it actually wrote:

```typescript
const allDest = (await listTemplateFiles(destDir)) ?? []
return allDest
  .filter(f => f.startsWith('.claude/skills/') || f.startsWith('.github/workflows/') || f === 'CLAUDE.md')
  .sort()
```

If the user's project already had `.claude/skills/` files from a previous run, all of them appear in the "Files updated" note even if they were unchanged. This misleads the user into thinking more was changed than actually was.

**Fix:** Track written files explicitly inside `upgradeTemplates` instead of re-walking the destination:
```typescript
const written: string[] = []
// After each copy/rename/merge operation, push the relative path to `written`
return written.sort()
```

---

### WR-03: `readManifest` / `read_manifest` swallows all exceptions including `EPERM`, violating the "Fail loud" rule

**File:** `packages/npm/src/steps/write-manifest.ts:27-33` and `packages/pip/src/goodvibes_cli/steps/write_manifest.py:26-28`

**Issue:** Both implementations catch every exception and return `null`/`None`:

TypeScript:
```typescript
} catch {
  return null   // catches ENOENT, EPERM, parse error — all treated identically
}
```

Python:
```python
except Exception:
    return None  # catches PermissionError, IOError, JSONDecodeError — all treated identically
```

A permission-denied error on `.goodvibes.json` surfaces as "No manifest found" — the user is told to run `goodvibes init` to create the manifest when the real problem is a filesystem permission issue. This contradicts the project's "Fail loud — error messages must be actionable and specific enough to debug" rule.

**Fix:** Catch only the expected error (`ENOENT` / file-not-found, JSON parse error); re-raise others:

TypeScript:
```typescript
} catch (e) {
  const err = e as NodeJS.ErrnoException
  if (err.code === 'ENOENT') return null
  if (e instanceof SyntaxError) return null   // JSON.parse failure
  throw e
}
```

Python:
```python
except FileNotFoundError:
    return None
except (json.JSONDecodeError, ValueError):
    return None
# All other exceptions (PermissionError, OSError, etc.) propagate
```

---

### WR-04: Telemetry `Promise.race` can surface unexpected rejections to the user

**File:** `packages/npm/src/commands/init.ts:149`

**Issue:**
```typescript
await Promise.race([telemetryPromise, sleep(1_000)])
```

If `sendTelemetry()` rejects with an unhandled error, `Promise.race` re-throws it and the outer try/catch (lines 134–143) does not wrap this line — it runs after the `try` block. The rejection would escape as an unhandled exception, terminating the CLI with an unhelpful stack trace after all setup has otherwise succeeded.

**Fix:** Shield the race with a suppressed catch on the telemetry side:
```typescript
await Promise.race([telemetryPromise.catch(() => {}), sleep(1_000)])
```

---

### WR-05: Python `init_cmd` dry-run inconsistency between minimal and non-minimal paths

**File:** `packages/pip/src/goodvibes_cli/commands/init_cmd.py:72-79`

**Issue:** The `--dry-run` branch uses two different code paths depending on `minimal`:

```python
if dry_run:
    if minimal:
        all_files = list_template_files(template_dir)           # path A: direct list + filter
        files = [f for f in all_files if not f.startswith(".github") ...]
    else:
        files_tuple = copy_templates(template_dir, cwd, dry_run=True, ...)  # path B: copy_templates
        files = files_tuple[0]
```

The TypeScript version (init.ts:64–68) is consistent: it always calls `listTemplateFiles` then applies an in-line filter for both minimal and non-minimal cases. If `copy_templates(dry_run=True)` applies different filtering logic than `list_template_files + manual filter`, the Python non-minimal dry-run will produce a different file list than the TypeScript equivalent. This makes cross-platform behaviour unpredictable and harder to test.

**Fix:** Mirror the TypeScript approach — always call `list_template_files` and apply both the CI-variant filter and the minimal filter inline:
```python
all_files = list_template_files(template_dir)
ci_variants = ["ci-node.yml", "ci-python.yml", "ci-both.yml"]
selected = f"ci-{project_type}.yml"
if minimal:
    files = [f for f in all_files if not f.startswith(".github") and not f.startswith("docs")]
else:
    files = [f for f in all_files if not any(f.endswith(v) and not f.endswith(selected) for v in ci_variants)]
```

---

### WR-06: `update_cmd.py` "Updated" panel shows planned files, not files actually applied

**File:** `packages/pip/src/goodvibes_cli/commands/update_cmd.py:117`

**Issue:**
```python
console.print(Panel("\n".join(overwrite + net_new) or "(none)", title="Updated"))
```

The panel is built from the planned `overwrite + net_new` list. The apply loop (lines 93–111) silently skips any file whose template source does not exist (`if not template_src.exists(): continue`). Those files appear in the "Updated" panel but were not actually written. The TypeScript version correctly reports a count of applied files rather than the full planned list.

**Fix:** Collect actually-applied files and display those:
```python
applied_files: list[str] = []
for rel in overwrite + net_new:
    ...
    if not template_src.exists():
        continue
    ...
    applied_files.append(rel)

console.print(Panel("\n".join(applied_files) or "(none)", title="Updated"))
```

---

## Info

### IN-01: `upgrade.ts` mixes `'fs'` / `'path'` imports with `'node:fs'` / `'node:path'` style used elsewhere

**File:** `packages/npm/src/commands/upgrade.ts:8-9`

**Issue:**
```typescript
import { existsSync } from 'fs'
import { join, relative } from 'path'
```

All other files in this package use the `node:` protocol prefix (`import { existsSync } from 'node:fs'`, etc.). Inconsistent style; no functional difference.

**Fix:** Use `node:fs` and `node:path` to match the rest of the codebase.

---

### IN-02: Double-patching of `write_manifest` in `test_init_cmd.py`

**File:** `packages/pip/tests/conftest.py:8-14` and `packages/pip/tests/test_init_cmd.py:26-30`

**Issue:** The `_auto_mock_write_manifest` autouse fixture in `conftest.py` patches `goodvibes_cli.commands.init_cmd.write_manifest`. The `mock_write_manifest` autouse fixture in `test_init_cmd.py` patches the same target again. The second patch silently shadows the first. Both fixtures are active for every test in `test_init_cmd.py`.

**Fix:** Remove the autouse fixture from `conftest.py` since `test_init_cmd.py` already handles it. If the conftest fixture is still needed for `test_main.py` or other callers, scope it more narrowly with an explicit module marker rather than relying on the module-name string check.

---

### IN-03: `_auto_mock_write_manifest` conftest fixture unnecessarily applies to `test_update_cmd.py`

**File:** `packages/pip/tests/conftest.py:9-13`

**Issue:** The fixture activates for all modules whose name does not contain `"test_write_manifest"`. This includes `test_update_cmd`, so every update test carries a spurious mock of `goodvibes_cli.commands.init_cmd.write_manifest` that is never exercised. The update tests already mock `goodvibes_cli.commands.update_cmd.write_manifest` themselves. The autouse is harmless but adds noise and makes fixture scope hard to reason about.

**Fix:** Scope the conftest autouse fixture to only the init/main tests using a pytest marker, or remove it and let each test file handle its own mocks.

---

### IN-04: No tests cover the `net_new` second pass with real CI variant paths

**File:** `packages/pip/tests/test_update_cmd.py` (entire file)

**Issue:** Every test that exercises the second pass (`list_template_files` path) mocks the function to return `[]`. The CI-variant filtering logic in the second pass — the source of CR-01 — is completely untested. If the mock had returned realistic paths (`.github/workflows/ci-node.yml`, etc.), the bug in CR-01 would have been caught by the test suite.

**Fix:** Add a test that passes `[".github/workflows/ci-node.yml", ".github/workflows/ci-both.yml"]` to the mocked `list_template_files` and asserts that only the selected variant becomes `net_new`, and under no circumstances does `ci-node.yml` get written for a `"both"` project:

```python
def test_update_net_new_only_adds_selected_ci_variant(mocker):
    manifest = {"version": "1.0.0", "files": {}}
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=manifest)
    mocker.patch("goodvibes_cli.commands.update_cmd.resolve_templates_dir")
    mocker.patch("goodvibes_cli.commands.update_cmd.detect_project_type", return_value="both")
    mocker.patch(
        "goodvibes_cli.commands.update_cmd.list_template_files",
        return_value=[
            ".github/workflows/ci-node.yml",
            ".github/workflows/ci-python.yml",
            ".github/workflows/ci-both.yml",
        ],
    )
    mocker.patch("pathlib.Path.exists", return_value=False)
    mock_copy = mocker.patch("goodvibes_cli.commands.update_cmd.shutil.copy2")
    mocker.patch("goodvibes_cli.commands.update_cmd.write_manifest")
    runner.invoke(app, ["update", "--force"])
    # Only ci-both.yml (mapped to ci.yml) should be in net_new; the others should be excluded
    written_dests = [call.args[1] for call in mock_copy.call_args_list]
    assert not any("ci-node.yml" in d for d in written_dests)
    assert not any("ci-python.yml" in d for d in written_dests)
```

---

_Reviewed: 2026-07-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
