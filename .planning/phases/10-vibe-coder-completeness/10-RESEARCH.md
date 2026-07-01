# Phase 10: Vibe Coder Completeness — Research

**Researched:** 2026-07-01
**Domain:** CLI command extension (Commander.js + Typer), template doc authoring, UX copy
**Confidence:** HIGH

---

## Summary

Phase 10 is almost entirely a code-extension problem on top of a well-understood, fully-passing codebase (106 npm tests, 109 pip tests, all green). The six VCC requirements split into two categories: CLI work (VCC-01 `update` alias, VCC-02 `doctor` command, VCC-03 `--version` fix, VCC-05 headroom transparency) and content work (VCC-04 `getting-started.md`, VCC-06 IDE ponytail guidance sections). No new dependencies are needed; every feature uses existing libraries or stdlib.

The `goodvibes update` command (VCC-01) is a Commander.js `.alias('update')` on the existing `upgrade` subcommand — one line in `index.ts`, one `app.command('update')` call in `main.py`. The logic is identical to `upgrade`; only the entry name changes. The ROADMAP success criteria for VCC-01 match what `upgrade` already does, confirming this is an alias not a new command.

The `goodvibes doctor` command (VCC-02) is the most substantive CLI addition: four checks (headroom on PATH, git user.name + user.email configured, CLAUDE.md present, sentinel block intact) printed as a pass/fail table, exiting non-zero on any failure. All checks use already-available tools: `execa` (TS), `subprocess`/`shutil.which` (Python), `fs.existsSync` / `pathlib.Path.exists` for file checks, and `extractVersion` / `SENTINEL_START` from the existing sentinel-merge module for the sentinel check.

The `--version` flag (VCC-03) has a latent bug: `index.ts` hardcodes `.version('1.0.0')` while `package.json` is at `1.5.0`. Python (`main.py`) already handles this correctly via `importlib.metadata`. The TypeScript fix reads `package.json` via `createRequire(import.meta.url)('../package.json')` — the same pattern upgrade.ts attempts, but with the correct path (`../` not `../../` from `dist/index.js`).

**Primary recommendation:** Wire `update` as alias, add a `doctor` command module following the existing `init.ts`/`upgrade.ts` pattern, fix the hardcoded version string, add idempotency message to headroom install, and author two template docs (`docs/getting-started.md`, IDE ponytail sections). No new packages. No architectural changes.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VCC-01 | `goodvibes update` re-runs sentinel merge + copies updated templates without clobbering; skipped on first-run dirs | `upgrade` command already implements this fully; a Commander `.alias('update')` + Typer `app.command('update')` exposes it under the new name with zero duplicate logic |
| VCC-02 | `goodvibes doctor` prints pass/fail checklist — headroom installed, git configured, CLAUDE.md present, sentinel intact — plain-English remediation per failure; exits non-zero on any failure | All four checks implementable with existing tools: `execa`/`shutil.which` for headroom, `execa git config` for git, `existsSync`/`Path.exists` for CLAUDE.md, `SENTINEL_START` string check for sentinel |
| VCC-03 | `goodvibes --version` prints installed package version and exits 0 | Commander `.version(str)` already wired; bug is hardcoded `'1.0.0'`; fix is `createRequire(import.meta.url)('../package.json').version`; Python side already reads from `importlib.metadata` correctly |
| VCC-04 | `docs/getting-started.md` walks a beginner from "I just ran init" through first feature in under 5 minutes | Pure template file, no CLI code; follows same pattern as `templates/docs/platform-setup/*.md`; copied to target project by existing `copyTemplates` machinery |
| VCC-05 | Headroom install step shows explicit status (installing / already installed / skipped) and a one-sentence "what is headroom?" explanation | `installHeadroom(log)` already accepts a `log` callback; add idempotency check (`shutil.which('headroom')` / `execa headroom --version`) before the install loop; add one-sentence description to the existing ONNX warning message |
| VCC-06 | Non-Claude Code IDE users get a "what do I do now?" ponytail section in their platform setup guides | Existing `templates/docs/platform-setup/` has `base44.md` and `chatgpt.md` as examples; Cursor/Windsurf/Kiro/Replit/Bolt.new users need equivalent guides; content clarifies ponytail is embedded in their IDE rule file, explicit commands not available |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Ponytail minimalism ruleset active (full mode):** Stop at the first rung of the ladder. `update` is one alias call, not a new module. Doctor checks use stdlib where possible.
- **Surgical changes:** Touch only what each VCC requirement needs. Do not reformulate passing tests, rename variables, or add abstractions.
- **Fail loud:** Doctor exits non-zero on any check failure. Remediation messages must be specific enough to act on without googling.
- **Zero new dependencies:** Every feature in Phase 10 uses already-installed packages. Adding any new package requires escalation to user.
- **Both CLIs stay in sync:** Every CLI feature (doctor, update alias, --version, headroom transparency) must be implemented in both `packages/npm/src/` (TypeScript, Commander.js 15.x) and `packages/pip/src/goodvibes_cli/` (Python, Typer 0.26.x).
- **Test conventions:** Unit tests mock all external calls. Test names are sentences. TS tests go in `src/commands/doctor.test.ts`; Python tests in `tests/test_doctor_cmd.py`. Run with `npm test` / `cd packages/pip && uv run pytest tests/`.
- **No docstrings for self-evident functions.** One-line `ponytail:` comment for deliberate simplifications.
- **Running Python tests:** Always `cd packages/pip && uv run pytest tests/`, never from repo root.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `update` alias wiring | CLI entry point (`index.ts` / `main.py`) | — | One-line alias; no new module needed |
| `doctor` command logic | CLI command module (`commands/doctor.ts` / `doctor_cmd.py`) | Existing utils (sentinel-merge, detect-python) | Same module pattern as init.ts / upgrade.ts |
| `--version` fix | CLI entry point (`index.ts`) | `createRequire` / `importlib.metadata` | Both already exist; just fix the hardcoded string |
| Headroom idempotency UX | `steps/install-headroom.ts` / `install_headroom.py` | — | Add check before the installer loop; all in the existing step file |
| `getting-started.md` | Template file (`templates/docs/getting-started.md`) | — | Static doc; `copyTemplates` already handles `docs/` prefix |
| IDE ponytail guidance | Template files (`templates/docs/platform-setup/*.md`) | — | New platform-setup files for Cursor, Windsurf, Kiro, Replit, Bolt.new |

