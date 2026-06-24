# Phase 4: CI/CD Scaffolding - Research

**Researched:** 2026-06-24
**Domain:** GitHub Actions workflow authoring, project-type detection, template file injection
**Confidence:** HIGH

## Summary

Phase 4 is primarily a **template authoring and project-type detection** problem, not a new
framework integration problem. The goodvibes CLI already has all the infrastructure needed:
`copy-templates.ts` / `copy_templates.py` copy files verbatim, and the `--minimal` flag already
skips `.github/workflows/` wholesale. The missing piece is (1) no CI workflow templates exist in
`templates/.github/workflows/` yet, and (2) there is no project-type detection that selects
different workflow files for Node vs Python targets.

The decision space has exactly two branches:

**Option A — Static multi-file selection:** Author three static workflow files
(`ci-node.yml`, `ci-python.yml`, `ci-both.yml`), detect the target project type in `init`,
and copy only the relevant file as `ci.yml`. Zero templating, zero string interpolation — pure
file copy, consistent with the existing copy-templates pattern.

**Option B — Universal auto-detecting workflow:** Author a single `ci.yml` that shells out to
detect `package.json` and `pyproject.toml` at runtime inside the GitHub Actions job and runs
the appropriate steps conditionally. Avoids branching in init but makes the YAML more complex.

**Option A is recommended.** It is simpler to reason about, simpler to test, and fully consistent
with the project's "copy static files, no templating" architecture. The project-type detection
function (`detect-project-type`) is a thin `existsSync`/`os.path.exists` check — it is small
enough that it does not need to be a shared module; a few lines in `copy-templates` or `init`.

The biggest known risk in this phase: the `uv run pytest` failure mode (CI fails because `pytest`
lives in `[project.optional-dependencies].dev`, not base deps) is a **documented past bug** in
this repo (commit `a239d64`). Generated Python CI workflows MUST use `uv run --extra dev pytest`.

**Primary recommendation:** Author three static CI workflow templates + `security.yml` +
`dependency-review.yml` + `dependabot.yml`, add a `detectProjectType()` helper that checks
`package.json` / `pyproject.toml` / `requirements.txt` in `cwd`, and wire it into `copyTemplates`
to select the appropriate `ci.yml` variant. No dynamic templating. No new libraries.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Project-type detection | CLI (init time) | — | Detects markers in target dir at runtime before copy |
| CI workflow selection | CLI (copy-templates) | — | Copy logic already owns file filtering; add variant selection here |
| CI workflow execution | GitHub Actions (target repo CI) | — | Runs in the user's repo, not goodvibes |
| Security scanning | GitHub Actions (codeql) | — | Runs in user repo CI; no goodvibes code executes |
| Dependency review | GitHub Actions (PR workflow) | — | Pull request event; runs in user repo |
| Dependabot updates | GitHub (dependabot.yml config) | — | Config-driven, no code execution |

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fs-extra` | ^11.3.5 | `existsSync` for project-type detection | Already a direct dependency; `existsSync` from Node `fs` also works |
| `node:fs` | stdlib | `existsSync` for project-type detection (TS) | Zero-dep option; prefer over adding fs-extra for a one-liner |
| `pathlib` | stdlib | `Path.exists()` for project-type detection (Python) | Already used throughout pip CLI |

**No new packages are required for this phase.** Project-type detection is a `fs.existsSync`
check. Template authoring is YAML files. The existing copy-templates infrastructure handles the
rest.

### GitHub Actions Action Versions (latest as of 2026-06-24)

| Action | Latest Version | Used In | Notes |
|--------|---------------|---------|-------|
| `actions/checkout` | v7 | all workflows | [VERIFIED: GitHub releases] |
| `actions/setup-node` | v6 | ci-node.yml | [VERIFIED: GitHub releases] |
| `astral-sh/setup-uv` | v8 | ci-python.yml | [VERIFIED: GitHub releases] v8.2.0 is latest minor; use `v8` major pin |
| `github/codeql-action` | v4 | security.yml | [VERIFIED: GitHub releases] |
| `actions/dependency-review-action` | v5 | dependency-review.yml | [VERIFIED: GitHub releases] Requires Actions Runner v2.327.1+ |

**Note on the goodvibes repo's own CI:** The repo's `.github/workflows/ci.yml` uses `setup-uv@v7`
(correct as of the last fix commit `a239d64`). The latest is v8 — the generated template
should pin v8. The goodvibes repo's own CI is a separate concern from the template CI and can
be upgraded independently.

### Package Legitimacy Audit

> Phase 4 installs no new packages. The audit below covers the npm packages already in the
> codebase that this phase's detection code will use.

slopcheck was run against PyPI (incorrect ecosystem) and flagged npm-only packages as SLOP —
this is expected cross-ecosystem confusion. All packages were verified against the npm registry:

| Package | Registry | Age | npm version | slopcheck (npm) | Disposition |
|---------|----------|-----|-------------|-----------------|-------------|
| `commander` | npm | 2011 (15 yrs) | 15.0.0 | Not applicable — already in codebase | Approved |
| `@clack/prompts` | npm | 2023 (3 yrs) | 1.6.0 | Not applicable — already in codebase | Approved |
| `fs-extra` | npm | 2011 (15 yrs) | 11.3.5 | Not applicable — already in codebase | Approved |
| `execa` | npm | verified on npm | 9.6.1 | Not applicable — already in codebase | Approved |
| `vitest` | npm | 2021 (5 yrs) | 4.1.9 | Not applicable — already in codebase | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck ran against wrong ecosystem)
**Packages flagged as suspicious [SUS]:** none

*Note: slopcheck v0.6.1 does not support npm ecosystem detection — it checks PyPI only. For npm
package legitimacy, age + download count + official GitHub org were used as verification signals.
All packages above have GitHub sources, multi-year histories, and are already locked in
package-lock.json.*

## Architecture Patterns

### System Architecture Diagram

```
goodvibes init
      |
      v
