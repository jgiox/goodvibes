# Phase 5: Upgrade Command & Template Repo — Pattern Map

**Mapped:** 2026-06-25
**Files analyzed:** 7
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/npm/src/commands/upgrade.ts` | command | request-response | `packages/npm/src/commands/init.ts` | exact |
| `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py` | command | request-response | `packages/pip/src/goodvibes_cli/commands/init_cmd.py` | exact |
| `packages/npm/src/commands/upgrade.test.ts` | test | — | `packages/npm/src/commands/init.test.ts` | exact |
| `packages/pip/tests/test_upgrade_cmd.py` | test | — | `packages/pip/tests/test_main.py` | exact |
| `packages/npm/src/index.ts` | entrypoint | request-response | self (MODIFY) | exact |
| `packages/pip/src/goodvibes_cli/main.py` | entrypoint | request-response | self (MODIFY) | exact |
| `scripts/verify-phase5.sh` | utility/script | batch | `scripts/verify-phase4.sh` | exact |

---

## Pattern Assignments

### `packages/npm/src/commands/upgrade.ts` (command, request-response)

**Analog:** `packages/npm/src/commands/init.ts`

**Imports pattern** (lines 1-7):
```typescript
import type { Command } from 'commander'
import { intro, outro, note, tasks } from '@clack/prompts'
import { copyTemplates, listTemplateFiles, resolveTemplatesDir } from '../steps/copy-templates.js'
import { detectProjectType } from '../utils/detect-project-type.js'
import { extractVersion, versionGte, mergeClaude } from '../utils/sentinel-merge.js'
// node:fs/promises readFile is already used in sentinel-merge.ts — import directly here too
import { readFile } from 'node:fs/promises'
import { pathExists } from 'fs-extra'
import { join } from 'path'
```

**Registration pattern** (lines 8-15 of init.ts — mirror exactly):
```typescript
export function registerUpgradeCommand(program: Command): void {
  program
    .command('upgrade')
    .description('Update goodvibes-managed files to the latest version')
    .option('--dry-run', 'Preview what would change without writing')
    .action(async (options: { dryRun: boolean }) => {
      const dryRun = options.dryRun ?? false
      const cwd = process.cwd()
      const templateDir = resolveTemplatesDir()
      const projectType = detectProjectType(cwd)

      intro('goodvibes upgrade')
      // ...
    })
}
```

**Version detection pattern** (derived from sentinel-merge.ts `extractVersion`, lines 7-9):
```typescript
// Read installed version from project's CLAUDE.md — null if absent or no sentinel
async function detectInstalledVersion(cwd: string): Promise<string | null> {
  const claudePath = join(cwd, 'CLAUDE.md')
  if (!(await pathExists(claudePath))) return null
  const content = await readFile(claudePath, 'utf-8')
  return extractVersion(content)  // reuse — searches /# goodvibes: v([\d.]+)/
}
```

**Up-to-date guard** (mirrors Case D logic in sentinel-merge.ts lines 54-56):
```typescript
// Treat null installedVersion as "0.0.0" — run full upgrade
if (installedVersion && bundledVersion && versionGte(installedVersion, bundledVersion)) {
  outro(`Already up to date (v${installedVersion})`)
  return
}
```

**Dry-run pattern** (mirrors init.ts lines 23-36):
```typescript
if (dryRun) {
  // print change summary without writing
  const changes = await computeChanges(templateDir, cwd, projectType)
  note(formatChangeSummary(changes), 'What would change')
  outro('Run without --dry-run to apply these changes.')
  return
}
```

**Task orchestration pattern** (mirrors init.ts lines 39-70 — use `tasks()` array):
```typescript
await tasks([
  {
    title: 'Checking for changes',
    task: async () => {
      changes = await computeChanges(templateDir, cwd, projectType)
      return `${changes.filter(c => c.status !== 'unchanged').length} files to update`
    },
  },
  {
    title: 'Upgrading managed files',
    task: async () => {
      updated = await upgradeTemplates(templateDir, cwd, projectType)
      return `Updated ${updated.length} files`
    },
  },
])
note(formatChangeSummary(changes), 'Changes applied')
outro('Upgrade complete!')
```

**Error handling:** No explicit try/catch in init.ts — errors propagate up to Commander's default handler. Follow the same pattern (fail loud, do not swallow).

---

### `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py` (command, request-response)

**Analog:** `packages/pip/src/goodvibes_cli/commands/init_cmd.py`

**Imports pattern** (lines 1-13 of init_cmd.py):
```python
"""goodvibes upgrade command — port of upgrade.ts."""
import pathlib
from typing import Annotated

import typer
from rich.console import Console
from rich.panel import Panel

