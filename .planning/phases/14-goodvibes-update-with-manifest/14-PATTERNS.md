# Phase 14: goodvibes update with Manifest - Pattern Map

**Mapped:** 2026-07-27
**Files analyzed:** 17 (9 new, 8 modified)
**Analogs found:** 17 / 17

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/npm/src/steps/write-manifest.ts` | step | file-I/O | `packages/npm/src/steps/telemetry.ts` | role-match |
| `packages/npm/src/steps/write-manifest.test.ts` | test | file-I/O | `packages/npm/src/utils/sentinel-merge.test.ts` | exact |
| `packages/npm/src/commands/update.ts` | command | request-response | `packages/npm/src/commands/upgrade.ts` | exact |
| `packages/npm/src/commands/update.test.ts` | test | unit | `packages/npm/src/commands/upgrade.test.ts` | exact |
| `packages/npm/src/commands/init.ts` (MODIFY) | command | request-response | self | n/a |
| `packages/npm/src/commands/init.test.ts` (MODIFY) | test | unit | self | n/a |
| `packages/npm/src/utils/sentinel-merge.ts` (MODIFY) | utility | file-I/O | `packages/pip/src/goodvibes_cli/utils/sentinel_merge.py` | exact (Python has the fix) |
| `packages/npm/src/utils/sentinel-merge.test.ts` (MODIFY) | test | file-I/O | `packages/pip/tests/test_sentinel_merge.py` lines 127–138 | exact |
| `packages/npm/src/commands/upgrade.ts` (MODIFY) | command | request-response | self | n/a |
| `packages/npm/src/index.ts` (MODIFY) | config/entry | request-response | self | n/a |
| `packages/pip/src/goodvibes_cli/steps/write_manifest.py` | step | file-I/O | `packages/pip/src/goodvibes_cli/steps/telemetry.py` | role-match |
| `packages/pip/tests/test_write_manifest.py` | test | file-I/O | `packages/pip/tests/test_sentinel_merge.py` | exact |
| `packages/pip/src/goodvibes_cli/commands/update_cmd.py` | command | request-response | `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py` | exact |
| `packages/pip/tests/test_update_cmd.py` | test | unit | `packages/pip/tests/test_upgrade_cmd.py` | exact |
| `packages/pip/src/goodvibes_cli/commands/init_cmd.py` (MODIFY) | command | request-response | self | n/a |
| `packages/pip/tests/test_init_cmd.py` (MODIFY) | test | unit | self | n/a |
| `packages/pip/src/goodvibes_cli/main.py` (MODIFY) | config/entry | request-response | self | n/a |

---

## Pattern Assignments

### `packages/npm/src/steps/write-manifest.ts` (step, file-I/O)

**Analog:** `packages/npm/src/steps/telemetry.ts`

**Imports pattern** — how a step module imports only stdlib and no project deps (telemetry.ts lines 1–0, all inline):
```typescript
// telemetry.ts uses dynamic import of node:crypto inside the function body.
// write-manifest.ts uses static imports (file I/O is always needed):
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
```

**Core step function pattern** — async function, named export, no default export (telemetry.ts lines 4–28):
```typescript
// telemetry.ts shape:
export async function sendTelemetry(): Promise<void> {
  // ...
}

// write-manifest.ts follows the same shape — two named exports, no class, no default:
export interface Manifest {
  version: string
  files: Record<string, string>  // rel path → sha256 hex
}

const MANIFEST_PATH = '.goodvibes.json'

export async function writeManifest(
  destDir: string,
  writtenFiles: string[],
  version: string,
): Promise<void> {
  const files: Record<string, string> = {}
  for (const rel of writtenFiles) {
    const content = await readFile(join(destDir, rel), 'utf-8')
    files[rel] = createHash('sha256').update(content, 'utf8').digest('hex')
  }
  const manifest: Manifest = { version, files }
  await writeFile(join(destDir, MANIFEST_PATH), JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
}

export async function readManifest(destDir: string): Promise<Manifest | null> {
  try {
    const raw = await readFile(join(destDir, MANIFEST_PATH), 'utf-8')
    return JSON.parse(raw) as Manifest
  } catch {
    return null
  }
}
```

**Error handling pattern** — silent null return on read failure (same as telemetry.ts catch block on line 23):
```typescript
// telemetry.ts:
  } catch {
    // ponytail: silent on error — network failure must not affect init
  }