detectProjectType(cwd)                    ← new function
      |
      +---> hasPackageJson? ---> "node"
      +---> hasPyprojectToml OR hasRequirementsTxt? ---> "python"
      +---> both? ---> "both"
      +---> neither? ---> "both"           (safe default: install everything)
      |
      v
copyTemplates(templateDir, destDir, dryRun, minimal, projectType)
      |
      +---> NOT minimal:
      |       copy ci-node.yml as .github/workflows/ci.yml   (if node or both)
      |       copy ci-python.yml as .github/workflows/ci.yml (if python)
      |       copy ci-both.yml as .github/workflows/ci.yml   (if both)
      |       copy security.yml → .github/workflows/security.yml
      |       copy dependency-review.yml → .github/workflows/dependency-review.yml
      |       copy dependabot.yml → .github/dependabot.yml
      +---> minimal: skip all .github/workflows/ (existing behavior, unchanged)
```

**Note on ci.yml naming:** The three source templates are named distinctly in
`templates/.github/workflows/` to avoid collision. Only one gets written as `ci.yml` to the
target. The copy-templates logic handles the rename.

### Recommended Project Structure

```
templates/
└── .github/
    ├── dependabot.yml           # covers npm + pip + github-actions (new)
    └── workflows/
        ├── ci-node.yml          # Node-only CI template (new)
        ├── ci-python.yml        # Python-only CI template (new)
        ├── ci-both.yml          # Both stacks CI template (new)
        ├── security.yml         # CodeQL + security scan (new)
        └── dependency-review.yml # PR dep review gate (new)

packages/npm/src/
├── steps/
│   └── copy-templates.ts       # add projectType param + CI variant selection (modify)
└── utils/
    └── detect-project-type.ts  # new: existsSync checks → ProjectType enum (new)

packages/pip/src/goodvibes_cli/
├── steps/
│   └── copy_templates.py       # add project_type param + CI variant selection (modify)
└── utils/
    └── detect_project_type.py  # new: Path.exists() checks → ProjectType literal (new)
```

### Pattern 1: Static Multi-File CI Template Selection

**What:** Three static YAML files in the templates directory; the copy step renames the
selected one to `ci.yml` at the destination. No string interpolation.

**When to use:** When the workflow content differs substantially between stacks (Node needs
`setup-node`, Python needs `setup-uv`) and the "both" case is a superset of both.

**Why not Option B (universal auto-detecting):** A single workflow that shell-detects the stack
at runtime requires `if: ${{ hashFiles('package.json') != '' }}` syntax and step-level
conditionals. This is valid YAML but harder to understand for a beginner reading the generated
file. The static selection approach produces a clean, readable workflow file with no
conditionals the user has to understand.

**TypeScript sketch (copy-templates.ts):**
```typescript
// Source: codebase pattern — existsSync is Node stdlib
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type ProjectType = 'node' | 'python' | 'both'

export function detectProjectType(cwd: string): ProjectType {
  const hasNode = existsSync(join(cwd, 'package.json'))
  const hasPython =
    existsSync(join(cwd, 'pyproject.toml')) ||
    existsSync(join(cwd, 'requirements.txt'))
  if (hasNode && hasPython) return 'both'
  if (hasNode) return 'node'
  if (hasPython) return 'python'
  return 'both'  // safe default: install all workflows
}
```

**Python sketch (detect_project_type.py):**
```python
# Source: codebase pattern — pathlib is stdlib
import pathlib

