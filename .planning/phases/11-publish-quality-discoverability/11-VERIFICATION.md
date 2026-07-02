---
phase: 11-publish-quality-discoverability
verified: 2026-07-02T08:30:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "On pypi.org, log in as jgiox and confirm a trusted publisher exists for goodvibes-cli with workflow=publish-pip.yml and environment=release"
    expected: "Trusted publisher listed under goodvibes-cli on PyPI; any push of a pip-v* tag triggers a successful publish without an OIDC mismatch error"
    why_human: "PyPI trusted publisher configuration is a one-time action on pypi.org that cannot be verified from repository files"
  - test: "Run `npm view @jgiox/goodvibes deprecated` from a terminal with npm installed"
    expected: "Returns the string 'Renamed to goodvibes-cli. Install: npm install -g goodvibes-cli'"
    why_human: "npm deprecate is a registry-level flag on npmjs.com that cannot be confirmed from local repository files"
---

# Phase 11: Publish Quality & Discoverability Verification Report

**Phase Goal:** Publish goodvibes-cli to both npm and PyPI under the correct package names, with CI smoke tests gating every publish and UX polish making the CLI self-describing.
**Verified:** 2026-07-02T08:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A publish followed by a smoke test failure blocks the release before users see a broken package (PUB-01) | VERIFIED | `publish-npm.yml` and `publish-pip.yml` each have a `smoke-test` job with `needs: publish`; both run `goodvibes init --dry-run 2>&1 \| tee /tmp/gv-out.txt && grep -q "CLAUDE.md" /tmp/gv-out.txt` |
| 2 | A PR that bumps the package version without bumping templates/CLAUDE.md fails CI with a clear message pointing to the stale file (PUB-02) | VERIFIED | `ci.yml` has a `check-stamps` job (no `needs`, runs in parallel) that extracts NPM_VER, PIP_VER, TPL_VER and emits "Fix: update templates/CLAUDE.md header to '# goodvibes: v$NPM_VER'" on mismatch |
| 3 | goodvibes-cli is installable under the correct name on both npm and PyPI with polished registry metadata (PKG-01, PKG-02) | VERIFIED (code side) | `packages/npm/package.json` name=`goodvibes-cli`, description, 9 keywords, homepage; `packages/pip/pyproject.toml` name=`goodvibes-cli`, 11 classifiers, keywords, Homepage+Repository URLs; zero old-name strings in source |
| 4 | goodvibes doctor output starts with the installed version (POL-01) | VERIFIED | `doctor.ts`: `const lines = [\`goodvibes v${version}\`, ...all.map(...)]`; `doctor_cmd.py`: `lines = [f"goodvibes v{version}"] + [...]`; tests pass asserting first line = "goodvibes v1.6.1" |
| 5 | goodvibes upgrade --dry-run change summary uses "new / updated / unchanged" English words (POL-02) | VERIFIED | `upgrade.ts`: `const label = { changed: 'updated', unchanged: 'unchanged', new: 'new' }`; `upgrade_cmd.py`: `symbol = {"changed": "updated", "unchanged": "unchanged", "new": "new"}`; formatChangeSummary exported and unit-tested |

**Score:** 5/5 truths verified (code-side); 2 registry-side human checks remain

### Additional Must-Haves (from PLAN frontmatter)

