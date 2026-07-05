# Phase 12: Headroom Status Surfacing - Pattern Map

**Mapped:** 2026-07-03
**Files analyzed:** 16 (all MODIFY, zero new files)
**Analogs found:** 16 / 16 — all files are their own analog (in-place refactors)

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `packages/npm/src/steps/install-headroom.ts` | step/service | request-response | `packages/npm/src/steps/copy-templates.ts` (lines 55–141) | role-match — both are steps returning typed results |
| `packages/npm/src/steps/configure-mcp.ts` | step/service | request-response | `packages/npm/src/steps/install-headroom.ts` | exact — same soft-fail subprocess chain pattern |
| `packages/npm/src/commands/init.ts` | command/controller | request-response | `packages/npm/src/commands/doctor.ts` | role-match — both are command orchestrators consuming step results |
| `packages/npm/src/commands/doctor.ts` | command/controller | request-response | self (probe call site swap) | self-analog |
| `packages/npm/src/steps/install-headroom.test.ts` | test | — | `packages/npm/src/steps/configure-mcp.test.ts` | exact — same vitest mock pattern |
| `packages/npm/src/steps/configure-mcp.test.ts` | test | — | `packages/npm/src/steps/install-headroom.test.ts` | exact |
| `packages/npm/src/commands/init.test.ts` | test | — | `packages/npm/src/commands/doctor.test.ts` | role-match |
| `packages/npm/src/commands/doctor.test.ts` | test | — | self (probe call assertion swap) | self-analog |
| `packages/pip/src/goodvibes_cli/steps/install_headroom.py` | step/service | request-response | `packages/pip/src/goodvibes_cli/steps/configure_mcp.py` | exact |
| `packages/pip/src/goodvibes_cli/steps/configure_mcp.py` | step/service | request-response | `packages/pip/src/goodvibes_cli/steps/install_headroom.py` | exact |
| `packages/pip/src/goodvibes_cli/commands/init_cmd.py` | command/controller | request-response | `packages/pip/src/goodvibes_cli/commands/doctor_cmd.py` | role-match |
| `packages/pip/src/goodvibes_cli/commands/doctor_cmd.py` | command/controller | request-response | self (probe swap + label) | self-analog |
| `packages/pip/tests/test_install_headroom.py` | test | — | `packages/pip/tests/test_configure_mcp.py` | exact |
| `packages/pip/tests/test_configure_mcp.py` | test | — | `packages/pip/tests/test_install_headroom.py` | exact |
| `packages/pip/tests/test_init_cmd.py` | test | — | self (mock return type update) | self-analog |
| `packages/pip/tests/test_doctor_cmd.py` | test | — | self (probe mock swap) | self-analog |

---

## Pattern Assignments

### `packages/npm/src/steps/install-headroom.ts` (step, request-response)

**Change:** `Promise<void>` → `Promise<HeadroomResult>`; probe `--version` → `compress --help`; add `{ timeout: 10_000 }` to all execa calls.

**Analog for return type:** `packages/npm/src/steps/copy-templates.ts` lines 55–61 — the only existing TS step that returns a typed result object:

```typescript
// copy-templates.ts lines 55–61: existing typed result pattern
export async function copyTemplates(
  templateDir: string,
  destDir: string,
  dryRun: boolean,
  minimal: boolean,
  projectType: string,
): Promise<{ written: string[]; skipped: string[] }> {
```

**Current return type (line 16) — to be replaced:**

```typescript
// install-headroom.ts line 16: current void return
export async function installHeadroom(log: (msg: string) => void): Promise<void> {
```

**New discriminated union type — add above function:**

```typescript
export type HeadroomResult =
  | { status: 'installed' }
  | { status: 'already-installed' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

export async function installHeadroom(log: (msg: string) => void): Promise<HeadroomResult> {
```

**Current idempotency probe (lines 27–37) — to be changed:**

```typescript
// install-headroom.ts lines 27–37: OLD probe using --version
try {
  await execa('headroom', ['--version'])
  log('headroom already installed — skipping')
  return           // ← becomes: return { status: 'already-installed' }
} catch (e: unknown) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
    log(`headroom probe failed: ${(e as Error).message?.split('\n')[0] ?? 'unknown'}`)
  }
}
```

**New probe (HDR2-03 + HDR2-04):**

```typescript
// NEW: functional probe with timeout
try {
  await execa('headroom', ['compress', '--help'], { timeout: 10_000 })
  log('headroom already installed — skipping')
  return { status: 'already-installed' }
} catch (e: unknown) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
    log(`headroom probe failed: ${(e as Error).message?.split('\n')[0] ?? 'unknown'}`)
  }
}
```

**Installer loop (lines 48–64) — add timeout + return values:**

```typescript
// install-headroom.ts lines 48–64: current loop — no timeout, bare return
for (const installer of installers) {
  try {
    await execa(installer.cmd, installer.args)   // ← add { timeout: 10_000 }
    return                                        // ← becomes: return { status: 'installed' }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      continue
    }
    const summary = (e as Error).message?.split('\n')[0] ?? 'unknown error'
    log(`headroom install failed: ${summary}`)
    log('You can install headroom manually later: uv tool install "headroom-ai[all]"')
    return                                        // ← becomes: return { status: 'failed', reason: summary }
  }
}
// bottom of function (line 67):
log('No package installer found (uv, pipx, pip). ...')
// add: return { status: 'failed', reason: 'No package installer found' }
```

**Python return null guard (line 19–22) — add return value:**

