# Phase 12: Headroom Status Surfacing - Research

**Researched:** 2026-07-03
**Domain:** TypeScript/Python subprocess return types and CLI UX surfacing
**Confidence:** HIGH — all findings from direct codebase reading; zero inference

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HDR2-01 | `goodvibes init` reports actual headroom install outcome (installed / already-installed / skipped / failed) in the init outro | Return-type change in `installHeadroom()` feeds into task callback label and post-task `note()` |
| HDR2-02 | `goodvibes init` reports MCP config outcome separately (written / already-configured / failed) | Return-type change in `configureMcp()` feeds into task callback label and post-task `note()` |
| HDR2-03 | Headroom probe uses `headroom compress --help` (not `--version`) to catch broken installs | Probe call sites in `install-headroom.ts` (1 call), `doctor.ts` (1 call), `install_headroom.py` (1 call via `shutil.which`), `doctor_cmd.py` (1 call via `shutil.which`) all require updating |
| HDR2-04 | All headroom subprocess calls have a hard 10-second timeout | execa v9 `{ timeout: 10_000 }` option; Python `subprocess.run(..., timeout=10)` |
| HDR2-05 | `goodvibes doctor` headroom check reflects real functional status (installed + working vs just on PATH) | `doctor.ts::checkHeadroom()` and `doctor_cmd.py::_check_headroom()` both use PATH-only checks; must change to functional probe |
</phase_requirements>

---

## Summary

Phase 12 is a return-type refactor with a probe change. Every outcome-determining call in `installHeadroom()` and `configureMcp()` already branches on every possible outcome — the branching logic is complete. The two step functions just return `void`, so `init.ts` and `init_cmd.py` throw away that information and display hardcoded strings.

The fix is mechanical: change return types from `void` to discriminated unions, capture the results in the calling code, and display them in the post-init outro. Separately, the headroom probe changes from `--version` (PATH check only) to `compress --help` (functional check), and every headroom subprocess call gains a 10-second timeout.

**Net new files: zero.** All changes are in-place modifications. Eight TypeScript files and eight Python files total.

**Primary recommendation:** Work in this order — (1) change return types in both step files, (2) update `init.ts`/`init_cmd.py` to consume results, (3) update `doctor.ts`/`doctor_cmd.py` for functional probe, (4) update all test files. Keep TS and Python in sync: every commit that changes a step function should also change its mirror.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Headroom outcome tracking | Steps layer (`install-headroom`, `configure-mcp`) | — | Outcome is determined inside the step; surfacing it means the step must own and return it |
| Headroom status display | Commands layer (`init.ts`, `init_cmd.py`) | — | Display/UX decisions belong in the command orchestrator, not the step |
| Functional probe | Steps layer (install) + Commands layer (doctor) | — | Install uses probe for idempotency; doctor uses probe for health-check |
| Timeout enforcement | Steps layer | — | Steps own all subprocess calls; timeout is a call-site option |

---

## Standard Stack

### No new packages

This phase uses only what is already installed:

| What | Mechanism | Status |
|------|-----------|--------|
| TypeScript subprocess timeout | `execa(cmd, args, { timeout: 10_000 })` | execa v9.6.1 installed [VERIFIED: npm package.json + types file] |
| Python subprocess timeout | `subprocess.run([...], timeout=10)` | Python stdlib; `TimeoutExpired` raised on expiry [VERIFIED: Python stdlib docs] |
| TypeScript discriminated union | Native TypeScript type system | Already in use across the codebase |
| Python return typing | `dict[str, str]` with `status` key | Simplest; no new import |

### Package Legitimacy Audit

No new packages are installed in this phase. Audit section not applicable.

---

## Architecture Patterns

### System Architecture Diagram

```
goodvibes init
    │
    ├── tasks()
    │     ├── copyTemplates()  → returns { written, skipped }  [unchanged]
    │     │
    │     ├── installHeadroom(log)  → returns HeadroomResult
    │     │     ├── 'installed'         (uv/pipx/pip succeeded)
    │     │     ├── 'already-installed' (probe: headroom compress --help exit 0)
    │     │     ├── 'skipped'           (Python 3.10+ absent)
    │     │     └── 'failed'            (all installers exhausted or CalledProcessError)
    │     │
    │     └── configureMcp(log)    → returns McpResult
    │           ├── 'registered'         (claude mcp add or headroom mcp install succeeded)
    │           ├── 'already-registered' (mcp status or mcp list showed headroom)
    │           ├── 'skipped'            (headroom binary not on PATH)
    │           └── 'failed'             (CalledProcessError not otherwise handled)
    │
    ├── note(files written)
    ├── note(formatHeadroomStatus(headroomResult, mcpResult), 'Headroom')  ← NEW
    └── outro("You're all set!")

goodvibes doctor
    │
    └── checkHeadroom()  ← CHANGE: subprocess probe instead of PATH-only check
          ├── pass: headroom compress --help exits 0 within 10s
          └── fail: ENOENT or CalledProcessError or TimeoutExpired
```

