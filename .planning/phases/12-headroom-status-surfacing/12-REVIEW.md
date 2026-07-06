---
phase: 12-headroom-status-surfacing
reviewed: 2026-07-06T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - packages/npm/src/commands/doctor.ts
  - packages/npm/src/commands/init.ts
  - packages/npm/src/steps/configure-mcp.ts
  - packages/npm/src/steps/install-headroom.ts
  - packages/npm/src/commands/doctor.test.ts
  - packages/npm/src/commands/init.test.ts
  - packages/npm/src/steps/configure-mcp.test.ts
  - packages/npm/src/steps/install-headroom.test.ts
  - packages/pip/src/goodvibes_cli/commands/doctor_cmd.py
  - packages/pip/src/goodvibes_cli/commands/init_cmd.py
  - packages/pip/src/goodvibes_cli/steps/configure_mcp.py
  - packages/pip/src/goodvibes_cli/steps/install_headroom.py
  - packages/pip/tests/test_configure_mcp.py
  - packages/pip/tests/test_doctor_cmd.py
  - packages/pip/tests/test_init_cmd.py
  - packages/pip/tests/test_install_headroom.py
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-07-06
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 12 adds headroom status surfacing to both the npm and pip CLIs — specifically `install-headroom`, `configure-mcp`, `init`, and `doctor` commands in TypeScript and Python. The Python/TypeScript parity is generally good. One BLOCKER was found: the TypeScript fallback-chain behaviour when an installer produces a non-ENOENT error is meaningfully different (and worse) than the Python implementation. Six warnings cover timeout sizing, uncaught exception paths, a Windows-specific path bug, a misleading error message, and two broad exception catches. Three info items cover minor code-smell violations of the CLAUDE.md "fail loud" rule.

---

## Critical Issues

### CR-01: TS `install-headroom.ts` — non-ENOENT installer failure stops fallback chain

**File:** `packages/npm/src/steps/install-headroom.ts:54-68`

**Issue:** When the first installer (`uv`) produces any non-ENOENT error — including an `ETIMEDOUT` from execa's `timeout: 10_000` option — the catch block immediately returns `{ status: 'failed' }` without trying `pipx` or `pip`. The comment says "e.g. missing C++ compiler" to justify stopping, but a 10-second timeout is also caught here and has nothing to do with a C++ build failure. The Python equivalent (`install_headroom.py:54-58`) correctly uses `continue` for both `CalledProcessError` and `TimeoutExpired`, advancing to the next installer. The two implementations have diverged on a load-bearing control-flow decision.

Concretely: on any connection slow enough to exceed 10 seconds for `uv tool install headroom-ai[all]`, the TS path returns `{ status: 'failed', reason: 'Command timed out' }` and never tries `pipx` or `pip`. The ONNX note on line 46 says "this may take 1–3 minutes on a slow connection" — for the model, yes, but the install itself can still exceed 10 seconds. Users see "headroom install failed" with no recovery path.

**Fix:** Either (a) match Python's behaviour by using `continue` instead of `return` for non-ENOENT errors, or (b) separate timeout handling from hard build failures. Option (a) is the minimal fix:

```typescript
for (const installer of installers) {
  try {
    await execa(installer.cmd, installer.args, { timeout: 120_000 }) // also fix timeout
    return { status: 'installed' }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      continue // installer binary not found
    }
    // log and try next installer instead of stopping the chain
    const summary = (e as Error).message?.split('\n')[0] ?? 'unknown error'
    log(`${installer.cmd} install failed: ${summary} — trying next installer`)
    continue
  }
}
// all exhausted
log('No installer succeeded. Run manually: uv tool install "headroom-ai[all]"')
return { status: 'failed', reason: 'all installers failed' }
```

---

## Warnings

### WR-01: 10-second install timeout is too short in both implementations

**File:** `packages/npm/src/steps/install-headroom.ts:56` and `packages/pip/src/goodvibes_cli/steps/install_headroom.py:50`

**Issue:** `timeout: 10_000` (TS) / `timeout=10` (Python) is applied to `uv tool install`, `pipx install`, and `pip install --user`. Package installation on corporate proxies, slow VPNs, or any network that must resolve and download `headroom-ai[all]` plus its dependency tree routinely exceeds 10 seconds. In Python, each timed-out installer is logged and the loop continues; in TypeScript (CR-01 above) the chain stops. Both ultimately return `{ status: 'failed' }` whenever the network is slow — which is exactly when a beginner user is most likely to be frustrated. The 10-second probe on `compress --help` is fine; installs need a separate, longer timeout.