```typescript
// install-headroom.ts lines 17–22
if (pythonCmd === null) {
  log('Python 3.10+ not found — skipping headroom install. ...')
  return   // ← becomes: return { status: 'skipped', reason: 'Python 3.10+ not found' }
}
```

---

### `packages/npm/src/steps/configure-mcp.ts` (step, request-response)

**Change:** `Promise<void>` → `Promise<McpResult>`; add `{ timeout: 10_000 }` to all execa calls; convert `throw fallbackErr` (line 71) and `throw e` (line 75) to `return { status: 'failed' }`.

**New type — add above function:**

```typescript
export type McpResult =
  | { status: 'registered' }
  | { status: 'already-registered' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

export async function configureMcp(log: (msg: string) => void): Promise<McpResult> {
```

**Idempotency check (lines 25–32):**

```typescript
// configure-mcp.ts lines 25–32: already-registered path
try {
  await execa('headroom', ['mcp', 'status'])   // ← add { timeout: 10_000 }
  log('headroom MCP already configured — skipping')
  return   // ← becomes: return { status: 'already-registered' }
} catch {
  // not registered
}
```

**Headroom not on PATH inner catch (lines 46–52):**

```typescript
// configure-mcp.ts lines 46–52: skipped path
try {
  const pathResult = await execa(whichCmd, ['headroom'])   // ← add { timeout: 10_000 }
  absolutePath = pathResult.stdout.trim()
} catch {
  log('headroom binary not found on PATH — ...')
  return   // ← becomes: return { status: 'skipped', reason: 'headroom binary not found on PATH' }
}
```

**claude mcp add success (line 55–57):**

```typescript
await execa('claude', ['mcp', 'add', '-s', 'user', 'headroom', absolutePath])  // ← add { timeout: 10_000 }
log('headroom registered as global MCP server')
return   // ← becomes: return { status: 'registered' }
```

**CRITICAL: re-throw → soft-fail (lines 66–75) — the architectural fix:**

```typescript
// configure-mcp.ts lines 63–75: CURRENT (re-throws, violates "steps never throw")
try {
  await execa('headroom', ['mcp', 'install'])
  return
} catch (fallbackErr: unknown) {
  if ((fallbackErr as NodeJS.ErrnoException).code === 'ENOENT') {
    log('headroom binary not found — MCP registration skipped. ...')
    return
  }
  throw fallbackErr   // ← LINE 71: MUST become return { status: 'failed', reason: summary }
}
// ...
throw e   // ← LINE 75: MUST become return { status: 'failed', reason: summary }
```

**New soft-fail fallback:**

```typescript
// NEW: fallback — headroom mcp install
try {
  await execa('headroom', ['mcp', 'install'], { timeout: 10_000 })
  return { status: 'registered' }
} catch (fallbackErr: unknown) {
  if ((fallbackErr as NodeJS.ErrnoException).code === 'ENOENT') {
    log('headroom binary not found — MCP registration skipped. ...')
    return { status: 'skipped', reason: 'headroom binary not found' }
  }
  const summary = (fallbackErr as Error).message?.split('\n')[0] ?? 'unknown'
  log(`headroom mcp install failed: ${summary}`)
  return { status: 'failed', reason: summary }
}
```

**Non-ENOENT outer catch (line 75):**

```typescript
// after ENOENT branch in outer catch:
const summary = (e as Error).message?.split('\n')[0] ?? 'unknown'
log(`MCP registration failed: ${summary}`)
return { status: 'failed', reason: summary }
```

---

### `packages/npm/src/commands/init.ts` (command/controller, request-response)

**Change:** Capture results from `installHeadroom` and `configureMcp`; add label tables; add `note(formatHeadroomStatus(...), 'Headroom')` after tasks.

**Analog for result-capture pattern:** `packages/npm/src/steps/copy-templates.ts` call in `init.ts` lines 59–64 — existing pattern of capturing structured return from a step:

```typescript
// init.ts lines 59–64: existing pattern — capture structured step result
task: async (message) => {
  const { written, skipped } = await copyTemplates(templateDir, cwd, false, minimal, projectType)
  createdFiles.push(...written)
  skippedFiles.push(...skipped)
  return `Copied ${written.length} files`
},
```

**New imports to add (line 1 block):**

```typescript
import { installHeadroom, type HeadroomResult } from '../steps/install-headroom.js'
import { configureMcp, type McpResult } from '../steps/configure-mcp.js'
```

**Closure variables — add before taskList (after line 55):**

```typescript
let headroomResult: HeadroomResult | undefined
let mcpResult: McpResult | undefined
```

**Label tables — add inline before taskList (Ponytail: no separate file):**

```typescript
// ponytail: inline — too small to justify a separate module
const headroomLabels: Record<HeadroomResult['status'], string> = {
  'installed':         'headroom installed',
  'already-installed': 'headroom already installed',
  'skipped':           'headroom skipped (Python 3.10+ not found)',
  'failed':            'headroom install failed — see note below',
}
const mcpLabels: Record<McpResult['status'], string> = {
  'registered':         'MCP server registered',
  'already-registered': 'MCP server already configured',
  'skipped':            'MCP registration skipped',
  'failed':             'MCP registration failed — see note below',
}
```

**Existing headroom tasks (lines 69–85) — update task callbacks:**

```typescript
// init.ts lines 70–85: CURRENT (discards return values, hardcoded strings)
{
  title: 'Installing headroom',
  task: async (message) => {
    await installHeadroom((msg) => message(msg))
    return 'headroom ready'   // ← hardcoded
  },
},
{
  title: 'Configuring headroom MCP',
  task: async (message) => {
    await configureMcp((msg) => message(msg))
    return 'MCP server registered'   // ← hardcoded
  },
}
```