from goodvibes_cli.steps.copy_templates import resolve_templates_dir
from goodvibes_cli.utils.detect_project_type import detect_project_type
from goodvibes_cli.utils.sentinel_merge import extract_version, version_gte, merge_claude
```

**Function signature pattern** (mirrors init_cmd.py lines 23-26):
```python
def upgrade_cmd(
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Preview changes without writing")] = False,
) -> None:
    """Re-sync goodvibes-managed files to the latest version."""
    template_dir = resolve_templates_dir()
    cwd = pathlib.Path.cwd()
    project_type = detect_project_type(cwd)
    console.rule("[bold]goodvibes upgrade[/bold]")
```

**Console output pattern** (mirrors init_cmd.py lines 32-39, 64-67):
```python
# Use console.status() for spinners, Panel() for notes, console.rule() for intro/outro
console = Console()

with console.status("Checking for changes") as status:
    changes = compute_changes(template_dir, cwd, project_type)

console.print(Panel(format_change_summary(changes), title="What will change"))

if dry_run:
    console.rule("Run without --dry-run to apply these changes.")
    return

with console.status("Upgrading managed files") as status:
    updated = upgrade_templates(template_dir, cwd, project_type)

console.print(Panel("\n".join(updated) or "(none)", title="Files updated"))
console.rule("[green]Upgrade complete![/green]")
```

**Version detection pattern** (Python port of TS detectInstalledVersion):
```python
def _detect_installed_version(cwd: pathlib.Path) -> str | None:
    claude_path = cwd / "CLAUDE.md"
    if not claude_path.exists():
        return None
    return extract_version(claude_path.read_text(encoding="utf-8"))
```

---

### `packages/npm/src/commands/upgrade.test.ts` (test)

**Analog:** `packages/npm/src/commands/init.test.ts`

**Mock setup pattern** (lines 1-26 of init.test.ts — copy exactly, swapping modules):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  tasks: vi.fn(),
}))

vi.mock('../steps/copy-templates.js', () => ({
  resolveTemplatesDir: vi.fn(),
  listTemplateFiles: vi.fn(),
}))

// Also mock sentinel-merge for version detection tests
vi.mock('../utils/sentinel-merge.js', () => ({
  extractVersion: vi.fn(),
  versionGte: vi.fn(),
  mergeClaude: vi.fn(),
}))

// Also mock fs-extra pathExists
vi.mock('fs-extra', () => ({
  pathExists: vi.fn(),
}))
```

**beforeEach reset pattern** (lines 29-31 of init.test.ts):
```typescript
describe('upgrade command', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  // ...
})
```

**Test import pattern** (lines 33-43 of init.test.ts — dynamic imports after mock setup):
```typescript
it('skips upgrade when already up to date', async () => {
  const { outro } = await import('@clack/prompts')
  const { resolveTemplatesDir } = await import('../steps/copy-templates.js')
  const { extractVersion, versionGte } = await import('../utils/sentinel-merge.js')
  const { pathExists } = await import('fs-extra')

  vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
  vi.mocked(pathExists).mockResolvedValue(true as any)
  vi.mocked(extractVersion).mockReturnValue('1.0.0')  // both installed and bundled same
  vi.mocked(versionGte).mockReturnValue(true)

  const { registerUpgradeCommand } = await import('./upgrade.js')
  const { Command } = await import('commander')
  const program = new Command()
  program.exitOverride()
  registerUpgradeCommand(program)

  await program.parseAsync(['node', 'goodvibes', 'upgrade'])

  expect(vi.mocked(outro)).toHaveBeenCalledWith(expect.stringContaining('up to date'))
})
```

**Test naming convention** (CLAUDE.md rule — sentences):
```typescript
it('--dry-run: prints change summary without writing files')
it('skips upgrade when already up to date')
it('runs full upgrade when CLAUDE.md is absent')
it('prints diff summary before applying changes')
it('preserves user content outside sentinel blocks after upgrade')
```

**tasks() mock execution pattern** (lines 82-86 of init.test.ts):
```typescript
vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
  for (const t of taskList) {
    await t.task(vi.fn())
  }
})
```

---

### `packages/pip/tests/test_upgrade_cmd.py` (test)

**Analog:** `packages/pip/tests/test_main.py`

**Runner setup pattern** (lines 1-9 of test_main.py):
```python
"""Upgrade command tests — mirrors test_main.py pattern."""
from unittest.mock import patch

import pytest
from typer.testing import CliRunner

from goodvibes_cli.main import app

runner = CliRunner()
```

**mocker.patch pattern** (lines 33-45 of test_main.py):
```python
def test_dry_run_shows_summary_without_writing(mocker):
    mocker.patch(
        "goodvibes_cli.commands.upgrade_cmd.resolve_templates_dir",
        return_value=None,
    )
    mocker.patch(
        "goodvibes_cli.commands.upgrade_cmd.compute_changes",
        return_value=[],
    )
    result = runner.invoke(app, ["upgrade", "--dry-run"])
    assert result.exit_code == 0
    assert "dry-run" in result.output.lower() or "without" in result.output.lower()
```