// readManifest: malformed JSON must not crash — return null, let UPD-05 handle it
  } catch {
    return null
  }
```

**NOTE:** The `readManifest` catch intentionally swallows parse errors. This is the one place where a silent catch is correct — the caller receives `null` and shows the UPD-05 message.

---

### `packages/npm/src/steps/write-manifest.test.ts` (test, file-I/O)

**Analog:** `packages/npm/src/utils/sentinel-merge.test.ts`

**Test file structure** — real tmpdir, no mocks for file I/O (sentinel-merge.test.ts lines 1–10, 55–64):
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync } from 'fs'
import { rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { writeManifest, readManifest } from './write-manifest.js'

describe('writeManifest / readManifest', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-manifest-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  // tests follow...
})
```

**Test naming pattern** (sentinel-merge.test.ts lines 66, 73, 101, 116, 127):
```typescript
it('writes .goodvibes.json with sha256 for each written file', async () => { ... })
it('readManifest returns null when .goodvibes.json does not exist', async () => { ... })
it('readManifest returns null when .goodvibes.json is malformed JSON', async () => { ... })
it('writeManifest hashes the actual dest content, not the path string', async () => { ... })
```

---

### `packages/npm/src/commands/update.ts` (command, request-response)

**Analog:** `packages/npm/src/commands/upgrade.ts`

**Imports pattern** (upgrade.ts lines 1–11):
```typescript
import type { Command } from 'commander'
import { intro, outro, note, confirm, isCancel, cancel } from '@clack/prompts'
import { listTemplateFiles, resolveTemplatesDir } from '../steps/copy-templates.js'
import { readManifest, writeManifest } from '../steps/write-manifest.js'
import { mergeClaude } from '../utils/sentinel-merge.js'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'

const _require = createRequire(import.meta.url)
```

**Command registration pattern** (upgrade.ts lines 136–143):
```typescript
export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update goodvibes-managed files using the manifest')
    .option('--dry-run', 'Preview what would change without writing')
    .option('--force', 'Skip confirmation prompt and overwrite without asking')
    .action(async (options: { dryRun: boolean; force: boolean }) => {
      const dryRun = options.dryRun ?? false
      const force = options.force ?? false
      const cwd = process.cwd()
      // ...
    })
}
```

**UPD-05 no-manifest early exit pattern** (upgrade.ts lines 176–178 as reference for outro + return):
```typescript
      intro('goodvibes update')

      const manifest = await readManifest(cwd)
      if (!manifest) {
        note(
          "No .goodvibes.json found. This project was initialised before v1.2.0.\n" +
          "Run 'goodvibes init' once to create the manifest, then use 'goodvibes update' to keep files current.",
          'No manifest'
        )
        outro('Nothing updated.')
        return  // exit 0 — UPD-05 requires no crash, no exit(1)
      }
```

**Confirmation prompt pattern** (verified: `confirm` and `isCancel` exported from @clack/prompts v1.7.0):
```typescript
      if (!force && overwrite.length > 0) {
        const proceed = await confirm({ message: `Overwrite ${overwrite.length} file(s)?` })
        if (isCancel(proceed) || !proceed) {
          cancel('Update cancelled.')
          process.exit(0)
        }
      }
```

**Dry-run early exit pattern** (upgrade.ts lines 181–183):
```typescript
      if (dryRun) {
        note(
          [
            overwrite.length > 0 ? `Will overwrite (${overwrite.length}): ${overwrite.join(', ')}` : null,
            skip.length > 0 ? `Will skip — user-modified (${skip.length}): ${skip.join(', ')}` : null,
            netNew.length > 0 ? `Will add net-new (${netNew.length}): ${netNew.join(', ')}` : null,
          ].filter(Boolean).join('\n'),
          'Dry run — no files written'
        )
        outro('Run without --dry-run to apply these changes.')
        return
      }
```