**New task callbacks:**

```typescript
{
  title: 'Installing headroom',
  task: async (message) => {
    headroomResult = await installHeadroom((msg) => message(msg))
    return headroomLabels[headroomResult.status]
  },
},
{
  title: 'Configuring headroom MCP',
  task: async (message) => {
    mcpResult = await configureMcp((msg) => message(msg))
    return mcpLabels[mcpResult.status]
  },
}
```

**`formatHeadroomStatus` helper — add inline in init.ts (after imports, before `registerInitCommand`):**

```typescript
// ponytail: inline helper — too small to justify a separate module
function formatHeadroomStatus(
  hr: HeadroomResult | undefined,
  mr: McpResult | undefined
): string {
  const lines: string[] = []
  if (hr) {
    const install = {
      'installed':         'headroom: installed',
      'already-installed': 'headroom: already installed',
      'skipped':           `headroom: skipped (${hr.status === 'skipped' ? hr.reason : ''})`,
      'failed':            `headroom: install failed (${hr.status === 'failed' ? hr.reason : ''})`,
    }[hr.status]
    lines.push(install)
  }
  if (mr) {
    const mcp = {
      'registered':         'MCP: registered',
      'already-registered': 'MCP: already configured',
      'skipped':            `MCP: skipped (${mr.status === 'skipped' ? mr.reason : ''})`,
      'failed':             `MCP: failed (${mr.status === 'failed' ? mr.reason : ''})`,
    }[mr.status]
    lines.push(mcp)
  }
  return lines.join('\n')
}
```

**After tasks(), before outro (lines 98–118) — add headroom note:**

```typescript
// init.ts lines 98–118: existing note calls pattern
note(createdFiles.join('\n') || '(none)', `Files written (${createdFiles.length})`)
if (skippedFiles.length > 0) {
  note(skippedFiles.join('\n'), `Files skipped (${skippedFiles.length})`)
}

// NEW: add headroom status note after file list notes
if (!minimal && headroomResult) {
  note(formatHeadroomStatus(headroomResult, mcpResult), 'Headroom')
}

// existing next-steps note continues...
const nextSteps = [...].join('\n')
note(nextSteps, 'Next steps')
```

---

### `packages/npm/src/commands/doctor.ts` (command/controller, request-response)

**Change:** `checkHeadroom()` — replace `execa('headroom', ['--version'])` with `execa('headroom', ['compress', '--help'], { timeout: 10_000 })`; update label to "headroom installed and working".

**Current `checkHeadroom` (lines 22–36) — to be changed:**

```typescript
// doctor.ts lines 22–36: CURRENT probe
async function checkHeadroom(): Promise<CheckResult> {
  try {
    await execa('headroom', ['--version'])   // ← OLD: PATH-only check
    return { label: 'headroom on PATH', pass: true }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        label: 'headroom on PATH',   // ← label stays same on fail (backwards compat)
        pass: false,
        remedy: 'Run: uv tool install "headroom-ai[all]"  (or re-run goodvibes init)',
      }
    }
    throw e
  }
}
```

**New `checkHeadroom` (HDR2-05):**

```typescript
async function checkHeadroom(): Promise<CheckResult> {
  try {
    await execa('headroom', ['compress', '--help'], { timeout: 10_000 })
    return { label: 'headroom installed and working', pass: true }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT'
        || (e as any).timedOut === true
        || (e as NodeJS.ErrnoException).code !== undefined) {
      return {
        label: 'headroom installed and working',
        pass: false,
        remedy: 'Run: uv tool install "headroom-ai[all]"  (or re-run goodvibes init)',
      }
    }
    throw e
  }
}
```

Note: the `timedOut` check handles execa v9's `error.timedOut` flag. Alternatively, catch all errors from the probe (ENOENT, CalledProcessError, timedOut) and soft-fail — the doctor's job is to report, not to propagate.

---

### `packages/npm/src/steps/install-headroom.test.ts` (test)

**Change:** Update idempotency probe assertion; update `resolves.toBeUndefined()` to result object assertions; add `{ timeout: 10_000 }` assertions.

**Pattern source:** existing vitest mock pattern in `configure-mcp.test.ts` lines 1–12 and `install-headroom.test.ts` lines 1–21.

**Mock preamble (unchanged — keep as-is):**

```typescript
// install-headroom.test.ts lines 1–21: existing vitest mock preamble
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('execa', () => ({
  execa: vi.fn(),
  ExecaError: class ExecaError extends Error { ... },
}))
vi.mock('../utils/detect-python.js', () => ({
  detectPython: vi.fn(),
}))
```

**Probe assertion (line 181) — to be updated:**

```typescript
// install-headroom.test.ts line 181: CURRENT assertion
expect(vi.mocked(execa)).toHaveBeenCalledWith('headroom', ['--version'])

// NEW assertion (HDR2-03 + HDR2-04):
expect(vi.mocked(execa)).toHaveBeenCalledWith(
  'headroom',
  ['compress', '--help'],
  expect.objectContaining({ timeout: 10_000 })
)
```

**Return value assertions — replace `resolves.toBeUndefined()` (lines 29, 137):**

```typescript
// install-headroom.test.ts line 29: CURRENT
await expect(installHeadroom(log)).resolves.toBeUndefined()

// NEW: for Python-absent path:
const result = await installHeadroom(log)
expect(result).toEqual({ status: 'skipped', reason: expect.stringContaining('Python 3.10+') })

// For all-ENOENT path (line 137):
const result = await installHeadroom(log)
expect(result).toEqual({ status: 'failed', reason: expect.any(String) })

// For already-installed path (line 174):
const result = await installHeadroom(log)
expect(result).toEqual({ status: 'already-installed' })

// For uv-succeeds path:
const result = await installHeadroom(log)
expect(result).toEqual({ status: 'installed' })
```

