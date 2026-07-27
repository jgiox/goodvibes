# Phase 14: goodvibes update with Manifest - Research

**Researched:** 2026-07-27
**Domain:** CLI file management, manifest-based update, SHA-256 hashing, sentinel guard
**Confidence:** HIGH

---

## Summary

Phase 14 adds a manifest-writing step to `goodvibes init` and replaces the current `update` alias (which points to the old `upgrade` logic) with a proper manifest-based `goodvibes update` command. The manifest is `.goodvibes.json` written to the project root: it records the SHA-256 hash of every file init wrote, indexed by relative path, with the goodvibes version. On `goodvibes update`, the manifest lets the CLI distinguish files the user has not touched (safe to overwrite) from ones they have modified (skip), and files that did not exist when init ran (net-new, always write).

The entire feature uses only stdlib: `node:crypto` for SHA-256 in TypeScript and `hashlib` in Python. No new npm or pip dependencies are required. The existing `@clack/prompts` library already exports `confirm()` and `isCancel()` (verified against the installed build), and `typer.confirm()` is available in the Python package.

There is one pre-existing bug that UPD-06 must fix: `sentinel-merge.ts` does not guard against the case where `SENTINEL_START` appears but `SENTINEL_END` is absent. The Python counterpart already handles this (line 65–68 of `sentinel_merge.py`); the Python test `test_merge_claude_malformed_start_without_end_does_not_corrupt` already asserts the correct behaviour. The TypeScript code will corrupt the file by computing `after = existing.slice(23)` when `endIdx === -1`, because `-1 + SENTINEL_END.length (24)` = `23`.

**Primary recommendation:** Create `write-manifest.ts` / `write_manifest.py` (step modules), wire into `init`, create `update.ts` / `update_cmd.py` (command modules), wire into `index.ts` / `main.py`, and patch `sentinel-merge.ts` with the missing guard. No new dependencies.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UPD-01 | `goodvibes init` writes `.goodvibes.json` manifest (SHA-256 per managed file + goodvibes version) | `node:crypto` + `hashlib` stdlib confirmed; manifest must be written AFTER `copyTemplates` returns written list |
| UPD-02 | `goodvibes update` reads manifest and categorises: managed (safe to overwrite), user-modified (skip), net-new (write) | Three-category classification fully understood; uses SHA-256 comparison |
| UPD-03 | `goodvibes update --dry-run` shows three labelled categories without writing | No new dependencies; Commander.js `--dry-run` option pattern already established |
| UPD-04 | `goodvibes update` prompts confirmation before overwrites; `--force` skips prompt | `confirm()` + `isCancel()` verified in installed `@clack/prompts`; `typer.confirm()` available in pip |
| UPD-05 | Pre-v1.2.0 project (no `.goodvibes.json`) gets clear message, no crash or silent overwrite | Simple `existsSync` / `Path.exists()` check at command entry; print and exit 0 |
| UPD-06 | Sentinel guard: `SENTINEL_START` without `SENTINEL_END` treated as append, not data-loss | TypeScript bug confirmed; Python already fixed; fix is 4-line guard in `sentinel-merge.ts` |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SHA-256 hash computation | Step module (both CLIs) | — | Pure I/O: read file, compute hash. Belongs in a step, not in the command layer |
| Manifest write (init) | Step module (`write-manifest`) | Called from init handler | Keeps init.ts thin; step is independently testable |
| Manifest read (update) | Step module (`write-manifest`) | Called from update handler | Same module owns both read and write |
| File categorisation | Command layer (`update.ts`) | — | Business logic that consumes manifest + template files |
| Confirmation prompt | Command layer (`update.ts`) | — | UX concern, belongs in command handler |
| Sentinel guard fix | Util layer (`sentinel-merge.ts`) | — | Bug fix in existing utility; no new layer |
| CLAUDE.md merge during update | Util layer (`sentinel-merge.ts`) via `mergeClaude` | — | Same path as init; update must NOT bypass sentinel merge for CLAUDE.md |

---

## Standard Stack

### Core

No new runtime dependencies. All new code uses only already-installed packages and stdlib.