**Version lookup pattern** — copy from upgrade.ts lines 25–32 (`getInstalledVersion`):
```typescript
function getVersion(): string {
  try {
    const pkg = _require('../../package.json') as { version?: string }
    return pkg.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}
```

**CLAUDE.md write pattern during update** — must use `mergeClaude`, never direct overwrite (upgrade.ts lines 125–127):
```typescript
      // For CLAUDE.md, always go through mergeClaude — never direct overwrite
      const claudeSrc = join(templateDir, 'CLAUDE.md')
      const templateContent = await readFile(claudeSrc, 'utf-8')
      await mergeClaude(claudeDest, templateContent)
```

---

### `packages/npm/src/commands/update.test.ts` (test, unit)

**Analog:** `packages/npm/src/commands/upgrade.test.ts`

**Mock setup pattern** (upgrade.test.ts lines 1–52):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
}))

vi.mock('../steps/copy-templates.js', () => ({
  listTemplateFiles: vi.fn(),
  resolveTemplatesDir: vi.fn(),
}))

vi.mock('../steps/write-manifest.js', () => ({
  writeManifest: vi.fn().mockResolvedValue(undefined),
  readManifest: vi.fn().mockResolvedValue(null),
}))

vi.mock('../utils/sentinel-merge.js', () => ({
  mergeClaude: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: vi.fn().mockReturnValue(true) }
})

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('file content'),
}))

vi.mock('node:crypto', () => ({
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('abc123'),
  }),
}))

vi.mock('node:module', () => ({
  createRequire: () => () => ({ version: '1.2.0' }),
}))

describe('update command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  // ...
})
```

**Test naming pattern** (upgrade.test.ts and init.test.ts style):
```typescript
it('shows no-manifest note and exits 0 when .goodvibes.json is absent', ...)
it('--dry-run: prints three categories and does not write any files', ...)
it('--force: skips confirm prompt and applies overwrites', ...)
it('prompts confirmation before overwriting when --force is not passed', ...)
it('calls writeManifest after applying changes', ...)
```

---

### `packages/npm/src/commands/init.ts` (MODIFY)

**Where to add:** After `await tasks(taskList)` succeeds (line 133), before the `note(createdFiles.join...)` call on line 145.

**Import to add** at top of file (after existing imports):
```typescript
import { writeManifest } from '../steps/write-manifest.js'
```

**Version lookup to add** — inline, consistent with upgrade.ts top-level `createRequire`:
```typescript
// After: await tasks(taskList)
// Before: await Promise.race([telemetryPromise, sleep(1_000)])

const { createRequire } = await import('node:module')
const _req = createRequire(import.meta.url)
const _ver = (_req('../../package.json') as { version: string }).version
await writeManifest(cwd, createdFiles.filter(f => f !== '.goodvibes.json'), _ver)
```

**Context** — `createdFiles` is populated during `tasks()` execution (init.ts lines 83–95):
```typescript
const createdFiles: string[] = []
// ...tasks() populates createdFiles via push() calls in each task
await tasks(taskList)
// writeManifest goes here — after tasks() so hashes are computed from final written files
```

---

### `packages/npm/src/commands/init.test.ts` (MODIFY)

**Mock to add** after existing mocks (after line 43 `telemetry` mock):
```typescript
vi.mock('../steps/write-manifest.js', () => ({
  writeManifest: vi.fn().mockResolvedValue(undefined),
  readManifest: vi.fn().mockResolvedValue(null),
}))
```

**Assertion to add** in the 'normal run' test (after existing assertions, around line 190):
```typescript
const { writeManifest } = await import('../steps/write-manifest.js')
expect(vi.mocked(writeManifest)).toHaveBeenCalledTimes(1)
expect(vi.mocked(writeManifest)).toHaveBeenCalledWith(
  expect.any(String),   // cwd
  expect.any(Array),    // createdFiles
  expect.any(String),   // version
)
```

**Assertion to add** in the '--dry-run' test to confirm writeManifest NOT called:
```typescript
const { writeManifest } = await import('../steps/write-manifest.js')
expect(vi.mocked(writeManifest)).not.toHaveBeenCalled()
```

---

### `packages/npm/src/utils/sentinel-merge.ts` (MODIFY — UPD-06 bug fix)

**Bug location:** Lines 49–50. Current code:
```typescript
  const endIdx = existing.indexOf(SENTINEL_END)
  const existingBlock = existing.slice(startIdx, endIdx + SENTINEL_END.length)