**Installer call assertion — add timeout to execa call shape assertions (e.g. line 51):**

```typescript
// CURRENT (line 51):
expect(vi.mocked(execa)).toHaveBeenCalledWith('uv', ['tool', 'install', 'headroom-ai[all]'])

// NEW:
expect(vi.mocked(execa)).toHaveBeenCalledWith(
  'uv',
  ['tool', 'install', 'headroom-ai[all]'],
  expect.objectContaining({ timeout: 10_000 })
)
```

---

### `packages/npm/src/steps/configure-mcp.test.ts` (test)

**Change:** Add return value assertions for each path; add `{ timeout: 10_000 }` to execa call shape assertions; convert existing bare `return` expectations to result checks.

**Pattern:** Same vitest mock pattern as `install-headroom.test.ts`. Tests that assert log messages stay the same. New assertions follow this pattern:

```typescript
// After each configureMcp(log) call, add:
const result = await configureMcp(log)
expect(result).toEqual({ status: 'already-registered' })  // already registered paths
expect(result).toEqual({ status: 'registered' })           // success paths
expect(result).toEqual({ status: 'skipped', reason: expect.any(String) })  // skip paths
expect(result).toEqual({ status: 'failed', reason: expect.any(String) })   // fail paths
```

**Timeout shape assertions — same pattern as install-headroom.test.ts:**

```typescript
expect(mockedExeca).toHaveBeenCalledWith(
  'headroom',
  ['mcp', 'status'],
  expect.objectContaining({ timeout: 10_000 })
)
```

---

### `packages/npm/src/commands/init.test.ts` (test)

**Change:** `mockResolvedValue(undefined)` → result objects for `installHeadroom` and `configureMcp`; add Headroom `note()` assertion for normal run.

**Current mock pattern (lines 133–134) — to be updated:**

```typescript
// init.test.ts lines 133–134: CURRENT (type error after return type change)
vi.mocked(installHeadroom).mockResolvedValue(undefined)
vi.mocked(configureMcp).mockResolvedValue(undefined)
```

**New mock pattern (applies to ALL tests that mock installHeadroom/configureMcp):**

```typescript
// Every vi.mocked(installHeadroom).mockResolvedValue(undefined) becomes:
vi.mocked(installHeadroom).mockResolvedValue({ status: 'installed' })
vi.mocked(configureMcp).mockResolvedValue({ status: 'registered' })
```

**Locations:** Lines 133–134, 188–189, 219–220, 263–264, 303–304, 336–337 — every test in the file that sets up these mocks.

**New Headroom note assertion — add to normal run test (after line 178):**

```typescript
// After existing assertions in 'normal run' test:
const headroomNoteCall = noteCalls.find(c => String(c[1]).toLowerCase().includes('headroom'))
expect(headroomNoteCall).toBeDefined()
expect(String(headroomNoteCall![0])).toMatch(/headroom|MCP/i)
```

---

### `packages/npm/src/commands/doctor.test.ts` (test)

**Change:** Update headroom probe assertions from `['--version']` to `['compress', '--help']` with `{ timeout: 10_000 }`.

**Current probe mock sequence (lines 47–49):**

```typescript
// doctor.test.ts lines 47–49: CURRENT mock sequence assumes --version
vi.mocked(execa)
  .mockResolvedValueOnce({ stdout: '1.0.0' } as any)  // headroom --version
  .mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })) // git calls
```

**Updated sequence — same mock value, different what's being verified:**

```typescript
vi.mocked(execa)
  .mockResolvedValueOnce({ stdout: '' } as any)  // headroom compress --help → exit 0
  .mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })) // git calls
```

**Lines 103–106 (git test) and other tests** that also seed a headroom `--version` success mock:

```typescript
// doctor.test.ts line 104: CURRENT
.mockResolvedValueOnce({ stdout: '1.0.0' } as any) // headroom --version

// NEW (same mock value works — just documents intent):
.mockResolvedValueOnce({ stdout: '' } as any) // headroom compress --help → exit 0
```

The mock value `{ stdout: '1.0.0' }` still works after the change (execa result shape is the same), but updating to `{ stdout: '' }` is more accurate and documents the intent.

---

### `packages/pip/src/goodvibes_cli/steps/install_headroom.py` (step, request-response)

**Change:** Return `dict[str, str]` not `None`; replace `shutil.which("headroom")` probe with `subprocess.run(['headroom', 'compress', '--help'], ...)` try-except; add `timeout=10` to all subprocess calls; add `subprocess.TimeoutExpired` to all except clauses.

**Current return type (line 9):**

```python
def install_headroom(log: Callable[[str], None]) -> None:
```

**New return type:**

```python
def install_headroom(log: Callable[[str], None]) -> dict[str, str]:
```

**Current idempotency probe (lines 27–29) — to be replaced:**

```python
# install_headroom.py lines 27–29: CURRENT — PATH-only, misses broken installs
if shutil.which("headroom") is not None:
    log("headroom already installed — skipping")
    return
```

**New functional probe (HDR2-03):**

```python
# NEW: functional probe — catches broken installs where binary exists but fails
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

**Current installer loop (lines 43–53) — add timeout + return values:**

```python
# install_headroom.py lines 43–53: CURRENT — no timeout, bare return
for cmd_list in installers:
    try:
        subprocess.run(cmd_list, capture_output=True, text=True, check=True)
        return   # ← becomes: return {"status": "installed", "reason": ""}
    except FileNotFoundError:
        continue
    except subprocess.CalledProcessError as e:
        ...
        continue  # advance to next installer