| Library | Purpose | Source |
|---------|---------|--------|
| `node:crypto` | SHA-256 hashing (Node.js stdlib) | `createHash('sha256').update(content, 'utf8').digest('hex')` |
| `node:fs/promises` | Read files for hashing, write manifest JSON | Already used throughout codebase |
| `hashlib` | SHA-256 hashing (Python stdlib) | `hashlib.sha256(content.encode('utf-8')).hexdigest()` |
| `json` | Parse/serialize manifest (Python stdlib) | Already used in `upgrade_cmd.py` |
| `@clack/prompts` confirm + isCancel | Confirmation prompt in TS update command | Verified installed: `confirm: function`, `isCancel: function` |
| `typer.confirm` | Confirmation prompt in Python update command | Built-in to Typer, no import needed beyond typer |

### Package Legitimacy Audit

No new packages are installed in Phase 14. All capabilities come from stdlib (`node:crypto`, `hashlib`, `json`) and the already-installed `@clack/prompts`. No legitimacy audit is required.

---

## Architecture Patterns

### System Architecture Diagram

```
goodvibes init
  ├── [existing] copyTemplates(templateDir, destDir) → { written: string[] }
  └── [new] writeManifest(destDir, written, version)
        → writes .goodvibes.json

goodvibes update
  ├── readManifest(cwd) → Manifest | null
  │     if null → print UPD-05 message, exit 0
  ├── loadTemplateFiles(templateDir) → Map<rel, SHA-256>
  ├── loadDestFiles(cwd, manifest.files) → Map<rel, SHA-256 | null>
  ├── categorise(manifest, templateShas, destShas)
  │     → { overwrite: string[], skip: string[], netNew: string[] }
  ├── [--dry-run] print 3 categories, exit
  ├── [--force or confirm()] apply changes
  │     overwrite + netNew: copy template file to dest (CLAUDE.md → mergeClaude)
  └── writeManifest(cwd, writtenFiles, version)  ← update manifest with new hashes
```

### Recommended Project Structure

New files required (relative to repo root):

```
packages/npm/src/
  steps/
    write-manifest.ts          # NEW — writeManifest() + readManifest()
    write-manifest.test.ts     # NEW — unit tests
  commands/
    update.ts                  # NEW — registerUpdateCommand()
    update.test.ts             # NEW — unit tests
  utils/
    sentinel-merge.ts          # PATCH — add endIdx === -1 guard (UPD-06)
    sentinel-merge.test.ts     # PATCH — add UPD-06 test case
  commands/
    init.ts                    # PATCH — call writeManifest after tasks()
    init.test.ts               # PATCH — assert writeManifest called
    upgrade.ts                 # PATCH — remove .alias('update')
  index.ts                     # PATCH — registerUpdateCommand(program)

packages/pip/src/goodvibes_cli/
  steps/
    write_manifest.py          # NEW — write_manifest() + read_manifest()
  commands/
    update_cmd.py              # NEW — update_cmd() Typer command
  commands/
    init_cmd.py                # PATCH — call write_manifest after copy_templates
    main.py                    # PATCH — app.command("update")(update_cmd)

packages/pip/tests/
  test_write_manifest.py       # NEW — unit tests
  test_update_cmd.py           # NEW — unit tests
  test_sentinel_merge.py       # already has malformed guard test — no change needed
  test_init_cmd.py             # PATCH — assert write_manifest called
```

### Pattern 1: Manifest Schema

**What:** Minimal JSON with version string and files dict (relative paths → SHA-256 hex).
**When to use:** Written by `writeManifest` after any successful init run. Read by `readManifest` at the start of `goodvibes update`.

```typescript
// Source: [VERIFIED: codebase — project conventions]
// packages/npm/src/steps/write-manifest.ts

import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

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

```python
# Source: [VERIFIED: codebase — project conventions]
# packages/pip/src/goodvibes_cli/steps/write_manifest.py

from __future__ import annotations
import hashlib
import json
import pathlib

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

**Note:** Hash `dest` file content (after sentinel merge), NOT the template source. CLAUDE.md is transformed by `mergeClaude` so the template SHA ≠ the written SHA.

**Note:** `written_files` comes from `copyTemplates`'s return value. It does NOT include `.goodvibes.json` itself — the manifest is meta, not a managed template.

### Pattern 2: File Categorisation