**Test naming convention** (CLAUDE.md rule — snake_case sentences):
```python
def test_dry_run_shows_summary_without_writing(mocker): ...
def test_skips_when_already_up_to_date(mocker): ...
def test_runs_upgrade_when_claude_md_absent(mocker): ...
def test_upgrade_help_has_dry_run(): ...
def test_diff_summary_printed_before_apply(mocker): ...
```

**Conftest fixtures available** (conftest.py lines 4-44 — use these):
```python
# TEMPLATE_CONTENT, SENTINEL_START, SENTINEL_END — import from conftest or reuse directly
# tmp_dir fixture — real tmp_path for integration-style assertions
# template_dir fixture — pre-populated with CLAUDE.md, CONTRIBUTING.md, ci-*.yml files
```

---

### `packages/npm/src/index.ts` (MODIFY — entrypoint)

**Analog:** Self — current file (lines 1-23)

**Current pattern** (full file — lines 10-22):
```typescript
import { Command } from 'commander'
import { registerInitCommand } from './commands/init.js'

const program = new Command()

program
  .name('goodvibes')
  .version('1.0.0')
  .description('One-command bootstrap for vibe coding projects')

registerInitCommand(program)

await program.parseAsync(process.argv)
```

**Addition required** (insert after line 11, before `const program`):
```typescript
import { registerUpgradeCommand } from './commands/upgrade.js'
```

**And after `registerInitCommand(program)`:**
```typescript
registerUpgradeCommand(program)
```

The version guard block at the top (lines 1-8) is not touched.

---

### `packages/pip/src/goodvibes_cli/main.py` (MODIFY — entrypoint)

**Analog:** Self — current file (lines 1-16)

**Current pattern** (full file):
```python
import typer

from goodvibes_cli.commands.init_cmd import init_cmd

app = typer.Typer(help="goodvibes — one-command bootstrap for vibe coding projects")

@app.callback()
def _callback() -> None:
    """goodvibes CLI — run 'goodvibes init' to bootstrap a project"""

app.command("init")(init_cmd)

if __name__ == "__main__":
    app()
```

**Addition required** (one import + one `app.command` call — mirrors existing pattern):
```python
from goodvibes_cli.commands.upgrade_cmd import upgrade_cmd
# ...
app.command("upgrade")(upgrade_cmd)
```

---

### `scripts/verify-phase5.sh` (utility/script, batch)

**Analog:** `scripts/verify-phase4.sh`

**Full shell structure pattern** (lines 1-77 of verify-phase4.sh — copy structure verbatim):
```bash
#!/usr/bin/env bash

cd "$(dirname "$0")/.."

QUICK=0
for arg in "$@"; do
  if [ "$arg" = "--quick" ]; then
    QUICK=1
  fi
done

set -euo pipefail

pass=0; fail=0

check() {
  if bash -c "$2" > /dev/null 2>&1; then
    echo "PASS [$1]"
    pass=$((pass + 1))
  else
    echo "FAIL [$1]: $2"
    fail=$((fail + 1))
  fi
}

# -----------------------------------------------------------------------
# File existence checks (always run, --quick safe)
# -----------------------------------------------------------------------

# Phase 5 file existence checks go here (upgrade.ts, upgrade_cmd.py, etc.)

# -----------------------------------------------------------------------
# Content correctness checks (always run, --quick safe)
# -----------------------------------------------------------------------

# Phase 5 content checks go here (upgrade subcommand registered, etc.)

# -----------------------------------------------------------------------
# Unit test checks (only without --quick)
# -----------------------------------------------------------------------

if [ "$QUICK" -eq 0 ]; then
  echo ""
  echo "--- Unit test checks (full mode) ---"

  check "NPM-TESTS"  "cd packages/npm && npm test"
  check "PIP-TESTS"  "cd packages/pip && uv run --extra dev pytest tests/ -x -q"

  echo ""
fi

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------

echo ""
echo "Results: $pass passed, $fail failed"
if [ "$fail" -eq 0 ]; then
  echo "Phase 5 gate: PASS"
else
  echo "Phase 5 gate: FAIL" >&2
  exit 1
fi
```