---

## Standard Stack

### Core (all already installed — no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `commander` | ^15 (15.0.0 on registry) [VERIFIED: npm registry] | Subcommand routing, `--version`, `.alias()` | Already the CLI framework; `.alias()` is built-in |
| `@clack/prompts` | ^1 | Spinner/note/outro for doctor output | Already used in init and upgrade |
| `execa` | ^9 | Subprocess calls for git checks, headroom probe | Already used throughout |
| `fs-extra` / `node:fs` | ^11 / stdlib | File existence checks | Already imported |
| `typer` | ^0.15 (0.26.7 installed) [VERIFIED: local venv] | Python CLI framework; multiple commands per function | Already the pip CLI framework |
| `rich` | ^14 | Python terminal output (panels, status) | Already imported in init_cmd.py / upgrade_cmd.py |
| Python stdlib | 3.10+ | `shutil.which`, `subprocess`, `pathlib`, `importlib.metadata` | Already used throughout pip CLI |

**Installation:** None required — all packages are already declared in `package.json` and `pyproject.toml`.

---

## Package Legitimacy Audit

Phase 10 introduces **no new packages**. All implementation uses libraries already declared in `packages/npm/package.json` and `packages/pip/pyproject.toml`.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
packages/npm/src/
└── commands/
    └── doctor.ts            # new — doctor command module
    └── doctor.test.ts       # new — unit tests for doctor

packages/pip/src/goodvibes_cli/
└── commands/
    └── doctor_cmd.py        # new — doctor command module

packages/pip/tests/
└── test_doctor_cmd.py       # new — unit tests for doctor

templates/docs/
├── getting-started.md       # new — VCC-04 newbie flow guide
└── platform-setup/
    ├── cursor.md            # new — VCC-06 ponytail guidance for Cursor users
    ├── windsurf.md          # new — VCC-06 ponytail guidance for Windsurf users
    ├── kiro.md              # new — VCC-06 ponytail guidance for Kiro users
    ├── replit.md            # new — VCC-06 ponytail guidance for Replit Agent users
    └── bolt.md              # new — VCC-06 ponytail guidance for Bolt.new users
```

### System Architecture Diagram

```
goodvibes CLI entry
    │
    ├── init ──────────────────────────────── [existing]
    ├── upgrade ───────────────────────────── [existing]
    │     └── alias: update ─────────────── [VCC-01: +1 line in index.ts / main.py]
    ├── doctor ─────────────────────────── [VCC-02: new module]
    │     ├── check: headroom on PATH
    │     │     └── execa('headroom', ['--version']) / shutil.which('headroom')
    │     ├── check: git user.name configured
    │     │     └── execa('git', ['config', 'user.name'])
    │     ├── check: git user.email configured
    │     │     └── execa('git', ['config', 'user.email'])
    │     ├── check: CLAUDE.md exists in cwd
    │     │     └── existsSync / Path.exists
    │     ├── check: sentinel block intact
    │     │     └── readFile + SENTINEL_START/END string check (reuse from sentinel-merge)
    │     └── exit 0 (all pass) / exit 1 (any fail)
    └── --version ──────────────────────── [VCC-03: fix hardcoded '1.0.0']
          └── createRequire('../package.json').version (TS)
              importlib.metadata.version('jgiox-goodvibes') (Python, already correct)