```typescript
// Source: [ASSUMED — derived from requirements UPD-02]
// packages/npm/src/commands/update.ts

type Category = { overwrite: string[]; skip: string[]; netNew: string[] }

async function categorise(
  templateDir: string,
  destDir: string,
  manifest: Manifest,
): Promise<Category> {
  const allTemplateFiles = await listTemplateFiles(templateDir)
  const overwrite: string[] = []
  const skip: string[] = []
  const netNew: string[] = []

  for (const rel of allTemplateFiles) {
    if (rel === '.goodvibes.json') continue  // skip the manifest itself

    const manifestSha = manifest.files[rel]
    const destPath = join(destDir, rel)
    const destExists = existsSync(destPath)

    if (!manifestSha) {
      // Not in manifest → net-new template file
      netNew.push(rel)
      continue
    }
    if (!destExists) {
      // Was managed but dest is gone → treat as overwrite (re-create)
      overwrite.push(rel)
      continue
    }
    const destContent = await readFile(destPath, 'utf-8')
    const destSha = createHash('sha256').update(destContent, 'utf8').digest('hex')
    if (destSha === manifestSha) {
      overwrite.push(rel)  // user hasn't touched it
    } else {
      skip.push(rel)  // user has modified it
    }
  }
  return { overwrite, skip, netNew }
}
```

### Pattern 3: UPD-06 Sentinel Guard Fix (TypeScript only)

The Python fix is already in place. The TypeScript `sentinel-merge.ts` needs one guard:

```typescript
// Source: [VERIFIED: codebase — sentinel-merge.ts line 49]
// ADD this block after: const endIdx = existing.indexOf(SENTINEL_END)

const endIdx = existing.indexOf(SENTINEL_END)
if (endIdx === -1) {
  // Malformed: start present but end absent — treat as Case B (append, no data-loss)
  await writeFile(destPath, existing.slice(0, startIdx).trimEnd() + '\n\n' + templateBlock + '\n')
  return
}
```

Without this guard: `after = existing.slice(-1 + 24)` = `existing.slice(23)` — the entire file (minus the first 23 chars) is appended after the new sentinel block, corrupting the output.

### Pattern 4: Confirmation Prompt (TypeScript)

```typescript
// Source: [VERIFIED: @clack/prompts installed build — confirm and isCancel confirmed]
import { confirm, isCancel, cancel } from '@clack/prompts'

const proceed = await confirm({ message: `Overwrite ${overwriteCount} file(s)?` })
if (isCancel(proceed) || !proceed) {
  cancel('Update cancelled.')
  process.exit(0)
}
```

### Pattern 5: Manifest Integration in init.ts

The manifest write is a post-task step, not a task in the task list, because:
- The task list's `createdFiles` is populated during the tasks() call
- Manifest needs the final written list after all tasks complete

```typescript
// Source: [VERIFIED: codebase — init.ts lines 83-141]
// After: await tasks(taskList) — add:
const { createRequire } = await import('node:module')
const _req = createRequire(import.meta.url)
const _ver = (_req('../../package.json') as { version: string }).version
await writeManifest(cwd, createdFiles.filter(f => f !== '.goodvibes.json'), _ver)
```

In Python, after the `with console.status("Copying template files")` block, add:
```python
from goodvibes_cli.steps.write_manifest import write_manifest
import importlib.metadata
_version = importlib.metadata.version("goodvibes-cli")
write_manifest(cwd, [f for f in created_files if f != ".goodvibes.json"], _version)
```

### Pattern 6: Pre-v1.2.0 No-Manifest Message (UPD-05)

```typescript
// packages/npm/src/commands/update.ts
const manifest = await readManifest(cwd)
if (!manifest) {
  note(
    "No .goodvibes.json found. This project was initialised before v1.2.0.\n" +
    "Run 'goodvibes init' once to create the manifest, then use 'goodvibes update' to keep files current.",
    "No manifest"
  )
  outro('Nothing updated.')
  return
}
```

### Pattern 7: Wiring — remove update alias from upgrade, add new update command

**TypeScript** — `upgrade.ts` currently has `.alias('update')`. Remove it:
```typescript
// upgrade.ts — BEFORE:
program.command('upgrade').alias('update').description(...)
// AFTER:
program.command('upgrade').description(...)
```
**index.ts** — add:
```typescript
import { registerUpdateCommand } from './commands/update.js'
// ...
registerUpdateCommand(program)
```