**Phase 5 specific checks to add** (mirrors verify-phase4.sh content checks pattern):
```bash
check "UPGRADE-TS"        "test -f packages/npm/src/commands/upgrade.ts"
check "UPGRADE-TEST-TS"   "test -f packages/npm/src/commands/upgrade.test.ts"
check "UPGRADE-PY"        "test -f packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py"
check "UPGRADE-TEST-PY"   "test -f packages/pip/tests/test_upgrade_cmd.py"
check "UPGRADE-IN-INDEX"  "grep -q 'registerUpgradeCommand' packages/npm/src/index.ts"
check "UPGRADE-IN-MAIN"   "grep -q 'upgrade_cmd' packages/pip/src/goodvibes_cli/main.py"
check "UPGRADE-DRY-RUN"   "grep -q 'dry-run' packages/npm/src/commands/upgrade.ts"
```

---

## Shared Patterns

### extractVersion / extract_version
**Source (TS):** `packages/npm/src/utils/sentinel-merge.ts` lines 7-9
**Source (Py):** `packages/pip/src/goodvibes_cli/utils/sentinel_merge.py`
**Apply to:** `upgrade.ts`, `upgrade_cmd.py` (version detection)
```typescript
export function extractVersion(block: string): string | null {
  const match = block.match(/# goodvibes: v([\d.]+)/)
  return match ? match[1] : null
}
```

### versionGte / version_gte
**Source (TS):** `packages/npm/src/utils/sentinel-merge.ts` lines 12-21
**Apply to:** `upgrade.ts` (up-to-date guard)
```typescript
export function versionGte(a: string, b: string): boolean {
  const pa = a.split('.').map(s => parseInt(s, 10))
  const pb = b.split('.').map(s => parseInt(s, 10))
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va > vb) return true
    if (va < vb) return false
  }
  return true // equal
}
```

### mergeClaude / merge_claude
**Source (TS):** `packages/npm/src/utils/sentinel-merge.ts` lines 31-63
**Apply to:** `upgrade.ts` — call directly, do NOT reimplement. Case C (replace sentinel, preserve surrounding content) is already correct and tested.

### resolveTemplatesDir / resolve_templates_dir
**Source (TS):** `packages/npm/src/steps/copy-templates.ts` lines 10-19
**Apply to:** `upgrade.ts`, `upgrade_cmd.py` — import and call, same as init.ts does.

### copy() with overwrite flag
**Source (TS):** `packages/npm/src/steps/copy-templates.ts` lines 71-85
**Apply to:** new `upgradeTemplates()` function (to be added to copy-templates.ts or inline in upgrade.ts)
**Key difference from init:** `overwrite: true` for managed paths only; CLAUDE.md always delegated to `mergeClaude`.
```typescript
// init uses overwrite: false (no-clobber)
await copy(templateDir, destDir, { overwrite: false, ... })

// upgrade uses overwrite: true for managed files only
await copy(templateDir, destDir, {
  overwrite: true,
  filter: (src: string) => {
    if (src.endsWith('CLAUDE.md')) return false  // mergeClaude handles it
    if (relative(templateDir, src).includes('..')) return false  // path traversal guard
    if (src.includes('.claude/skills/')) return true
    if (src.includes('.github/workflows/')) return true
    return false  // default: don't touch unknown files
  },
})
```

### Python shutil.copytree ignore pattern
**Source:** `packages/pip/src/goodvibes_cli/steps/copy_templates.py` lines 52-77
**Apply to:** `upgrade_cmd.py` — the `ignore_fn` pattern; adapt to allow overwrite for managed paths and block all others.

### CI variant rename (selectedVariant → ci.yml)
**Source (TS):** `packages/npm/src/steps/copy-templates.ts` lines 87-94
**Apply to:** `upgradeTemplates()` — re-detect project type, rename selected variant to ci.yml. Same logic as init.
```typescript
const variantPath = join(destDir, '.github', 'workflows', selectedVariant)
const ciPath = join(destDir, '.github', 'workflows', 'ci.yml')
if (existsSync(variantPath)) {
  await rename(variantPath, ciPath)
}
```

### Path traversal guard
**Source (TS):** `packages/npm/src/steps/copy-templates.ts` line 78
**Apply to:** `upgradeTemplates()` — must be preserved exactly.
```typescript
if (relative(templateDir, src).includes('..')) return false
```

### Error propagation (fail loud)
**Source:** All existing step files — no empty catch blocks, errors propagate.
**Apply to:** Both `upgrade.ts` and `upgrade_cmd.py`. Do not add try/catch unless you have a specific recovery action.

### Shell check pattern (verify script)
**Source:** `scripts/verify-phase4.sh` lines 16-23
**Apply to:** `scripts/verify-phase5.sh` — `check()` function is identical; copy verbatim.

---

## No Analog Found

No files in this phase lack an analog. All 7 files have exact or near-exact matches in the codebase.

---

## Metadata

**Analog search scope:** `packages/npm/src/`, `packages/pip/src/`, `packages/pip/tests/`, `scripts/`
**Files scanned:** 9
**Pattern extraction date:** 2026-06-25