```

When `endIdx === -1`, `existing.slice(startIdx, -1 + 24)` = `existing.slice(startIdx, 23)` — incorrect.

**Fix — insert guard after line 49:**
```typescript
  const endIdx = existing.indexOf(SENTINEL_END)
  if (endIdx === -1) {
    // Malformed: start present but end absent — treat as Case B (append, no data-loss)
    await writeFile(destPath, existing.slice(0, startIdx).trimEnd() + '\n\n' + templateBlock + '\n')
    return
  }
  // existing code continues from line 50 onwards unchanged
  const existingBlock = existing.slice(startIdx, endIdx + SENTINEL_END.length)
```

**Python equivalent** (sentinel_merge.py lines 64–68 — the fix that already exists in Python):
```python
    end_idx = existing.find(SENTINEL_END)
    if end_idx == -1:
        # Malformed: start marker present but end marker absent — treat as Case B.
        dest_path.write_text(existing[:start_idx].rstrip() + "\n\n" + template_block + "\n", encoding="utf-8")
        return
```

---

### `packages/npm/src/utils/sentinel-merge.test.ts` (MODIFY — add UPD-06 test)

**Where to add:** After the last test case in `describe('mergeClaude', ...)` (after line 137).

**Pattern** — mirrors the Python test at test_sentinel_merge.py lines 127–138:
```typescript
  it('SENTINEL_START without SENTINEL_END does not corrupt file', async () => {
    const destPath = join(tmpDir, 'CLAUDE.md')
    const malformed = '# User content\n\n' + SENTINEL_START + '\norphaned start'
    writeFileSync(destPath, malformed)
    await mergeClaude(destPath, TEMPLATE_CONTENT)
    const content = readFileSync(destPath, 'utf-8')
    expect(content).toContain('# User content')
    expect(content).toContain(SENTINEL_END)
    expect((content.match(/<!-- goodvibes:start -->/g) ?? []).length).toBe(1)
    // No garbage after sentinel end (corruption check mirrors Python test)
    const afterEnd = content.split(SENTINEL_END)[1] ?? ''
    expect(afterEnd.trim()).toBe('')
  })
```

---

### `packages/npm/src/commands/upgrade.ts` (MODIFY — remove alias)

**Single line change** at line 139. Remove `.alias('update')`:
```typescript
// BEFORE:
  program
    .command('upgrade')
    .alias('update')
    .description('Update goodvibes-managed files to the latest version')

// AFTER:
  program
    .command('upgrade')
    .description('Update goodvibes-managed files to the latest version')
```

---

### `packages/npm/src/index.ts` (MODIFY — wire update command)

**Import to add** after existing imports (after line 14):
```typescript
import { registerUpdateCommand } from './commands/update.js'
```

**Registration to add** after line 28 (`registerUpgradeCommand(program)`):
```typescript
registerUpdateCommand(program)
```

---

### `packages/pip/src/goodvibes_cli/steps/write_manifest.py` (step, file-I/O)

**Analog:** `packages/pip/src/goodvibes_cli/steps/telemetry.py`

**Imports pattern** — stdlib only, no project imports (telemetry.py lines 1–5):
```python
from __future__ import annotations
import hashlib
import json
import pathlib
```

**Core step functions pattern** — plain functions, no class, no `from goodvibes_cli` imports:
```python
MANIFEST_PATH = ".goodvibes.json"


