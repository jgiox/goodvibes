# Phase 13: Anonymous Telemetry - Pattern Map

**Mapped:** 2026-07-06
**Files analyzed:** 12 (8 new, 4 modified)
**Analogs found:** 10 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/npm/src/steps/telemetry.ts` | utility | request-response | `packages/npm/src/steps/install-headroom.ts` | exact |
| `packages/npm/src/steps/telemetry.test.ts` | test | — | `packages/npm/src/steps/install-headroom.test.ts` | exact |
| `packages/pip/src/goodvibes_cli/steps/telemetry.py` | utility | request-response | `packages/pip/src/goodvibes_cli/steps/install_headroom.py` | exact |
| `packages/pip/tests/test_telemetry.py` | test | — | `packages/pip/tests/test_install_headroom.py` | exact |
| `packages/npm/src/commands/init.ts` (modified) | command | request-response | itself | self |
| `packages/pip/src/goodvibes_cli/commands/init_cmd.py` (modified) | command | request-response | itself | self |
| `packages/npm/src/commands/init.test.ts` (modified) | test | — | itself | self |
| `packages/pip/tests/test_init_cmd.py` (modified) | test | — | itself | self |
| `.github/workflows/deploy-worker.yml` | config | — | `.github/workflows/publish-npm.yml` | role-match |
| `workers/telemetry/worker.js` | service | request-response | none | no analog |
| `workers/telemetry/wrangler.toml` | config | — | none | no analog |
| `workers/telemetry/package.json` | config | — | `packages/npm/package.json` | partial |

---

## Pattern Assignments

### `packages/npm/src/steps/telemetry.ts` (utility, request-response)

**Analog:** `packages/npm/src/steps/install-headroom.ts`

**Imports pattern** (lines 1–2):
```typescript
import { execa } from 'execa'
import { detectPython } from '../utils/detect-python.js'
```
Telemetry uses Node 20 built-ins only — no imports needed except a local `.js` extension if cross-referencing. Follow the same single-file, no-barrel-import convention.

**Function signature pattern** (line 22):
```typescript
export async function installHeadroom(log: (msg: string) => void): Promise<HeadroomResult> {
```
For telemetry, the signature is simpler: `export async function sendTelemetry(): Promise<void>`. No `log` parameter — errors are silently swallowed. Return type is void.

**Graceful error swallowing pattern** (lines 32–43 and 57–69):
```typescript
  try {
    await execa('headroom', ['compress', '--help'], { timeout: 10_000 })
    log('headroom already installed — skipping')
    return { status: 'already-installed' }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      log(`headroom probe failed: ${(e as Error).message?.split('\n')[0] ?? 'unknown'}`)
    }
    // ENOENT: headroom not on PATH — proceed with installer loop
  }
```
Telemetry uses the same pattern: a `try/catch` that swallows all errors silently. The only difference is the catch block is completely empty (no logging) per D-08.

**AbortController timeout pattern** — not in codebase yet; copy from RESEARCH.md Pattern 1:
```typescript
const ac = new AbortController()
const timer = setTimeout(() => ac.abort(), 5_000)
try {
  await fetch(TELEMETRY_URL, { method: 'POST', body: null, signal: ac.signal, headers: { 'X-Request-Id': id } })
} catch {
  // silent on error
} finally {
  clearTimeout(timer)
}
```

**Inline helper pattern** (lines 9, 232 from `init.ts`):
```typescript
// ponytail: inline helper — too small to justify a separate module
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```
Place `sleep` as a module-private function at the bottom of `telemetry.ts`, same pattern as `init.ts`.

**Env-var constant pattern** — use `process.env.GOODVIBES_TELEMETRY_URL ?? 'https://...'` as a module-top constant. This is the same pattern used for URL/path resolution at the top of step files.

---

### `packages/npm/src/steps/telemetry.test.ts` (test)

**Analog:** `packages/npm/src/steps/install-headroom.test.ts`

**Test file header + mock setup** (lines 1–21):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('execa', () => ({
  execa: vi.fn(),
  ExecaError: class ExecaError extends Error {
    code: string
    constructor(message: string, code: string) {
      super(message)
      this.code = code
    }
  },
}))

vi.mock('../utils/detect-python.js', () => ({
  detectPython: vi.fn(),
}))
```
For `telemetry.test.ts`, replace `vi.mock('execa', ...)` with `vi.stubGlobal('fetch', vi.fn())` in `beforeEach` (fetch is a global, not a module — see RESEARCH.md Pitfall 4). Also add `vi.unstubAllGlobals()` in `afterEach`.

