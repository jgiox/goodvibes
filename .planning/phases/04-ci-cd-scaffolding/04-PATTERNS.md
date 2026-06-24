# Phase 4: CI/CD Scaffolding - Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 12
**Analogs found:** 11 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/npm/src/utils/detect-project-type.ts` | utility | request-response | `packages/npm/src/utils/detect-python.ts` | exact (same role: synchronous detection utility) |
| `packages/npm/src/utils/detect-project-type.test.ts` | test | — | `packages/npm/src/utils/detect-python.test.ts` | exact |
| `packages/npm/src/steps/copy-templates.ts` (modify) | service | file-I/O | itself | exact (extend existing filter + add rename step) |
| `packages/npm/src/steps/copy-templates.test.ts` (modify) | test | — | itself | exact (extend existing test suite) |
| `packages/pip/src/goodvibes_cli/utils/detect_project_type.py` | utility | request-response | `packages/pip/src/goodvibes_cli/utils/detect_python.py` | exact |
| `packages/pip/tests/test_detect_project_type.py` | test | — | `packages/pip/tests/test_copy_templates.py` | role-match |
| `packages/pip/src/goodvibes_cli/steps/copy_templates.py` (modify) | service | file-I/O | itself | exact |
| `packages/pip/tests/test_copy_templates.py` (modify) | test | — | itself | exact |
| `templates/.github/workflows/ci-node.yml` | config | — | `.github/workflows/ci.yml` (repo's own CI) | role-match (Node job is structurally identical) |
| `templates/.github/workflows/ci-python.yml` | config | — | `.github/workflows/ci.yml` (pip job) | role-match |
| `templates/.github/workflows/ci-both.yml` | config | — | `.github/workflows/ci.yml` (both jobs combined) | role-match |
| `templates/.github/workflows/security.yml` | config | — | `.github/workflows/codeql.yml` | exact (copy verbatim) |
| `templates/.github/workflows/dependency-review.yml` | config | — | none in codebase | no analog |
| `templates/.github/dependabot.yml` | config | — | `.github/dependabot.yml` | partial (target uses `directory: "/"`) |

---

## Pattern Assignments

### `packages/npm/src/utils/detect-project-type.ts` (utility, synchronous detection)

**Analog:** `packages/npm/src/utils/detect-python.ts`

**Imports pattern** (lines 1-1 of detect-python.ts — existsSync replaces execa):
```typescript
import { existsSync } from 'node:fs'
import { join } from 'node:path'
```

**Core pattern** — synchronous, not async (existsSync has no async variant in use here):
```typescript
// detect-python.ts uses execa (async subprocess). detect-project-type.ts uses
// existsSync (sync stdlib) — no async needed. Pattern: same module shape, sync return.
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

**No error handling needed** — `existsSync` never throws; no try/catch required.

---

### `packages/npm/src/utils/detect-project-type.test.ts` (test)

**Analog:** `packages/npm/src/utils/detect-python.test.ts`

**Test file structure** (lines 1-13 of detect-python.test.ts):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
// detect-project-type uses no mocks — uses real tmpdir + real files instead
// (existsSync is sync stdlib, not a subprocess; no vi.mock needed)
```

**Core test pattern** — real filesystem with mkdtempSync (from copy-templates.test.ts lines 39-44):
```typescript
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('detectProjectType', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-detect-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns node when only package.json present', () => { ... })
  it('returns python when only pyproject.toml present', () => { ... })
  it('returns python when only requirements.txt present', () => { ... })
  it('returns both when package.json and pyproject.toml both present', () => { ... })
  it('returns both when neither marker file exists (safe default)', () => { ... })
})
```

**Note:** `detectProjectType` is synchronous and only calls `existsSync` — no mocking needed. Use `writeFileSync(join(tmpDir, 'package.json'), '')` to create marker files.

---

### `packages/npm/src/steps/copy-templates.ts` (modify — add projectType param + CI variant filter + rename)

**Analog:** itself — extend the existing `filter` callback and add a post-copy rename.

**Existing filter pattern** (lines 50-59 of copy-templates.ts):
```typescript
await copy(templateDir, destDir, {
  overwrite: false,
  errorOnExist: false,
  filter: (src: string) => {
    if (src.endsWith('CLAUDE.md')) return false // handled by sentinel merge
    if (minimal && src.includes('.github/workflows')) return false
    // ponytail: path traversal guard per T-02-02-A
    if (relative(templateDir, src).includes('..')) return false
    return true
  },
})
```

**Extended filter — add CI variant exclusion:**
```typescript
const ciVariants = ['ci-node.yml', 'ci-python.yml', 'ci-both.yml']
const selectedVariant = `ci-${projectType}.yml`

