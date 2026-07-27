---
phase: 14-goodvibes-update-with-manifest
fixed_at: 2026-07-27T19:17:00Z
review_path: .planning/phases/14-goodvibes-update-with-manifest/14-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-07-27
**Source review:** .planning/phases/14-goodvibes-update-with-manifest/14-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (2 Critical, 6 Warning)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: Python `update_cmd` CI variant check is always false

**Files modified:** `packages/pip/src/goodvibes_cli/commands/update_cmd.py`
**Commit:** 6d6356f
**Applied fix:** Changed the second-pass loop from `if tf in ci_variants` (set of bare filenames) to `is_variant = any(tf.endswith(v) for v in ci_variants)` with `if not tf.endswith(selected_variant_src): continue`, mirroring the TypeScript endsWith logic. Both defects fixed: the set-membership check and the same-style bare-filename comparison for `selected_variant_src`.

### CR-02: Path traversal via unsanitised manifest keys

**Files modified:** `packages/npm/src/commands/update.ts`, `packages/pip/src/goodvibes_cli/commands/update_cmd.py`
**Commit:** 8372b45
**Applied fix:** Added `assertSafe(base, rel)` in TypeScript (throws `Error` if resolved path escapes base) and `_assert_safe(base, rel)` in Python (raises `ValueError` if resolved path escapes base). Both helpers called at the start of the first-pass manifest loop and the apply loop in their respective files. Added `resolve` and `sep` imports to `update.ts`.

### WR-01: `upgrade` command leaves `.goodvibes.json` stale after modifying files

**Files modified:** `packages/npm/src/commands/upgrade.ts`, `packages/npm/src/commands/upgrade.test.ts`
**Commit:** 9249a5a (upgrade.ts), e92bc8f (test fix)
**Applied fix:** Imported `writeManifest` from `../steps/write-manifest.js` and added a call after `upgradeTemplates` inside the task, passing the file list and installed version. Updated `upgrade.test.ts` to mock `../steps/write-manifest.js` so the three tests that invoke the task function don't fail trying to read non-existent files from the mock filesystem.

### WR-02: `upgrade.ts` "Files updated" note over-reports

**Files modified:** `packages/npm/src/commands/upgrade.ts`
**Commit:** 4b48443
**Applied fix:** Replaced the `listTemplateFiles(destDir)` walk (which picks up pre-existing user files) with a `listTemplateFiles(templateDir)` walk that derives the written paths from the template source — same logic as the copy filter. CI variant is mapped to `ci.yml`, CLAUDE.md is always included (always merged). This ensures only files that were actually touched by the upgrade appear in the "Files updated" note.

### WR-03: `readManifest` / `read_manifest` swallows all exceptions

**Files modified:** `packages/npm/src/steps/write-manifest.ts`, `packages/pip/src/goodvibes_cli/steps/write_manifest.py`
**Commit:** 0daa63a
**Applied fix:** TypeScript: changed bare `catch {}` to `catch (e)` that re-throws unless `err.code === 'ENOENT'` or `e instanceof SyntaxError`. Python: changed `except Exception` to `except (json.JSONDecodeError, ValueError)`, letting `PermissionError`, `OSError`, etc. propagate. The `p.exists()` check already handles the not-found case in Python so `FileNotFoundError` is not reached.

### WR-04: Telemetry `Promise.race` can propagate rejections

**Files modified:** `packages/npm/src/commands/init.ts`
**Commit:** 822e74d
**Applied fix:** Changed `Promise.race([telemetryPromise, sleep(1_000)])` to `Promise.race([telemetryPromise.catch(() => {}), sleep(1_000)])` so any rejection from `sendTelemetry()` is silently discarded rather than surfacing as an unhandled exception after the setup tasks have succeeded.

### WR-05: Python `init_cmd` dry-run inconsistency between minimal and non-minimal paths

**Files modified:** `packages/pip/src/goodvibes_cli/commands/init_cmd.py`, `packages/pip/tests/test_main.py`
**Commit:** b9d3cb2 (init_cmd.py), adf7aed (test fix)
**Applied fix:** Unified both minimal and non-minimal dry-run paths under a single `list_template_files(template_dir)` call with inline filtering — `minimal` filters out `.github` and `docs`, non-minimal filters out unselected CI variants using `endswith` — mirroring the TypeScript approach. Updated `test_dry_run_no_files_written` in `test_main.py` to mock `list_template_files` instead of `copy_templates` since the dry-run path no longer calls `copy_templates`.

### WR-06: `update_cmd.py` "Updated" panel shows planned files not applied files

**Files modified:** `packages/pip/src/goodvibes_cli/commands/update_cmd.py`
**Commit:** 8f3a71a
**Applied fix:** Replaced the post-hoc `applied = [r for r in overwrite + net_new if (cwd / r).exists()]` check with an `applied: list[str] = []` list that accumulates `rel` only after each file is successfully processed in the apply loop (after the `if not template_src.exists(): continue` guard). The `write_manifest` call and the `Updated` panel both now use `applied` which reflects only files that were truly written.

---

_Fixed: 2026-07-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