```

**New installer loop:**

```python
for cmd_list in installers:
    try:
        subprocess.run(cmd_list, capture_output=True, text=True, check=True, timeout=10)
        return {"status": "installed", "reason": ""}
    except FileNotFoundError:
        continue
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        lines = (getattr(e, 'stderr', '') or "").splitlines()
        first_line = lines[0] if lines else "unknown error"
        log(f"{cmd_list[0]} install failed: {first_line} — trying next installer")
        continue
```

**Python-absent path (lines 17–22) — add return value:**

```python
if python_cmd is None:
    log("Python 3.10+ not found — ...")
    return {"status": "skipped", "reason": "Python 3.10+ not found"}
```

**Bottom of function (lines 55–58) — add return value:**

```python
log('headroom could not be installed. Run manually: uv tool install "headroom-ai[all]"')
return {"status": "failed", "reason": "all installers exhausted"}
```

**Import cleanup:** `shutil` can be removed if no longer used by `install_headroom.py` after the probe change. Verify `configure_mcp.py` still uses it before removing from there.

---

### `packages/pip/src/goodvibes_cli/steps/configure_mcp.py` (step, request-response)

**Change:** Return `dict[str, str]` not `None`; add `timeout=10` to all subprocess calls; add `subprocess.TimeoutExpired` to except clauses; return `{"status": "failed"}` instead of falling through silently on `claude mcp add` CalledProcessError.

**Current return type (line 7):**

```python
def configure_mcp(log: Callable[[str], None]) -> None:
```

**New return type:**

```python
def configure_mcp(log: Callable[[str], None]) -> dict[str, str]:
```

**Idempotency check (lines 18–28) — add timeout + return value:**

```python
try:
    subprocess.run(
        ["headroom", "mcp", "status"],
        capture_output=True, text=True, check=True, timeout=10
    )
    log("headroom MCP already configured — skipping")
    return {"status": "already-registered", "reason": ""}
except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
    pass
```

**mcp list check (lines 32–38) — add timeout:**

```python
list_result = subprocess.run(
    ["claude", "mcp", "list"],
    capture_output=True, text=True, check=True, timeout=10
)
if "headroom" in list_result.stdout:
    log("headroom already registered in claude MCP — skipping")
    return {"status": "already-registered", "reason": ""}
```

**PATH check (lines 42–48) — return value:**

```python
absolute_path = shutil.which("headroom")
if not absolute_path:
    log("headroom binary not found on PATH — ...")
    return {"status": "skipped", "reason": "headroom binary not found on PATH"}
```

**claude mcp add (lines 50–57) — add timeout + return value:**

```python
subprocess.run(
    ["claude", "mcp", "add", "-s", "user", "headroom", absolute_path],
    capture_output=True, text=True, check=True, timeout=10
)
log("headroom registered as global MCP server")
return {"status": "registered", "reason": ""}
```

**claude CalledProcessError handler (lines 65–69) — add return value:**

```python
except subprocess.CalledProcessError as e:
    lines = (e.stderr or "").splitlines()
    log(f"claude mcp add failed: {lines[0] if lines else 'unknown error'}")
    return {"status": "failed", "reason": lines[0] if lines else "unknown error"}
```

**Fallback headroom mcp install (lines 72–91) — add timeout + return values:**

```python
try:
    subprocess.run(
        ["headroom", "mcp", "install"],
        capture_output=True, text=True, check=True, timeout=10
    )
    return {"status": "registered", "reason": ""}
except FileNotFoundError:
    log("headroom binary not found — ...")
    return {"status": "skipped", "reason": "headroom binary not found"}
except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
    lines = (getattr(e, 'stderr', '') or "").splitlines()
    first_line = lines[0] if lines else "unknown error"
    log(f"headroom MCP install failed: {first_line}. ...")
    return {"status": "failed", "reason": first_line}
```

---

### `packages/pip/src/goodvibes_cli/commands/init_cmd.py` (command/controller, request-response)

**Change:** Capture return values from `install_headroom` and `configure_mcp`; add `console.print(Panel(..., title="Headroom"))` after step blocks.

**Analog:** existing `console.print(Panel(...))` calls in `init_cmd.py` lines 91–96 and the `doctor_cmd.py` Panel pattern.

**Initialize default results before conditional block (before line 70):**

```python
# ponytail: default to skipped — minimal path never enters the block
headroom_result: dict[str, str] = {"status": "skipped", "reason": ""}
mcp_result: dict[str, str] = {"status": "skipped", "reason": ""}
```

**Existing step calls (lines 71–82) — capture return values:**

```python
# init_cmd.py lines 71–82: CURRENT (discards return values)
if not minimal:
    with console.status("Installing headroom") as status:
        def log_install(msg: str) -> None:
            status.update(msg)
        install_headroom(log_install)   # ← return value discarded

    with console.status("Configuring headroom MCP") as status:
        def log_mcp(msg: str) -> None:
            status.update(msg)
        configure_mcp(log_mcp)   # ← return value discarded
```

**New step calls:**

```python
if not minimal:
    with console.status("Installing headroom") as status:
        def log_install(msg: str) -> None:
            status.update(msg)
        headroom_result = install_headroom(log_install)

    with console.status("Configuring headroom MCP") as status:
        def log_mcp(msg: str) -> None:
            status.update(msg)
        mcp_result = configure_mcp(log_mcp)