### Recommended Project Structure

No structural changes. All modified files are in their existing locations:

```
packages/npm/src/
  steps/
    install-headroom.ts       ← change return void→HeadroomResult; probe; timeout
    configure-mcp.ts          ← change return void→McpResult; timeout
  commands/
    init.ts                   ← capture results; emit headroom note
    doctor.ts                 ← functional probe in checkHeadroom()
  steps/
    install-headroom.test.ts  ← update assertions for result objects
    configure-mcp.test.ts     ← update assertions for result objects
  commands/
    init.test.ts              ← update mocks; add headroom note assertions
    doctor.test.ts            ← update probe assertion

packages/pip/src/goodvibes_cli/
  steps/
    install_headroom.py       ← change return None→dict; probe; timeout
    configure_mcp.py          ← change return None→dict; timeout
  commands/
    init_cmd.py               ← capture results; emit headroom panel
    doctor_cmd.py             ← functional probe in _check_headroom()
  tests/
    test_install_headroom.py  ← update assertions
    test_configure_mcp.py     ← update assertions
    test_init_cmd.py          ← update mocks; add headroom panel assertions
    test_doctor_cmd.py        ← update probe assertions
```

### Pattern 1: TypeScript Discriminated Union Return

**What:** Replace `Promise<void>` with a tagged union so callers can branch on outcome without re-probing.

**When to use:** Any step function that has multiple terminal outcomes the caller needs to distinguish.

```typescript
// Source: direct codebase derivation from existing branch structure in install-headroom.ts

export type HeadroomResult =
  | { status: 'installed' }
  | { status: 'already-installed' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

export async function installHeadroom(log: (msg: string) => void): Promise<HeadroomResult> {
  const pythonCmd = await detectPython()
  if (pythonCmd === null) {
    log('Python 3.10+ not found — skipping headroom install.')
    return { status: 'skipped', reason: 'Python 3.10+ not found' }
  }
  // ...
  try {
    await execa('headroom', ['compress', '--help'], { timeout: 10_000 })  // HDR2-03, HDR2-04
    log('headroom already installed — skipping')
    return { status: 'already-installed' }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      log(`headroom probe failed: ${(e as Error).message?.split('\n')[0] ?? 'unknown'}`)
    }
  }
  // installer loop — timeout applies to each installer call too
  for (const installer of installers) {
    try {
      await execa(installer.cmd, installer.args, { timeout: 10_000 })
      return { status: 'installed' }
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue
      const summary = (e as Error).message?.split('\n')[0] ?? 'unknown error'
      log(`headroom install failed: ${summary}`)
      return { status: 'failed', reason: summary }
    }
  }
  log('No package installer found (uv, pipx, pip).')
  return { status: 'failed', reason: 'No package installer found' }
}
```

### Pattern 2: TypeScript McpResult Union