**describe + beforeEach reset pattern** (lines 18–21):
```typescript
describe('installHeadroom', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
```
Use identical structure for `telemetry.test.ts` with `vi.unstubAllGlobals()` added to the `beforeEach`/`afterEach`.

**Dynamic import pattern** (lines 27–28):
```typescript
    const { installHeadroom } = await import('./install-headroom.js')
    const log = vi.fn()
```
Use `const { sendTelemetry } = await import('./telemetry.js')` inside each test. This is required in ESM vitest to pick up mocked globals before the module loads.

**Env-var mock pattern** (not in `install-headroom.test.ts` but same project uses env vars) — use `vi.stubEnv('DO_NOT_TRACK', '1')` / `vi.unstubAllEnvs()` to test opt-out. This matches the `vi.stubGlobal` pattern already established.

**Full skip test pattern** (lines 23–35):
```typescript
  it('prints Python-absent skip message and returns without throwing when detectPython returns null', async () => {
    const { detectPython } = await import('../utils/detect-python.js')
    vi.mocked(detectPython).mockResolvedValueOnce(null)

    const { installHeadroom } = await import('./install-headroom.js')
    const log = vi.fn()
    const result = await installHeadroom(log)
    expect(result).toEqual({ status: 'skipped', reason: expect.stringContaining('Python 3.10+') })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Python 3.10+'))
    // Must NOT call execa for any install
    const { execa } = await import('execa')
    expect(vi.mocked(execa)).not.toHaveBeenCalled()
  })
```
Mirror this pattern for `DO_NOT_TRACK=1` opt-out: assert `fetch` was NOT called, confirm function resolves without throwing.

---

### `packages/pip/src/goodvibes_cli/steps/telemetry.py` (utility, request-response)

**Analog:** `packages/pip/src/goodvibes_cli/steps/install_headroom.py`

**Module docstring + imports pattern** (lines 1–5):
```python
"""Install headroom-ai via uv → pipx → pip fallback chain."""
import subprocess
from typing import Callable

from goodvibes_cli.utils.detect_python import detect_python
```
For `telemetry.py`: `"""Anonymous telemetry for goodvibes init — fire-and-forget install counter."""` followed by stdlib-only imports: `import os`, `import threading`, `import urllib.request`, `import uuid as _uuid`.

**Graceful error swallowing pattern** (lines 26–34):
```python
    try:
        subprocess.run(
            ["headroom", "compress", "--help"],
            capture_output=True, text=True, check=True, timeout=10
        )
        log("headroom already installed — skipping")
        return {"status": "already-installed", "reason": ""}
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        pass  # not installed or broken — proceed to installer loop
```
Telemetry uses the same bare `except Exception: pass` (even simpler — swallow everything). The `pass` comment pattern is `# ponytail: silent on error — network must not affect init`.

**Return pattern**: `install_headroom` returns `dict[str, str]`. `telemetry.py` exports two functions: `start_telemetry_thread() -> threading.Thread | None` (returns `None` when opted out) and `_fire(request_id: str) -> None` (private). This mirrors the single-responsibility pattern of `install_headroom`.

---

### `packages/pip/tests/test_telemetry.py` (test)

**Analog:** `packages/pip/tests/test_install_headroom.py`