**Python** — `main.py` — BEFORE: `app.command("update")(upgrade_cmd)`. AFTER:
```python
from goodvibes_cli.commands.update_cmd import update_cmd
app.command("update")(update_cmd)
```

### Anti-Patterns to Avoid

- **Hashing template content instead of dest content:** CLAUDE.md is transformed by `mergeClaude`; hash what's actually written to dest, not the template source. If you hash the template source for CLAUDE.md, the hash will mismatch on every re-run (because the dest is the merged result, not the template verbatim).
- **Including `.goodvibes.json` in the manifest's own file list:** The manifest is meta-data, not a managed template file. Skip it when writing hashes.
- **Adding manifest writing inside `copyTemplates`:** `copyTemplates` is a pure file-copy step. Manifest writing is a policy layer above it, and belongs in the init handler. Mixing them breaks the single-responsibility of the copy step.
- **Writing the manifest before `copyTemplates` returns:** The manifest must reflect what was actually written; compute hashes from the final dest files, not pre-flight assumptions.
- **Bypassing `mergeClaude` for CLAUDE.md during update:** Even in the update command's "apply" step, CLAUDE.md must go through `mergeClaude`. Never directly overwrite CLAUDE.md with template content.
- **Calling `process.exit(1)` or `raise typer.Exit(1)` on no-manifest:** UPD-05 requires exit 0 with a clear message, not a failure exit.
- **Walking the entire project directory in update:** The spec says "only managed template files, never walk project directory." Update operates only on files known to the template set.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA-256 hashing | Custom hash function | `node:crypto.createHash('sha256')` / `hashlib.sha256` | Stdlib, tested, zero dependency |
| Confirmation prompt | Custom readline loop | `confirm()` from `@clack/prompts` / `typer.confirm()` | Already installed, handles TTY/non-TTY, cancellation |
| JSON manifest serialization | Custom format | `JSON.stringify(manifest, null, 2)` / `json.dumps(..., indent=2)` | Stdlib, pretty-printed, parseable by any tool |
| File walk for hashing | New walk function | Reuse `listTemplateFiles()` (already in copy-templates.ts / copy_templates.py) | Avoids a second walk implementation |
| Version detection in manifest writer | New version lookup | Reuse `createRequire` / `importlib.metadata.version` pattern from existing upgrade.ts / upgrade_cmd.py | Same pattern, already tested |

**Key insight:** This phase is pure application of existing patterns. Every primitive (hash, prompt, JSON, walk) is already available in stdlib or the installed dependencies.

---

## Common Pitfalls

### Pitfall 1: Hashing template content for CLAUDE.md instead of dest content

**What goes wrong:** The SHA in the manifest does not match the SHA of the actual dest file. On the next `goodvibes update`, every project with a custom CLAUDE.md is falsely flagged as "user-modified" and skipped.

**Why it happens:** The developer hashes `templateDir/CLAUDE.md` for speed, not knowing that `mergeClaude` transforms the content before writing it to dest.

**How to avoid:** Always read `join(destDir, rel)` for hashing, after `copyTemplates` (and `mergeClaude`) have run. Never hash the source template file for manifest purposes.

**Warning signs:** Integration test shows SHA mismatch for CLAUDE.md even when user never touched it.

### Pitfall 2: TypeScript `endIdx === -1` silent data corruption (UPD-06)

**What goes wrong:** `sentinel-merge.ts` produces a corrupted CLAUDE.md when the file contains `<!-- goodvibes:start -->` but no `<!-- goodvibes:end -->`. The `after` variable becomes `existing.slice(23)`, which is almost the entire file, duplicated after the new sentinel block.

**Why it happens:** The existing TypeScript code does not check if `endIdx === -1` before using it in slice operations. Python added this guard; TypeScript was never updated.

**How to avoid:** Add the `endIdx === -1` guard immediately after `const endIdx = existing.indexOf(SENTINEL_END)`. See Pattern 3 above.

**Warning signs:** Unit test `it('SENTINEL_START without SENTINEL_END does not corrupt file')` fails in TypeScript; test is already present and passing in Python.