def detect_project_type(cwd: pathlib.Path) -> str:  # Literal["node", "python", "both"]
    has_node = (cwd / "package.json").exists()
    has_python = (cwd / "pyproject.toml").exists() or (cwd / "requirements.txt").exists()
    if has_node and has_python:
        return "both"
    if has_node:
        return "node"
    if has_python:
        return "python"
    return "both"
```

### Pattern 2: Zero-Config CI Workflow for Node Projects

**Key insight:** The generated `ci.yml` must pass on first push for a project that may have no
tests defined yet. Use `npm run test --if-present` and `npm run lint --if-present` to avoid
failing when those scripts do not exist in the target's `package.json`.

```yaml
# Source: [CITED: docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-nodejs]
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Node.js tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: ['20', '22']
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version: ${{ matrix.node }}
          cache: 'npm'
      - run: npm install
      - run: npm run build --if-present
      - run: npm test --if-present
      - run: npm run lint --if-present
```

**Why `npm install` not `npm ci`:** `npm ci` requires a `package-lock.json`. A new project
initialized with goodvibes may not have run `npm install` yet, so no lockfile exists. Using
`npm install` (not `npm ci`) makes the CI pass on first push for a brand-new project.
`npm ci` is correct for projects that already have a lockfile; document this trade-off.

**Why `--if-present`:** A beginner's project will not have `test` or `lint` scripts on day one.
`npm run test --if-present` exits 0 when the script is not defined, so CI passes. Without this
flag, `npm test` exits non-zero with "missing script: test" — a false failure that discourages
beginners.

### Pattern 3: Zero-Config CI Workflow for Python Projects

**Critical lesson from this repo (commit `a239d64`):**

> "CI was broken: `uv run pytest` failed because pytest lives in optional-dependencies (dev),
> not base deps. Fixed by adding `--extra dev` flag."

Generated Python CI workflows MUST use `uv run --extra dev pytest` (or `uv run --group dev
pytest` for `uv` workspace projects). Plain `uv run pytest` will fail on any project that
declares pytest as a dev optional dependency — which is the recommended pattern.

```yaml
# Source: [CITED: docs.astral.sh/uv/guides/integration/github/]
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Python tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python: ['3.10', '3.11', '3.12']
    steps:
      - uses: actions/checkout@v7
      - uses: astral-sh/setup-uv@v8
        with:
          python-version: ${{ matrix.python }}
      - run: uv run --extra dev pytest --if-exists 2>/dev/null || echo "No tests yet"
```

**Wait — there is no `--if-exists` flag for pytest.** Pytest fails with exit code 4 when no
tests are collected (not exit code 1, which is test failure). The "pass when no tests" requirement
requires explicit handling:

```yaml
      - name: Run tests (skip if none exist)
        run: |
          if [ -d "tests" ] || find . -name "test_*.py" -not -path "./.venv/*" | grep -q .; then
            uv run --extra dev pytest -x -q
          else
            echo "No tests found — skipping (add tests/ directory to get started)"
          fi
```

**Alternative simpler approach:** Use `pytest --co -q` (collect only) to check if any tests exist,
then conditionally run. Or: always run pytest but use `|| true` — however this masks real
failures. **The conditional check is correct.**

**For projects using `requirements.txt` without `pyproject.toml`:** Use `uv pip install -r
requirements.txt` instead of `uv sync`. Since goodvibes writes to beginner projects that may not
have `pyproject.toml`, the CI must detect which pattern applies — or use a single command that
works for both:

```yaml
      - name: Install dependencies
        run: |
          if [ -f "pyproject.toml" ]; then
            uv sync --all-extras 2>/dev/null || uv sync
          elif [ -f "requirements.txt" ]; then
            uv pip install -r requirements.txt
          fi
      - name: Run tests
        run: |
          if find . -name "test_*.py" -not -path "./.venv/*" | grep -q .; then
            uv run pytest -x -q
          else
            echo "No tests found — add a tests/ directory to get started"
          fi
```

### Pattern 4: `security.yml` — CodeQL Analysis

CodeQL `security-extended` queries cover OWASP Top 10 and supply-chain checks. For a beginner
project, keep the language matrix to `javascript-typescript` (for Node projects), `python` (for
Python projects), or both. The `autobuild` step handles the build for both — no manual build
script needed.

```yaml
# Source: [CITED: github.com/github/codeql-action]
name: Security scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 8 * * 1'  # Weekly Monday scan

jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      actions: read
      contents: read
    strategy:
      fail-fast: false
      matrix:
        language: ['javascript-typescript', 'python']
    steps:
      - uses: actions/checkout@v7
      - uses: github/codeql-action/init@v4
        with:
          languages: ${{ matrix.language }}
          queries: security-extended
      - uses: github/codeql-action/autobuild@v4
      - uses: github/codeql-action/analyze@v4
        with:
          category: "/language:${{ matrix.language }}"
```

**Language matrix per project type:**
- Node-only: `language: ['javascript-typescript']`
- Python-only: `language: ['python']`
- Both: `language: ['javascript-typescript', 'python']`

This means security.yml also has three variants, or a single combined one with the full matrix
(the combined always runs both; for single-language projects CodeQL skips the inapplicable
language gracefully). **Recommendation: use the combined version (both languages always) for
security.yml** — CodeQL handles "nothing to scan" gracefully, and it keeps the template count
down. Only `ci.yml` needs three variants.

### Pattern 5: `dependency-review.yml` — PR Dep Audit Gate

The dependency-review action v5 works zero-config on any public repo or private repo with GitHub
Advanced Security. It requires `pull_request` trigger only.

```yaml
# Source: [CITED: github.com/actions/dependency-review-action]
name: Dependency Review

on:
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  dependency-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/dependency-review-action@v5
```

**Important:** `dependency-review-action@v5` requires Actions Runner v2.327.1+. GitHub-hosted
runners on `ubuntu-latest` meet this requirement. [CITED: github.com/actions/dependency-review-action/releases]

### Pattern 6: `dependabot.yml` — Three Ecosystems

The goodvibes repo's current `dependabot.yml` covers all three needed ecosystems correctly:
npm, pip, and github-actions. The template should use a single `directory: "/"` for simplicity
(Dependabot will find `package.json`, `pyproject.toml`, and `.github/workflows` from root).

```yaml
# Source: [CITED: docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference]
version: 2

updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"

  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"

  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