**File header + mocker.patch module boundary** (lines 1–25):
```python
"""Tests for install_headroom — Wave 1b (03-03-PLAN.md).

All subprocess calls are mocked; no real uv/pipx/pip/python runs during the suite.
detect_python is mocked at the install_headroom module boundary.
"""
import subprocess

import pytest


def test_uv_found_and_succeeds(mocker):
    """install_headroom calls uv tool install when uv is available and logs ONNX warning."""
    mocker.patch(
        "goodvibes_cli.steps.install_headroom.detect_python",
        return_value="python3",
    )
```
For `test_telemetry.py`, the patch path is `goodvibes_cli.steps.telemetry.urllib.request.urlopen` — same dot-path convention.

**Import inside test pattern** (lines 26–28):
```python
    from goodvibes_cli.steps.install_headroom import install_headroom
    log_calls: list[str] = []
    result = install_headroom(log_calls.append)
```
Use `from goodvibes_cli.steps.telemetry import start_telemetry_thread` inside each test function.

**Opt-out / skip test pattern** (lines 171–186):
```python
def test_python_absent_skips(mocker):
    """install_headroom logs skip message and returns immediately when Python 3.10+ not found."""
    mocker.patch(
        "goodvibes_cli.steps.install_headroom.detect_python",
        return_value=None,
    )
    run = mocker.patch("goodvibes_cli.steps.install_headroom.subprocess.run")
    from goodvibes_cli.steps.install_headroom import install_headroom

    log_calls: list[str] = []
    result = install_headroom(log_calls.append)

    assert any("Python 3.10+ not found" in m for m in log_calls)
    # no installer subprocess should be called
    run.assert_not_called()
    assert result["status"] == "skipped"
```
Mirror for opt-out: set `os.environ['DO_NOT_TRACK'] = '1'` in the test (or use `monkeypatch.setenv`), then assert `urlopen.assert_not_called()` and that `start_telemetry_thread()` returns `None`.

**env var isolation pattern** — use `monkeypatch.setenv` / `monkeypatch.delenv` (pytest built-in) so env changes do not leak between tests. This is safer than direct `os.environ` mutation.

---

### `packages/npm/src/commands/init.ts` (modified — command, request-response)

**Analog:** itself — patterns already in the file

**Existing note() + guard pattern** (lines 50–55):
```typescript
      intro('goodvibes init')

      const existingEntries = readdirSync(cwd).filter(e => e !== '.git' && e !== '.DS_Store')
      if (existingEntries.length > 0) {
        note('Existing files will not be overwritten.', 'Non-empty project detected')
      }
```
Insert telemetry disclosure note immediately after `intro()` on line 51, before the `if (existingEntries...)` check. Use the same `note(message, title)` signature.

**Dry-run guard pattern** (lines 57–75):
```typescript
      if (dryRun) {
        // ... dry-run path ...
        return
      }
```
`sendTelemetry()` and `const telemetryPromise = sendTelemetry()` must be placed AFTER this `return` — inside the non-dry-run branch only.

**tasks() + Promise.race pattern** (lines 126–135):
```typescript
      try {
        await tasks(taskList)
      } catch (e) {
        const err = e as NodeJS.ErrnoException
        // ...
        cancel(msg)
        process.exit(1)
      }
```
After the `try/catch` block (after `tasks(taskList)` resolves successfully), add:
```typescript
await Promise.race([telemetryPromise, sleep(1_000)])
```
The `sleep` helper is already used in `init.ts` — define it at the module bottom with `ponytail:` comment.

**Import insertion point** (lines 1–7):
```typescript
import type { Command } from 'commander'
import { readdirSync } from 'node:fs'
import { intro, outro, note, tasks, cancel } from '@clack/prompts'
import { copyTemplates, listTemplateFiles, resolveTemplatesDir } from '../steps/copy-templates.js'
import { installHeadroom, type HeadroomResult } from '../steps/install-headroom.js'
import { configureMcp, type McpResult } from '../steps/configure-mcp.js'
import { detectProjectType } from '../utils/detect-project-type.js'
```
Add: `import { sendTelemetry } from '../steps/telemetry.js'` after the existing steps imports.

---

### `packages/pip/src/goodvibes_cli/commands/init_cmd.py` (modified — command, request-response)

**Analog:** itself — patterns already in the file