```

**`_format_headroom_status` helper — add inline in init_cmd.py (before `init_cmd` function):**

```python
# ponytail: inline helper — too small to justify a separate module
def _format_headroom_status(hr: dict[str, str], mr: dict[str, str]) -> str:
    install_labels = {
        "installed":         "headroom: installed",
        "already-installed": "headroom: already installed",
        "skipped":           f"headroom: skipped ({hr.get('reason', '')})",
        "failed":            f"headroom: install failed ({hr.get('reason', '')})",
    }
    mcp_labels = {
        "registered":         "MCP: registered",
        "already-registered": "MCP: already configured",
        "skipped":            f"MCP: skipped ({mr.get('reason', '')})",
        "failed":             f"MCP: failed ({mr.get('reason', '')})",
    }
    lines = [
        install_labels.get(hr.get("status", ""), f"headroom: {hr.get('status', 'unknown')}"),
        mcp_labels.get(mr.get("status", ""), f"MCP: {mr.get('status', 'unknown')}"),
    ]
    return "\n".join(lines)
```

**Add Headroom Panel after file list panels (after line 92, before Next steps Panel):**

```python
# init_cmd.py lines 91–96: existing Panel pattern
console.print(Panel(written_str, title=f"Files written ({len(created_files)})"))
if skipped_files_list:
    skipped_str = "\n".join(skipped_files_list)
    console.print(Panel(skipped_str, title=f"Files skipped ({len(skipped_files_list)})"))

# NEW: headroom status Panel (guard: minimal never sets headroom_result to non-skipped)
if not minimal:
    console.print(Panel(_format_headroom_status(headroom_result, mcp_result), title="Headroom"))

console.print(Panel(_NEXT_STEPS, title="Next steps"))
```

---

### `packages/pip/src/goodvibes_cli/commands/doctor_cmd.py` (command/controller, request-response)

**Change:** `_check_headroom()` — replace `shutil.which("headroom")` with `subprocess.run(['headroom', 'compress', '--help'], ...)` functional probe; update label to "headroom installed and working".

**Current `_check_headroom` (lines 35–41) — to be replaced:**

```python
# doctor_cmd.py lines 35–41: CURRENT — PATH-only
def _check_headroom() -> CheckResult:
    present = shutil.which("headroom") is not None
    return CheckResult(
        label="headroom on PATH",
        passed=present,
        remedy="" if present else 'Run: uv tool install "headroom-ai[all]"  (or re-run goodvibes init)',
    )
```

**New `_check_headroom` (HDR2-05):**

```python
def _check_headroom() -> CheckResult:
    try:
        subprocess.run(
            ["headroom", "compress", "--help"],
            capture_output=True, text=True, check=True, timeout=10
        )
        return CheckResult(label="headroom installed and working", passed=True)
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return CheckResult(
            label="headroom installed and working",
            passed=False,
            remedy='Run: uv tool install "headroom-ai[all]"  (or re-run goodvibes init)',
        )
```

**Import cleanup:** `shutil` can be removed from `doctor_cmd.py` if `_check_headroom` is the only user. Verify before removing.

---

### `packages/pip/tests/test_install_headroom.py` (test)

**Change:** Replace `shutil.which` idempotency mock with `subprocess.run` mock; add return value assertions to every test; add `timeout=10` to subprocess call assertions.

**Pattern source:** `test_configure_mcp.py` lines 10–26 — existing `subprocess.run` side_effect pattern.

**CRITICAL: mock target change for already-installed test (line 245):**

```python
# test_install_headroom.py line 245: CURRENT mock (will no longer intercept after probe change)
mocker.patch("goodvibes_cli.steps.install_headroom.shutil.which", return_value="/usr/local/bin/headroom")
run = mocker.patch("goodvibes_cli.steps.install_headroom.subprocess.run")

# NEW mock (subprocess.run exits 0 for compress --help → already installed):
def already_installed_side_effect(cmd_list, **kwargs):
    if cmd_list == ["headroom", "compress", "--help"]:
        return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")
    return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

run = mocker.patch(
    "goodvibes_cli.steps.install_headroom.subprocess.run",
    side_effect=already_installed_side_effect,
)
```

**Add return value assertion to every test (following `test_uv_found_and_succeeds` as model):**

```python
# After every install_headroom(log_calls.append) call, add:
result = install_headroom(log_calls.append)
assert result["status"] == "installed"     # for success paths
assert result["status"] == "already-installed"  # for idempotency path
assert result["status"] == "skipped"       # for Python-absent path
assert result["status"] == "failed"        # for all-exhausted path
```

**Timeout assertion — add to tests that check subprocess call args:**

```python
# test_uv_found_and_succeeds: after verifying call args
assert first_call_args == ["uv", "tool", "install", "headroom-ai[all]"]
# add:
first_call_kwargs = run.call_args_list[0][1]
assert first_call_kwargs.get("timeout") == 10
```

**`description_logged_before_idempotency_check` test (lines 257–289) — update to reflect no shutil.which:**

The test currently instruments `shutil.which`. After the probe change, `shutil.which` is gone from `install_headroom.py`. Update this test to instrument `subprocess.run` for the probe call instead:

```python
# NEW: track that description log appears before the first subprocess.run call
event_log: list[str] = []

def recording_run(cmd_list, **kwargs):
    event_log.append(f"subprocess:{cmd_list[0]}")
    return subprocess.CompletedProcess(args=cmd_list, returncode=0, stdout="", stderr="")

mocker.patch("goodvibes_cli.steps.install_headroom.subprocess.run", side_effect=recording_run)

def recording_log(msg: str) -> None:
    event_log.append(f"log:{msg}")

install_headroom(recording_log)