**Fix:** Use 120 seconds (2 minutes) for install subprocess calls. Keep the probe at 10 seconds.

```typescript
// install-headroom.ts
await execa(installer.cmd, installer.args, { timeout: 120_000 })
```
```python
# install_headroom.py
subprocess.run(cmd_list, capture_output=True, text=True, check=True, timeout=120)
```

---

### WR-02: Python `configure_mcp.py` — `TimeoutExpired` not caught in primary strategy block

**File:** `packages/pip/src/goodvibes_cli/steps/configure_mcp.py:61-71`

**Issue:** The primary strategy try block (lines 32–60) contains two `subprocess.run` calls with `timeout=10` — one for `claude mcp list` and one for `claude mcp add`. The `except` clauses on lines 61 and 68 handle `FileNotFoundError` and `CalledProcessError` only. `subprocess.TimeoutExpired` is not caught. If either command times out, the exception propagates out of `configure_mcp()` uncaught.

In `init_cmd.py`, this is eventually caught by the broad `except (OSError, Exception)` on line 113, which prints "Unexpected error: Command timed out" and exits with code 1. The entire `goodvibes init` command fails instead of just registering MCP as `{ status: 'failed', reason: 'timeout' }`. The TypeScript version handles this correctly via the outer `catch` in `configure-mcp.ts:64-86`.

**Fix:** Add `subprocess.TimeoutExpired` to the primary strategy except clause:

```python
except subprocess.CalledProcessError as e:
    lines = (e.stderr or "").splitlines()
    log(f"claude mcp add failed: {lines[0] if lines else 'unknown error'}")
    return {"status": "failed", "reason": lines[0] if lines else "unknown error"}
except subprocess.TimeoutExpired:
    log("claude mcp command timed out — MCP registration skipped")
    return {"status": "failed", "reason": "timeout"}
```

---

### WR-03: Python `init_cmd.py` — `cwd.iterdir()` called outside the try/except block

**File:** `packages/pip/src/goodvibes_cli/commands/init_cmd.py:76`

**Issue:** The non-empty directory check is performed on line 76 before the `try` block that starts on line 83. If `cwd` is a directory the current user can enter but not list (an unusual but valid permission setup), `cwd.iterdir()` raises `PermissionError`. This is an unhandled exception — it produces a raw Python traceback for a beginner-facing CLI. The graceful `PermissionError` handler on lines 108–112 is never reached.

**Fix:** Move the `iterdir()` call inside the try block, or wrap it in its own try/except:

```python
try:
    existing = [e for e in cwd.iterdir() if e.name not in (".git", ".DS_Store")]
except PermissionError:
    existing = []  # ponytail: can't list — continue without the notice

if existing:
    console.print(Panel("Existing files will not be overwritten.", title="Non-empty project detected"))
```

---

### WR-04: Python `init_cmd.py` — `except Exception` swallows programming errors

**File:** `packages/pip/src/goodvibes_cli/commands/init_cmd.py:113`

**Issue:** `except (OSError, Exception)` on line 113 catches every exception that reaches it, including `TypeError`, `AttributeError`, and other programming bugs from `copy_templates`, `install_headroom`, or `configure_mcp`. These surface as "Unexpected error: 'dict' object has no attribute 'status'" rather than a traceback — making bugs in those functions invisible during development. This violates CLAUDE.md's "fail loud" rule: "Error messages must be actionable and specific enough to debug." Additionally, `OSError` in the tuple is redundant since `Exception` is its superclass.

**Fix:** Catch only the exceptions you can handle:

```python
except OSError as e:
    console.print(f"[red]Unexpected error:[/red] {e}")
    raise typer.Exit(1)
```

Programming errors (TypeError, AttributeError, etc.) should produce a full traceback, not a swallowed message.

---

### WR-05: TS `configure-mcp.ts` — Windows `where headroom` returns multiple lines

**File:** `packages/npm/src/steps/configure-mcp.ts:53`

**Issue:** On Windows, `where headroom` prints one line per match when headroom is found in multiple PATH locations. `pathResult.stdout.trim()` removes leading/trailing whitespace only — an embedded newline between two matches remains in the string. This multi-line string is passed as a single argument to `claude mcp add -s user headroom <path>`, which would fail because the path does not exist. The Python equivalent uses `shutil.which()` which always returns a single path.