**Existing Panel disclosure pattern** (lines 76–78):
```python
    if existing:
        console.print(Panel("Existing files will not be overwritten.", title="Non-empty project detected"))
```
Insert telemetry disclosure `Panel` immediately after `console.rule(...)` on line 55, before the `if dry_run:` check. Use the same `console.print(Panel(..., title='Privacy'))` call.

**Dry-run guard** (lines 57–73): `start_telemetry_thread()` must be called AFTER the `if dry_run: ... return` block.

**console.status() pattern** (lines 84–107):
```python
        with console.status("Copying template files") as status:
            def log_copy(msg: str) -> None:
                status.update(msg)
            written, skipped = copy_templates(...)
```
Thread start and join bracket the existing task blocks:
```python
    tel_thread = start_telemetry_thread()
    try:
        with console.status("Copying template files") as status:
            ...
        if not minimal:
            ...
    except ...
    if tel_thread is not None:
        tel_thread.join(timeout=1.0)
```

**Import insertion point** (lines 1–12):
```python
from goodvibes_cli.steps.configure_mcp import configure_mcp
from goodvibes_cli.steps.copy_templates import copy_templates, list_template_files, resolve_templates_dir
from goodvibes_cli.steps.install_headroom import install_headroom
```
Add: `from goodvibes_cli.steps.telemetry import start_telemetry_thread`

---

### `packages/npm/src/commands/init.test.ts` (modified — test)

**Analog:** itself — patterns already in the file

**vi.mock for new step module** (lines 31–39):
```typescript
// Mock install-headroom
vi.mock('../steps/install-headroom.js', () => ({
  installHeadroom: vi.fn(),
}))

// Mock configure-mcp
vi.mock('../steps/configure-mcp.js', () => ({
  configureMcp: vi.fn(),
}))
```
Add a matching mock block for the new telemetry module:
```typescript
vi.mock('../steps/telemetry.js', () => ({
  sendTelemetry: vi.fn().mockResolvedValue(undefined),
}))
```

**Import + assert pattern inside tests** (lines 47–50):
```typescript
    const { intro, outro, note, tasks } = await import('@clack/prompts')
    const { copyTemplates, listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')
```
Add `const { sendTelemetry } = await import('../steps/telemetry.js')` to each test that needs to assert TEL-04 (disclosure note) or verify telemetry is not called in dry-run.

**note() assertion pattern** (lines 76–79):
```typescript
    expect(vi.mocked(note)).toHaveBeenCalledWith(
      expect.stringContaining('Would write'),
      expect.stringContaining('Dry run')
    )
```
For TEL-04: assert `note` was called with disclosure text before the first task runs.

---

### `packages/pip/tests/test_init_cmd.py` (modified — test)

**Analog:** itself — patterns already in the file

**mocker.patch for new step** (lines 22–26):
```python
def test_non_empty_dir_prints_notice_before_tasks(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.init_cmd.copy_templates", return_value=(["CLAUDE.md"], []))
    mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom", return_value={"status": "installed", "reason": ""})
```
Add to each test: `mocker.patch("goodvibes_cli.commands.init_cmd.start_telemetry_thread", return_value=None)` — prevents real HTTP calls and prevents thread leak during tests.

**runner.invoke + output assertion pattern** (lines 29–31):
```python
    result = runner.invoke(app, ["--minimal"])
    assert result.exit_code == 0
    assert "non-empty" in result.output.lower() or "existing" in result.output.lower()
```
For TEL-04: assert `"Privacy" in result.output` or `"DO_NOT_TRACK" in result.output`.

---

### `.github/workflows/deploy-worker.yml` (config — CI/CD workflow)

**Analog:** `.github/workflows/publish-npm.yml`

**Workflow structure + permissions** (lines 1–17):
```yaml
name: Publish npm package

on:
  push:
    tags:
      - 'npm-v*'
  workflow_dispatch:

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7
```
Copy: `permissions: contents: read` (least-privilege pattern used across ALL workflows in this project). Use `actions/checkout@v7` (project standard — not v3 or v4).