```typescript
// Source: direct codebase derivation from existing branch structure in configure-mcp.ts

export type McpResult =
  | { status: 'registered' }
  | { status: 'already-registered' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

export async function configureMcp(log: (msg: string) => void): Promise<McpResult> {
  try {
    await execa('headroom', ['mcp', 'status'], { timeout: 10_000 })
    log('headroom MCP already configured — skipping')
    return { status: 'already-registered' }
  } catch { /* not registered yet */ }

  try {
    const list = await execa('claude', ['mcp', 'list'], { timeout: 10_000 })
    if (list.stdout.includes('headroom')) {
      log('headroom already registered in claude MCP — skipping')
      return { status: 'already-registered' }
    }
    const whichCmd = process.platform === 'win32' ? 'where' : 'which'
    let absolutePath: string
    try {
      const pathResult = await execa(whichCmd, ['headroom'], { timeout: 10_000 })
      absolutePath = pathResult.stdout.trim()
    } catch {
      log('headroom binary not found on PATH — MCP registration skipped.')
      return { status: 'skipped', reason: 'headroom binary not found on PATH' }
    }
    await execa('claude', ['mcp', 'add', '-s', 'user', 'headroom', absolutePath], { timeout: 10_000 })
    log('headroom registered as global MCP server')
    return { status: 'registered' }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      // claude CLI not on PATH — fall through to headroom mcp install fallback
      log('claude CLI not found — falling back to headroom mcp install')
    } else {
      // claude mcp add CalledProcessError — treat as failed
      const summary = (e as Error).message?.split('\n')[0] ?? 'unknown'
      log(`MCP registration failed: ${summary}`)
      return { status: 'failed', reason: summary }
    }
  }

  // Fallback: headroom mcp install
  try {
    await execa('headroom', ['mcp', 'install'], { timeout: 10_000 })
    return { status: 'registered' }
  } catch (fallbackErr: unknown) {
    if ((fallbackErr as NodeJS.ErrnoException).code === 'ENOENT') {
      log('headroom binary not found — MCP registration skipped.')
      return { status: 'skipped', reason: 'headroom binary not found' }
    }
    const summary = (fallbackErr as Error).message?.split('\n')[0] ?? 'unknown'
    log(`headroom mcp install failed: ${summary}`)
    return { status: 'failed', reason: summary }  // was: throw fallbackErr
  }
}
```

**Breaking change note:** The existing `configure-mcp.ts` re-throws on non-ENOENT `headroom mcp install` failure (line 74: `throw fallbackErr`). The refactor converts this to `return { status: 'failed' }`, making `configureMcp` a true soft-fail function matching the invariant that steps never throw on soft failures.

### Pattern 3: init.ts Task Result Capture

```typescript
// Source: direct codebase derivation from init.ts task list pattern

let headroomResult: HeadroomResult | undefined
let mcpResult: McpResult | undefined

// In task list (inside the !minimal block):
{
  title: 'Installing headroom',
  task: async (message) => {
    headroomResult = await installHeadroom((msg) => message(msg))
    return headroomLabels[headroomResult.status]  // human-friendly label for spinner
  },
},
{
  title: 'Configuring headroom MCP',
  task: async (message) => {
    mcpResult = await configureMcp((msg) => message(msg))
    return mcpLabels[mcpResult.status]
  },
}

// After tasks(), before outro():
if (!minimal && headroomResult) {
  note(formatHeadroomStatus(headroomResult, mcpResult), 'Headroom')
}
```

Label tables (inline in init.ts, not a new file):

```typescript
const headroomLabels: Record<HeadroomResult['status'], string> = {
  'installed': 'headroom installed',
  'already-installed': 'headroom already installed',
  'skipped': 'headroom skipped (Python 3.10+ not found)',
  'failed': 'headroom install failed — see note below',
}

const mcpLabels: Record<McpResult['status'], string> = {
  'registered': 'MCP server registered',
  'already-registered': 'MCP server already configured',
  'skipped': 'MCP registration skipped',
  'failed': 'MCP registration failed — see note below',
}
```

### Pattern 4: Python Return Type (dict)

The Ponytail rule favors the simplest correct structure. `dict[str, str]` with a `status` key matches the TS union discriminant without requiring a new import or class.

```python
# Source: direct codebase derivation from install_headroom.py

def install_headroom(log: Callable[[str], None]) -> dict[str, str]:
    python_cmd = detect_python()
    if python_cmd is None:
        log("Python 3.10+ not found — skipping headroom install.")
        return {"status": "skipped", "reason": "Python 3.10+ not found"}

    log("headroom compresses AI context to save tokens — ...")

    # HDR2-03: use compress --help not shutil.which
    try:
        subprocess.run(
            ["headroom", "compress", "--help"],
            capture_output=True, text=True, check=True, timeout=10
        )
        log("headroom already installed — skipping")
        return {"status": "already-installed", "reason": ""}
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        pass  # not installed or broken — proceed to installer loop

    log("Note: headroom will download its compression model on first use ...")

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

    log('headroom could not be installed. Run manually: uv tool install "headroom-ai[all]"')
    return {"status": "failed", "reason": "all installers exhausted"}
```

### Pattern 5: Python init_cmd.py Result Capture

The Python version uses `console.status()` context managers (not `tasks()`) — result capture is direct:

