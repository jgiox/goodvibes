---
phase: 07-readme-demo
reviewed: 2026-06-27T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - README.md
  - .github/workflows/vhs.yml
  - packages/npm/package.json
  - packages/pip/pyproject.toml
  - scripts/demo.tape
findings:
  critical: 3
  warning: 3
  info: 2
  total: 8
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-06-27
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files were reviewed: the project README, the VHS demo workflow, the npm and pip package manifests, and the demo tape script. Three blockers were found — all three stem from the same root cause: the npm package is scoped as `@jgiox/goodvibes`, but every user-facing invocation says `npx goodvibes init`. This command will silently resolve to a non-existent or wrong package. The third blocker is the missing `docs/demo.gif` file referenced in the README, which produces a broken image on GitHub before the workflow ever runs. Three warnings cover an unverifiable VHS version pin, an unused `pytest-asyncio` dependency with no asyncio mode configuration, and a `contents: write` permission that is broader than necessary. Two info items cover minor inconsistencies in version specifiers.

---

## Critical Issues

### CR-01: `npx goodvibes init` resolves to wrong package — command fails for all users

**File:** `README.md:15`
**Issue:** The npm package is published as the scoped name `@jgiox/goodvibes`. `npx goodvibes init` does NOT look for a scoped package; it looks for an unscoped package named `goodvibes`. Confirmed: no such package exists on the npm registry (registry returns 404). Every new user who follows the Quick Start will get an error or will run an unrelated package that happens to own the `goodvibes` name in the future. The same incorrect invocation appears on lines 15, 39–40, and in the requirements table at line 51.

**Fix:**
```sh
# README.md lines 14-16 — replace
npx @jgiox/goodvibes init

# README.md lines 39-40
npx @jgiox/goodvibes init --dry-run
npx @jgiox/goodvibes init --minimal
```
Alternatively, publish a thin unscoped `goodvibes` package that re-exports or defers to `@jgiox/goodvibes`. That approach is more user-friendly but requires maintaining an extra package.

---

### CR-02: `demo.tape` uses same broken `npx goodvibes init` invocation — CI demo will fail

**File:** `scripts/demo.tape:22`
**Issue:** The tape script runs `npx goodvibes init --minimal --dry-run`. Because `goodvibes` does not exist as an unscoped npm package (see CR-01), VHS will record a failure output — either an npm 404 error or a "command not found" — and commit that failure as `docs/demo.gif`. The CI workflow will succeed (it commits whatever VHS produces) but the resulting GIF will show an error, not the intended demo.

**Fix:**
```tape
Type "npx @jgiox/goodvibes init --minimal --dry-run"
```
Must be fixed in tandem with CR-01 so the README and demo are consistent.

---

### CR-03: `docs/demo.gif` does not exist — README shows a broken image

**File:** `README.md:10`
**Issue:** The README embeds `docs/demo.gif` at line 10. The file does not exist in the repository (confirmed: `docs/` contains only `onboarding.md`). On GitHub, new visitors see a broken image immediately above the Quick Start section — exactly the worst place for a first impression on a project aimed at beginners.

The VHS workflow is designed to generate and commit this file on push to `main`, but only when `scripts/demo.tape` has changed. Until the workflow runs successfully once (which is blocked by CR-02), the image will remain broken.

**Fix:** Either:
1. Commit a placeholder `docs/demo.gif` so the README renders correctly before the first workflow run, OR
2. Fix CR-01 and CR-02 first, then trigger the workflow manually (`workflow_dispatch`) to generate the GIF before merging this phase.

---

## Warnings

### WR-01: VHS version unpinned — tape syntax may break on VHS updates

**File:** `.github/workflows/vhs.yml:19` and `scripts/demo.tape:1`
**Issue:** `charmbracelet/vhs-action@v2.1.0` downloads VHS at `version: latest` (the action's default) at workflow runtime. The comment in `demo.tape` line 1 says "Source: charmbracelet/vhs v0.11.0", but the workflow will actually use whatever VHS version is current when the job runs. The `Wait+Screen` command at `demo.tape:26` was introduced in a specific VHS release; if VHS releases a breaking change or the command syntax shifts, the workflow will silently record garbage.

**Fix:** Pin the VHS version in the workflow step:
```yaml
- uses: charmbracelet/vhs-action@v2.1.0
  with:
    path: 'scripts/demo.tape'
    version: '0.11.0'   # match the version the tape was authored against
```
Update the tape comment to match if the version is bumped intentionally.

---

### WR-02: `pytest-asyncio` listed as dependency but never configured or used

**File:** `packages/pip/pyproject.toml:36`
**Issue:** `pytest-asyncio>=0.25` is listed in `[project.optional-dependencies] dev` but:
1. No async tests exist in `tests/` (confirmed by grep).
2. `asyncio_mode` is not set in `[tool.pytest.ini_options]`.

Without `asyncio_mode = "auto"`, any future async test will silently run synchronously (it will appear to pass while the coroutine body is never executed). The unused dependency adds install weight and creates a trap for contributors.

**Fix:** Remove the dependency if no async tests are planned:
```toml
dev = [
    "pytest>=9",
    "pytest-mock>=3",
    "pytest-cov>=7",
]
```
If async tests are planned, add `asyncio_mode = "auto"` to `[tool.pytest.ini_options]` at the same time.

---

### WR-03: `contents: write` permission is broader than the minimum required

**File:** `.github/workflows/vhs.yml:14`
**Issue:** The job-level `permissions: contents: write` grants write access to the entire repository contents. `git-auto-commit-action` only needs to push one file (`docs/demo.gif`) to one branch. While this is a common pattern for auto-commit workflows and not exploitable in isolation, it violates least-privilege: a supply-chain compromise of either `charmbracelet/vhs-action@v2.1.0` or `stefanzweifel/git-auto-commit-action@v7.1.0` would gain full write access to the repository.

**Fix:** This cannot be narrowed further within GitHub Actions' permission model (there is no "write one file" scope). The mitigation is to pin both third-party actions to a commit SHA rather than a mutable tag:
```yaml
- uses: charmbracelet/vhs-action@<SHA>   # v2.1.0
- uses: stefanzweifel/git-auto-commit-action@<SHA>   # v7.1.0
```
Mutable tags mean a tag reassignment (intentional or via compromise) silently runs different code under elevated permissions.

---

## Info

### IN-01: `@clack/prompts` version specifier `^1` disagrees with CLAUDE.md stack table

**File:** `packages/npm/package.json:44`
**Issue:** `@clack/prompts` is pinned to `"^1"` in `package.json`. The technology stack documentation in `CLAUDE.md` lists it as `^0.9`. The latest published version is `1.6.0`, so `^1` is a valid and current specifier, but the mismatch will confuse contributors who check the docs against the manifest.

**Fix:** Update the CLAUDE.md stack table entry for `@clack/prompts` from `^0.9` to `^1` to match what is actually installed.

---

### IN-02: `typescript ^6` in devDependencies is a pre-release track

**File:** `packages/npm/package.json:51`
**Issue:** `"typescript": "^6"` resolves to the TypeScript 6.x line. As of the review date the latest published TypeScript 6 release is `6.0.3` (release candidate lineage). TypeScript 6.x is not yet GA-stable. Pinning `^6` means any TypeScript 6 release — including ones with breaking changes to strict mode or module resolution — will be silently adopted when contributors run `npm install`.

**Fix:** If TypeScript 6 features are intentionally required, document why in a `ponytail:` comment. If TypeScript 5 is sufficient, use `"typescript": "^5.5"` which is the stable release:
```json
"typescript": "^5.5"
```

---

_Reviewed: 2026-06-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