```

**Note:** The `directory` for `github-actions` must be `"/"`. For npm and pip, `"/"` works
if `package.json` / `pyproject.toml` are at the project root (which is the target for
goodvibes-bootstrapped beginner projects).

### Anti-Patterns to Avoid

- **`npm ci` in generated Node CI:** Requires `package-lock.json`. A new beginner project
  may not have one. Use `npm install` instead. [ASSUMED — no official doc explicitly states
  `npm ci` fails on missing lockfile, but this is the documented npm ci behavior]
- **`uv run pytest` without `--extra dev`:** Fails silently if pytest is in optional deps.
  Always use `uv run --extra dev pytest`. Lesson from this repo (commit `a239d64`).
- **Hard-coding test paths:** `pytest tests/` fails if the tests directory doesn't exist yet.
  Use a conditional or `pytest --ignore-glob="*.py" -x` pattern.
- **CodeQL on `push` to feature branches:** Generates noise. Keep `branches: [main]` for
  push trigger; allow `pull_request` to any branch if desired.
- **`dependency-review` on `push`:** The action only makes sense on PRs. Using it on push
  has no effect and wastes runner minutes.
- **Dependabot with directory: "/packages/npm":** Works for this monorepo but not for a
  typical beginner single-package project. Generated template should use `directory: "/"`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Security scanning | Custom grep/regex for vulnerable patterns | `github/codeql-action` | CodeQL has semantic analysis, handles transitive vulnerabilities; regex misses context-dependent patterns |
| Dependency vulnerability check | Manual CVE list comparison | `actions/dependency-review-action` | Integrates GitHub Advisory Database; updated automatically |
| Automated dependency updates | CI that pins and updates lockfiles | `dependabot.yml` | GitHub manages PR creation, conflict detection, and merge queues |
| Python CI runner setup | `pip install pytest` in workflow | `astral-sh/setup-uv` | uv is 10-100x faster, handles Python version matrix, caches automatically |

**Key insight:** Every workflow in this phase delegates to a well-maintained GitHub or
ecosystem-owned action. The goodvibes job is to author correct YAML and copy it — not to
build CI functionality.

## Common Pitfalls

### Pitfall 1: `uv run pytest` Without `--extra dev`

**What goes wrong:** The CI job exits 1 with "No module named pytest" or similar even though
pytest is in pyproject.toml.
**Why it happens:** pytest declared under `[project.optional-dependencies].dev` is not installed
by `uv run` by default — only base dependencies are installed.
**How to avoid:** Always use `uv run --extra dev pytest` in generated workflows. Use `uv run
--all-extras pytest` for maximum compatibility.
**Warning signs:** CI passes locally (`pip install -e ".[dev]"` was run) but fails in CI.
**Evidence:** This exact bug hit goodvibes CI (commit `a239d64`, 2026-06-24).

### Pitfall 2: `npm ci` Requires a Lockfile

**What goes wrong:** CI fails on first push with "npm ERR! The `npm ci` command can only install
with an existing package-lock.json or npm-shrinkwrap.json."
**Why it happens:** New projects have `package.json` but not `package-lock.json` until after
the first `npm install`.
**How to avoid:** Use `npm install` in generated CI. Document in a comment that the user should
commit `package-lock.json` after their first install.
**Warning signs:** Project does not have a lockfile committed in the initial push.

### Pitfall 3: pytest Exits Code 4 on No Tests

**What goes wrong:** CI fails with exit code 4 ("no tests ran") on a brand-new project with
no test files.
**Why it happens:** pytest exit code 4 = "no tests collected". It is not exit code 0.
**How to avoid:** Wrap `pytest` in a conditional that checks whether any test files exist first.
Or write a placeholder test file into the templates so the test suite is never empty.
**Recommended approach:** Add a minimal `tests/test_placeholder.py` to the Python template
(single passing test) so pytest always finds at least one test. This eliminates the conditional
complexity and gives beginners a working example. [ASSUMED — recommended approach, not verified
against project decision log]

### Pitfall 4: `setup-uv` Without `python-version`

**What goes wrong:** All matrix Python versions run against the same Python (the runner default),
making the matrix useless.
**Why it happens:** `setup-uv` does not automatically read the matrix `python` variable —
it must be explicitly wired with `python-version: ${{ matrix.python }}`.
**How to avoid:** Always include `python-version: ${{ matrix.python }}` in the `setup-uv` step.
**Evidence:** This was fixed in goodvibes CI commit `a239d64`.

### Pitfall 5: `dependency-review` Trigger on `push`

**What goes wrong:** The action fails with "Unsupported event type: push. This action supports
only pull_request events."
**Why it happens:** The action is designed exclusively for PRs (it needs a base commit to diff
against).
**How to avoid:** Use `on: pull_request` only for `dependency-review.yml`.

### Pitfall 6: CI Template Count in `listTemplateFiles`

**What goes wrong:** The `files created` completion note lists `ci-node.yml`, `ci-python.yml`,
`ci-both.yml` — the source names, not the target name `ci.yml`. Confuses users.
**Why it happens:** `listTemplateFiles` walks the templates directory and returns all file paths,
including the two CI variant files that were not copied.
**How to avoid:** Either (a) the copy step returns the actual list of files it wrote (not just
the template list), or (b) the copy step omits the non-selected CI variants from the returned
list. The existing `copyTemplates` already returns `listTemplateFiles(templateDir)` — this will
need to be adjusted to return the paths as written to the destination, not as they appear in the
template directory.

## Runtime State Inventory

> Phase 4 is a greenfield feature addition (new workflow files + detection logic). No rename,
> refactor, or migration is involved. This section is omitted.

## Code Examples

### detect-project-type.ts (full implementation)

```typescript
// Source: codebase pattern (Node stdlib)
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type ProjectType = 'node' | 'python' | 'both'

export function detectProjectType(cwd: string): ProjectType {
  const hasNode = existsSync(join(cwd, 'package.json'))
  const hasPython =
    existsSync(join(cwd, 'pyproject.toml')) ||
    existsSync(join(cwd, 'requirements.txt'))
  if (hasNode && hasPython) return 'both'
  if (hasNode) return 'node'
  if (hasPython) return 'python'
  return 'both'
}
```

### detect_project_type.py (full implementation)

```python
# Source: codebase pattern (pathlib stdlib)
from __future__ import annotations
import pathlib

def detect_project_type(cwd: pathlib.Path) -> str:
    has_node = (cwd / "package.json").exists()
    has_python = (cwd / "pyproject.toml").exists() or (cwd / "requirements.txt").exists()
    if has_node and has_python:
        return "both"
    if has_node:
        return "node"
    if has_python:
        return "python"
    return "both"
```

### copyTemplates CI variant selection (copy-templates.ts patch)

```typescript
// Extend the filter fn in copyTemplates to skip non-matching CI variants
const ciVariants = ['ci-node.yml', 'ci-python.yml', 'ci-both.yml']
const selectedCiVariant = `ci-${projectType}.yml`  // e.g. 'ci-node.yml'

