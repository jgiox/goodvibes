---
phase: 05-upgrade-command-template-repo
fixed_at: 2026-06-25T05:52:00Z
review_path: .planning/phases/05-upgrade-command-template-repo/05-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 8
skipped: 2
status: partial
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-06-25T05:52:00Z
**Source review:** `.planning/phases/05-upgrade-command-template-repo/05-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (4 Critical + 6 Warning)
- Fixed: 8
- Skipped: 2 (WR-04 subsumed by CR-01 fix; TS path-traversal guard note documented)

## Fixed Issues

### CR-01: Double `merge_claude` call silently overwrites CLAUDE.md sentinel on every upgrade

**Files modified:** `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py`, `packages/pip/tests/test_upgrade_cmd.py`
**Commit:** 67ecd11
**Applied fix:** Removed the redundant `merge_claude` block at lines 184-191 of `upgrade_cmd` (the call inside `upgrade_templates` is the single correct owner). Updated `test_user_content_outside_sentinel_preserved_after_upgrade` to assert `upgrade_templates.call_count == 1` rather than relying on the now-removed direct `merge_claude` call.

---

### CR-02: Path-traversal guard never fires — dead code in `upgrade_cmd.py` and `copy_templates.py`

**Files modified:** `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py`, `packages/pip/src/goodvibes_cli/steps/copy_templates.py`
**Commit:** 092edd6
**Applied fix:** Replaced `".." in pathlib.Path(str(rel)).parts` (dead after `relative_to()`) with `full.resolve().relative_to(template_dir.resolve())` which catches symlink escapes that could bypass the original check. Applied to both `ignore_fn` closures in `upgrade_cmd.py` and `copy_templates.py`.

---

### CR-03: PAT token exposed in git URL appears in process list, runner logs, and git reflog

**Files modified:** `.github/workflows/publish-template.yml`
**Commit:** d41e19c
**Applied fix:** Replaced inline `https://x-access-token:${{ secrets.TEMPLATE_REPO_TOKEN }}@...` URL with `git remote add template-repo` pattern using `TOKEN` env var, followed by `git subtree push template-repo main` and `git remote remove template-repo`. Token stays in env var where GitHub Actions masking applies.

---

### CR-04: `set -euo pipefail` positioned too late in `verify-phase5.sh`

**Files modified:** `scripts/verify-phase5.sh`
**Commit:** ef9fb1c
**Applied fix:** Moved `set -euo pipefail` to line 2, immediately after the shebang, before the `cd` and argument-parsing loop so all early failures abort the script.

---

### WR-01 + WR-02: `detectProjectType` mocked with `mockResolvedValue` but is synchronous

**Files modified:** `packages/npm/src/commands/upgrade.test.ts`
**Commit:** 6151d64
**Applied fix:** Changed `vi.fn().mockResolvedValue('both')` to `vi.fn().mockReturnValue('both')` in the module-level `detect-project-type.js` mock. This ensures `projectType` is the string `'both'` rather than a `Promise<'both'>` during tests, fixing the silently wrong CI variant path (`ci-[object Promise].yml`).

---

### WR-03: Dead `templateDir` else-branch in `upgradeTemplates` is unreachable

**Files modified:** `packages/npm/src/commands/upgrade.ts`, `packages/npm/src/commands/upgrade.test.ts`
**Commit:** 6768684
**Applied fix:** Removed the `if (templateDir) { ... } else { ... }` wrapping from `upgradeTemplates` — `resolveTemplatesDir()` always returns a string so the else-branch was structurally dead. Three tests that call `upgradeTemplates` via the `tasks` mock were updated to mock `resolveTemplatesDir` returning `/fake/templates` (previously they relied on the undefined-templateDir falling into the removed else-branch via `vi.resetAllMocks()`).

---

### WR-05: `check()` uses unquoted `$2` in `bash -c`

**Files modified:** `scripts/verify-phase5.sh`
**Commit:** d4fc934
**Applied fix:** Bound positional args to `local label="$1"` and `local cmd="$2"` in the `check()` function body. Functionally equivalent but makes variable binding explicit and eliminates the latent word-splitting/injection surface.

---

### WR-06: Python test `test_dry_run_shows_summary_without_writing` reads real CLAUDE.md

**Files modified:** `packages/pip/tests/test_upgrade_cmd.py`
**Commit:** 4ab55ce
**Applied fix:** Added mocks for `_detect_installed_version` (returns `None`), `_detect_bundled_version` (returns `"1.0.0"`), and `version_gte` (returns `False`) to the `test_dry_run_shows_summary_without_writing` test. This prevents real filesystem reads from `cwd / "CLAUDE.md"` in the test runner's working directory.

---

## Skipped Issues

### WR-04: `merge_claude` called with empty string when template is unavailable, silently deletes sentinel

**File:** `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py:191`
**Reason:** Subsumed by CR-01 fix. The data-loss path WR-04 describes was the concrete consequence of the duplicate `merge_claude` call removed in CR-01. With that block deleted, the `merge_claude(claude_dest, template_content or "")` line no longer exists; there is no separate fix needed.
**Original issue:** `merge_claude` called with `""` when `template_dir` is falsy, causing `_extract_sentinel_block("")` to return `""` and the sentinel block to be deleted from CLAUDE.md.

---

### CR-02 TS note: `relative(templateDir, src).includes('..')` in `upgrade.ts`

**File:** `packages/npm/src/commands/upgrade.ts:89`
**Reason:** The review noted the TS guard `relative(templateDir, src).includes('..')` "could fire on Windows where relative() may produce a ..-containing string when crossing drive roots, but on POSIX it is similarly unreachable." The guard is inside `copy`'s `filter` callback where `src` is always a child path provided by fs-extra's recursive walk — not an external input. The risk is theoretical; replacing with a resolve-based check would require async operations inside a synchronous filter callback (not supported by fs-extra's API). The existing belt-and-suspenders guard is left as-is with a ponytail comment already in place. The Python files (which use a synchronous `ignore_fn` with `shutil.copytree`) were fully fixed in CR-02.

---

_Fixed: 2026-06-25T05:52:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
