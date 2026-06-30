---
phase: 08-multi-ide-expansion
fixed_at: 2026-06-30T00:00:00Z
review_path: .planning/phases/08-multi-ide-expansion/08-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-06-30T00:00:00Z
**Source review:** .planning/phases/08-multi-ide-expansion/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (2 critical, 5 warning; info excluded per fix_scope)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: Python `copy_templates` returns `CLAUDE.md` in `written` even when no `CLAUDE.md` exists in template

**Files modified:** `packages/pip/src/goodvibes_cli/steps/copy_templates.py`, `packages/pip/tests/test_copy_templates.py`
**Commit:** d26b3ca
**Applied fix:** Added `claude_merged` boolean flag; the unconditional `if "CLAUDE.md" not in written: written = ["CLAUDE.md"] + written` block is now guarded by `if claude_merged and ...` so callers only see CLAUDE.md in the written list when sentinel merge actually ran. Added `assert "CLAUDE.md" not in written` to the empty-template test to prevent regression.

---

### CR-02: Python path traversal test is tautological — provides zero real coverage

**Files modified:** `packages/pip/tests/test_copy_templates.py`
**Commit:** cd8886b
**Applied fix:** Replaced the tautological assertion (`for f in tmp_dir.rglob("*"): assert str(f).startswith(str(tmp_dir))` — always true by construction) with a test that plants a real symlink inside `template_dir` pointing to a file outside it, then verifies neither the symlink nor its target appear in the destination. This exercises the actual `full.resolve().relative_to(template_dir.resolve())` guard in `ignore_fn`.

---

### WR-01: TS `ci.yml` rename-guard test uses a weak disjunctive assertion

**Files modified:** `packages/npm/src/steps/copy-templates.integration.test.ts`
**Commit:** 620ab91
**Applied fix:** Replaced `expect(ciSkipped || !ciWritten).toBe(true)` (which passes when ci.yml is absent from both lists) with two separate assertions: `expect(result.skipped.some(...)).toBe(true)` and `expect(result.written.some(...)).toBe(false)`.

---

### WR-02: `conftest.py` `TEMPLATE_CONTENT` sentinel version is `v1.0.0` while production template is `v1.3.0`

**Files modified:** `packages/pip/tests/conftest.py`, `packages/pip/tests/test_sentinel_merge.py`
**Commit:** 290bdba
**Applied fix:** Added `TEMPLATE_CONTENT_V130` constant (v1.3.0 variant) to conftest.py and a new test `test_merge_claude_case_d_skips_write_when_version_is_v1_3_0` in `test_sentinel_merge.py` that covers the Case D same-version skip that real users hit on every re-run after v1.3.0 is installed. Note: this commit was superseded by WR-03's refactor — the constant now lives in `fixtures.py`.

---

### WR-03: `from .conftest import TEMPLATE_CONTENT` imports `conftest.py` as a regular module

**Files modified:** `packages/pip/tests/fixtures.py` (new), `packages/pip/tests/conftest.py`, `packages/pip/tests/test_copy_templates.py`, `packages/pip/tests/test_sentinel_merge.py`
**Commit:** dacd69f
**Applied fix:** Extracted all shared constants (`SENTINEL_START`, `SENTINEL_END`, `TEMPLATE_CONTENT`, `TEMPLATE_CONTENT_V130`) into a new `tests/fixtures.py` module. `conftest.py` now re-exports from `fixtures.py`. Both test files import from `fixtures.py` directly, eliminating the double-import anti-pattern.

---

### WR-04: `resolveTemplatesDir()` called at describe-block scope silently drops tests if templates dir is absent

**Files modified:** `packages/npm/src/steps/copy-templates.integration.test.ts`
**Commit:** 2cc1d8b
**Applied fix:** Moved all four describe-scope `const templateDir = resolveTemplatesDir()` declarations (in `written/skipped tracking`, `ci.yml rename guard`, `minimal filter scope`, and `IDE rule files` describe blocks) to `let templateDir: string` declarations with assignment inside the existing `beforeEach` callbacks. Failures now surface as clear test errors rather than silent test disappearance.

---

### WR-05: `copy-templates.test.ts` tests are integration tests placed in a unit test file, violating CLAUDE.md convention

**Files modified:** `packages/npm/src/steps/copy-templates.integration.test.ts` (renamed from `copy-templates.test.ts`), `packages/npm/vitest.config.ts`
**Commit:** e190238
**Applied fix:** Renamed `copy-templates.test.ts` to `copy-templates.integration.test.ts` per CLAUDE.md convention. Updated `vitest.config.ts` to add `src/**/*.integration.test.ts` to the `include` glob so the tests continue to run under `npm test`. A separate mocked unit test file (`copy-templates.test.ts`) is not created here — that is new feature work beyond the scope of this fix pass.

---

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-06-30T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