```python
headroom_result: dict[str, str] = {"status": "skipped", "reason": ""}
mcp_result: dict[str, str] = {"status": "skipped", "reason": ""}

if not minimal:
    with console.status("Installing headroom") as status:
        def log_install(msg: str) -> None:
            status.update(msg)
        headroom_result = install_headroom(log_install)

    with console.status("Configuring headroom MCP") as status:
        def log_mcp(msg: str) -> None:
            status.update(msg)
        mcp_result = configure_mcp(log_mcp)

# After panels:
if not minimal:
    console.print(Panel(_format_headroom_status(headroom_result, mcp_result), title="Headroom"))
```

### Pattern 6: Doctor Functional Probe (HDR2-05)

Both `doctor.ts::checkHeadroom()` and `doctor_cmd.py::_check_headroom()` currently use PATH-only checks. After the change, they use a functional probe.

**TS before:**
```typescript
await execa('headroom', ['--version'])
```

**TS after:**
```typescript
await execa('headroom', ['compress', '--help'], { timeout: 10_000 })
```

**Python before:**
```python
present = shutil.which("headroom") is not None
```

**Python after:**
```python
try:
    subprocess.run(
        ["headroom", "compress", "--help"],
        capture_output=True, text=True, check=True, timeout=10
    )
    passed = True
    label = 'headroom installed and working'
except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
    passed = False
    label = 'headroom on PATH'  # unchanged label for backwards compat
```

The doctor label changes from "headroom on PATH" to "headroom installed and working" to reflect the functional check (HDR2-05 specifically requires this distinction).

### Anti-Patterns to Avoid

- **Spinner label shows raw status string:** `return headroomResult.status` in the task callback shows `'skipped'` or `'failed'` directly — looks like an error to beginners. Use the label table (Pattern 3).
- **Re-probe in init.ts after tasks():** Running `headroom compress --help` again after the step already ran it. The return value avoids the double-probe.
- **Initializing headroomResult to undefined and checking after:** If `minimal=true`, the task block is never entered and `headroomResult` stays `undefined`. Guard the post-task note with `if (!minimal && headroomResult)`.
- **Python: `shutil.which` as functional probe:** `shutil.which("headroom")` returns the PATH location but does not execute the binary — a broken install that fails on actual invocation passes this check. Must use subprocess.
- **Python: not catching `subprocess.TimeoutExpired`:** After adding `timeout=10`, a hanging subprocess raises `TimeoutExpired` which is a `SubprocessError` subclass, not `CalledProcessError`. All subprocess except-blocks must add `subprocess.TimeoutExpired`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subprocess timeout | Custom `Promise.race` with `AbortController` | `execa(cmd, args, { timeout: N })` option | execa v9 native; `error.timedOut` flag; force-kills subprocess cleanly |
| Python subprocess timeout | `threading.Timer` + `Popen.kill()` | `subprocess.run(..., timeout=N)` | stdlib; `TimeoutExpired` exception; already the right abstraction |
| Outcome enum | Separate constants file | Inline TypeScript union type / Python dict literal | One file touched; Ponytail forbids new abstractions with one use |

**Key insight:** Both TypeScript and Python already have built-in timeout mechanisms in their subprocess abstractions. Adding `timeout: 10_000` (TS) or `timeout=10` (Python) to each call is a one-argument change.

---

## Common Pitfalls

### Pitfall 1: Python idempotency probe uses `shutil.which`, not subprocess

**What goes wrong:** The Python `install_headroom.py` idempotency probe is `shutil.which("headroom")`, not a subprocess call. Changing the TS probe to `compress --help` while leaving the Python probe as `shutil.which` means HDR2-03 is only partially implemented — the broken-install case is caught in TS but not Python.

**Why it happens:** The TS and Python implementations diverged at the idempotency step: TS calls `execa('headroom', ['--version'])` while Python calls `shutil.which`. The TS probe was easy to spot; the Python one is easy to miss.

**How to avoid:** After updating `install-headroom.ts` idempotency probe, explicitly update `install_headroom.py` to replace `shutil.which("headroom") is not None` with a `subprocess.run(['headroom', 'compress', '--help'], ...)` try-except.

**Warning signs:** The Python test `test_already_installed_skips_installer` mocks `shutil.which` — if this test still passes after the probe change, the probe was not actually changed.

### Pitfall 2: Python tests mock `shutil.which` for idempotency — tests break after probe change