**working-directory pattern** (lines 22–25):
```yaml
      - name: Install dependencies
        working-directory: packages/npm
        run: npm ci
```
Use `working-directory: workers/telemetry` for the wrangler deploy step.

**Secrets env pattern** (lines 42–44):
```yaml
      - name: Publish
        working-directory: packages/npm
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```
Mirror for wrangler-action:
```yaml
      - name: Deploy Worker
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: workers/telemetry
```

**Path filter pattern** — from RESEARCH.md Pattern 4 (not in existing workflows, but aligns with project intent to avoid spurious CI runs). Add `paths: - 'workers/telemetry/**'` under the `push: branches: [main]` trigger.

---

## Shared Patterns

### Error Swallowing (Graceful Degradation)

**Source:** `packages/npm/src/steps/install-headroom.ts` lines 57–69; `packages/pip/src/goodvibes_cli/steps/install_headroom.py` lines 48–58

**Apply to:** `telemetry.ts`, `telemetry.py` — both must swallow ALL errors silently; no log, no retry, no propagation to caller.

TypeScript:
```typescript
  } catch {
    // ponytail: silent on error — network failure must not affect init
  }
```
Python:
```python
    except Exception:
        pass  # ponytail: silent on error — network must not affect init
```

### Module-Boundary Mock (TypeScript)

**Source:** `packages/npm/src/steps/install-headroom.test.ts` lines 3–16

**Apply to:** `telemetry.test.ts` — mock the external call at module boundary. For `fetch` (a global): use `vi.stubGlobal` not `vi.mock`.

```typescript
// At file top — for module deps:
vi.mock('../steps/telemetry.js', () => ({ sendTelemetry: vi.fn().mockResolvedValue(undefined) }))

// In beforeEach — for globals:
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
// In afterEach:
vi.unstubAllGlobals()
```

### Module-Boundary Mock (Python)

**Source:** `packages/pip/tests/test_install_headroom.py` lines 11–25

**Apply to:** `test_telemetry.py`, `test_init_cmd.py` additions

```python
mocker.patch(
    "goodvibes_cli.steps.telemetry.urllib.request.urlopen",
)
```
Path convention: `goodvibes_cli.steps.<module>.<imported_name>` — matches all existing mock paths in this project.

### note() / Panel Disclosure (UX Pattern)

**Source:** `packages/npm/src/commands/init.ts` lines 53–55; `packages/pip/src/goodvibes_cli/commands/init_cmd.py` lines 76–78

**Apply to:** both `init.ts` and `init_cmd.py` modifications

TypeScript (existing pattern for any informational note):
```typescript
note('Existing files will not be overwritten.', 'Non-empty project detected')
```
Python (existing pattern):
```python
console.print(Panel("Existing files will not be overwritten.", title="Non-empty project detected"))
```
Disclosure line: `'Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out.'` / title: `'Privacy'`

### Permissions: Least Privilege (GitHub Actions)

**Source:** `.github/workflows/ci.yml` lines 9–10; `.github/workflows/publish-npm.yml` lines 12–13

**Apply to:** `deploy-worker.yml`

```yaml
permissions:
  contents: read
```
All workflows in this repo use `contents: read` at the job level. Never omit permissions block.

### actions/checkout Version

**Source:** `.github/workflows/ci.yml` line 17; `.github/workflows/publish-npm.yml` line 15

**Apply to:** `deploy-worker.yml`

```yaml
- uses: actions/checkout@v7
```
Project standard is `@v7`. Do not use `@v3` or `@v4` for checkout.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `workers/telemetry/worker.js` | service | request-response | No Cloudflare Workers source exists in this repo. Use RESEARCH.md Pattern 3 directly. |
| `workers/telemetry/wrangler.toml` | config | — | No wrangler config exists in this repo. Use RESEARCH.md Pattern 3 directly. |

---

## Metadata

**Analog search scope:** `packages/npm/src/`, `packages/pip/src/`, `packages/pip/tests/`, `.github/workflows/`
**Files scanned:** 12 source + 5 workflows
**Pattern extraction date:** 2026-07-06