def write_manifest(dest_dir: pathlib.Path, written_files: list[str], version: str) -> None:
    files: dict[str, str] = {}
    for rel in written_files:
        content = (dest_dir / rel).read_bytes()
        files[rel] = hashlib.sha256(content).hexdigest()
    manifest = {"version": version, "files": files}
    (dest_dir / MANIFEST_PATH).write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


def read_manifest(dest_dir: pathlib.Path) -> dict | None:
    p = dest_dir / MANIFEST_PATH
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None
```

**NOTE:** Use `read_bytes()` not `read_text()` for hashing to avoid encoding round-trip differences.

---

### `packages/pip/tests/test_write_manifest.py` (test, file-I/O)

**Analog:** `packages/pip/tests/test_sentinel_merge.py`

**Test file structure** — uses `tmp_dir` fixture from conftest.py (no mock for file I/O):
```python
"""Tests for write_manifest step."""
import pathlib
import pytest
from goodvibes_cli.steps.write_manifest import write_manifest, read_manifest


def test_write_manifest_creates_goodvibes_json_with_sha256_per_file(tmp_dir):
    (tmp_dir / "CLAUDE.md").write_text("# hello\n", encoding="utf-8")
    write_manifest(tmp_dir, ["CLAUDE.md"], "1.2.0")
    manifest_path = tmp_dir / ".goodvibes.json"
    assert manifest_path.exists()
    import json
    data = json.loads(manifest_path.read_text())
    assert data["version"] == "1.2.0"
    assert "CLAUDE.md" in data["files"]
    assert len(data["files"]["CLAUDE.md"]) == 64  # sha256 hex


def test_read_manifest_returns_none_when_file_absent(tmp_dir):
    assert read_manifest(tmp_dir) is None


def test_read_manifest_returns_none_when_json_is_malformed(tmp_dir):
    (tmp_dir / ".goodvibes.json").write_text("not json", encoding="utf-8")
    assert read_manifest(tmp_dir) is None
```

**`tmp_dir` fixture note** (conftest.py lines 8–11): `tmp_dir` returns `tmp_path` directly — NOT a subdirectory. Files "outside" must use a sibling path.

---

### `packages/pip/src/goodvibes_cli/commands/update_cmd.py` (command, request-response)

**Analog:** `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py`

**Imports pattern** (upgrade_cmd.py lines 1–26):
```python
"""goodvibes update command — manifest-based file update."""
from __future__ import annotations

import hashlib
import importlib.metadata
import pathlib
from typing import Annotated

import typer
from rich.console import Console
from rich.panel import Panel

from goodvibes_cli.steps.copy_templates import list_template_files, resolve_templates_dir
from goodvibes_cli.steps.write_manifest import read_manifest, write_manifest
from goodvibes_cli.utils.sentinel_merge import merge_claude

console = Console()
```

**Command function signature pattern** (upgrade_cmd.py lines 186–189):
```python
def update_cmd(
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Preview changes without writing")] = False,
    force: Annotated[bool, typer.Option("--force", help="Skip confirmation and overwrite")] = False,
) -> None:
    """Update goodvibes-managed files using the manifest."""
```

**UPD-05 no-manifest early exit** (mirrors upgrade_cmd.py `already up to date` pattern lines 212–214):
```python
    manifest = read_manifest(cwd)
    if manifest is None:
        console.print(Panel(
            "No .goodvibes.json found. This project was initialised before v1.2.0.\n"
            "Run 'goodvibes init' once to create the manifest, then use 'goodvibes update'.",
            title="No manifest"
        ))
        console.rule("Nothing updated.")
        return  # exit 0 — typer.Exit() not called, UPD-05
```

**Python confirmation prompt pattern** (typer built-in, no extra import):
```python
    if not force and overwrite:
        confirmed = typer.confirm(f"Overwrite {len(overwrite)} file(s)?")
        if not confirmed:
            console.rule("Update cancelled.")
            return