### Pitfall 3: `update` alias left on `upgrade` command after new `update` command is registered

**What goes wrong:** Commander.js / Typer registers two commands named `update`. Behaviour is undefined — one silently shadows the other depending on registration order.

**Why it happens:** Forgetting to remove `.alias('update')` from `registerUpgradeCommand` when adding the new `registerUpdateCommand`.

**How to avoid:** In `upgrade.ts`, change `.command('upgrade').alias('update')` to `.command('upgrade')`. In `main.py`, change `app.command("update")(upgrade_cmd)` to `app.command("update")(update_cmd)`.

**Warning signs:** `goodvibes update --help` shows upgrade description, not update description. Test: `it('update command has --force flag')` would fail.

### Pitfall 4: Manifest missing files because init was run with `--minimal`

**What goes wrong:** The manifest records only non-.github/docs files when init is run with `--minimal`. On `goodvibes update` (full run), files that were never in the manifest get flagged as "net-new" even though they exist at dest (user put them there). This is actually correct behaviour — but it must be documented for the planner.

**Why it happens:** `--minimal` filters out `.github/` and `docs/` from the written list. The manifest correctly reflects what init actually wrote.

**How to avoid:** No code change needed; this is correct semantics. Document in the update command's UPD-05 note that re-running `goodvibes init` (not `--minimal`) will expand the manifest.

### Pitfall 5: `writeManifest` called before `copyTemplates` returns the final written list

**What goes wrong:** Manifest hashes files before sentinel merge runs, or before the CI variant rename happens. SHA mismatches result.

**Why it happens:** Calling `writeManifest` inside the tasks() task instead of after `await tasks(taskList)`.

**How to avoid:** Call `writeManifest(cwd, createdFiles, version)` AFTER the `await tasks(taskList)` line in `init.ts`/`init_cmd.py`, not inside a task.

---

## Code Examples

### SHA-256 of a destination file (TypeScript)

```typescript
// Source: node:crypto stdlib — [VERIFIED: node --version v22.23.1]
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

async function fileSha256(path: string): Promise<string> {
  const content = await readFile(path, 'utf-8')
  return createHash('sha256').update(content, 'utf8').digest('hex')
}
```

### SHA-256 of a destination file (Python)

```python
# Source: hashlib stdlib — [VERIFIED: Python 3.12.3]
import hashlib

def file_sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()
```

Note: Use `read_bytes()` not `read_text()` in Python to avoid encoding round-trip differences. The hash should be computed from the raw bytes. In Node.js, `'utf-8'` encoding + string update also works because the file was written as utf-8.

### Vitest mock pattern for new write-manifest module

```typescript
// Source: [VERIFIED: codebase — init.test.ts pattern]
vi.mock('../steps/write-manifest.js', () => ({
  writeManifest: vi.fn().mockResolvedValue(undefined),
  readManifest: vi.fn().mockResolvedValue(null),
}))
```

### pytest mock pattern for new write_manifest module (Python)