desc_idx = next((i for i, e in enumerate(event_log) if "headroom compresses" in e), None)
subprocess_idx = next((i for i, e in enumerate(event_log) if e.startswith("subprocess:")), None)
assert desc_idx < subprocess_idx
```

---

### `packages/pip/tests/test_configure_mcp.py` (test)

**Change:** Add return value assertions for each path; add `timeout=10` to subprocess call kwargs assertions.

**Existing pattern (lines 10–26) — preserve, add return assertions:**

```python
# test_configure_mcp.py: existing pattern — add result assertions after each call
result = configure_mcp(log_calls.append)

# per-test expected results:
# test_already_registered_via_mcp_status:
assert result == {"status": "already-registered", "reason": ""}

# test_already_in_claude_mcp_list:
assert result == {"status": "already-registered", "reason": ""}

# test_claude_mcp_add_primary:
assert result["status"] == "registered"

# test_headroom_not_on_path:
assert result["status"] == "skipped"

# test_claude_not_found_fallback (headroom mcp install succeeds):
assert result["status"] == "registered"

# test_headroom_enoent_in_fallback:
assert result["status"] == "skipped"

# test_headroom_mcp_install_called_process_error_soft_fails:
assert result["status"] == "failed"

# test_claude_mcp_add_called_process_error_soft_fails:
assert result["status"] == "failed"
```

---

### `packages/pip/tests/test_init_cmd.py` (test)

**Change:** Mocks for `install_headroom` and `configure_mcp` currently return `None` implicitly. After return type change, tests must return dict values; add assertion for Headroom Panel in normal run.

**Current mock calls (lines 25–26, 42–43, etc.) — all use bare `mocker.patch` with no return value:**

```python
# test_init_cmd.py lines 25–26: CURRENT
mocker.patch("goodvibes_cli.commands.init_cmd.install_headroom")
mocker.patch("goodvibes_cli.commands.init_cmd.configure_mcp")
```

**New mock calls — add `return_value`:**

```python
mocker.patch(
    "goodvibes_cli.commands.init_cmd.install_headroom",
    return_value={"status": "installed", "reason": ""}
)
mocker.patch(
    "goodvibes_cli.commands.init_cmd.configure_mcp",
    return_value={"status": "registered", "reason": ""}
)
```

**Apply to all four test functions in this file** (lines 25–26, 42–43, 57, 72 — verify all locations).

**Add Headroom Panel assertion for normal run test (none currently exists):**

```python
# New test or assertion in test_completion_shows_files_written_and_skipped_panels:
# (currently uses --minimal, which skips headroom)
# Add a new test for non-minimal run:

def test_normal_run_shows_headroom_panel(runner, app, mocker, tmp_path):
    mocker.patch("goodvibes_cli.commands.init_cmd.resolve_templates_dir", return_value=tmp_path)
    mocker.patch("goodvibes_cli.commands.init_cmd.detect_project_type", return_value="both")
    mocker.patch("goodvibes_cli.commands.init_cmd.copy_templates", return_value=(["CLAUDE.md"], []))
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.install_headroom",
        return_value={"status": "installed", "reason": ""}
    )
    mocker.patch(
        "goodvibes_cli.commands.init_cmd.configure_mcp",
        return_value={"status": "registered", "reason": ""}
    )
    mocker.patch("pathlib.Path.iterdir", return_value=iter([]))
    result = runner.invoke(app, [])
    assert result.exit_code == 0
    assert "Headroom" in result.output
    assert "headroom: installed" in result.output
    assert "MCP: registered" in result.output
```

---

### `packages/pip/tests/test_doctor_cmd.py` (test)

**Change:** Replace `shutil.which` mocks with `subprocess.run` mocks for headroom probe; update label assertion from "headroom on PATH" to "headroom installed and working".

**Current direct tests of `_check_headroom` (lines 25–35):**

```python
# test_doctor_cmd.py lines 25–35: CURRENT — mocks shutil.which
def test_check_headroom_returns_pass_when_headroom_on_path(mocker):
    mocker.patch("goodvibes_cli.commands.doctor_cmd.shutil.which", return_value="/usr/bin/headroom")
    result = _check_headroom()
    assert result.passed is True

def test_check_headroom_returns_fail_with_remedy_when_not_on_path(mocker):
    mocker.patch("goodvibes_cli.commands.doctor_cmd.shutil.which", return_value=None)
    result = _check_headroom()
    assert result.passed is False
    assert "uv tool install" in result.remedy
```

**New tests — mock subprocess.run instead:**

```python
def test_check_headroom_returns_pass_when_headroom_working(mocker):
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        return_value=subprocess.CompletedProcess(
            args=["headroom", "compress", "--help"], returncode=0, stdout="", stderr=""
        ),
    )
    result = _check_headroom()
    assert result.passed is True
    assert result.label == "headroom installed and working"

def test_check_headroom_returns_fail_when_headroom_not_found(mocker):
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        side_effect=FileNotFoundError("headroom not found"),
    )
    result = _check_headroom()
    assert result.passed is False
    assert "uv tool install" in result.remedy

def test_check_headroom_returns_fail_when_headroom_broken(mocker):
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        side_effect=subprocess.CalledProcessError(1, ["headroom", "compress", "--help"]),
    )
    result = _check_headroom()
    assert result.passed is False

def test_check_headroom_returns_fail_when_headroom_times_out(mocker):
    mocker.patch(
        "goodvibes_cli.commands.doctor_cmd.subprocess.run",
        side_effect=subprocess.TimeoutExpired(cmd=["headroom", "compress", "--help"], timeout=10),
    )
    result = _check_headroom()
    assert result.passed is False