filter: (src: string) => {
  if (src.endsWith('CLAUDE.md')) return false
  if (minimal && src.includes('.github/workflows')) return false
  if (relative(templateDir, src).includes('..')) return false
  // Skip CI variants not matching the detected project type
  for (const variant of ciVariants) {
    if (src.endsWith(variant) && variant !== selectedCiVariant) return false
  }
  return true
}
// After copy, rename the selected variant to ci.yml
// fs-extra's copy() does not rename — use a separate rename/copy step
```

**Note:** `fs-extra.copy` with `filter` copies `ci-node.yml` → `dest/.github/workflows/ci-node.yml`.
A post-copy rename step is needed: `await rename(join(destDir, '.github/workflows', selectedCiVariant), join(destDir, '.github/workflows/ci.yml'))`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `setup-uv` without python-version | `setup-uv` + `python-version: ${{ matrix.python }}` | Jun 2026 (commit a239d64) | Matrix testing actually tests multiple Python versions |
| `uv run pytest` | `uv run --extra dev pytest` | Jun 2026 (commit a239d64) | CI no longer fails on projects where pytest is in optional deps |
| `github/codeql-action@v3` | `github/codeql-action@v4` | Jun 2026 | v4 is current; v3 still works but deprecated |
| `actions/checkout@v4` | `actions/checkout@v7` | Jun 2026 | v7 adds fork PR blocking; latest as of research date |
| `dependency-review-action@v4` | `dependency-review-action@v5` | May 2026 | v5 requires Node 24 runner (ubuntu-latest satisfies this) |

**Deprecated/outdated:**
- `npm ci` for new projects: works for projects with lockfiles, fails for new projects
- `pip install pytest && pytest` in GitHub Actions: replaced by `uv run --extra dev pytest` for uv-managed projects

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `npm install` is the correct choice over `npm ci` for generated Node CI (new projects lack lockfile) | Architecture Patterns, Pitfall 2 | If wrong, CI passes for some projects but fails for others; low risk since `npm install` always works |
| A2 | A `tests/test_placeholder.py` in the template eliminates the pytest exit-code-4 problem | Pitfall 3 | If rejected (adds noise), the conditional-check approach must be used instead |
| A3 | `dependency-review-action@v5` works on all public GitHub repos without Advanced Security license | Don't Hand-Roll, security.yml | If wrong, `dependency-review.yml` silently does nothing on private repos without GHAS |
| A4 | CodeQL handles "no source to scan" gracefully when a language is in the matrix but no source files exist | Pattern 4 | If wrong, security.yml fails on single-language projects using the combined template |
| A5 | `uv sync --all-extras` is the correct command for installing all optional dependency groups | Pattern 3 | If the target project uses `[dependency-groups]` (uv 0.5+ syntax) instead of `[optional-dependencies]`, `--all-extras` may not install them; use `--all-groups` instead |

## Open Questions (RESOLVED)

1. **Should `ci.yml` variants be named `ci-node.yml`, `ci-python.yml`, `ci-both.yml` in the
   templates directory, or stored in a `templates/.github/workflows/variants/` subdirectory?**
   - What we know: `copy-templates` copies the entire templates tree; subdirectories are included
   - What's unclear: If stored at root `.github/workflows/ci-node.yml`, they all appear in the
     user's repo until the unused ones are filtered out — the filter must exclude them explicitly
   - Recommendation: Store under `templates/.github/workflows/` with distinct names; the
     copy-templates filter handles exclusion. A `variants/` subdirectory would require more filter logic.
   - **RESOLVED:** Store at top level (`templates/.github/workflows/ci-node.yml` etc.); copy-templates filter excludes non-selected variants by filename match.

2. **Should `listTemplateFiles` return source paths or destination paths?**
   - What we know: Currently returns source paths from the template dir verbatim
   - What's unclear: After the CI variant rename, the user's completion note would show
     `ci-node.yml` not `ci.yml` — confusing
   - Recommendation: `copyTemplates` should return the actual files as written to dest
     (i.e., the renamed `ci.yml`, not `ci-node.yml`). This is a small refactor of the return
     value, not a change to the copy logic.
   - **RESOLVED:** Return destination paths (walk destDir after copy) so completion output shows `ci.yml`, not `ci-node.yml`.

3. **Does `security.yml` need per-project-type language matrix variation?**
   - What we know: CodeQL runs autobuild; if no Python files exist, the Python analysis
     completes in seconds with 0 findings
   - What's unclear: Whether CodeQL fails or succeeds gracefully when no files of the
     requested language exist
   - Recommendation: Use combined template (both languages always). Test in a real GitHub
     Actions run to confirm. If CodeQL fails on "no Python source", add a conditional.
   - **RESOLVED:** Use combined template (both languages always); CodeQL handles "no source" for a language gracefully (job succeeds with 0 findings). No conditional needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20+ | npm CLI dev + test | ✓ | (runtime) | — |
| Python 3.10+ | pip CLI dev + test | ✓ | (runtime) | — |
| uv | pip CLI test commands | ✓ | system | `pip install pytest` |
| vitest | npm unit tests | ✓ | 4.1.9 (devDep) | — |
| pytest | pip unit tests | ✓ | 9.1.1 (optional dep) | — |
| GitHub Actions runners | CI workflow execution | ✓ (GitHub-hosted) | ubuntu-latest | — |

No blocking missing dependencies.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| TypeScript framework | vitest 4.1.9 |
| Python framework | pytest 9.1.1 |
| TS config file | packages/npm/package.json (`"test": "vitest run"`) |
| Python config | packages/pip/pyproject.toml (`[tool.pytest.ini_options]`) |
| TS quick run | `cd packages/npm && npm test` |
| Python quick run | `cd packages/pip && uv run --extra dev pytest tests/ -x -q` |
| Full suite | both of the above |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CI-01 | `init` writes `.github/workflows/ci.yml` for Node projects | unit | `cd packages/npm && npm test` (test: copy-templates writes ci.yml when package.json present) | ❌ Wave 0 |
| CI-01 | Python: writes `ci.yml` for Python projects | unit | `cd packages/pip && uv run --extra dev pytest tests/test_copy_templates.py -x -q` | ❌ Wave 0 |
| CI-02 | `init` writes `security.yml` | unit | copy-templates test: security.yml present in output | ❌ Wave 0 |
| CI-03 | `init` writes `dependency-review.yml` | unit | copy-templates test: dependency-review.yml present in output | ❌ Wave 0 |
| CI-04 | `init` writes `dependabot.yml` covering all 3 ecosystems | unit + file content | copy-templates test + grep: `npm`, `pip`, `github-actions` in written file | ❌ Wave 0 |
| CI-05 | Detects Node vs Python project type | unit | `detectProjectType(tmpdir)` where tmpdir has/lacks package.json + pyproject.toml | ❌ Wave 0 |
| CI-05 | Defaults to `both` when neither marker exists | unit | `detectProjectType(empty_tmpdir) === 'both'` | ❌ Wave 0 |
| CI-06 | Generated workflows pass on first push (zero config) | integration (manual) | Push a test repo to GitHub, verify CI green | manual only |

**CI-06 is manual-only** — it requires a real GitHub push to a real repository. There is no
automated substitute for verifying "CI passes on first push." The verify harness
(`scripts/verify-phase4.sh`) should check file content (correct action versions, `--extra dev`
flag present, `--if-present` flags on npm scripts) as a proxy for correctness, but a real push
test is needed before marking the phase complete.

### Smoke Test Harness (`scripts/verify-phase4.sh`) Checks

The Wave 0 script should verify:

1. All 5 template files exist:
   - `templates/.github/workflows/ci-node.yml`
   - `templates/.github/workflows/ci-python.yml`
   - `templates/.github/workflows/ci-both.yml`
   - `templates/.github/workflows/security.yml`
   - `templates/.github/workflows/dependency-review.yml`
   - `templates/.github/dependabot.yml`
2. Content correctness:
   - `ci-node.yml` contains `--if-present` on test/lint commands
   - `ci-python.yml` contains `--extra dev` in the pytest command
   - `ci-python.yml` contains `python-version: ${{ matrix.python }}` in setup-uv
   - `security.yml` contains `queries: security-extended`
   - `dependency-review.yml` triggers on `pull_request` only (not `push`)
   - `dependabot.yml` contains `github-actions`, `npm`, and `pip` ecosystem entries
3. Unit tests pass for `detect-project-type.ts` and `detect_project_type.py`
4. `copyTemplates` with project type `node` does NOT write `ci-python.yml` or `ci-both.yml`
5. `copyTemplates` with project type `node` writes a file named exactly `ci.yml` (not `ci-node.yml`)

### Sampling Rate

- Per task commit: `cd packages/npm && npm test && cd ../pip && uv run --extra dev pytest tests/ -x -q`
- Per wave merge: Full suite (both above)
- Phase gate: All verify-phase4.sh checks green + manual GitHub push test passing

### Wave 0 Gaps

- [ ] `packages/npm/src/utils/detect-project-type.test.ts` — covers CI-05
- [ ] `packages/pip/tests/test_detect_project_type.py` — covers CI-05
- [ ] `scripts/verify-phase4.sh` — smoke harness covering all CI-0x requirements
- [ ] Template files: `ci-node.yml`, `ci-python.yml`, `ci-both.yml`, `security.yml`,
      `dependency-review.yml`, updated `dependabot.yml` — all 6 need authoring

## Security Domain

> `security_enforcement: true` in config.json; ASVS Level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | CI uses GitHub OIDC tokens (not managed by goodvibes) |
| V3 Session Management | No | No sessions in CLI or CI workflows |
| V4 Access Control | Yes (partial) | Workflow `permissions:` blocks should follow least-privilege |
| V5 Input Validation | Yes | `detectProjectType` reads filenames from `cwd` — path traversal guard already in copy-templates must cover detection inputs |
| V6 Cryptography | No | No crypto in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Workflow `permissions:` over-grant | Elevation of Privilege | Set minimum permissions per job (`contents: read`; `security-events: write` only where needed) |
| `pull_request_target` event misuse | Spoofing | Do not use `pull_request_target` in generated workflows — use `pull_request` only (checkout@v7 blocks unsafe fork PR checkouts) |
| Path traversal in cwd detection | Tampering | `detectProjectType` only calls `existsSync(join(cwd, 'package.json'))` — join sanitizes relative paths; no user-controlled path component |

**Least-privilege permissions per workflow:**
- `ci.yml`: `contents: read` (default, no override needed)
- `security.yml`: `security-events: write`, `actions: read`, `contents: read` (explicit — matches codeql requirement)
- `dependency-review.yml`: `contents: read` (explicit)
- No workflow should use `write-all` or leave `permissions:` unset

## Sources

### Primary (HIGH confidence)

- `commit a239d64` (this repo) — documents `uv run --extra dev pytest` requirement and `setup-uv python-version` fix
- GitHub releases for actions/checkout, setup-node, setup-uv, codeql-action, dependency-review-action — version numbers verified directly
- `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`, `.github/dependabot.yml` (this repo) — known-working YAML patterns
- `packages/npm/src/steps/copy-templates.ts` + `packages/pip/src/goodvibes_cli/steps/copy_templates.py` — existing template copy architecture
- [CITED: docs.astral.sh/uv/guides/integration/github/] — uv GitHub Actions guide with `uv run --frozen pytest` pattern

### Secondary (MEDIUM confidence)

- [CITED: docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference] — valid `package-ecosystem` values confirmed: `github-actions`, `npm`, `pip`
- [CITED: docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-nodejs] — `npm run build --if-present`, `npm test` pattern
- [CITED: github.com/actions/dependency-review-action/releases] — v5 release notes, runner version requirement

### Tertiary (LOW confidence — flagged in Assumptions Log)

- A2: placeholder test file recommendation — inferred from UX reasoning, not official guidance

## Metadata

**Confidence breakdown:**
- Template file content: HIGH — patterns are verified against working goodvibes CI + official docs
- Project-type detection: HIGH — trivial `existsSync` logic, no ambiguity
- CI variant selection architecture: HIGH — consistent with existing copy-templates pattern
- Pitfalls: HIGH — majority documented by real failures in this repo
- `--if-present` behavior: MEDIUM — documented in npm CLI; edge case behavior on missing lockfile inferred
- CodeQL "no source" graceful handling: LOW (A4) — needs validation in a real Actions run

**Research date:** 2026-06-24
**Valid until:** 2026-09-24 (stable APIs; re-check action major versions before execution)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CI-01 | `init` writes `.github/workflows/ci.yml` for detected project type (Node or Python) | Template authoring (3 static variants) + detectProjectType + copy-templates filter/rename |
| CI-02 | `init` writes `.github/workflows/security.yml` — CodeQL + dependency audit | Pattern 4: security.yml with codeql-action@v4, security-extended queries |
| CI-03 | `init` writes `.github/workflows/dependency-review.yml` — blocks PRs with high-severity deps | Pattern 5: dependency-review-action@v5, pull_request trigger only |
| CI-04 | `init` writes `.github/dependabot.yml` — weekly updates for GitHub Actions, npm, and pip | Pattern 6: dependabot.yml with all 3 ecosystems, directory "/" |
| CI-05 | CLI detects project type via package.json / pyproject.toml / requirements.txt presence; defaults to both | detectProjectType() helper: existsSync checks, 4-outcome enum |
| CI-06 | Generated workflows pass on first push with zero additional user configuration | --if-present flags (Node), --extra dev (Python), python-version matrix wiring, no npm ci |
</phase_requirements>
