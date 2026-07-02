# Phase 11: Publish Quality & Discoverability — Research

**Researched:** 2026-07-02
**Domain:** npm/PyPI publishing, CI gating, package naming, UX code patches
**Confidence:** HIGH

---

## Summary

Phase 11 has six requirements spread across four problem domains: (1) post-publish smoke tests in CI so "published" and "works" are guaranteed to be the same thing, (2) a CI version-stamp gate that prevents the v1.4.0 false-update bug from recurring, (3) a package rename from personal-handle prefixes to unambiguous "goodvibes" names, and (4) two small UX polish items in `doctor` and `upgrade --dry-run`.

The research confirms all six requirements are implementable with existing project infrastructure and no new runtime dependencies. The most uncertain area is the npm name similarity policy: `goodvibes` is blocked by `good-vibes` (both reduce to `goodvibies` after punctuation stripping), but `goodvibes-cli` is available because `good-vibes-cli` does not exist. `goodvibes-cli` is therefore the recommended npm name. On PyPI, `goodvibes` is taken by the Paton Research Group chemistry package; `goodvibes-cli` is available and passes PyPI index check.

The post-publish smoke test and version-stamp gate are pure CI additions — no code changes in either package. The doctor version line and upgrade --dry-run symbol swap are 2–5 line code patches each.

**Primary recommendation:** Rename to `goodvibes-cli` on both registries. Add a `smoke-test` job to each publish workflow with `needs: publish` and a 30s wait. Add a `check-stamps` job to `ci.yml` using a 10-line shell script. Patch doctor (TS + Python) and upgrade `formatChangeSummary` (TS + Python).

---

## Project Constraints (from CLAUDE.md)

- **Ponytail minimalism full mode active:** shortest working diff wins; no abstractions with one implementation; no new dependencies unless stdlib cannot do it.
- **Surgical changes:** touch only what the task requires. Do not opportunistically reformat.
- **Fail loud:** no empty catch blocks; error messages must be actionable.
- **Testing conventions:** unit tests mock all external calls; every new public function gets at least one test; test names are sentences describing expected behavior; Python tests run from `packages/pip/` with `uv run pytest tests/`.
- **Template sync:** `packages/npm/templates/` is a prebuild artifact — `npm run prebuild` must run before build or publish if templates change. Phase 11 does not change templates, so this is informational only.
- **`tmp_dir` fixture:** returns `tmp_path` directly, not a subdirectory — write files directly onto `tmp_path`.
- **TypeScript:** pinned to `^5.5` (per CLAUDE.md lock — TypeScript 6 breaking changes not yet investigated). Note: `package.json` currently uses `^6` — do not change this pin unless it causes a failure.
- **JOURNAL.md:** must be updated at end of every task.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PUB-01 | Post-publish smoke test job in CI; install from registry, run `--dry-run`, assert exit 0 and expected files | See §Post-Publish Smoke Test Pattern |
| PUB-02 | CI check validates `# goodvibes: vX.Y.Z` in `templates/CLAUDE.md` matches versions in `packages/npm/package.json` and `packages/pip/pyproject.toml` | See §Version-Stamp Gate |
| PKG-01 | Rename packages to contain "goodvibes", available, no conflict; update all in-repo references; old names get deprecation notice | See §Package Naming |
| PKG-02 | Polished registry pages: description, keywords, homepage, repository (npm); same + classifiers (PyPI) | See §Registry Page Requirements |
| POL-01 | `goodvibes doctor` output starts with installed version (`goodvibes v1.6.x`) | See §UX Code Patches |
| POL-02 | `goodvibes upgrade --dry-run` prints `new / updated / unchanged` instead of `+ / ~ / =` | See §UX Code Patches |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Post-publish smoke test | CI (GitHub Actions) | — | The test runs after the publish job completes; it is a CI concern, not application code |
| Version-stamp gate | CI (GitHub Actions) | Shell script | Extraction of three version strings and comparison can be done in shell in 10 lines |
| Package rename | Registry + Code | CI (update badge URLs) | Registry publish + in-repo reference search and replace |
| Deprecation notice | Registry (npm deprecate / PyPI stub) | — | Registry-level operation, not code |
| Registry page polish | Package manifest files | — | `package.json` and `pyproject.toml` fields directly render on registry pages |
| Doctor version line | Application (npm + pip CLI) | Unit tests | One prepend in `doctor.ts` / `doctor_cmd.py` |
| Upgrade dry-run labels | Application (npm + pip CLI) | Unit tests | Change two string maps in `upgrade.ts` / `upgrade_cmd.py` |

---

## Standard Stack

### Core — No New Runtime Dependencies

Phase 11 installs **zero new runtime dependencies**. All changes use the existing project stack.

| Library | Version (current) | Purpose in Phase 11 | Source |
|---------|-----------------|--------------------|----|
| GitHub Actions | — | Post-publish smoke test + stamp gate | [VERIFIED: docs.github.com] |
| `npm deprecate` | built-in | Deprecate old npm package name | [VERIFIED: docs.npmjs.com] |
| PyPI stub wheel | n/a | Redirect old PyPI name to new | [CITED: dampfkraft.com deprecation guide] |
| `jq` / `grep` + `awk` | shell builtins | Extract version from JSON and TOML in CI | [VERIFIED: shell stdlib] |
| `vitest` | ^4 (existing) | Unit tests for doctor/upgrade changes | existing |
| `pytest` + `pytest-mock` | existing | Unit tests for Python parity | existing |