```

**CLAUDE.md write pattern during update** (upgrade_cmd.py lines 163–165):
```python
        # CLAUDE.md must go through merge_claude — never direct overwrite
        template_content = (template_dir / "CLAUDE.md").read_text(encoding="utf-8")
        merge_claude(claude_dest, template_content)
```

---

### `packages/pip/tests/test_update_cmd.py` (test, unit)

**Analog:** `packages/pip/tests/test_upgrade_cmd.py`

**Test file structure** (upgrade_cmd.py test lines 1–22):
```python
"""Tests for update_cmd."""
import re
from unittest.mock import patch

import pytest
from typer.testing import CliRunner

from goodvibes_cli.main import app

runner = CliRunner()

_ANSI = re.compile(r'\x1b\[[0-9;]*m')
```

**Test naming pattern** (upgrade test lines 24–58 as template):
```python
def test_update_shows_no_manifest_message_and_exits_0_when_goodvibes_json_absent(mocker):
    mocker.patch("goodvibes_cli.commands.update_cmd.read_manifest", return_value=None)
    result = runner.invoke(app, ["update"])
    assert result.exit_code == 0
    assert "manifest" in result.output.lower() or "v1.2.0" in result.output.lower()


def test_update_dry_run_prints_three_categories_without_writing(mocker):
    ...


def test_update_force_skips_confirm_prompt(mocker):
    ...


def test_update_calls_write_manifest_after_applying_changes(mocker):
    ...
```

---

### `packages/pip/src/goodvibes_cli/commands/init_cmd.py` (MODIFY)

**Import to add** at top (after existing step imports, around line 13):
```python
from goodvibes_cli.steps.write_manifest import write_manifest
```

**Version lookup to add** — same pattern as upgrade_cmd.py line 35 (`_get_package_version`):
```python
import importlib.metadata
# already present in upgrade_cmd.py — add it to init_cmd.py imports if not present
```

**Where to add the write_manifest call** — after the `with console.status("Copying template files"):` block and the headroom/MCP blocks, immediately after the `except` block closes (after line 127 in init_cmd.py), before the `if tel_thread:` line:

```python
    # After the try/except block, before tel_thread.join:
    _version = importlib.metadata.version("goodvibes-cli")
    write_manifest(cwd, [f for f in created_files if f != ".goodvibes.json"], _version)
```

---

### `packages/pip/tests/test_init_cmd.py` (MODIFY)

**Mock to add** in each test that runs the full init path — use `mocker.patch` targeting `goodvibes_cli.commands.init_cmd.write_manifest`:
```python
@pytest.fixture(autouse=True)
def mock_write_manifest(mocker):
    return mocker.patch("goodvibes_cli.commands.init_cmd.write_manifest")