install-headroom step [VCC-05: add idempotency + description]
    ├── probe: execa('headroom', ['--version']) / shutil.which('headroom')
    │     ├── found → log("headroom already installed — skipping")
    │     └── not found → proceed to installer loop (existing)
    └── log: "headroom compresses AI context to save tokens and reduce cost"
          (added alongside existing ONNX warning)

templates/docs/ [VCC-04, VCC-06: static files]
    ├── getting-started.md   → copied to target project by existing copyTemplates
    └── platform-setup/*.md  → copied to target project by existing copyTemplates
```

### Pattern 1: Commander.js `.alias()` for the `update` subcommand

**What:** Expose the existing `upgrade` command under a second name `update`.
**When to use:** When two command names should do identical things.

```typescript
// Source: Commander.js Readme.md line 556 [VERIFIED: local node_modules]
// In registerUpgradeCommand(), change:
program.command('upgrade')
// to:
program.command('upgrade').alias('update')
// That is the entire diff for VCC-01 on the npm side.
```

### Pattern 2: Typer multiple command names for `update`

**What:** Register the same Python function under two Typer command names.
**When to use:** Alias pattern in Typer (no native `.alias()`).

```python
# Source: Typer docs — app.command() decorator with name arg [ASSUMED]
# In main.py:
app.command("upgrade")(upgrade_cmd)
app.command("update")(upgrade_cmd)   # alias — same function
```

### Pattern 3: Dynamic version in Commander.js

**What:** Read `package.json` version at runtime instead of hardcoding it.
**When to use:** Ensures `--version` always matches the published package.

```typescript
// Source: Node.js createRequire docs [VERIFIED: confirmed working via local test]
// In index.ts, replace:
program.version('1.0.0')
// with:
import { createRequire } from 'node:module'
const _require = createRequire(import.meta.url)
const _pkg = _require('../package.json') as { version: string }
program.version(_pkg.version)
// Path is '../package.json' not '../../package.json':
// dist/index.js -> ../package.json = packages/npm/package.json (local) ✓
// node_modules/@jgiox/goodvibes/dist/index.js -> ../package.json = package root ✓
```

### Pattern 4: Doctor command exit code

**What:** `process.exit(1)` / `raise typer.Exit(1)` after printing all failures.
**When to use:** Collect all failures first, print them all, then exit — don't short-circuit on first failure.

```typescript
// Source: existing pattern in init.ts line 95 [VERIFIED: codebase]
// Key: run ALL checks before deciding to exit, so user sees the complete picture
let failed = false
// ... run checks, set failed = true if any fail, print remediation for each ...
if (failed) process.exit(1)
```

### Pattern 5: Headroom idempotency probe

**What:** Check if headroom is already on PATH before attempting install.
**When to use:** Beginning of `installHeadroom()`, before the installer loop.

```typescript
// Source: existing ENOENT pattern in install-headroom.ts [VERIFIED: codebase]
try {
  await execa('headroom', ['--version'])
  log('headroom already installed — skipping')
  return
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
  // not installed — proceed to installer loop
}
```

```python
# Source: shutil.which stdlib docs [ASSUMED]
import shutil
if shutil.which('headroom') is not None:
    log('headroom already installed — skipping')
    return
```

### Anti-Patterns to Avoid

- **Duplicate upgrade logic for `update`:** Do not copy the upgrade implementation. Use `.alias('update')` in Commander, `app.command('update')(upgrade_cmd)` in Typer.
- **Short-circuiting doctor on first failure:** Doctor must run all four checks and print all failures before exiting. Users shouldn't have to re-run four times to discover four problems.
- **`process.exit()` in the doctor check helper functions:** Keep exit codes at the command action level; check helpers should return booleans/status objects, not call exit themselves.
- **Using `'../../package.json'` path:** This is wrong from `dist/index.js`. The correct relative path is `'../package.json'`. (The existing `upgrade.ts` `getInstalledVersion()` has this bug — it returns `null` silently in local dev. Phase 10 should use `'../package.json'` in the new code, and optionally patch upgrade.ts too.)
- **`shell: true` in subprocess calls:** Never. All execa/subprocess calls pass args as arrays.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sentinel block detection (doctor) | Custom regex | Import `SENTINEL_START`/`SENTINEL_END` from `sentinel-merge.ts` / `sentinel_merge.py` | Already exported; single source of truth |
| Headroom PATH detection | Custom which() implementation | `execa('headroom', ['--version'])` catch ENOENT (TS) / `shutil.which('headroom')` (Python) | Both already used in configure-mcp; no new code |
| git config reading | Custom .gitconfig parser | `execa('git', ['config', 'user.name'])` | Already used in existing codebase; cross-platform |
| Version reading (TS) | `fs.readFileSync` on package.json | `createRequire(import.meta.url)('../package.json')` | Same mechanism upgrade.ts already imports |
| Pass/fail output formatting | Custom table renderer | `note()` from `@clack/prompts` (TS) / `console.print(Panel(...))` from rich (Python) | Already used in init and upgrade commands |

**Key insight:** Every building block for Phase 10 exists in the codebase. The planner should not propose importing new utility libraries or creating new shared util modules — use existing imports.

---

## Common Pitfalls

### Pitfall 1: Hardcoded version string diverges from package.json
**What goes wrong:** `program.version('1.0.0')` stays at 1.0.0 while the package ships as 1.5.0. `goodvibes --version` prints the wrong version.
**Why it happens:** Developer bumps version in `package.json` but forgets to update the hardcoded string in `index.ts`.
**How to avoid:** Use `createRequire(import.meta.url)('../package.json').version` — the source of truth is `package.json`, not the code.
**Warning signs:** `goodvibes --version` output doesn't match `npm view @jgiox/goodvibes version`.

### Pitfall 2: Wrong `createRequire` path (`../../` vs `../`)
**What goes wrong:** `createRequire(import.meta.url)('../../package.json')` fails silently (`getInstalledVersion()` returns `null`) because from `dist/index.js` one level up is `dist/`, two levels up is `packages/`, not `packages/npm/`.
**Why it happens:** The path calculation is counterintuitive; `import.meta.url` resolves relative to the *file*, not the process cwd.
**How to avoid:** Use `'../package.json'` — verified working in local test (see research probe above). The published package layout confirms this: `dist/index.js` and `package.json` are siblings in the package root.
**Warning signs:** The `upgrade` command's self-update shows `null` as current version in tests.

### Pitfall 3: Doctor exits on first failure (instead of collecting all)
**What goes wrong:** User runs `goodvibes doctor`, fixes the first error, runs again, discovers the second error. Four iterations to learn about four problems.
**Why it happens:** Early `process.exit(1)` inside the check loop.
**How to avoid:** Accumulate a list of failures, print all of them, then exit once at the end.
**Warning signs:** Test that runs doctor with two failing checks only reports one.

### Pitfall 4: Commander.js `.version()` conflict with `-V` flag
**What goes wrong:** Commander adds `-V, --version` automatically via `.version()`. If someone also tries `program.option('--version', ...)`, Commander will throw "cannot add option --version: already defined".
**Why it happens:** `.version()` registers the `-V, --version` option internally.
**How to avoid:** Use only `.version(str)` — don't add a separate `--version` option. Commander's built-in is sufficient.
**Warning signs:** `Error: Cannot add option...` on startup.

### Pitfall 5: `goodvibes update` shown in help but `goodvibes upgrade` hidden (or vice versa)
**What goes wrong:** Commander shows aliases in help differently from primary names; Typer lists both as separate commands.
**Why it happens:** Commander `.alias()` does show aliases in help (`upgrade|update`). Typer `app.command('update')(fn)` lists both as top-level commands.
**How to avoid:** This is expected behavior — both CLIs will show both names, which is desirable for discoverability. No special handling needed.
**Warning signs:** Help output showing duplicate descriptions without indicating they are equivalent.

### Pitfall 6: Headroom transparency UX: message ordering
**What goes wrong:** The one-sentence "what is headroom?" explanation appears after the install subprocess (which can take 30+ seconds), making it look like an afterthought.
**Why it happens:** Log message appended after the subprocess call.
**How to avoid:** Log the description message BEFORE the idempotency check and BEFORE the installer loop — same discipline as the existing ONNX warning (already positioned before subprocess calls).
**Warning signs:** In tests, the description log appears in a different position than the ONNX warning.

### Pitfall 7: `docs/getting-started.md` not excluded from `--minimal` copy
**What goes wrong:** `--minimal` is supposed to skip `docs/` entirely. If `getting-started.md` is in `templates/docs/`, it will be skipped by `--minimal` — which is correct, but the test assertions for `--minimal` may not account for the new file.
**Why it happens:** Test suite might hard-code the list of expected `docs/` files.
**How to avoid:** Check `copy-templates.test.ts` and `test_copy_templates.py` for any hardcoded file lists — update if they enumerate docs contents.
**Warning signs:** `--minimal` tests fail after adding `getting-started.md`.

---

## Code Examples

### Doctor command structure (TypeScript)

```typescript
// src/commands/doctor.ts
// Source: pattern from init.ts and upgrade.ts [VERIFIED: codebase]
import type { Command } from 'commander'
import { note, outro } from '@clack/prompts'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execa } from 'execa'

const SENTINEL_START = '<!-- goodvibes:start -->'
const SENTINEL_END = '<!-- goodvibes:end -->'

type CheckResult = { label: string; pass: boolean; remedy?: string }

async function checkHeadroom(): Promise<CheckResult> {
  try {
    await execa('headroom', ['--version'])
    return { label: 'headroom installed', pass: true }
  } catch {
    return {
      label: 'headroom installed',
      pass: false,
      remedy: 'Run: uv tool install "headroom-ai[all]"  (or re-run goodvibes init)',
    }
  }
}

async function checkGit(): Promise<CheckResult[]> {
  const checks: CheckResult[] = []
  for (const key of ['user.name', 'user.email'] as const) {
    try {
      const { stdout } = await execa('git', ['config', key])
      checks.push({ label: `git ${key}`, pass: stdout.trim().length > 0 })
    } catch {
      checks.push({
        label: `git ${key}`,
        pass: false,
        remedy: `Run: git config --global ${key} "Your Value"`,
      })
    }
  }
  return checks
}

function checkClaudeMd(cwd: string): CheckResult {
  const exists = existsSync(join(cwd, 'CLAUDE.md'))
  return {
    label: 'CLAUDE.md present',
    pass: exists,
    remedy: exists ? undefined : 'Run: goodvibes init',
  }
}

function checkSentinel(cwd: string): CheckResult {
  const path = join(cwd, 'CLAUDE.md')
  if (!existsSync(path)) return { label: 'sentinel block intact', pass: false, remedy: 'Run: goodvibes init' }
  const content = readFileSync(path, 'utf-8')
  const pass = content.includes(SENTINEL_START) && content.includes(SENTINEL_END)
  return {
    label: 'sentinel block intact',
    pass,
    remedy: pass ? undefined : 'Run: goodvibes init (will merge sentinel block)',
  }
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check goodvibes setup is complete')
    .action(async () => {
      const cwd = process.cwd()
      const results: CheckResult[] = [
        ...await Promise.all([checkHeadroom()]),
        ...await checkGit(),
        checkClaudeMd(cwd),
        checkSentinel(cwd),
      ]

      const lines = results.map(r => `${r.pass ? '[PASS]' : '[FAIL]'} ${r.label}`)
      note(lines.join('\n'), 'goodvibes doctor')

      const failures = results.filter(r => !r.pass)
      if (failures.length > 0) {
        const remediation = failures
          .filter(r => r.remedy)
          .map(r => `- ${r.label}: ${r.remedy}`)
          .join('\n')
        note(remediation, 'How to fix')
        process.exit(1)
      }

      outro('All checks passed.')
    })
}
```

### Doctor command structure (Python)

```python
# src/goodvibes_cli/commands/doctor_cmd.py
# Source: pattern from init_cmd.py and upgrade_cmd.py [VERIFIED: codebase]
import pathlib
import shutil
import subprocess
from dataclasses import dataclass

import typer
from rich.console import Console
from rich.panel import Panel

SENTINEL_START = "<!-- goodvibes:start -->"
SENTINEL_END = "<!-- goodvibes:end -->"

console = Console()


@dataclass
class CheckResult:
    label: str
    passed: bool
    remedy: str = ""


def _check_headroom() -> CheckResult:
    if shutil.which("headroom") is not None:
        return CheckResult("headroom installed", True)
    return CheckResult(
        "headroom installed",
        False,
        'Run: uv tool install "headroom-ai[all]"  (or re-run goodvibes init)',
    )


def _check_git_config(key: str) -> CheckResult:
    try:
        result = subprocess.run(["git", "config", key], capture_output=True, text=True, check=True)
        return CheckResult(f"git {key}", bool(result.stdout.strip()))
    except (subprocess.CalledProcessError, FileNotFoundError):
        return CheckResult(f"git {key}", False, f'Run: git config --global {key} "Your Value"')


def _check_claude_md(cwd: pathlib.Path) -> CheckResult:
    exists = (cwd / "CLAUDE.md").exists()
    return CheckResult("CLAUDE.md present", exists, "" if exists else "Run: goodvibes init")


def _check_sentinel(cwd: pathlib.Path) -> CheckResult:
    path = cwd / "CLAUDE.md"
    if not path.exists():
        return CheckResult("sentinel block intact", False, "Run: goodvibes init")
    content = path.read_text(encoding="utf-8")
    intact = SENTINEL_START in content and SENTINEL_END in content
    return CheckResult(
        "sentinel block intact",
        intact,
        "" if intact else "Run: goodvibes init (will merge sentinel block)",
    )


def doctor_cmd() -> None:
    """Check goodvibes setup is complete."""
    cwd = pathlib.Path.cwd()
    checks = [
        _check_headroom(),
        _check_git_config("user.name"),
        _check_git_config("user.email"),
        _check_claude_md(cwd),
        _check_sentinel(cwd),
    ]

    lines = "\n".join(f"{'[PASS]' if c.passed else '[FAIL]'} {c.label}" for c in checks)
    console.print(Panel(lines, title="goodvibes doctor"))

    failures = [c for c in checks if not c.passed and c.remedy]
    if failures:
        remediation = "\n".join(f"- {c.label}: {c.remedy}" for c in failures)
        console.print(Panel(remediation, title="How to fix"))
        raise typer.Exit(1)

    console.rule("[green]All checks passed.[/green]")
```

### Headroom install transparency (diff from current)

```typescript
// packages/npm/src/steps/install-headroom.ts — additions only
// Source: existing file [VERIFIED: codebase] + VCC-05 requirement

export async function installHeadroom(log: (msg: string) => void): Promise<void> {
  const pythonCmd = await detectPython()

  if (pythonCmd === null) {
    log('Python 3.10+ not found — skipping headroom install. Install Python 3.10+ and run `goodvibes init` again.')
    return
  }

  // VCC-05: explain what headroom is before any subprocess
  log('headroom compresses AI context to save tokens — this keeps your costs down and sessions faster.')

  // VCC-05: idempotency check — skip if already installed
  try {
    await execa('headroom', ['--version'])
    log('headroom already installed — skipping')
    return
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      log(`headroom probe failed: ${(e as Error).message} — proceeding with install`)
    }
    // ENOENT = not installed, continue to installer loop
  }

  // HDR-03: warn about ONNX model download BEFORE the subprocess starts
  log('Note: headroom will download its compression model on first use — this may take 1–3 minutes on a slow connection.')

  // ... existing installer loop unchanged ...
}
```

### `--version` fix in index.ts

```typescript
// packages/npm/src/index.ts — replace hardcoded version
// Source: createRequire pattern from upgrade.ts [VERIFIED: codebase] + path fix
import { createRequire } from 'node:module'
const _require = createRequire(import.meta.url)
// '../package.json' is correct: dist/index.js -> ../package.json = package root/package.json
const _pkg = _require('../package.json') as { version: string }

program
  .name('goodvibes')
  .version(_pkg.version)   // was: '1.0.0'
  .description('One-command bootstrap for vibe coding projects')
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Commander `.command('upgrade')` only | Add `.alias('update')` | Phase 10 | `goodvibes update` now recognized |
| `program.version('1.0.0')` hardcoded | `program.version(pkg.version)` dynamic | Phase 10 | `--version` always matches published package |
| Headroom install: silent spinner | Explicit status messages + description | Phase 10 | Beginners know what is happening |
| No doctor command | `goodvibes doctor` with 5 checks | Phase 10 | Setup verification is now automated |

**Deprecated/outdated:**
- The `'../../package.json'` path in `upgrade.ts` `getInstalledVersion()` is latent-broken (always returns `null` in the local dev tree). The correct path is `'../package.json'`. Phase 10 uses the correct path in new code; whether to backfix upgrade.ts is the planner's call (ponytail says only touch what the task requires).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Typer `app.command('update')(upgrade_cmd)` registers a second name for the same function without side effects | Standard Stack, Code Examples | If Typer errors on duplicate registration, need a thin wrapper function instead |
| A2 | `goodvibes update` should be an alias for `upgrade`, not a distinct command with different behavior | Architecture Patterns | If user intent is a genuinely different command (e.g., `update` for templates only, `upgrade` for self-update), the alias approach is wrong — needs discussion |
| A3 | `shutil.which('headroom')` returning non-None is sufficient to detect headroom installed (vs. broken install) | Code Examples | If headroom binary exists but is broken, the idempotency check passes silently; unlikely but possible |
| A4 | Platform-setup guides for Cursor, Windsurf, Kiro, Replit, Bolt.new are adequate VCC-06 coverage | Phase Requirements | If VCC-06 means "add a section to existing IDE rule files" rather than "add new platform-setup guide files", the approach changes |
| A5 | `docs/getting-started.md` is a new file in `templates/docs/` (not a replacement for `docs/onboarding.md`) | Architecture Patterns | If the intent is to rename/replace onboarding.md, the existing file must be removed from templates and test assertions updated |

---

## Open Questions (RESOLVED)

1. **`update` vs `upgrade`: alias or rename?**
   - What we know: Phase 10 ROADMAP says `goodvibes update`; REQUIREMENTS.md v2 item NPM-V2-01 says `goodvibes update`; Phase 5 shipped `goodvibes upgrade`.
   - What's unclear: Should `upgrade` be removed (breaking change), kept alongside `update` (both work), or `update` become the primary name with `upgrade` as the alias?
   - Recommendation: Safest (ponytail): `.alias('update')` makes `upgrade` the canonical name and `update` the alias. This is non-breaking, minimal diff. If `update` should be primary, flip the alias order.

2. **What platform-setup guides already exist vs. what VCC-06 needs?**
   - What we know: `templates/docs/platform-setup/` has `base44.md` and `chatgpt.md`. The goodvibes-hygiene SKILL.md already has IDE callout text covering all supported IDEs.
   - What's unclear: VCC-06 says "non-Claude Code IDE users get a 'what do I do now?' section in their platform setup guide." Does this mean new `platform-setup/*.md` files per IDE, or sections added to existing IDE rule template files?
   - Recommendation: New `platform-setup/*.md` files for each IDE listed in Phase 8/9 that doesn't already have one. Reuse the content structure from `base44.md` and `chatgpt.md`.

3. **Should `goodvibes doctor` also check git repo initialization (`git rev-parse --git-dir`)?**
   - What we know: ROADMAP success criteria lists: "headroom installed, git configured, CLAUDE.md present, sentinel block intact."
   - What's unclear: "git configured" could mean (a) git user identity set, or (b) current directory is a git repo.
   - Recommendation: Interpret as (a) user identity configured — that's what "git configured" means in vibe-coding onboarding contexts. Being inside a git repo is not checked.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20+ | npm CLI | ✓ | v20+ (enforced by engines field) | — |
| npm CLI | npm test | ✓ | present | — |
| Python 3.12 (venv) | pip CLI tests | ✓ | 3.12 | — |
| uv | pip test runner | ✓ | present | — |
| vitest | npm unit tests | ✓ | ^4 | — |
| pytest + pytest-mock | pip unit tests | ✓ | installed in venv | — |
| git | doctor check target | ✓ | 2.43.0 | skip git checks if ENOENT |
| headroom | doctor check target | ✓ | 0.28.0 | probe gracefully |

**Missing dependencies with no fallback:** none.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (npm) | vitest ^4 |
| Config file (npm) | `package.json` scripts (`vitest run`) |
| Quick run command (npm) | `cd packages/npm && npm test` |
| Full suite command (npm) | `cd packages/npm && npm test` |
| Framework (pip) | pytest + pytest-mock ^3, pytest-asyncio ^0.25 |
| Config file (pip) | `packages/pip/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command (pip) | `cd packages/pip && uv run pytest tests/ -x -q` |
| Full suite command (pip) | `cd packages/pip && uv run pytest tests/` |

**Important:** Always run pip tests from `packages/pip/`, not repo root — see CLAUDE.md.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| VCC-01 | `goodvibes update` invokes upgrade logic | unit | `cd packages/npm && npm test` | `src/commands/upgrade.test.ts` (add alias test) |
| VCC-01 | Python `goodvibes update` invokes upgrade logic | unit | `cd packages/pip && uv run pytest tests/test_upgrade_cmd.py` | `tests/test_upgrade_cmd.py` (add alias test) |
| VCC-02 | Doctor exits 0 when all checks pass | unit | `cd packages/npm && npm test` | `src/commands/doctor.test.ts` (new) |
| VCC-02 | Doctor exits 1 when headroom not installed | unit | `cd packages/npm && npm test` | `src/commands/doctor.test.ts` (new) |
| VCC-02 | Doctor exits 1 when git user.name not set | unit | `cd packages/npm && npm test` | `src/commands/doctor.test.ts` (new) |
| VCC-02 | Doctor exits 1 when CLAUDE.md absent | unit | `cd packages/npm && npm test` | `src/commands/doctor.test.ts` (new) |
| VCC-02 | Doctor exits 1 when sentinel missing from CLAUDE.md | unit | `cd packages/npm && npm test` | `src/commands/doctor.test.ts` (new) |
| VCC-02 | Doctor prints remediation for each failing check | unit | `cd packages/npm && npm test` | `src/commands/doctor.test.ts` (new) |
| VCC-02 | Python doctor equivalent tests | unit | `cd packages/pip && uv run pytest tests/test_doctor_cmd.py` | `tests/test_doctor_cmd.py` (new) |
| VCC-03 | `--version` output matches package.json version | unit | `cd packages/npm && npm test` | `src/index.test.ts` (update todo) |
| VCC-03 | Python `--version` output includes version string | unit | `cd packages/pip && uv run pytest tests/test_main.py` | `tests/test_main.py` (existing or add) |
| VCC-05 | Headroom install logs "already installed" when on PATH | unit | `cd packages/npm && npm test` | `src/steps/install-headroom.test.ts` (add) |
| VCC-05 | Headroom install logs description before subprocess | unit | `cd packages/npm && npm test` | `src/steps/install-headroom.test.ts` (add) |
| VCC-05 | Python headroom install logs "already installed" | unit | `cd packages/pip && uv run pytest tests/test_install_headroom.py` | `tests/test_install_headroom.py` (add) |
| VCC-04 | `getting-started.md` is copied by `copyTemplates` | existing `copy-templates` tests cover docs/ | `cd packages/npm && npm test` | `src/steps/copy-templates.integration.test.ts` (check file count) |
| VCC-06 | Platform-setup files copied for each IDE | existing `copy-templates` tests | manual check | n/a (static files, no new CLI logic) |

### Sampling Rate

- **Per task commit:** `cd packages/npm && npm test && cd packages/pip && uv run pytest tests/ -x -q`
- **Per wave merge:** Same as above (full suite)
- **Phase gate:** Both suites green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/commands/doctor.test.ts` — covers VCC-02 (new file)
- [ ] `tests/test_doctor_cmd.py` — covers VCC-02 Python parity (new file)

*(All other test infrastructure exists; gaps are only the new doctor test files.)*

---

## Security Domain

Phase 10 introduces no new input boundaries, file writes, or external service calls beyond what the existing codebase already handles. Doctor reads local files (already-trusted template dir) and runs subprocesses with arg arrays (no shell=True). No ASVS categories newly applicable.

The only new subprocess calls are:
- `execa('headroom', ['--version'])` — read-only probe, no user input
- `execa('git', ['config', 'user.name'])` — read-only, no user input

Both follow the existing `no shell:true, args as arrays` pattern enforced throughout the codebase.

---

## Sources

### Primary (HIGH confidence)
- Commander.js `Readme.md` in local `node_modules/commander/` — `.version()`, `.alias()` API [VERIFIED: local node_modules]
- Commander.js README line 556: `.alias()` documented and confirmed working via `node -e` test [VERIFIED: local node_modules]
- `packages/npm/src/index.ts`, `upgrade.ts`, `init.ts` — existing patterns [VERIFIED: codebase]
- `packages/pip/src/goodvibes_cli/main.py`, `commands/upgrade_cmd.py`, `commands/init_cmd.py` — existing patterns [VERIFIED: codebase]
- `packages/npm/dist/index.js` + manual `createRequire` probe: `'../package.json'` correct, `'../../package.json'` broken [VERIFIED: local test]
- `npm pack --dry-run` output confirming published package layout [VERIFIED: local test]
- `headroom mcp status` exit code behavior [VERIFIED: local execution]
- `git config nonexistent.key` exit code = 1 [VERIFIED: local execution]
- `shutil.which('headroom')` behavior [VERIFIED: local Python test]
- Typer 0.26.7 installed in pip venv [VERIFIED: local venv]
- Commander.js 15.0.0 on npm registry [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- Typer multiple-name command registration (`app.command('update')(same_fn)`) — tested locally with no errors [ASSUMED — behavior confirmed but not against official Typer docs]

---

## Metadata

**Confidence breakdown:**
- VCC-01 (update alias): HIGH — verified Commander `.alias()` and Typer dual-command registration work
- VCC-02 (doctor command): HIGH — all four checks use verified existing patterns
- VCC-03 (--version fix): HIGH — path bug identified and correct path verified by direct test
- VCC-04 (getting-started.md): HIGH — pure template file, no new CLI logic
- VCC-05 (headroom transparency): HIGH — `log()` callback already wired; idempotency pattern mirrors configure-mcp
- VCC-06 (IDE guides): HIGH — pattern established by base44.md and chatgpt.md examples

**Research date:** 2026-07-01
**Valid until:** 2026-07-31 (stable APIs; Commander and Typer are very stable)