**Installation:** none required.

---

## Package Legitimacy Audit

Phase 11 installs no new packages. The only registry operations are:

| Operation | Registry | Details |
|-----------|----------|---------|
| Publish `goodvibes-cli` | npm | New name — verified available via `npm view goodvibes-cli` (E404) |
| Publish `goodvibes-cli` | PyPI | New name — verified via `pip index versions goodvibes-cli` (no matching distribution) |
| `npm deprecate @jgiox/goodvibes` | npm | Existing owned package — ownership confirmed |
| PyPI stub wheel for `jgiox-goodvibes` | PyPI | Publish a minimal stub that depends on `goodvibes-cli`; ownership confirmed |

**Packages removed due to slopcheck [SLOP]:** none — no new packages installed.
**Packages flagged [SUS]:** none.

*Note: slopcheck was run but checks against PyPI. npm-ecosystem packages (commander, @clack/prompts, execa, tsup) correctly appear as SLOP on PyPI because they are npm-only — this is expected cross-ecosystem behavior, not a real slop signal. These packages were verified via `npm view` and their existing presence in the project's `node_modules`.*

---

## Architecture Patterns

### System Architecture Diagram

```
[git tag push: npm-v*]               [git tag push: pip-v*]
         │                                    │
         ▼                                    ▼
┌─────────────────────┐           ┌──────────────────────┐
│  publish-npm.yml    │           │  publish-pip.yml      │
│  job: publish       │           │  job: publish         │
│  (existing)         │           │  (existing)           │
└────────┬────────────┘           └──────────┬───────────┘
         │ completes                          │ completes
         ▼                                    ▼
┌─────────────────────┐           ┌──────────────────────┐
│  job: smoke-test    │           │  job: smoke-test      │
│  needs: publish     │           │  needs: publish       │
│  sleep 30s          │           │  sleep 30s            │
│  npx goodvibes-cli  │           │  pip install          │
│    init --dry-run   │           │    goodvibes-cli      │
│  assert exit 0      │           │  goodvibes init       │
│  assert CLAUDE.md   │           │    --dry-run          │
│  in tmpdir          │           │  assert exit 0        │
└─────────────────────┘           └──────────────────────┘

[PR / push to main]
         │
         ▼
┌─────────────────────────────────────────────┐
│  ci.yml — job: check-stamps (new)           │
│  needs: nothing (runs in parallel)          │
│  Extract npm version: jq .version           │
│  Extract pip version: grep ^version         │
│  Extract template version: grep "^# goodvibes:" │
│  Compare all three; fail with message if mismatch │
└─────────────────────────────────────────────┘
```

### Recommended Project Structure Changes

```
.github/workflows/
├── ci.yml                  # add check-stamps job (new)
├── publish-npm.yml         # add smoke-test job (new)
└── publish-pip.yml         # add smoke-test job (new)

packages/npm/
├── package.json            # name: goodvibes-cli
└── src/commands/
    ├── doctor.ts           # prepend version line to note panel
    └── upgrade.ts          # symbol map: + → new, ~ → updated, = → unchanged

packages/pip/
├── pyproject.toml          # name: goodvibes-cli + classifiers
└── src/goodvibes_cli/commands/
    ├── doctor_cmd.py       # prepend version line to output
    └── upgrade_cmd.py      # symbol map: new / updated / unchanged
```

### Pattern 1: Post-Publish Smoke Test Job (npm)

**What:** A GitHub Actions job that depends on the publish job, waits briefly for registry propagation, then installs from the public registry and runs a sanity check.

**When to use:** On every publish workflow run, after the `publish` job completes.

```yaml
# Source: GitHub Actions docs + community patterns [ASSUMED for exact timing]
smoke-test:
  needs: publish
  runs-on: ubuntu-latest
  steps:
    - name: Wait for registry propagation
      run: sleep 30

    - name: Install from npm
      run: npm install -g goodvibes-cli@${{ github.ref_name }}
      # github.ref_name is the tag, e.g. npm-v1.7.0 — strip prefix below

    - name: Smoke test
      run: |
        cd $(mktemp -d)
        goodvibes init --dry-run
        test $? -eq 0
        test -f CLAUDE.md || (echo "CLAUDE.md not in dry-run output" && exit 1)
```

**Registry propagation timing:** npm registry typically propagates within seconds to a few minutes for public packages on npmjs.org (as opposed to GitHub Packages). A 30-second sleep is a conservative safe margin used by many open source publish pipelines. [ASSUMED — no official SLA documented by npm]

**Version extraction from tag:** The tag is `npm-v1.7.0`; the package version is `1.7.0`. Strip with shell: `VERSION=${GITHUB_REF_NAME#npm-v}`.

### Pattern 2: Post-Publish Smoke Test Job (PyPI)

```yaml
# Source: pypa publish docs + community patterns [ASSUMED for uv install]
smoke-test:
  needs: publish
  runs-on: ubuntu-latest
  steps:
    - name: Install uv
      uses: astral-sh/setup-uv@v7

    - name: Wait for registry propagation
      run: sleep 30

    - name: Install from PyPI
      run: uv tool install goodvibes-cli

    - name: Smoke test
      run: |
        cd $(mktemp -d)
        goodvibes init --dry-run
        test $? -eq 0
```