**What goes wrong:** Eight Python tests in `test_install_headroom.py` and `test_configure_mcp.py` mock `goodvibes_cli.steps.install_headroom.shutil.which` to control the idempotency probe. After the probe changes from `shutil.which` to `subprocess.run`, these mocks no longer intercept the probe call — tests that expect "already installed" will instead run the full installer loop.

**Why it happens:** The mock target is tightly coupled to the implementation detail of which probe function is used.

**How to avoid:** When updating the probe in `install_headroom.py`, simultaneously update the corresponding test mocks to use `subprocess.run` side effects instead of `shutil.which` mocks. The pattern to use: a `subprocess.run` side effect that returns exit 0 for `['headroom', 'compress', '--help']`.

### Pitfall 3: `configure-mcp.ts` re-throw must become a `failed` return

**What goes wrong:** Line 74 of `configure-mcp.ts` currently `throw fallbackErr` on non-ENOENT `headroom mcp install` failures. If left unchanged, a failing `headroom mcp install` call propagates to `init.ts`'s `catch (e)` block, which calls `cancel()` and `process.exit(1)` — a hard failure for what should be a soft failure.

**Why it happens:** The original implementation was missing a soft-fail handler for the fallback path. The Python version already soft-fails here (catches `CalledProcessError` and logs). The TS version was missed.

**How to avoid:** Replace `throw fallbackErr` with `return { status: 'failed', reason: summary }` and add `log(...)` before it. The architectural invariant is: steps never throw on soft failures.

### Pitfall 4: `init.test.ts` mocks return `undefined` for `installHeadroom`

**What goes wrong:** `init.test.ts` line 133: `vi.mocked(installHeadroom).mockResolvedValue(undefined)`. After the return type changes to `HeadroomResult`, TypeScript will type-error on `undefined`. Beyond type errors, the `init.ts` code will try to access `headroomResult.status` on `undefined` at runtime.

**Why it happens:** The existing mock returns `undefined` because `installHeadroom` previously returned `void`. After the change, the mock must return a valid `HeadroomResult` object.

**How to avoid:** Update all `mockResolvedValue(undefined)` calls for `installHeadroom` and `configureMcp` in `init.test.ts` to return appropriate result objects:
```typescript
vi.mocked(installHeadroom).mockResolvedValue({ status: 'installed' })
vi.mocked(configureMcp).mockResolvedValue({ status: 'registered' })
```

### Pitfall 5: `doctor.test.ts` probes `headroom --version`, tests break after probe change

**What goes wrong:** `doctor.test.ts` line 48: `vi.mocked(execa).mockResolvedValueOnce({ stdout: '1.0.0' } as any)` — the test assumes the first execa call is `headroom --version`. After changing to `compress --help`, the mock sequence shifts.

**Why it happens:** Tests are implicitly ordered around the old probe call.

**How to avoid:** When changing `doctor.ts::checkHeadroom()`, update the corresponding test to verify `execa` was called with `['headroom', ['compress', '--help'], expect.objectContaining({ timeout: 10_000 })]`.

### Pitfall 6: Python `subprocess.TimeoutExpired` not caught alongside `CalledProcessError`

**What goes wrong:** After adding `timeout=10` to `subprocess.run` calls, a subprocess that hangs raises `subprocess.TimeoutExpired`. If the except block only catches `CalledProcessError`, the `TimeoutExpired` propagates up and causes an unhandled exception — failing init hard instead of soft.

**Why it happens:** It's easy to add `timeout=10` and forget to extend the except clause.

**How to avoid:** Any `subprocess.run` call that adds `timeout=` must have its except clause extended:
```python
# Before:
except subprocess.CalledProcessError as e: ...
# After:
except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e: ...
```

### Pitfall 7: `--minimal` path — headroomResult is undefined

**What goes wrong:** When `--minimal` is passed, the headroom task block is skipped entirely. `headroomResult` stays `undefined`. Any code that accesses `headroomResult.status` without a guard crashes.

**Why it happens:** The minimal flag skips the entire `if (!minimal)` block including the task list extension.

**How to avoid:** Gate the headroom note display with `if (!minimal && headroomResult)`. In Python, initialize `headroom_result` and `mcp_result` to a default value before the `if not minimal:` block to avoid unbound variable access.

---

## Code Examples

### execa v9 timeout option