```python
# Source: [VERIFIED: codebase — test_init_cmd.py mocker pattern]
def test_init_calls_write_manifest(mocker, tmp_dir):
    mocker.patch("goodvibes_cli.commands.init_cmd.copy_templates", return_value=(["CLAUDE.md"], []))
    mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom", return_value={"status": "skipped", "reason": ""})
    mocker.patch("goodvibes_cli.commands.init_cmd.configure_mcp", return_value={"status": "skipped", "reason": ""})
    mocker.patch("goodvibes_cli.commands.init_cmd.start_telemetry_thread", return_value=None)
    mock_wm = mocker.patch("goodvibes_cli.commands.init_cmd.write_manifest")
    result = runner.invoke(app, ["init", "--minimal"])
    assert result.exit_code == 0
    assert mock_wm.call_count == 1
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `upgrade` uses string equality (template == dest) to detect changes | `update` uses SHA-256 manifest to distinguish managed-unchanged vs user-modified | User edits no longer silently overwritten on update |
| `update` is an alias for `upgrade` (content-equality based) | `update` is a manifest-based command with --dry-run, --force, three categories | Three-category output is beginner-comprehensible |
| Sentinel guard missing in TypeScript for SENTINEL_START without SENTINEL_END | Guard added (same as Python) | Prevents CLAUDE.md data-loss edge case |

**Deprecated/outdated:**
- The `update` alias on the `upgrade` command: replaced by a dedicated manifest-based `update` command in Phase 14.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Hashing files as utf-8 strings in Node.js (vs raw bytes) produces consistent results for all goodvibes template files (which are all text) | Code Examples | If any template becomes binary, sha256 comparison could fail; switch to `readFile` as Buffer if needed |
| A2 | The `written` list from `copyTemplates` does not include `.goodvibes.json` (it didn't exist before init ran) | Pattern 1 | If `.goodvibes.json` somehow ends up in `written`, the manifest would try to hash itself at write time (file doesn't exist yet) — harmless but confusing; the filter guard handles this |
| A3 | `goodvibes update` should exit 0 (not 1) when no manifest exists (UPD-05 says "clear message … exits without crashing") | Pattern 6 | If the intent is exit 1, the error message framing would need to change |
| A4 | The manifest should be updated after a successful `goodvibes update` run (reflecting new template hashes) | Architecture Diagram | If not updated, subsequent `update` runs would still compare against original-init hashes; files updated by `update` would appear as "user-modified" on the next run |

---

## Open Questions

1. **Should `--minimal` init produce a partial manifest?**
   - What we know: `--minimal` skips `.github/` and `docs/`; `copyTemplates` returns only the written files
   - What's unclear: If the user later runs `goodvibes update` (full), net-new files include all `.github/` and `docs/` files — is that the intended UX?
   - Recommendation: Yes, this is correct. The manifest faithfully records what init wrote; update adds what's new. No code change needed, but a note in the outro would help beginners.

2. **Does `goodvibes update` need to update CLAUDE.md's sentinel block?**
   - What we know: `mergeClaude` in Case C replaces the sentinel block if the template version is newer; Case D skips if already up-to-date
   - What's unclear: `goodvibes update` applies template content to "overwrite" files. For CLAUDE.md, should it call `mergeClaude` (sentinel merge) or direct overwrite?
   - Recommendation: Always `mergeClaude` for CLAUDE.md — never direct overwrite. This is the established pattern in `upgradeTemplates` (upgrade.ts line 127 and upgrade_cmd.py line 165). The update command must preserve user content outside the sentinel block.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥ 20 | `node:crypto`, `node:fs/promises` | Yes | v22.23.1 | — |
| Python ≥ 3.10 | `hashlib`, `json`, `pathlib` | Yes | 3.12.3 | — |
| `@clack/prompts` `confirm` | UPD-04 TS confirmation | Yes (verified) | 1.7.0 | — |
| `typer.confirm` | UPD-04 Python confirmation | Yes (built-in to typer ≥ 0.15) | per pyproject.toml | — |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (npm) | vitest 4.1.10 |
| Config file (npm) | `packages/npm/vitest.config.ts` |
| Quick run (npm) | `cd packages/npm && npm test` |
| Framework (pip) | pytest + pytest-mock |
| Quick run (pip) | `cd packages/pip && uv run pytest tests/` |
| Baseline | 132 npm tests passing, 139 pip tests passing (verified 2026-07-27) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | File | Command |
|--------|----------|-----------|------|---------|
| UPD-01 | init writes .goodvibes.json with sha256 per file | unit | `write-manifest.test.ts` / `test_write_manifest.py` | `npm test` / `uv run pytest tests/test_write_manifest.py` |
| UPD-01 | init.ts calls writeManifest after copyTemplates | unit | `init.test.ts` / `test_init_cmd.py` (patch) | same |
| UPD-02 | update categorises managed/user-modified/net-new | unit | `update.test.ts` / `test_update_cmd.py` | same |
| UPD-03 | --dry-run prints 3 categories, no disk writes | unit | `update.test.ts` / `test_update_cmd.py` | same |
| UPD-04 | confirm prompt shown; --force skips it | unit | `update.test.ts` / `test_update_cmd.py` | same |
| UPD-05 | no manifest → clear message, exit 0 | unit | `update.test.ts` / `test_update_cmd.py` | same |
| UPD-06 | SENTINEL_START without SENTINEL_END → no data-loss | unit | `sentinel-merge.test.ts` (add case) | `npm test` |
| UPD-06 | Python sentinel guard already tested | unit (existing) | `test_sentinel_merge.py` line 127 | `uv run pytest tests/test_sentinel_merge.py` |

### Sampling Rate

- **Per task commit:** `cd packages/npm && npm test` + `cd packages/pip && uv run pytest tests/`
- **Per wave merge:** Full suite on both packages
- **Phase gate:** Both full suites green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/npm/src/steps/write-manifest.test.ts` — covers UPD-01 (manifest write + read)
- [ ] `packages/npm/src/commands/update.test.ts` — covers UPD-02, UPD-03, UPD-04, UPD-05
- [ ] `packages/pip/tests/test_write_manifest.py` — covers UPD-01 (Python parity)
- [ ] `packages/pip/tests/test_update_cmd.py` — covers UPD-02 through UPD-05 (Python parity)
- [ ] Add UPD-06 test case to `packages/npm/src/utils/sentinel-merge.test.ts` (Python test exists at line 127)

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` (per config.json).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes (partial) | Manifest JSON parsed with `JSON.parse` / `json.loads`; malformed manifest returns null — no crash |
| V6 Cryptography | No (SHA-256 is for file integrity, not security-grade auth) | stdlib `createHash` / `hashlib.sha256` — never hand-rolled |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in manifest file keys | Tampering | Validate that `rel` keys do not contain `..` — existing `copyTemplates` path traversal guard already filters this on write; on read, `join(destDir, rel)` is safe if `rel` has no `..` components |
| Malformed JSON in .goodvibes.json | Denial of Service | `readManifest` wraps `JSON.parse` in try/catch, returns null on any error — triggers UPD-05 message gracefully |
| Manifest injection via crafted .goodvibes.json | Tampering | Manifest is only read from `destDir` (the project root). No remote fetch. No schema elevation. |

The manifest does not contain secrets and is not used for authentication — no additional ASVS controls apply.

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: codebase] `packages/npm/src/utils/sentinel-merge.ts` — sentinel bug at line 49–50 confirmed by direct inspection
- [VERIFIED: codebase] `packages/pip/src/goodvibes_cli/utils/sentinel_merge.py` lines 65–68 — Python guard confirmed
- [VERIFIED: codebase] `packages/pip/tests/test_sentinel_merge.py` line 127–138 — Python malformed guard test confirmed
- [VERIFIED: codebase] `packages/npm/src/steps/copy-templates.ts` — `written` return type and CLAUDE.md sentinel route confirmed
- [VERIFIED: codebase] `packages/npm/src/commands/upgrade.ts` — `.alias('update')` at line 140 confirmed; must be removed
- [VERIFIED: codebase] `packages/pip/src/goodvibes_cli/main.py` — `app.command("update")(upgrade_cmd)` at line 28 confirmed; must be changed
- [VERIFIED: node runtime] `@clack/prompts` v1.7.0 exports `confirm` (function) and `isCancel` (function) — verified via `node -e` import
- [VERIFIED: node runtime] `node:crypto` `createHash('sha256')` produces 64-char hex digest — verified at runtime
- [VERIFIED: python runtime] `hashlib.sha256` produces 64-char hex digest — verified at runtime (Python 3.12.3)
- [VERIFIED: codebase] `packages/npm/package.json` — `commander: ^15`, `@clack/prompts: ^1`, no new deps needed
- [VERIFIED: codebase] `packages/pip/pyproject.toml` — `typer>=0.15`, `rich>=14`, no new deps needed

### Secondary (MEDIUM confidence)

- [ASSUMED] `typer.confirm()` is the idiomatic Python prompt for this pattern (vs. `rich.Confirm.ask()`) — both work; typer is already the CLI framework
- [ASSUMED] Manifest should be updated after a successful `goodvibes update` run — not stated in requirements but logically necessary for subsequent update runs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in installed packages or stdlib
- Architecture: HIGH — directly derived from existing code patterns in the codebase
- Pitfalls: HIGH — TypeScript sentinel bug verified by direct code inspection; other pitfalls derived from code analysis

**Research date:** 2026-07-27
**Valid until:** 2026-08-27 (stable, no external API dependencies)