filter: (src: string) => {
  if (src.endsWith('CLAUDE.md')) return false
  if (minimal && src.includes('.github/workflows')) return false
  if (relative(templateDir, src).includes('..')) return false
  // Skip CI variants not matching the detected project type
  for (const variant of ciVariants) {
    if (src.endsWith(variant) && variant !== selectedVariant) return false
  }
  return true
},
```

**Post-copy rename step** (add after the `copy()` call, before the `mergeClaude` call):
```typescript
// Rename selected CI variant to ci.yml
import { rename } from 'node:fs/promises'
// ...
const variantPath = join(destDir, '.github', 'workflows', selectedVariant)
const ciPath = join(destDir, '.github', 'workflows', 'ci.yml')
if (existsSync(variantPath)) {
  await rename(variantPath, ciPath)
}
```

**Function signature change:**
```typescript
// Before:
export async function copyTemplates(
  templateDir: string,
  destDir: string,
  dryRun: boolean,
  minimal: boolean,
): Promise<string[]>

// After:
export async function copyTemplates(
  templateDir: string,
  destDir: string,
  dryRun: boolean,
  minimal: boolean,
  projectType: ProjectType = 'both',
): Promise<string[]>
```

---

### `packages/npm/src/steps/copy-templates.test.ts` (modify — add CI variant tests)

**Analog:** itself — extend with describe block following the existing pattern.

**Existing describe block structure** (lines 36-110 of copy-templates.test.ts):
```typescript
describe('copyTemplates', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-copy-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('copies all template files to empty destination', async () => { ... })
  // ...
})
```

**New tests follow the same shape:**
```typescript
it('writes ci.yml (not ci-node.yml) when projectType is node', async () => {
  // ...
  expect(existsSync(join(tmpDir, '.github', 'workflows', 'ci.yml'))).toBe(true)
  expect(existsSync(join(tmpDir, '.github', 'workflows', 'ci-node.yml'))).toBe(false)
})

it('does not write ci-python.yml or ci-both.yml when projectType is node', async () => { ... })
it('writes ci.yml when projectType is python', async () => { ... })
it('writes ci.yml when projectType is both', async () => { ... })
```

---

### `packages/pip/src/goodvibes_cli/utils/detect_project_type.py` (utility)

**Analog:** `packages/pip/src/goodvibes_cli/utils/detect_python.py`

**Module structure** (lines 1-6 of detect_python.py — remove subprocess/re imports, use pathlib):
```python
"""Detect the target project type by inspecting marker files."""
from __future__ import annotations
import pathlib
```

**Core pattern** — synchronous, no subprocess:
```python
def detect_project_type(cwd: pathlib.Path) -> str:
    """Return 'node', 'python', or 'both' based on marker files in cwd."""
    has_node = (cwd / "package.json").exists()
    has_python = (cwd / "pyproject.toml").exists() or (cwd / "requirements.txt").exists()
    if has_node and has_python:
        return "both"
    if has_node:
        return "node"
    if has_python:
        return "python"
    return "both"  # safe default
```

**No error handling needed** — `Path.exists()` never throws under normal conditions.

---

### `packages/pip/tests/test_detect_project_type.py` (test)

**Analog:** `packages/pip/tests/test_copy_templates.py` and `packages/pip/tests/conftest.py`

**Test file structure** (lines 1-11 of test_copy_templates.py):
```python
"""Tests for detect_project_type."""
import pathlib
import pytest
```

**Fixture pattern** from conftest.py (lines 20-22):
```python
@pytest.fixture
def tmp_dir(tmp_path):
    """Temporary directory for file operation tests."""
    return tmp_path