```

**Update label assertion in `test_doctor_cmd_collects_all_failures_before_exiting` (line 114):**

```python
# CURRENT: assert "headroom" in result.output (line 114)
# Remains valid — but if label is being tested, update:
# OLD label: "headroom on PATH"
# NEW label: "headroom installed and working"
assert "headroom" in result.output  # still passes with new label
```

**Update `_check_headroom` mock return value in integration-style tests (lines 77, 89, 101):**

```python
# CURRENT (line 77):
mocker.patch("goodvibes_cli.commands.doctor_cmd._check_headroom",
             return_value=CheckResult(label="headroom on PATH", passed=False, remedy="..."))

# NEW label:
mocker.patch("goodvibes_cli.commands.doctor_cmd._check_headroom",
             return_value=CheckResult(label="headroom installed and working", passed=False, remedy="..."))
```

---

## Shared Patterns

### Subprocess Call Shape with Timeout

**Source:** `packages/npm/src/steps/install-headroom.ts` and `packages/pip/src/goodvibes_cli/steps/install_headroom.py`
**Apply to:** All execa/subprocess.run calls that invoke headroom, uv, pipx, pip, claude binaries

**TypeScript:**
```typescript
await execa('headroom', ['compress', '--help'], { timeout: 10_000 })
```

**Python:**
```python
subprocess.run(
    ["headroom", "compress", "--help"],
    capture_output=True, text=True, check=True, timeout=10
)
```

### TimeoutExpired Exception Handling (Python)

**Source:** Python stdlib
**Apply to:** All except clauses in `install_headroom.py` and `configure_mcp.py` and `doctor_cmd.py`

```python
# Before adding timeout=:
except subprocess.CalledProcessError as e: ...

# After adding timeout=10 to the call:
except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e: ...
```

### Soft-Fail Step Invariant

**Source:** `packages/npm/src/steps/install-headroom.ts` (existing pattern) and `packages/pip/src/goodvibes_cli/steps/install_headroom.py`
**Apply to:** Both step files, every catch/except block — steps never throw or raise on soft failures

```typescript
// TypeScript: all error paths return { status: 'failed', reason: summary }
// NEVER: throw e or throw fallbackErr
```

```python
# Python: all error paths return {"status": "failed", "reason": first_line}
# NEVER: raise
```

### Vitest Mock Pattern for ESM Steps

**Source:** `packages/npm/src/steps/install-headroom.test.ts` lines 1–21
**Apply to:** All TS test files that mock execa or step functions

```typescript
vi.mock('execa', () => ({
  execa: vi.fn(),
  ExecaError: class ExecaError extends Error {
    code: string
    constructor(message: string, code: string) { super(message); this.code = code }
  },
}))
// Use await import() inside each test for fresh module instances
const { execa } = await import('execa')
vi.mocked(execa).mockResolvedValueOnce(...)
```

### pytest-mock Target Path Convention

**Source:** `packages/pip/tests/test_install_headroom.py` throughout
**Apply to:** All Python test files

```python
# Pattern: always patch at the import boundary of the module under test, not the source module
mocker.patch("goodvibes_cli.steps.install_headroom.subprocess.run", ...)
mocker.patch("goodvibes_cli.commands.doctor_cmd.subprocess.run", ...)
# NOT: mocker.patch("subprocess.run", ...)
```

### Panel Output Pattern (Python CLI)

**Source:** `packages/pip/src/goodvibes_cli/commands/init_cmd.py` lines 91–96
**Apply to:** `init_cmd.py` new Headroom Panel

```python
# Existing Panel pattern — copy exactly for Headroom status Panel
console.print(Panel(content_string, title="Section Title"))
```

### clack `note()` Pattern (TypeScript CLI)

**Source:** `packages/npm/src/commands/init.ts` lines 98–116
**Apply to:** `init.ts` new Headroom note

```typescript
// Existing note() pattern — copy exactly for Headroom status note
note(contentString, 'Headroom')
```

---

## No Analog Found

None. Every file in this phase is a targeted in-place modification of an existing file. All pattern analogies are drawn from the existing codebase. RESEARCH.md code examples are the authoritative reference for exact new code shapes.

---

## Pitfall Reminder (for Planner)

| Pitfall | File | What to guard against |
|---------|------|-----------------------|
| Python probe still uses `shutil.which` | `install_headroom.py` | Must replace line 27–29 with subprocess.run call |
| Test mocks `shutil.which` for idempotency | `test_install_headroom.py` | Must replace `shutil.which` mock with `subprocess.run` side_effect |
| `throw fallbackErr` not converted | `configure-mcp.ts` line 71 | Must become `return { status: 'failed', reason: summary }` |
| `throw e` not converted | `configure-mcp.ts` line 75 | Must become `return { status: 'failed', reason: summary }` |
| `mockResolvedValue(undefined)` type error | `init.test.ts` lines 133–134 et al | Must become `mockResolvedValue({ status: 'installed' })` |
| `headroomResult` accessed when `minimal=true` | `init.ts` | Gate with `if (!minimal && headroomResult)` |
| `headroom_result` unbound when `minimal=True` | `init_cmd.py` | Initialize defaults before `if not minimal:` block |
| `subprocess.TimeoutExpired` not caught | Python steps | Add to all except tuples alongside `CalledProcessError` |

---

## Metadata

**Analog search scope:** `packages/npm/src/`, `packages/pip/src/`, `packages/pip/tests/`
**Files read directly:** 16 source files, 0 node_modules (execa types confirmed via RESEARCH.md)
**Pattern extraction date:** 2026-07-03