```typescript
// Source: /home/ygiokas/GoodVibes/packages/npm/node_modules/execa/types/arguments/options.d.ts
// "If timeout is greater than 0, the subprocess will be terminated if it runs
//  for longer than that amount of milliseconds. On timeout, error.timedOut becomes true."
await execa('headroom', ['compress', '--help'], { timeout: 10_000 })
```

### Python subprocess timeout

```python
# Source: Python stdlib (subprocess.run, timeout parameter)
# "If timeout is given, and the process takes too long, a TimeoutExpired exception will be raised."
subprocess.run(['headroom', 'compress', '--help'],
               capture_output=True, text=True, check=True, timeout=10)
```

### `formatHeadroomStatus` helper (inline in init.ts, not a new file)

```typescript
// ponytail: inline helper — too small to justify a separate module
function formatHeadroomStatus(
  hr: HeadroomResult | undefined,
  mr: McpResult | undefined
): string {
  const lines: string[] = []
  if (hr) {
    const install = {
      'installed': 'headroom: installed',
      'already-installed': 'headroom: already installed',
      'skipped': `headroom: skipped (${hr.status === 'skipped' ? hr.reason : ''})`,
      'failed': `headroom: install failed (${hr.status === 'failed' ? hr.reason : ''})`,
    }[hr.status]
    lines.push(install)
  }
  if (mr) {
    const mcp = {
      'registered': 'MCP: registered',
      'already-registered': 'MCP: already configured',
      'skipped': `MCP: skipped (${mr.status === 'skipped' ? mr.reason : ''})`,
      'failed': `MCP: failed (${mr.status === 'failed' ? mr.reason : ''})`,
    }[mr.status]
    lines.push(mcp)
  }
  return lines.join('\n')
}
```

---

## Full File Change Map

| File | Status | Change |
|------|--------|--------|
| `packages/npm/src/steps/install-headroom.ts` | MODIFY | Return `HeadroomResult` not `void`; probe → `compress --help`; `{ timeout: 10_000 }` on all execa calls |
| `packages/npm/src/steps/configure-mcp.ts` | MODIFY | Return `McpResult` not `void`; `{ timeout: 10_000 }` on all execa calls; `throw fallbackErr` → `return { status: 'failed' }` |
| `packages/npm/src/commands/init.ts` | MODIFY | Capture results in closure; label tables; `note(formatHeadroomStatus(...), 'Headroom')` |
| `packages/npm/src/commands/doctor.ts` | MODIFY | `checkHeadroom()`: `--version` → `compress --help`; add `{ timeout: 10_000 }`; label → "headroom installed and working" |
| `packages/npm/src/steps/install-headroom.test.ts` | MODIFY | `resolves.toBeUndefined()` → result object assertions; update idempotency probe mock call |
| `packages/npm/src/steps/configure-mcp.test.ts` | MODIFY | Add return value assertions for each path |
| `packages/npm/src/commands/init.test.ts` | MODIFY | `mockResolvedValue(undefined)` → result objects; add headroom `note()` call assertions |
| `packages/npm/src/commands/doctor.test.ts` | MODIFY | Update probe assertion: `--version` → `compress --help` |
| `packages/pip/src/goodvibes_cli/steps/install_headroom.py` | MODIFY | Return `dict[str, str]`; probe → `subprocess.run(['headroom', 'compress', '--help'], timeout=10)`; add `timeout=10` to installer loop |
| `packages/pip/src/goodvibes_cli/steps/configure_mcp.py` | MODIFY | Return `dict[str, str]`; add `timeout=10` to all subprocess calls; CalledProcessError on `claude mcp add` → return failed |
| `packages/pip/src/goodvibes_cli/commands/init_cmd.py` | MODIFY | Capture results; `console.print(Panel(_format_headroom_status(...), title="Headroom"))` |
| `packages/pip/src/goodvibes_cli/commands/doctor_cmd.py` | MODIFY | `_check_headroom()`: `shutil.which` → subprocess functional probe; label update |
| `packages/pip/tests/test_install_headroom.py` | MODIFY | Replace `shutil.which` idempotency mock with `subprocess.run` mock; add return value assertions |
| `packages/pip/tests/test_configure_mcp.py` | MODIFY | Add return value assertions for each path |
| `packages/pip/tests/test_init_cmd.py` | MODIFY | Update mocks to return dicts; add headroom Panel assertion |
| `packages/pip/tests/test_doctor_cmd.py` | MODIFY | Update probe mock: `shutil.which` → subprocess; update label assertion |