```

**Assertion to add** in the test that verifies normal run completes:
```python
def test_init_calls_write_manifest_once(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.init_cmd.copy_templates", return_value=(["CLAUDE.md"], []))
    mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom", return_value={"status": "skipped", "reason": ""})
    mocker.patch("goodvibes_cli.commands.init_cmd.configure_mcp", return_value={"status": "skipped", "reason": ""})
    mock_wm = mocker.patch("goodvibes_cli.commands.init_cmd.write_manifest")
    result = runner.invoke(app, ["--minimal"])
    assert result.exit_code == 0
    assert mock_wm.call_count == 1
```

**Assertion for dry-run** — write_manifest must NOT be called:
```python
def test_init_dry_run_does_not_call_write_manifest(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.list_template_files", return_value=["CLAUDE.md"])
    mock_wm = mocker.patch("goodvibes_cli.commands.init_cmd.write_manifest")
    runner.invoke(app, ["--dry-run"])
    assert mock_wm.call_count == 0
```

---

### `packages/pip/src/goodvibes_cli/main.py` (MODIFY)

**Import to add** after existing command imports (after line 6):
```python
from goodvibes_cli.commands.update_cmd import update_cmd
```

**Line to change** (main.py line 28):
```python
# BEFORE:
app.command("update")(upgrade_cmd)

# AFTER:
app.command("update")(update_cmd)
```

---

## Shared Patterns

### Step Module Shape (TypeScript)
**Source:** `packages/npm/src/steps/telemetry.ts` (entire file, 28 lines)
**Apply to:** `write-manifest.ts`
- No default export
- Named async function exports only
- No project-internal imports; stdlib only
- Errors that must not crash the caller are silently swallowed in catch (with a comment explaining why)

### Step Module Shape (Python)
**Source:** `packages/pip/src/goodvibes_cli/steps/telemetry.py` (entire file, 39 lines)
**Apply to:** `write_manifest.py`
- `from __future__ import annotations` at top
- No class, no `@app.command()` decorators
- Stdlib only imports (no `from goodvibes_cli` imports)
- Plain functions, return type annotated

### Command Registration Pattern (TypeScript)
**Source:** `packages/npm/src/commands/upgrade.ts` lines 136–143
**Apply to:** `update.ts`
```typescript
export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description(...)
    .option('--dry-run', ...)
    .option('--force', ...)
    .action(async (options: { dryRun: boolean; force: boolean }) => { ... })
}
```

### Command Function Signature (Python)
**Source:** `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py` lines 186–189
**Apply to:** `update_cmd.py`
```python
def update_cmd(
    dry_run: Annotated[bool, typer.Option("--dry-run", help="...")] = False,
    force: Annotated[bool, typer.Option("--force", help="...")] = False,
) -> None:
```

### Version Detection
**Source (TypeScript):** `packages/npm/src/commands/upgrade.ts` lines 25–32 (`getInstalledVersion`)
**Source (Python):** `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py` lines 34–37 (`_get_package_version`)
**Apply to:** init.ts (inline dynamic import), update.ts (top-level `createRequire`)
```typescript
// TypeScript — top-level (upgrade.ts pattern):
const _require = createRequire(import.meta.url)
const pkg = _require('../../package.json') as { version?: string }

// Python (upgrade_cmd.py pattern):
import importlib.metadata
version = importlib.metadata.version("goodvibes-cli")
```

### Test Mocking Pattern (TypeScript — ESM modules)
**Source:** `packages/npm/src/commands/init.test.ts` lines 1–45
**Apply to:** `update.test.ts`
- `vi.mock(...)` at module level (hoisted by vitest)
- `vi.clearAllMocks()` in `beforeEach`
- Dynamic `await import(...)` inside each test to get the mocked reference
- `program.exitOverride()` to prevent `process.exit` in tests

### Test Runner Pattern (Python)
**Source:** `packages/pip/tests/test_upgrade_cmd.py` lines 1–22
**Apply to:** `test_update_cmd.py`
```python
from typer.testing import CliRunner
from goodvibes_cli.main import app

runner = CliRunner()
_ANSI = re.compile(r'\x1b\[[0-9;]*m')  # strip Rich ANSI in output assertions
```

### Real-Filesystem Test Pattern (TypeScript)
**Source:** `packages/npm/src/utils/sentinel-merge.test.ts` lines 55–64
**Apply to:** `write-manifest.test.ts`
```typescript
let tmpDir: string
beforeEach(() => { tmpDir = mkdtempSync(join(tmpdir(), 'gv-test-')) })
afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }) })
```

### Real-Filesystem Test Pattern (Python)
**Source:** `packages/pip/tests/conftest.py` lines 8–11
**Apply to:** `test_write_manifest.py`
```python
# Use the `tmp_dir` fixture — returns tmp_path directly, not a subdirectory
def test_something(tmp_dir):  # tmp_dir is pathlib.Path
    ...
```

---

## No Analog Found

All files in Phase 14 have a direct or role-match analog in the codebase. No file requires fallback to RESEARCH.md patterns only.

---

## Metadata

**Analog search scope:** `packages/npm/src/`, `packages/pip/src/`, `packages/pip/tests/`
**Files scanned:** 22 TypeScript source files, 14 Python source files, 13 Python test files
**Pattern extraction date:** 2026-07-27