**PyPI propagation:** Comparable to npm — seconds on release, with a 30-second margin being standard practice in open source. [ASSUMED]

### Pattern 3: Version-Stamp Gate (CI check)

**What:** A shell-only job in `ci.yml` that extracts the version from three files and fails with an actionable error if any diverge. Uses only `grep`, `sed`, and `awk` — available on both Linux and macOS without any install step.

```yaml
# Source: shell stdlib [VERIFIED: no external tools needed]
check-stamps:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v7

    - name: Check version stamps are in sync
      run: |
        NPM_VER=$(node -p "require('./packages/npm/package.json').version")
        PIP_VER=$(grep '^version' packages/pip/pyproject.toml | sed 's/version = "\(.*\)"/\1/')
        TPL_VER=$(grep '^# goodvibes: v' templates/CLAUDE.md | sed 's/# goodvibes: v//')

        echo "npm:      $NPM_VER"
        echo "pip:      $PIP_VER"
        echo "template: $TPL_VER"

        if [ "$NPM_VER" != "$PIP_VER" ] || [ "$NPM_VER" != "$TPL_VER" ]; then
          echo ""
          echo "ERROR: Version stamps are out of sync."
          echo "Fix: update templates/CLAUDE.md line 4 to '# goodvibes: v$NPM_VER'"
          echo "Fix: update packages/pip/pyproject.toml version to match"
          exit 1
        fi
        echo "All stamps in sync: v$NPM_VER"
```

**Why `node -p` for npm:** jq is not guaranteed on all GitHub runners; `node -p "require('./file').version"` is reliable when Node is already set up in the job. However, `check-stamps` does not set up Node, so `grep` + `sed` for all three files is the cross-platform approach.

**Alternative (all grep/sed):**
```bash
NPM_VER=$(grep '"version"' packages/npm/package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
```
This works without Node being in PATH and is macOS-compatible. [VERIFIED: shell stdlib]

**Cross-platform note:** `sed -E` is not available in BSD sed without `-E`; use `sed 's/pattern/\1/'` basic regex, which works on both GNU sed (Linux) and BSD sed (macOS). [VERIFIED: POSIX sh spec]

### Pattern 4: Doctor Version Prepend (TS)

**What:** Read the installed version via the existing `getInstalledVersion()` helper in `upgrade.ts` — or duplicate the one-liner from `index.ts` — and prepend it to the `note()` call in `doctor.ts`.

The installed version is available via `createRequire` + `package.json`:

```typescript
// Source: existing pattern in upgrade.ts [VERIFIED: codebase grep]
import { createRequire } from 'node:module'
const _require = createRequire(import.meta.url)
function getVersion(): string {
  try {
    const pkg = _require('../../package.json') as { version?: string }
    return pkg.version ?? 'unknown'
  } catch { return 'unknown' }
}
```

Prepend to the `lines` array in `registerDoctorCommand`:
```typescript
const version = getVersion()
const lines = [`goodvibes v${version}`, ...all.map(r => `${r.pass ? '✓' : '✗'} ${r.label}`)]
note(lines.join('\n'), 'goodvibes doctor')
```