```

**Core test pattern** — no mocking needed (pure filesystem calls):
```python
def test_returns_node_when_only_package_json_present(tmp_dir):
    from goodvibes_cli.utils.detect_project_type import detect_project_type
    (tmp_dir / "package.json").write_text("{}")
    assert detect_project_type(tmp_dir) == "node"

def test_returns_python_when_only_pyproject_toml_present(tmp_dir):
    from goodvibes_cli.utils.detect_project_type import detect_project_type
    (tmp_dir / "pyproject.toml").write_text("[project]")
    assert detect_project_type(tmp_dir) == "python"

def test_returns_both_when_neither_marker_exists(tmp_dir):
    from goodvibes_cli.utils.detect_project_type import detect_project_type
    # empty directory — safe default
    assert detect_project_type(tmp_dir) == "both"
```

---

### `packages/pip/src/goodvibes_cli/steps/copy_templates.py` (modify)

**Analog:** itself — extend `ignore_fn` to filter CI variants and add post-copy rename.

**Existing ignore_fn pattern** (lines 44-64 of copy_templates.py):
```python
def ignore_fn(directory: str, contents: list[str]) -> set[str]:
    ignored: set[str] = set()
    for name in contents:
        full = pathlib.Path(directory) / name
        try:
            rel = full.relative_to(template_dir)
        except ValueError:
            ignored.add(name)
            continue
        if name == "CLAUDE.md":
            ignored.add(name)
        if ".." in pathlib.Path(str(rel)).parts:
            ignored.add(name)
        if minimal and ".github" in rel.parts and "workflows" in rel.parts:
            ignored.add(name)
        dest_candidate = dest_dir / rel
        if dest_candidate.exists():
            ignored.add(name)
    return ignored
```

**Extended ignore_fn — add CI variant filter:**
```python
ci_variants = {"ci-node.yml", "ci-python.yml", "ci-both.yml"}
selected_variant = f"ci-{project_type}.yml"

# Inside the loop, before the return:
if name in ci_variants and name != selected_variant:
    ignored.add(name)
```

**Post-copy rename** (add after shutil.copytree call):
```python
variant_path = dest_dir / ".github" / "workflows" / selected_variant
ci_path = dest_dir / ".github" / "workflows" / "ci.yml"
if variant_path.exists():
    variant_path.rename(ci_path)
```

**Function signature change:**
```python
# Before:
def copy_templates(
    template_dir: pathlib.Path,
    dest_dir: pathlib.Path,
    dry_run: bool = False,
    minimal: bool = False,
) -> list[str]:

# After:
def copy_templates(
    template_dir: pathlib.Path,
    dest_dir: pathlib.Path,
    dry_run: bool = False,
    minimal: bool = False,
    project_type: str = "both",
) -> list[str]:
```

---

### `templates/.github/workflows/security.yml` (config — new)

**Analog:** `.github/workflows/codeql.yml` (lines 1-43) — copy verbatim, update heading comment.

**Full source to copy from** (`/home/ygiokas/GoodVibes/.github/workflows/codeql.yml` lines 1-43):
```yaml
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
    name: Analyze (${{ matrix.language }})
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
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v4
        with:
          languages: ${{ matrix.language }}
          queries: security-extended
      - name: Autobuild
        uses: github/codeql-action/autobuild@v4
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v4
        with:
          category: "/language:${{ matrix.language }}"
```

**Difference from repo's codeql.yml:** rename `name: CodeQL` to `name: Security scan`; no structural change.

---

### `templates/.github/workflows/ci-node.yml`, `ci-python.yml`, `ci-both.yml` (config — new)

**Analog:** `.github/workflows/ci.yml` (lines 1-63) — the repo's own CI is the closest working reference.

**Structural pattern** from `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Node.js tests (Node ${{ matrix.node }})
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
      # ...