**Net new files: zero.**

---

## Runtime State Inventory

This phase is greenfield refactoring of in-memory code paths. There is no rename of stored identifiers, user IDs, or service names.

**Nothing found in any category — verified by direct codebase reading.**

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| execa | install-headroom.ts, configure-mcp.ts | Yes | 9.6.1 | — |
| vitest | TS test suite | Yes | in npm scripts | — |
| pytest + pytest-mock | Python test suite | Yes | in pip venv | — |
| headroom binary | probe calls | Runtime-optional | varies | steps soft-fail |

**Missing dependencies with no fallback:** None — all dependencies are present.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| TS Framework | vitest (run: `npm run test` in `packages/npm/`) |
| Python Framework | pytest + pytest-mock (run: `cd packages/pip && uv run pytest tests/`) |
| TS quick run | `cd packages/npm && npm run test` |
| Python quick run | `cd packages/pip && uv run pytest tests/test_install_headroom.py tests/test_configure_mcp.py tests/test_init_cmd.py tests/test_doctor_cmd.py -x` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | File | Exists? |
|--------|----------|-----------|------|---------|
| HDR2-01 | `installHeadroom()` returns `HeadroomResult` with correct status per path | unit | `install-headroom.test.ts` / `test_install_headroom.py` | Partial — needs result assertions added |
| HDR2-01 | `init.ts` emits headroom `note()` in outro with install outcome | unit | `init.test.ts` | No — new assertion needed |
| HDR2-02 | `configureMcp()` returns `McpResult` with correct status per path | unit | `configure-mcp.test.ts` / `test_configure_mcp.py` | Partial — needs result assertions added |
| HDR2-02 | `init.ts` emits headroom `note()` in outro with MCP outcome | unit | `init.test.ts` | No — new assertion needed |
| HDR2-03 | idempotency probe calls `compress --help` not `--version` | unit | `install-headroom.test.ts` / `test_install_headroom.py` | No — must update existing "already installed" tests |
| HDR2-04 | all execa calls pass `{ timeout: 10_000 }` | unit | `install-headroom.test.ts`, `configure-mcp.test.ts` | No — new call-shape assertions needed |
| HDR2-04 | all Python subprocess calls pass `timeout=10` | unit | `test_install_headroom.py`, `test_configure_mcp.py` | No — new call-shape assertions needed |
| HDR2-05 | `doctor.ts::checkHeadroom` uses `compress --help`, not `--version` | unit | `doctor.test.ts` | No — existing test probes `--version` |
| HDR2-05 | `doctor_cmd.py::_check_headroom` uses subprocess probe, not `shutil.which` | unit | `test_doctor_cmd.py` | No — existing test uses `shutil.which` mock |

### Wave 0 Gaps

All test files already exist. No new test files are needed.

The existing tests that exercise the headroom path will require code-level updates:
- [ ] `install-headroom.test.ts` line 29: `resolves.toBeUndefined()` → returns `{ status: 'already-installed' }`
- [ ] `install-headroom.test.ts` line 181: probe call changes from `['headroom', '--version']` to `['headroom', 'compress', '--help']`
- [ ] `init.test.ts` line 133: `mockResolvedValue(undefined)` for `installHeadroom` and `configureMcp` → result objects
- [ ] `doctor.test.ts` line 48: mock sequence must reflect `compress --help` call
- [ ] `test_install_headroom.py` `test_already_installed_skips_installer`: `shutil.which` mock → `subprocess.run` mock
- [ ] `test_doctor_cmd.py`: `shutil.which` mock → `subprocess.run` mock

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Yes (subprocess args) | execa array args, no shell=True — already in place |
| V6 Cryptography | No | — |

### Known Threat Patterns for subprocess calls

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via subprocess string args | Tampering | All subprocess calls use array args in both TS (execa) and Python (`subprocess.run` without `shell=True`) — already enforced; no new risk in this phase |
| Hang/DoS via subprocess that never exits | Denial of Service | HDR2-04 exactly addresses this: 10-second hard timeout on all headroom calls |

No new security risks introduced. The timeout (HDR2-04) is itself a security/reliability improvement.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**This table is empty.** All claims in this research were verified by direct codebase reading (source files read verbatim), execa type definitions (read directly from `node_modules`), and Python stdlib documentation.

---

## Open Questions (RESOLVED)