**Fix:** Take the first line of `where` output:

```typescript
absolutePath = pathResult.stdout.trim().split('\n')[0].trim()
```

---

### WR-06: Python `configure_mcp.py` — wrong error attribution when `claude mcp list` fails

**File:** `packages/pip/src/goodvibes_cli/steps/configure_mcp.py:68-71`

**Issue:** The `try` block spanning lines 32–60 contains two `subprocess.run(check=True)` calls: one for `claude mcp list` and one for `claude mcp add`. Both can raise `CalledProcessError`. The single `except subprocess.CalledProcessError` handler on line 68 always logs `"claude mcp add failed: ..."` regardless of which command actually failed. If `claude mcp list` exits non-zero (e.g., corrupt config), the log message misleads the user into thinking `mcp add` failed, and any diagnostic effort focuses on the wrong command.

**Fix:** Split the try blocks so each has its own except clause:

```python
# separate list check
try:
    list_result = subprocess.run(["claude", "mcp", "list"], ..., check=True, timeout=10)
except subprocess.CalledProcessError as e:
    lines = (e.stderr or "").splitlines()
    log(f"claude mcp list failed: {lines[0] if lines else 'unknown error'}")
    return {"status": "failed", "reason": lines[0] if lines else "unknown error"}
except FileNotFoundError:
    ...  # fall through to headroom mcp install

# then separate add
try:
    subprocess.run(["claude", "mcp", "add", ...], ..., check=True, timeout=10)
except subprocess.CalledProcessError as e:
    lines = (e.stderr or "").splitlines()
    log(f"claude mcp add failed: {lines[0] if lines else 'unknown error'}")
    return {"status": "failed", "reason": lines[0] if lines else "unknown error"}
```

---

## Info

### IN-01: `doctor.ts` — empty catch block swallows version-read exception

**File:** `packages/npm/src/commands/doctor.ts:13`

**Issue:** `catch { return 'unknown' }` swallows any exception from `_require('../../package.json')`. CLAUDE.md explicitly forbids empty catch blocks ("No empty catch blocks. No swallowed exceptions."). The exception here is a `PackageNotFoundError` from a missing `package.json`, which is a configuration problem worth surfacing in development. A bare silent fallback hides packaging errors during local development and CI.

**Fix:**
```typescript
} catch (e: unknown) {
  // ponytail: only expected during local dev without package.json built
  if (process.env.NODE_ENV !== 'production') console.error('[goodvibes] version read failed:', e)
  return 'unknown'
}
```

---

### IN-02: Substring MCP list check could false-positive on server names containing 'headroom'

**File:** `packages/npm/src/steps/configure-mcp.ts:44` and `packages/pip/src/goodvibes_cli/steps/configure_mcp.py:40`

**Issue:** `list.stdout.includes('headroom')` and `"headroom" in list_result.stdout` would both return true if any other registered MCP server has a name or path containing the string "headroom" (e.g., `pre-headroom-check`, `/usr/local/bin/headroom-dev`). The function would then return `{ status: 'already-registered' }` without actually verifying headroom is registered, silently skipping registration.

**Fix:** Check for a word boundary or the exact server name as registered:
```typescript
if (list.stdout.split('\n').some(line => /\bheadroom\b/.test(line))) {
```

---

### IN-03: `init.ts` — redundant ternary in `formatHeadroomStatus`

**File:** `packages/npm/src/commands/init.ts:16`

**Issue:** Inside the `'skipped'` key of the Record, the expression `hr.status === 'skipped' ? hr.reason : ''` is always true by construction — the key is only evaluated when `hr.status === 'skipped'`. TypeScript cannot narrow through the Record cast, so the ternary is there as a defensive guard, but it adds noise and suggests uncertain control flow. The same pattern on line 17 (`hr.status === 'failed' ? hr.reason : ''`) has the same issue.

**Fix:** Simplify using `hr.reason ?? ''` directly, which works for both branches and removes the type narrowing workaround:
```typescript
'skipped': `headroom: skipped (${hr.status === 'skipped' ? hr.reason : ''})`,
// → 
'skipped': `headroom: skipped (${(hr as Extract<HeadroomResult, {status:'skipped'}>).reason})`,
```
Or, simpler: access `reason` via a helper that narrows safely. This is a code smell, not a runtime bug.

---

_Reviewed: 2026-07-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