**Ponytail note:** Do not import `getInstalledVersion` from `upgrade.ts` — that file is not structured for export of that helper. Duplicate the 5-line pattern locally (YAGNI — it's two files, not an abstraction opportunity). [ASSUMED — check if export is cleaner]

### Pattern 5: Doctor Version Prepend (Python)

```python
# Source: existing pattern in main.py [VERIFIED: codebase grep]
import importlib.metadata

def doctor_cmd() -> None:
    version = _safe_version()
    # prepend as first line of the panel
    lines = [f"goodvibes v{version}", ...]
    ...

def _safe_version() -> str:
    try:
        return importlib.metadata.version("goodvibes-cli")  # after rename
    except importlib.metadata.PackageNotFoundError:
        return "unknown"
```

**Note:** After rename, the package metadata key changes from `jgiox-goodvibes` to `goodvibes-cli`. All `importlib.metadata.version("jgiox-goodvibes")` calls in `main.py`, `upgrade_cmd.py`, and `doctor_cmd.py` must be updated to `"goodvibes-cli"`. [VERIFIED: codebase grep — 3 call sites]

### Pattern 6: Upgrade --dry-run Label Change

**What:** Change the `symbol` / `status` map in `formatChangeSummary` (TS) and `format_change_summary` (Python) from symbols to English words.

**TypeScript (upgrade.ts line ~92):**
```typescript
// Before:
const symbol: Record<string, string> = { changed: '~', unchanged: '=', new: '+' }
return changes.map(c => `${symbol[c.status] ?? '?'} ${c.path}`).join('\n')

// After:
const label: Record<string, string> = { changed: 'updated', unchanged: 'unchanged', new: 'new' }
return changes.map(c => `${label[c.status] ?? '?'} ${c.path}`).join('\n')
```

**Python (upgrade_cmd.py line ~114):**
```python
# Before:
symbol = {"changed": "~", "unchanged": "=", "new": "+"}

# After:
symbol = {"changed": "updated", "unchanged": "unchanged", "new": "new"}
```

**Test impact:** Existing tests that assert on `+`, `~`, `=` symbols will break and must be updated. Check `upgrade.test.ts` and `test_upgrade_cmd.py` for symbol assertions.

### Anti-Patterns to Avoid

- **`sleep 60`+ in smoke test:** Over-conservative; npm propagates in seconds on npmjs.org. 30 seconds is the practical ceiling. [ASSUMED]
- **`npx goodvibes-cli` in smoke test:** npx adds registry round-trip overhead. Use `npm install -g goodvibes-cli@$VERSION` then call the binary directly.
- **`shell: true` in CI steps:** No shell injection risk here since all inputs are constants, but use array form anyway per project security policy.
- **Importing version helper from `upgrade.ts` into `doctor.ts`:** Avoid cross-command imports — duplicate the 5-line helper. Commands are leaves, not a shared library.
- **Using `jq` in CI without a setup step:** jq is pre-installed on GitHub's ubuntu-latest runners [VERIFIED: GitHub Actions runner image documentation] but not guaranteed on macOS runners. Use `node -p` or pure `grep`/`sed` for maximum portability.

---

## Package Naming

### npm Name Decision

| Candidate | Available? | Risk | Verdict |
|-----------|-----------|------|---------|
| `goodvibes` | No — blocked by npm similarity rule (punctuation-stripped `goodvibies` == `good-vibes`) | Would fail at publish | REJECTED |
| `goodvibes-cli` | Yes — `good-vibes-cli` does not exist; `goodvibes-cli` not in registry | Minimal — `goodvibescli` also not in registry | RECOMMENDED |
| `goodvibes-init` | Yes — `good-vibes-init` not in registry | Minimal | Viable fallback |
| `goodvibes-setup` | Yes — `good-vibes-setup` not in registry | Minimal | Viable fallback |
| `goodvibes-dev` | Yes — `good-vibes-dev` not in registry | Minimal | Viable fallback |

**Evidence for `goodvibes` block:** JOURNAL.md line ~50 documents that `goodvibes` was blocked during Phase 2 publish due to npm's moniker similarity rule (hyphen removal). The npm blog post "New Package Moniker rules" (2018) confirms: after stripping punctuation, names that match existing names are blocked. `good-vibes` (42 versions, MIT, active) would block `goodvibes`. [CITED: blog.npmjs.org/post/168978377570]

**Evidence for `goodvibes-cli` availability:** `npm view good-vibes-cli` returns 404. `npm view goodvibes-cli` returns 404. `npm view goodvibescli` returns 404. No similarity conflict. [VERIFIED: npm registry]

**Recommended npm name:** `goodvibes-cli`

### PyPI Name Decision

| Candidate | Available? | Evidence |
|-----------|-----------|---------|
| `goodvibes` | No — Paton Research Group chemistry package v4.3.0 (since at least 2018) | [VERIFIED: `pip index versions goodvibes` → 4.3.0] |
| `goodvibes-cli` | Yes | [VERIFIED: `pip index versions goodvibes-cli` → error: no matching distribution] |
| `goodvibes-setup` | Yes | [VERIFIED: `pip index versions goodvibes-setup` → error] |

**PyPI does not have npm's moniker similarity rule.** PyPI has a squatting prevention policy but does not block names based on punctuation stripping. [ASSUMED — PyPI policy not fully documented in current sources]

**Recommended PyPI name:** `goodvibes-cli`

### Deprecation Strategy

**npm:** Run `npm deprecate @jgiox/goodvibes@"*" "This package has been renamed to goodvibes-cli. Install with: npm install -g goodvibes-cli"`. Deprecation message appears in terminal when `npm install @jgiox/goodvibes` is run; the package still installs but warns. Requires owner login. [VERIFIED: docs.npmjs.com/deprecating-and-undeprecating-packages]

**PyPI:** Publish a stub wheel named `jgiox-goodvibes` that depends on `goodvibes-cli` and has a deprecation notice in its description. Pattern: `install_requires = ["goodvibes-cli"]` — pip auto-installs the new package when old is installed. [CITED: dampfkraft.com/code/how-to-deprecate-a-pypi-package]

### In-Repo Reference Updates Required

All references to old names must be updated. Key locations:

| File | Old reference | New reference |
|------|--------------|--------------|
| `packages/npm/package.json` | `"name": "@jgiox/goodvibes"` | `"name": "goodvibes-cli"` |
| `packages/pip/pyproject.toml` | `name = "jgiox-goodvibes"` | `name = "goodvibes-cli"` |
| `packages/pip/pyproject.toml` | `[project.scripts] goodvibes = "goodvibes_cli.main:app"` | unchanged (entry point stays `goodvibes`) |
| `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py` | `_PYPI_URL = ".../jgiox-goodvibes/..."`, `uv tool upgrade jgiox-goodvibes`, `pip install --upgrade jgiox-goodvibes`, `importlib.metadata.version("jgiox-goodvibes")` | all → `goodvibes-cli` |
| `packages/pip/src/goodvibes_cli/main.py` | `importlib.metadata.version("jgiox-goodvibes")` | `goodvibes-cli` |
| `packages/npm/src/commands/upgrade.ts` | `npm view @jgiox/goodvibes version`, `npm install -g @jgiox/goodvibes@...` | `goodvibes-cli` |
| `.github/workflows/publish-pip.yml` | `test -f packages/pip/dist/jgiox_goodvibes-*.whl` | `goodvibes_cli-*.whl` |
| `README.md` | badge URLs (`jgiox-goodvibes` PyPI badge, `@jgiox/goodvibes` npm badge) | update to new names |
| `scripts/demo.tape` | `npm install -g @jgiox/goodvibes` | `npm install -g goodvibes-cli` |
| `packages/npm/.gitignore` | — | no change |

**Test files:** grep for `jgiox-goodvibes` and `@jgiox/goodvibes` in test files. Specifically:
- `test_upgrade_cmd.py`: mocks `_PYPI_URL`, `_get_package_version` — check for hardcoded package name
- `upgrade.test.ts`: mocks `npm view @jgiox/goodvibes version`

---

## Registry Page Requirements

### npm Page (package.json fields)

| Field | Current value | Required value | Notes |
|-------|--------------|----------------|-------|
| `name` | `@jgiox/goodvibes` | `goodvibes-cli` | rename |
| `description` | `One-command bootstrap for vibe coding projects` | Keep — clear and concise | already polished |
| `keywords` | 9 keywords | Keep current + consider `scaffold`, `starter`, `beginner` | already has `vibe-coding`, `claude`, `llm`, `cli`, `ai-coding` |
| `homepage` | not set | `https://github.com/jgiox/goodvibes` | add |
| `repository.url` | `https://github.com/jgiox/goodvibes` | keep | already set |
| `license` | `Apache-2.0` | keep | already set |

**Fields that render on npmjs.com:** `name`, `description`, `keywords`, `homepage`, `repository`, `license`, `version`, `engines`. All others are already set. [VERIFIED: npmjs.com package page inspection of existing packages]

### PyPI Page (pyproject.toml fields)

| Field | Current value | Required value |
|-------|--------------|----------------|
| `name` | `jgiox-goodvibes` | `goodvibes-cli` |
| `description` | `One-command bootstrap for vibe coding projects` | keep |
| `keywords` | 9 keywords | keep |
| `[project.urls] Homepage` | `https://github.com/jgiox/goodvibes` | keep |
| `classifiers` | not set | add (see below) |
| `license` | `{ text = "Apache-2.0" }` | keep |

**Recommended classifiers for PyPI:** [VERIFIED: pypi.org/classifiers/]
```toml
classifiers = [
    "Development Status :: 5 - Production/Stable",
    "Intended Audience :: Developers",
    "Environment :: Console",
    "Operating System :: OS Independent",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
    "Topic :: Software Development",
    "Topic :: Software Development :: Code Generators",
    "Topic :: Utilities",
]
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version extraction from JSON | Custom parser | `node -p "require('./packages/npm/package.json').version"` or `grep` + `sed` | stdlib; jq not guaranteed |
| Version extraction from TOML | TOML parser import | `grep '^version' pyproject.toml \| sed 's/version = "\(.*\)"/\1/'` | TOML is line-oriented at the `[project]` level; grep is sufficient for one field |
| Registry propagation polling | Loop with retries | Fixed `sleep 30` | CDN propagation is fast on npmjs.org; retry logic adds complexity for marginal benefit |
| npm name conflict check | Custom validation script | `npm view <name>` returning 404 | Already done in research; no runtime check needed |
| PyPI deprecation | Custom "please upgrade" logic in old package | Stub wheel with `install_requires=["goodvibes-cli"]` | pip handles the redirect automatically |
| Smoke test assertion framework | Install pytest in smoke runner | `test $? -eq 0` and `test -f FILE` shell assertions | 2 lines of shell; no framework needed |

---

## Runtime State Inventory

> Phase 11 involves a package rename — runtime state must be inventoried.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — goodvibes writes to user project directories, not a database | None |
| Live service config | None — no running service; CLI only | None |
| OS-registered state | None — goodvibes is not registered as a service or daemon | None |
| Secrets/env vars | `NPM_TOKEN` GitHub secret (publish auth for `@jgiox/goodvibes`); this token is scoped to the existing account and will work for any package published under that account | No action — same token works for `goodvibes-cli` |
| Build artifacts | `packages/pip/dist/jgiox_goodvibes-*.whl` — old wheel filename; `packages/npm/dist/` — no name in artifacts | After rename: wheel will be `goodvibes_cli-*.whl`; `dist/` is gitignored, no issue |

**Key rename side effect — importlib.metadata:** The Python package's installed metadata key is the PyPI name. After rename, `importlib.metadata.version("jgiox-goodvibes")` will raise `PackageNotFoundError` for users on the old name. All three call sites in the pip package must be updated to `"goodvibes-cli"`. [VERIFIED: codebase grep — 3 call sites confirmed]

**Key rename side effect — self-update URLs:** `upgrade_cmd.py` hardcodes `https://pypi.org/pypi/jgiox-goodvibes/json` in `_PYPI_URL` and `uv tool upgrade jgiox-goodvibes`. `upgrade.ts` hardcodes `npm view @jgiox/goodvibes version` and `npm install -g @jgiox/goodvibes@...`. All must change. [VERIFIED: codebase grep]

---

## Common Pitfalls

### Pitfall 1: npm Moniker Similarity Block at Publish Time
**What goes wrong:** Developer tests with `npm view goodvibes` (404), assumes it's available, updates package.json, runs `npm publish`, gets rejected with "name too similar to existing package."
**Why it happens:** npm strips all punctuation before comparing names. `goodvibes` == `good-vibes` after stripping.
**How to avoid:** Use `goodvibes-cli`. The similarity check on `goodvibes-cli` vs `good-vibes-cli` passes because `good-vibes-cli` does not exist.
**Warning signs:** The JOURNAL already documents this exact block at Phase 2.

### Pitfall 2: Registry Propagation Race in Smoke Test
**What goes wrong:** Smoke test job starts immediately after `npm publish` returns, runs `npm install -g goodvibes-cli@1.7.0`, gets 404 because the CDN has not replicated yet.
**Why it happens:** npm publish returns as soon as the primary registry accepts the package, before all CDN edges have replicated.
**How to avoid:** `sleep 30` between publish completion and install attempt. 30 seconds is conservative; real propagation is often under 5 seconds on npmjs.org.
**Warning signs:** "npm error 404" in smoke test step with correct package name and version.

### Pitfall 3: Version Tag Contains Package Prefix
**What goes wrong:** The smoke test needs to install `goodvibes-cli@1.7.0` but `GITHUB_REF_NAME` is `npm-v1.7.0`.
**Why it happens:** Publish workflows use `npm-v*` tags to distinguish npm from pip releases.
**How to avoid:** Strip the prefix: `VERSION=${GITHUB_REF_NAME#npm-v}` in bash.

### Pitfall 4: importlib.metadata Still Uses Old Package Name
**What goes wrong:** After rename, `goodvibes --version` fails with `PackageNotFoundError: jgiox-goodvibes` because `importlib.metadata.version("jgiox-goodvibes")` is not updated.
**Why it happens:** The package name in metadata calls must match the installed distribution name exactly.
**How to avoid:** Global search-replace `jgiox-goodvibes` → `goodvibes-cli` in all Python source files before publish.
**Warning signs:** `goodvibes --version` raises an unhandled exception; or returns `"unknown"` if there is a try/except already.

### Pitfall 5: Upgrade symbol test assertions break silently
**What goes wrong:** Tests for `formatChangeSummary` / `format_change_summary` that assert `+` or `~` in output pass because the regex is too loose, masking that the labels didn't change.
**Why it happens:** If tests match `assert "+" in output` instead of `assert output == "+ path/to/file"`, the old symbol could still be present in another part of the string.
**How to avoid:** Update tests to assert the new English words explicitly: `assert "new CLAUDE.md" in output` or equivalent.

### Pitfall 6: PyPI Trusted Publishing Environment Name Must Match
**What goes wrong:** After renaming the PyPI package, if the PyPI trusted publishing environment is configured for `jgiox-goodvibes`, publish fails with OIDC token mismatch.
**Why it happens:** PyPI trusted publishing is configured per-project on PyPI's website; the new package `goodvibes-cli` needs its own trusted publisher configured.
**How to avoid:** The publish workflow step requires a human to configure trusted publishing for `goodvibes-cli` on pypi.org before the first publish run. Add this as a human checkpoint task.

### Pitfall 7: Shields.io Badge URLs Use Old Package Names
**What goes wrong:** After rename, npm and PyPI badges in README.md still point to `@jgiox/goodvibes` and `jgiox-goodvibes` — badges show errors or old version.
**Why it happens:** Badge URLs are hardcoded strings, not derived from package.json.
**How to avoid:** Update both badge URLs in README.md as part of the rename task.

---

## Code Examples

### Version-Stamp Gate Shell Script (all-grep, no node required)

```bash
# Source: POSIX sh stdlib [VERIFIED: POSIX spec]
NPM_VER=$(grep '"version"' packages/npm/package.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
PIP_VER=$(grep '^version' packages/pip/pyproject.toml | sed 's/version = "\(.*\)"/\1/')
TPL_VER=$(grep '^# goodvibes: v' templates/CLAUDE.md | sed 's/# goodvibes: v//')

if [ "$NPM_VER" != "$PIP_VER" ] || [ "$NPM_VER" != "$TPL_VER" ]; then
  echo "ERROR: version stamps out of sync — npm=$NPM_VER pip=$PIP_VER template=$TPL_VER"
  echo "Fix: update templates/CLAUDE.md line 4 to '# goodvibes: v$NPM_VER'"
  exit 1
fi
```

### npm Deprecate Command

```bash
# Source: docs.npmjs.com [VERIFIED: official docs]
npm deprecate "@jgiox/goodvibes@*" "Renamed to goodvibes-cli. Install: npm install -g goodvibes-cli"
```

### PyPI Stub Wheel pyproject.toml (for `jgiox-goodvibes` tombstone)

```toml
# Source: dampfkraft.com deprecation guide [CITED]
[project]
name = "jgiox-goodvibes"
version = "2.0.0"  # bump major to signal breaking change
description = "Renamed to goodvibes-cli. Run: pip install goodvibes-cli"
dependencies = ["goodvibes-cli"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

### Doctor Version Line Prepend (TypeScript)

```typescript
// Source: existing pattern in upgrade.ts [VERIFIED: codebase]
// In registerDoctorCommand action:
const _require = createRequire(import.meta.url)
function getInstalledVersion(): string {
  try {
    const pkg = _require('../../package.json') as { version?: string }
    return pkg.version ?? 'unknown'
  } catch { return 'unknown' }
}
// ...
const version = getInstalledVersion()
const lines = [
  `goodvibes v${version}`,
  ...all.map(r => `${r.pass ? '✓' : '✗'} ${r.label}`)
]
note(lines.join('\n'), 'goodvibes doctor')
```

### Doctor Version Line Prepend (Python)

```python
# Source: existing pattern in main.py [VERIFIED: codebase]
import importlib.metadata

def _installed_version() -> str:
    try:
        return importlib.metadata.version("goodvibes-cli")
    except importlib.metadata.PackageNotFoundError:
        return "unknown"

def doctor_cmd() -> None:
    version = _installed_version()
    results = [...]
    lines = [f"goodvibes v{version}"] + [f"{'✓' if r.passed else '✗'} {r.label}" for r in results]
    console.print(Panel("\n".join(lines), title="goodvibes doctor"))
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Manual publish + hope it works | Post-publish smoke test CI job | Catches broken publishes before users see them |
| No version sync check | Automated CI stamp gate | Prevents the v1.4.0-class false-update bug |
| Personal-handle prefixed names (`@jgiox/`, `jgiox-`) | `goodvibes-cli` on both registries | Discovery — "goodvibes-cli" is searchable without knowing the maintainer's handle |
| `+` / `~` / `=` diff symbols | `new` / `updated` / `unchanged` English words | Legibility for beginners unfamiliar with diff notation |

**Background on the v1.4.0 stale-stamp bug (from JOURNAL.md 2026-07-02):** The upgrade command compared the installed project's CLAUDE.md version stamp against the *bundled template's* CLAUDE.md stamp, not the binary's own package metadata version. When v1.4.0 shipped without bumping `templates/CLAUDE.md`, users saw "Already up to date (v1.3.0)". Fixed in v1.6.1 by switching the comparison to `importlib.metadata.version()` / `package.json` version. PUB-02 prevents this class of bug by gating CI on all three stamps being in sync.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `sleep 30` is sufficient for npm registry propagation before smoke test install | Post-Publish Smoke Test Pattern | Smoke test fails with 404; fix: increase to 60s |
| A2 | `sleep 30` is sufficient for PyPI propagation | Post-Publish Smoke Test Pattern | Same; fix: increase sleep |
| A3 | npm's moniker rule blocks `goodvibes` due to `good-vibes` | Package Naming | If rule changed, `goodvibes` could be available — but `goodvibes-cli` is safer and equally good |
| A4 | PyPI does not have a moniker/similarity rule | Package Naming | If PyPI has one, `goodvibes-cli` may still be blocked — but evidence suggests PyPI does not strip punctuation for conflict detection |
| A5 | `getInstalledVersion()` pattern from `upgrade.ts` is safe to duplicate in `doctor.ts` | Code Examples | If package.json is not bundled correctly in some edge case, version returns "unknown" — acceptable fallback |
| A6 | PyPI trusted publishing for `goodvibes-cli` requires a human to configure on pypi.org before first publish | Pitfall 6 | If skipped, publish fails with OIDC error |
| A7 | GitHub ubuntu-latest runners have `grep` and `sed` pre-installed | Version-Stamp Gate | Extremely unlikely to be wrong — these are POSIX base utilities |
| A8 | `goodvibes-cli` entry point command stays `goodvibes` after rename | Package Naming | No impact — `[project.scripts]` maps `goodvibes` to the module regardless of package name |

---

## Open Questions

1. **Should the smoke test use `npx goodvibes-cli init --dry-run` (cold install) or pre-install?**
   - What we know: `npx` adds registry round-trip; `npm install -g` is faster but requires root on some systems; smoke test runs on GitHub Actions ubuntu-latest (root available)
   - What's unclear: whether `npx goodvibes-cli@VERSION` would work without version pinning
   - Recommendation: Use `npm install -g goodvibes-cli@$VERSION` then call binary directly — matches the JOURNAL observation that npx always re-checks the registry even with warm cache

2. **Should the version-stamp gate run as a pre-push hook in addition to CI?**
   - What we know: PUB-02 specifies "pre-push hook OR PR gate"; the project currently has no git hooks configured
   - What's unclear: whether adding a git hook would improve developer experience or add friction
   - Recommendation: PR gate via `ci.yml` is sufficient for PUB-02; git hooks are optional. Planner should add as a separate task only if the user specifically requests it.

3. **Should the PyPI stub wheel for `jgiox-goodvibes` be published from the same repo or a separate micro-repo?**
   - What we know: the stub is a one-file pyproject.toml with no source; it can live in `packages/pip-tombstone/` or as a separate repo
   - What's unclear: maintenance burden; trusted publishing for the stub needs its own PyPI config
   - Recommendation: Put in `packages/pip-tombstone/` with a manual one-time publish step; no automated CI needed for a tombstone package.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| npm CLI | Package rename + deprecate | ✓ | 10.x (from `npm --version`) | — |
| pip / uv | PyPI verify + stub publish | ✓ | uv 0.7+ (from `uv --version`) | pip fallback |
| `grep` + `sed` | Version-stamp gate script | ✓ | POSIX builtins | — |
| Node.js | CI npm step | ✓ | 20+ (project requirement) | — |
| Python 3.10+ | pip package | ✓ | system Python | — |

**Missing dependencies with no fallback:** none.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (npm) | vitest ^4 |
| Framework (pip) | pytest + pytest-mock |
| Config file (npm) | `packages/npm/vitest.config.ts` or `package.json scripts.test` |
| Config file (pip) | `packages/pip/pyproject.toml [tool.pytest.ini_options]` |
| Quick run (npm) | `cd packages/npm && npm test` |
| Quick run (pip) | `cd packages/pip && uv run pytest tests/ -x -q` |
| Full suite | both above |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUB-01 | Post-publish smoke test runs and passes | integration (CI-only) | CI job — not unit-testable | ❌ Wave 0 (add to publish workflows) |
| PUB-02 | Stamp gate fails when versions diverge | unit (shell script) | `bash scripts/check-stamps.sh` | ❌ Wave 0 (script + ci.yml job) |
| PKG-01 | Package name references updated | manual check + CI (wheel name assertion) | `test -f packages/pip/dist/goodvibes_cli-*.whl` | ❌ Wave 0 (update wheel check in publish-pip.yml) |
| PKG-02 | Registry page fields present | manual check | review npmjs.com + pypi.org post-publish | manual-only |
| POL-01 | Doctor output starts with version line | unit | `npm test` / `uv run pytest tests/test_doctor_cmd.py` | existing (tests need new assertion) |
| POL-02 | Upgrade dry-run prints English labels | unit | `npm test` / `uv run pytest tests/test_upgrade_cmd.py` | existing (tests need updated assertions) |

### Wave 0 Gaps

- [ ] `scripts/check-stamps.sh` — standalone script for PUB-02 (can also be inlined in ci.yml)
- [ ] `.github/workflows/ci.yml` — add `check-stamps` job
- [ ] `.github/workflows/publish-npm.yml` — add `smoke-test` job
- [ ] `.github/workflows/publish-pip.yml` — add `smoke-test` job
- [ ] `packages/pip/tests/test_doctor_cmd.py` — add test: `test_doctor_output_starts_with_version`
- [ ] `packages/npm/src/commands/doctor.test.ts` — add test: version line appears first in note
- [ ] `packages/pip/tests/test_upgrade_cmd.py` — update symbol assertions to English words
- [ ] `packages/npm/src/commands/upgrade.test.ts` — update symbol assertions to English words

*(Existing test infrastructure covers all phase requirements — gaps are additions to existing files, not new frameworks.)*

---

## Security Domain

`security_enforcement: true` per config. ASVS Level 1 applies.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | n/a |
| V3 Session Management | No | n/a |
| V4 Access Control | No | n/a |
| V5 Input Validation | Minimal | Version strings extracted from own files — no user input |
| V6 Cryptography | No | n/a |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in smoke test tmpdir | Tampering | Use `mktemp -d` — OS-provided safe temp dir |
| Version string injection in CI log | Spoofing | Values come from own repo files, not external input; display-only in logs |
| npm deprecate message seen by attackers | Spoofing | Deprecation notice is informational; no security impact |

**Security note:** The smoke test job installs a package from the public registry. The version being installed was just published by the same job — it is the project's own code. No additional supply chain risk beyond what the project already accepts at publish time.

---

## Sources

### Primary (HIGH confidence)
- npm moniker rules: [blog.npmjs.org/post/168978377570](https://blog.npmjs.org/post/168978377570/new-package-moniker-rules.html) — confirms punctuation-strip similarity rule
- npm deprecate docs: [docs.npmjs.com/deprecating-and-undeprecating-packages](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/) — exact command syntax
- PyPI classifiers: [pypi.org/classifiers](https://pypi.org/classifiers/) — canonical classifier list
- POSIX shell: grep, sed, test — POSIX stdlib
- Codebase: `packages/npm/src/commands/upgrade.ts` — formatChangeSummary pattern
- Codebase: `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py` — format_change_summary
- Codebase: `packages/npm/src/commands/doctor.ts` — current doctor structure
- Codebase: `packages/pip/src/goodvibes_cli/commands/doctor_cmd.py` — current doctor structure
- JOURNAL.md (2026-07-02) — v1.4.0 stale-stamp bug root cause and fix

### Secondary (MEDIUM confidence)
- PyPI deprecation pattern: [dampfkraft.com/code/how-to-deprecate-a-pypi-package](https://www.dampfkraft.com/code/how-to-deprecate-a-pypi-package.html) — stub wheel with `install_requires`
- GitHub Actions `needs:` pattern for post-publish jobs: multiple community examples and GitHub Docs
- npm registry propagation: GitHub community discussion #46463 — "a few minutes"; 30s practical margin

### Tertiary (LOW confidence, marked [ASSUMED])
- Registry propagation timing (exact seconds): no official SLA; 30s is community convention
- PyPI similarity/squatting rules: not fully documented; assumed to differ from npm

---

## Metadata

**Confidence breakdown:**
- Package naming: HIGH — npm availability verified via registry; moniker rule verified via official npm blog post; PyPI availability verified via pip index
- Post-publish smoke test: MEDIUM — pattern is community-standard; exact timing is assumed
- Version-stamp gate: HIGH — pure shell stdlib, no uncertainty
- UX code patches (POL-01, POL-02): HIGH — direct code inspection of both TS and Python source
- Registry page polish (PKG-02): HIGH — field names verified against npm and PyPI documentation

**Research date:** 2026-07-02
**Valid until:** 2026-08-02 (stable domain; npm moniker rules rarely change)