1. **McpResult 'registered' label in fallback path**
   - What we know: `configureMcp` can reach the `headroom mcp install` fallback and succeed. Currently no return path after the fallback succeeds.
   - What's unclear: Should the fallback success label be `'registered'` or a distinct `'registered-via-fallback'`?
   - RESOLVED: Use `'registered'` — the user doesn't need to know which strategy succeeded. Simpler label table.

2. **`formatHeadroomStatus` in Python — Panel or string?**
   - What we know: `init_cmd.py` uses Rich Panel for all post-task output.
   - What's unclear: Should the headroom status be one Panel with both install and MCP lines, or two separate Panels?
   - RESOLVED: One Panel titled "Headroom" with install status on line 1 and MCP status on line 2 — matches the `note()` pattern in TS which groups both into one call.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `headroom --version` probe (PATH + version) | `headroom compress --help` probe (functional) | This phase | Catches broken installs where binary exists but compression fails (Windows + Python 3.13 upstream issue #845) |
| `void` return from steps | Discriminated union return | This phase | Callers can branch on outcome without re-probing |

**Deprecated/outdated patterns in the codebase (introduced in prior phases, resolved here):**
- `execa('headroom', ['--version'])` as probe in `install-headroom.ts` and `doctor.ts` — replaced by `compress --help`
- `shutil.which("headroom")` as idempotency probe in `install_headroom.py` and `doctor_cmd.py` — replaced by subprocess functional probe
- `throw fallbackErr` in `configure-mcp.ts` fallback — architectural inconsistency with the "steps never throw" invariant; resolved by returning `{ status: 'failed' }`

---

## Sources

### Primary (HIGH confidence — direct file reads)

- `/home/ygiokas/GoodVibes/packages/npm/src/steps/install-headroom.ts` — all branch paths, probe call, return type
- `/home/ygiokas/GoodVibes/packages/npm/src/steps/configure-mcp.ts` — all branch paths, re-throw on line 74, return type
- `/home/ygiokas/GoodVibes/packages/npm/src/commands/init.ts` — hardcoded 'headroom ready' task return strings, minimal guard
- `/home/ygiokas/GoodVibes/packages/npm/src/commands/doctor.ts` — `checkHeadroom()` uses `--version` via execa
- `/home/ygiokas/GoodVibes/packages/npm/src/steps/install-headroom.test.ts` — `resolves.toBeUndefined()` assertions
- `/home/ygiokas/GoodVibes/packages/npm/src/steps/configure-mcp.test.ts` — return value not asserted
- `/home/ygiokas/GoodVibes/packages/npm/src/commands/init.test.ts` — `mockResolvedValue(undefined)` for step mocks
- `/home/ygiokas/GoodVibes/packages/npm/src/commands/doctor.test.ts` — probes `--version` assertion
- `/home/ygiokas/GoodVibes/packages/pip/src/goodvibes_cli/steps/install_headroom.py` — `shutil.which` idempotency probe
- `/home/ygiokas/GoodVibes/packages/pip/src/goodvibes_cli/steps/configure_mcp.py` — return type and timeout absence
- `/home/ygiokas/GoodVibes/packages/pip/src/goodvibes_cli/commands/init_cmd.py` — discards step return values
- `/home/ygiokas/GoodVibes/packages/pip/src/goodvibes_cli/commands/doctor_cmd.py` — `shutil.which` PATH-only check
- `/home/ygiokas/GoodVibes/packages/pip/tests/test_install_headroom.py` — `shutil.which` mocking pattern
- `/home/ygiokas/GoodVibes/packages/pip/tests/test_configure_mcp.py` — existing test structure
- `packages/npm/node_modules/execa/types/arguments/options.d.ts` — `timeout?: number` option, `error.timedOut` [VERIFIED: execa v9.6.1]
- Python `subprocess.run` stdlib — `timeout=` parameter; `TimeoutExpired` exception [VERIFIED: stdlib]
- `.planning/research/ARCHITECTURE.md` — prior architectural research confirming file roles and patterns
- `.planning/research/SUMMARY.md` — confirmed discriminated union approach and probe change rationale

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; existing libraries verified in node_modules and stdlib
- Architecture: HIGH — all findings from direct file reads, zero inference
- Pitfalls: HIGH — discovered by reading actual test mocking patterns and identifying the specific assertions that will break

**Research date:** 2026-07-03
**Valid until:** Stable — code is read directly; valid until the files change