| Truth | Status | Evidence |
|-------|--------|----------|
| No in-repo source file references @jgiox/goodvibes or jgiox-goodvibes | VERIFIED | `grep -r "jgiox-goodvibes" packages/pip/src packages/npm/src` → empty; `grep -r "@jgiox/goodvibes" packages/npm/src packages/npm/package.json` → empty |
| Tombstone stub for jgiox-goodvibes exists with goodvibes-cli as dependency | VERIFIED | `packages/pip-tombstone/pyproject.toml` present: name=jgiox-goodvibes, version=2.0.0, dependencies=["goodvibes-cli"] |
| npm tombstone documentation created | VERIFIED | `packages/npm-tombstone/package.json` present with deprecation note documenting the `npm deprecate` command run |
| JOURNAL.md updated with Phase 11 completion | VERIFIED | JOURNAL.md entries at lines 605, 633, 647, 661 cover plans 11-01 through 11-04 with dates, files, tests, decisions |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/npm/package.json` | name: goodvibes-cli | VERIFIED | name="goodvibes-cli", version=1.6.1, homepage present |
| `packages/pip/pyproject.toml` | name = goodvibes-cli, classifiers | VERIFIED | name="goodvibes-cli", 11 classifiers, Homepage+Repository URLs |
| `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py` | goodvibes-cli references, English labels | VERIFIED | _PYPI_URL, importlib.metadata.version, uv tool upgrade, pip install — all use goodvibes-cli; symbol map uses English values |
| `packages/pip/src/goodvibes_cli/main.py` | importlib.metadata.version("goodvibes-cli") | VERIFIED | Confirmed from code and passing test_version_output_includes_installed_version |
| `packages/npm/src/commands/upgrade.ts` | goodvibes-cli in npm view + install, English labels | VERIFIED | npm view goodvibes-cli, npm install -g goodvibes-cli@${version}, label map with 'updated'/'unchanged'/'new' |
| `.github/workflows/ci.yml` | check-stamps job | VERIFIED | Job present, no `needs` (parallel), POSIX grep+sed extracts NPM_VER/PIP_VER/TPL_VER, actionable error message |
| `.github/workflows/publish-npm.yml` | smoke-test job | VERIFIED | needs: publish, sleep 30, setup-node@v6, npm install -g goodvibes-cli@$VERSION, CLAUDE.md grep assertion |
| `.github/workflows/publish-pip.yml` | smoke-test job | VERIFIED | needs: publish, setup-uv@v7, sleep 30, uv tool install goodvibes-cli, CLAUDE.md grep assertion |
| `packages/npm/src/commands/doctor.ts` | version prepend with createRequire | VERIFIED | `import { createRequire } from 'node:module'`; `_getVersion()` helper; `lines = [\`goodvibes v${version}\`, ...]` |
| `packages/pip/src/goodvibes_cli/commands/doctor_cmd.py` | version prepend with importlib.metadata | VERIFIED | `import importlib.metadata`; `_installed_version()` helper; `lines = [f"goodvibes v{version}"] + [...]` |
| `packages/pip-tombstone/pyproject.toml` | jgiox-goodvibes stub → goodvibes-cli dep | VERIFIED | name=jgiox-goodvibes, version=2.0.0, dependencies=["goodvibes-cli"] |
| `packages/npm-tombstone/package.json` | npm deprecation documentation | VERIFIED | name=@jgiox/goodvibes, _deprecation_note documents the npm deprecate command |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/pip/src/goodvibes_cli/main.py` | importlib.metadata | version("goodvibes-cli") | VERIFIED | Exact string confirmed in source; test_version_output_includes_installed_version passes |
| `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py` | PyPI JSON API | _PYPI_URL = pypi.org/pypi/goodvibes-cli/json | VERIFIED | Line 30 confirmed |
| `packages/npm/src/commands/upgrade.ts` | npm registry | npm view goodvibes-cli version | VERIFIED | Line 18: `['view', 'goodvibes-cli', 'version']` confirmed |
| `ci.yml check-stamps` | templates/CLAUDE.md | grep '^# goodvibes: v' + sed | VERIFIED | Script confirmed in ci.yml lines 77-90; templates/CLAUDE.md has `# goodvibes: v1.6.1` at correct line |
| `publish-npm.yml smoke-test` | npm registry | npm install -g goodvibes-cli@$VERSION | VERIFIED | GITHUB_REF_NAME#npm-v strip present; no checkout step (registry install) |
| `publish-pip.yml smoke-test` | PyPI registry | uv tool install goodvibes-cli | VERIFIED | Latest install, no version pin; no checkout step (registry install) |
| `packages/npm/src/commands/doctor.ts` | package.json | createRequire(import.meta.url)('../../package.json').version | VERIFIED | `_require = createRequire(import.meta.url)` present; test mocks node:module to return {version: '1.6.1'} |
| `packages/pip/src/goodvibes_cli/commands/doctor_cmd.py` | importlib.metadata | importlib.metadata.version("goodvibes-cli") | VERIFIED | `_installed_version()` confirmed; test patches at module level |
| `packages/pip-tombstone/pyproject.toml` | PyPI jgiox-goodvibes | dependencies = ["goodvibes-cli"] | VERIFIED | File content confirmed |

### Data-Flow Trace (Level 4)

Not applicable — this phase modifies CLI tool behavior (string constants, version reads, CI workflow YAML) with no database or dynamic data sources. The "data" is static package metadata and version strings sourced from installed package manifests.

### Behavioral Spot-Checks

Step 7b: SKIPPED for CI workflow files (cannot run GitHub Actions locally). CLI behavioral verification is covered by test suite results.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| npm test suite passes | `cd packages/npm && npm test` | 119 passed, 1 skipped, 2 todo | PASS |
| pip test suite passes | `cd packages/pip && uv run pytest tests/` | 126 passed | PASS |
| Old npm name absent from source | `grep -r "@jgiox/goodvibes" packages/npm/src packages/npm/package.json` | no output | PASS |
| Old pip name absent from source | `grep -r "jgiox-goodvibes" packages/pip/src packages/npm/src` | no output | PASS |
| npm package name correct | `grep '"name"' packages/npm/package.json` | "name": "goodvibes-cli" | PASS |
| pip package name correct | `grep '^name' packages/pip/pyproject.toml` | name = "goodvibes-cli" | PASS |
| vhs.yml uses new npm name | `grep 'npm install -g' .github/workflows/vhs.yml` | npm install -g goodvibes-cli | PASS |
| verify-phase3.sh uses new name | `grep 'name = ' scripts/verify-phase3.sh` | grep -q 'name = "goodvibes-cli"' | PASS |
| Doctor version line in TS | `grep 'goodvibes v' packages/npm/src/commands/doctor.ts` | present in lines array | PASS |
| Doctor version line in Python | `grep 'goodvibes v' packages/pip/src/goodvibes_cli/commands/doctor_cmd.py` | present in lines list | PASS |
| English labels in TS upgrade | `grep "'updated'" packages/npm/src/commands/upgrade.ts` | present in label map | PASS |
| English labels in Python upgrade | `grep '"updated"' packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py` | present in symbol map | PASS |
| Version stamps in sync | templates/CLAUDE.md, packages/npm/package.json, packages/pip/pyproject.toml all at v1.6.1 | all match | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files declared for this phase. Step 7c: SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PUB-01 | 11-02 | Post-publish smoke test job in both publish workflows | SATISFIED | smoke-test jobs confirmed in publish-npm.yml and publish-pip.yml with needs: publish |
| PUB-02 | 11-02 | CI stamp gate fails when CLAUDE.md header diverges from package versions | SATISFIED | check-stamps job confirmed in ci.yml with actionable error message naming both stale files |
| PKG-01 | 11-01, 11-04 | Packages renamed to goodvibes-cli; old names deprecated | SATISFIED (code) | Source renamed, tombstone stubs created; npm deprecate and PyPI OIDC are human-verified (see Human Verification section) |
| PKG-02 | 11-01, 11-03 | Polished npm and PyPI registry pages with description/keywords/classifiers | SATISFIED | npm package.json: description + 9 keywords + homepage; pyproject.toml: description + keywords + 11 classifiers + Homepage/Repository URLs |
| POL-01 | 11-03 | goodvibes doctor first line is installed version | SATISFIED | Implemented in doctor.ts and doctor_cmd.py; tests asserting 'goodvibes v1.6.1' as first line pass |
| POL-02 | 11-03 | goodvibes upgrade --dry-run uses English change labels | SATISFIED | label/symbol maps use 'updated'/'unchanged'/'new'; formatChangeSummary exported and unit-tested in both TS and Python |

**Note:** REQUIREMENTS.md traceability table still shows Phase 11 requirements as "Pending" — the checkbox status was not updated from `[ ]` to `[x]` after implementation. This is a minor documentation gap; the code satisfies each requirement.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No TBD/FIXME/XXX markers found in any phase-modified file |

One structural note: `publish-npm.yml` smoke-test uses `VERSION=${GITHUB_REF_NAME#npm-v}` to strip the tag prefix. If the workflow is triggered via `workflow_dispatch` (manual run from a branch, not a tag), `GITHUB_REF_NAME` will be a branch name (e.g. `main`) and the npm install will attempt `goodvibes-cli@main` which will fail. This is a known edge-case for manual dispatch; tag-triggered runs (the normal publish path) are unaffected. Severity: INFO — does not affect the gate logic for real publish runs.

### Human Verification Required

### 1. PyPI Trusted Publisher Configuration

**Test:** Log in to pypi.org as jgiox. Navigate to Account Settings → Publishing. Confirm a trusted publisher exists for `goodvibes-cli` with: GitHub owner=jgiox, repository=goodvibes, workflow=publish-pip.yml, environment=release.
**Expected:** Publisher appears in the list. A push of a `pip-v*` tag to the repo triggers `publish-pip.yml` and completes the publish step without an OIDC token mismatch error.
**Why human:** PyPI trusted publisher configuration is a web action on pypi.org. There is no file in the repository that records the configured state — only the workflow YAML that expects it to exist.

### 2. npm @jgiox/goodvibes Deprecation

**Test:** Run `npm view @jgiox/goodvibes deprecated` from any machine with npm installed and internet access.
**Expected:** Returns the deprecation message: "Renamed to goodvibes-cli. Install: npm install -g goodvibes-cli"
**Why human:** `npm deprecate` is a one-shot CLI command that sets a registry-level flag on npmjs.com. The `packages/npm-tombstone/package.json` documents the command was run, but the actual registry state can only be confirmed by querying npmjs.com.

### Gaps Summary

No code gaps found. All 5 roadmap success criteria and all 6 requirement IDs (PUB-01, PUB-02, PKG-01, PKG-02, POL-01, POL-02) are implemented and verified in the codebase. Both test suites are green (npm: 119 passed, pip: 126 passed). All documented commit hashes (fe8cdf3, e52c235, 31986fd, ee0261b, b9fb426, 2c97ef8, fcb7ac7, e90a9b7) exist in git history.

The two human verification items (PyPI OIDC and npm deprecate) are registry-side actions that cannot be confirmed from repository files. They were claimed as complete in the 11-04 SUMMARY but require human confirmation to close the phase.

---

_Verified: 2026-07-02T08:30:00Z_
_Verifier: Claude (gsd-verifier)_