```

**Key differences for generated templates vs repo's own CI:**
- Use `npm install` not `npm ci` — new beginner projects lack `package-lock.json`
- Use `npm run build --if-present`, `npm test --if-present`, `npm run lint --if-present`
- Python: use `uv run --extra dev pytest` (lesson from commit `a239d64`)
- Python: wrap pytest in conditional checking for test files (pytest exit code 4 on no tests)
- Python: `setup-uv@v8` not `v7` (repo's own CI uses v7; templates should use latest v8)
- Remove `working-directory:` and `cache-dependency-path:` — generated templates target single-package repos, not this monorepo
- `ci-both.yml`: contains both `test-node` and `test-python` jobs from the respective single-stack templates

---

### `templates/.github/dependabot.yml` (config — new)

**Analog:** `.github/dependabot.yml` (the repo's own file)

**Repo's dependabot.yml pattern** (full file, read above):
```yaml
version: 2

updates:
  - package-ecosystem: "npm"
    directory: "/packages/npm"      # ← repo-specific monorepo path
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5

  - package-ecosystem: "pip"
    directory: "/packages/pip"      # ← repo-specific monorepo path
    ...
```

**Template version changes:**
- `directory: "/"` for all three ecosystems (beginner target projects are single-package, not monorepo)
- Keep `open-pull-requests-limit: 5`
- Keep same three ecosystems: `github-actions`, `npm`, `pip`

---

### `templates/.github/workflows/dependency-review.yml` (config — new)

**No analog in codebase.** Use RESEARCH.md Pattern 5 directly:
```yaml
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

---

## Shared Patterns

### Minimal flag — skip .github/workflows entirely
**Source:** `packages/npm/src/steps/copy-templates.ts` line 55
```typescript
if (minimal && src.includes('.github/workflows')) return false
```
**Apply to:** `copyTemplates` modifications in both TS and Python.
The existing behavior is unchanged — the `minimal` guard takes precedence over any project-type CI selection. When `minimal=true`, no workflow files are written at all.

### Path traversal guard
**Source:** `packages/npm/src/steps/copy-templates.ts` line 57
```typescript
if (relative(templateDir, src).includes('..')) return false
```
**Python equivalent** (`copy_templates.py` lines 56-58):
```python
if ".." in pathlib.Path(str(rel)).parts:
    ignored.add(name)
```
**Apply to:** All filter logic in both `copyTemplates` modifications. The CI variant filter must be added _after_ the path traversal guard, not before it.

### Vitest mock pattern for filesystem utilities
**Source:** `packages/npm/src/utils/detect-python.test.ts` lines 1-12
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('execa', () => ({ execa: vi.fn(), ... }))
```
**Note:** `detect-project-type.ts` uses `existsSync` not `execa`. Do not mock `node:fs` — use a real tmpdir instead (the `mkdtempSync` pattern from `copy-templates.test.ts` lines 39-44). This is simpler and more reliable.

### Python test fixture pattern
**Source:** `packages/pip/tests/conftest.py` lines 20-35
```python
@pytest.fixture
def tmp_dir(tmp_path):
    return tmp_path

@pytest.fixture
def template_dir(tmp_path):
    d = tmp_path / "templates"
    d.mkdir()
    (d / "CLAUDE.md").write_text(TEMPLATE_CONTENT)
    # pre-populated structure ...
    return d
```
**Apply to:** `test_detect_project_type.py` uses the `tmp_dir` fixture directly (no template_dir needed). New CI variant tests in `test_copy_templates.py` need the `template_dir` fixture extended to include `ci-node.yml`, `ci-python.yml`, `ci-both.yml` stub files.

### `from __future__ import annotations` header
**Source:** `packages/pip/src/goodvibes_cli/steps/copy_templates.py` line 1, `detect_python.py` does not use it
**Apply to:** New Python utility file `detect_project_type.py` — include `from __future__ import annotations` as first import per existing Python module convention in this codebase.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `templates/.github/workflows/dependency-review.yml` | config | — | No dependency-review workflow in the codebase; use RESEARCH.md Pattern 5 verbatim |

---

## Metadata

**Analog search scope:** `packages/npm/src/`, `packages/pip/src/`, `packages/pip/tests/`, `.github/workflows/`, `.github/dependabot.yml`, `templates/`
**Files scanned:** 18
**Pattern extraction date:** 2026-06-24
