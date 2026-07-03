# Architecture Research: goodvibes v1.2.0 Growth & Retention

**Milestone:** v1.2.0 — Growth & Retention (headroom validation, telemetry, update command)
**Researched:** 2026-07-03
**Confidence:** HIGH — all findings from direct source-code reading, no inference required

---

## Existing Architecture — Canonical Map

The codebase is a two-package monorepo. TypeScript is canonical; Python is a port. Every feature lands in both simultaneously.

```
packages/npm/src/
  index.ts                         <- entry; registers all three commands
  commands/
    init.ts                        <- action handler; orchestrates steps via tasks()
    upgrade.ts                     <- action handler; self-update + template sync; exposes .alias('update')
    doctor.ts                      <- health-check command; checkHeadroom(), checkGit(), etc.
  steps/
    copy-templates.ts              <- copyTemplates(), listTemplateFiles(), resolveTemplatesDir()
    install-headroom.ts            <- installHeadroom(log) → Promise<void>
    configure-mcp.ts               <- configureMcp(log) → Promise<void>
  utils/
    detect-project-type.ts
    detect-python.ts
    sentinel-merge.ts

packages/pip/src/goodvibes_cli/
  main.py                          <- Typer app; registers init, upgrade, update, doctor
  commands/
    init_cmd.py                    <- mirrors init.ts; orchestrates steps via console.status()
    upgrade_cmd.py                 <- mirrors upgrade.ts; self-update + template sync
    doctor_cmd.py
  steps/
    copy_templates.py
    install_headroom.py            <- install_headroom(log) → None
    configure_mcp.py               <- configure_mcp(log) → None
  utils/
    detect_project_type.py
    detect_python.py
    sentinel_merge.py
```

Two architectural invariants to preserve:
1. Steps accept a `log: (msg: string) => void` / `log: Callable[[str], None]` — never write to console directly.
2. Steps never throw on soft failures (installer not found, headroom binary absent). They log and return.

---

## Feature 1: Headroom Integration Validation

### Finding: Validation already happens — it is just not returned

`installHeadroom()` already runs an idempotency probe (`headroom --version` in TS, `shutil.which("headroom")` in Python) and has three distinct internal outcomes:

| Outcome | Current behavior | What user sees |
|---------|-----------------|----------------|
| Python not found | logs skip message, returns | spinner updates, then disappears |
| Already installed | logs "already installed — skipping", returns | spinner updates, then disappears |
| Install succeeded | returns after successful execa call | task completes silently |
| Install soft-failed | logs failure message, returns | spinner updates, then disappears |

The `log` messages reach the `@clack/prompts` spinner only while the task is active. After `tasks()` resolves, all log output is gone. `init.ts` always shows `'headroom ready'` in the task list regardless of outcome (line 73 of init.ts: the task callback returns a hardcoded string).

**Root problem:** the outcome is not surfaced in the post-init summary.

### Decision: Extend return types, not a new file

A new `validate-headroom.ts` step would re-run `headroom --version`, which `installHeadroom()` already ran. That is wasteful and violates Ponytail. The fix is returning the outcome.

**TS change — `install-headroom.ts`:**

```typescript
// Export a discriminated union instead of void
export type HeadroomResult =
  | { status: 'installed' }
  | { status: 'already-installed' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

export async function installHeadroom(log: (msg: string) => void): Promise<HeadroomResult>
```

Each existing `return` in `installHeadroom` maps to one of the four variants:
- `pythonCmd === null` → `{ status: 'skipped', reason: 'Python 3.10+ not found' }`
- probe succeeds → `{ status: 'already-installed' }`
- `execa` install succeeds → `{ status: 'installed' }`
- all installers exhausted or CalledProcessError → `{ status: 'failed', reason: ... }`

**TS change — `configure-mcp.ts`:**

```typescript
export type McpResult =
  | { status: 'registered' }
  | { status: 'already-registered' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

export async function configureMcp(log: (msg: string) => void): Promise<McpResult>
```

**TS change — `init.ts`:** consume the return values and emit them in the post-init summary:

```typescript
let headroomResult: HeadroomResult | undefined
let mcpResult: McpResult | undefined

// inside task:
{ title: 'Installing headroom', task: async () => {
    headroomResult = await installHeadroom(message)
    return headroomResult.status
}},
{ title: 'Configuring headroom MCP', task: async () => {
    mcpResult = await configureMcp(message)
    return mcpResult.status
}},

// after tasks():
note(formatHeadroomStatus(headroomResult, mcpResult), 'Headroom')
```

`formatHeadroomStatus` is a small inline helper in `init.ts` — no new file.

**Python changes mirror TS exactly:**
- `install_headroom.py`: return a `dict` or `TypedDict` with `status` key (string literal)
- `configure_mcp.py`: same
- `init_cmd.py`: capture return values, print a Rich Panel with the headroom status after other panels

**Modified files (Feature 1):**

| File | Change |
|------|--------|
| `packages/npm/src/steps/install-headroom.ts` | Change return type `void → HeadroomResult`; add return values at each exit point |
| `packages/npm/src/steps/configure-mcp.ts` | Change return type `void → McpResult`; add return values at each exit point |
| `packages/npm/src/commands/init.ts` | Capture return values; emit headroom status note after summary |
| `packages/npm/src/steps/install-headroom.test.ts` | Update test assertions for new return type |
| `packages/npm/src/steps/configure-mcp.test.ts` | Update test assertions for new return type |
| `packages/pip/src/goodvibes_cli/steps/install_headroom.py` | Change return `None → dict`; add returns at each exit point |
| `packages/pip/src/goodvibes_cli/steps/configure_mcp.py` | Change return `None → dict`; add returns at each exit point |
| `packages/pip/src/goodvibes_cli/commands/init_cmd.py` | Capture return values; emit headroom status panel |

**New files (Feature 1): Zero.**

---

## Feature 2: Anonymous Install Telemetry

### Decision: Utility function, called fire-and-forget from init action handler

**Not a step.** Steps appear in the `tasks()` list, are user-visible, and block the init flow on error. Telemetry must be invisible and must never block init.

**Not inline in `init.ts`.** A named utility function in `utils/` is testable in isolation, matches the existing `detect-python.ts` / `sentinel-merge.ts` pattern, and keeps `init.ts` clean.

**TS — new file `packages/npm/src/utils/telemetry.ts`:**

```typescript
// Single exported function: fire-and-forget, never throws, never logs on success.
// Called without await from init.ts action handler, after tasks() completes.
export function sendTelemetry(): void {
  // Implementation: one HTTP request to a counter endpoint.
  // No PII. No await at call site. Process exits naturally after init.
}
```

Call site in `init.ts` (after the `note(nextSteps, 'Next steps')` and before `outro()`):

```typescript
sendTelemetry()  // fire-and-forget; no await
outro("You're all set!")
```

**Python — new file `packages/pip/src/goodvibes_cli/utils/telemetry.py`:**

```python
def send_telemetry() -> None:
    """Fire-and-forget counter increment. Never raises. No PII."""
    ...
```

Call site in `init_cmd.py` after `console.rule(...)`:

```python
send_telemetry()  # fire-and-forget; synchronous with short timeout
```

**Telemetry implementation constraints:**
- No PII: no IP logging beyond what the endpoint's host logs by default, no user agent with version strings, no project name
- A simple GET request to a counter URL is sufficient (e.g., a Cloudflare Worker, a Plausible custom event endpoint, or a self-hosted tally)
- Timeout: 2 seconds max. Never retry. Swallow all exceptions.
- The endpoint URL must be a constant in the utility file, not user-configurable

**Modified files (Feature 2):**

| File | Change |
|------|--------|
| `packages/npm/src/commands/init.ts` | Add `sendTelemetry()` call after tasks complete |
| `packages/pip/src/goodvibes_cli/commands/init_cmd.py` | Add `send_telemetry()` call after tasks complete |

**New files (Feature 2):**

| File | Purpose |
|------|---------|
| `packages/npm/src/utils/telemetry.ts` | Fire-and-forget HTTP counter for npm package |
| `packages/pip/src/goodvibes_cli/utils/telemetry.py` | Mirror for pip package |

---

## Feature 3: `goodvibes update` Command

### Finding: Already implemented in both packages — the alias exists today

**npm (`upgrade.ts` line 138–139):**
```typescript
program
  .command('upgrade')
  .alias('update')
```

Running `goodvibes update` already invokes the full upgrade flow: self-update check against npm registry, template file sync, CLAUDE.md sentinel merge.

**pip (`main.py` line 28):**
```python
app.command("update")(upgrade_cmd)
```

The pip package registers `update` as an independent command (not an alias in Typer's model, but the same function). `goodvibes update` and `goodvibes upgrade` are equivalent today.

### What "Active (v1.2.0)" actually means

The PROJECT.md marks `goodvibes update` as Active, but the alias already exists. The remaining work is:

1. **Documentation**: README and `goodvibes --help` should clarify that `update` and `upgrade` are equivalent. Currently neither is mentioned explicitly in the docs as the "canonical" command.

2. **Validation under v1.2.0 changes**: If Feature 1 (headroom status) is added to `init.ts`, the `update` command might also want to re-run `installHeadroom()` to surface headroom status during update. That would be a new task in `upgrade.ts`. This is optional and should be decided at implementation time based on user-facing requirements.

**New command file: Not needed.** `upgrade.ts` / `upgrade_cmd.py` are the implementation. The alias routes to them.

**If headroom re-run during update is desired:**

```typescript
// In upgrade.ts registerUpgradeCommand(), add after template sync tasks:
if (!process.env[_GV_UPGRADING]) {  // skip during self-re-exec
  taskList.push({
    title: 'Validating headroom',
    task: async () => {
      const result = await installHeadroom(message)
      return result.status
    }
  })
}
```

This depends on Feature 1 landing first (for the return type).

**Modified files (Feature 3 — minimum):**

| File | Change |
|------|--------|
| `README.md` | Document `goodvibes update` as the canonical update command |

**Modified files (Feature 3 — if headroom re-run during update):**

| File | Change |
|------|--------|
| `packages/npm/src/commands/upgrade.ts` | Add headroom validation task after template sync |
| `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py` | Mirror: add headroom validation |

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `commands/init.ts` | Orchestration, UX, task list assembly | All steps, new telemetry util |
| `steps/install-headroom.ts` | Install headroom; return status | `utils/detect-python` |
| `steps/configure-mcp.ts` | Register headroom MCP; return status | Nothing |
| `utils/telemetry.ts` (NEW) | Fire-and-forget HTTP counter | External endpoint only |
| `commands/upgrade.ts` | Self-update + template sync; optionally headroom validation | Steps, npm registry |

---

## Build Order

Dependencies between features:

```
Feature 1 (headroom status)
  → Modify install-headroom.ts, configure-mcp.ts (return types)
  → Modify init.ts (consume return values)
  → Update test files for changed return types
  → No dependency on Features 2 or 3

Feature 2 (telemetry)
  → New telemetry.ts + telemetry.py (independent of Feature 1)
  → Modify init.ts + init_cmd.py to call send_telemetry()
  → Can land in the same PR as Feature 1 or separately

Feature 3 (update alias)
  → No code change if docs-only
  → If headroom re-run during update: requires Feature 1 to land first
    (depends on HeadroomResult return type being available in upgrade.ts)
```

### Recommended phase order

**Phase 1 — Headroom status (Feature 1):**
Start with `install-headroom.ts` return type change (TS), then update `init.ts`, then port to Python. Both test files must be updated in the same commit to keep CI green. No new files.

**Phase 2 — Telemetry (Feature 2):**
New `telemetry.ts` + `telemetry.py`. Wire into `init.ts` / `init_cmd.py`. The telemetry endpoint URL decision is a product decision that must precede implementation.

**Phase 3 — Update validation (Feature 3):**
If headroom re-run during update is in scope: modify `upgrade.ts` + `upgrade_cmd.py` after Feature 1 lands. If docs-only: can be done any time.

---

## Pitfall: HeadroomResult in the Tasks Spinner Text

`@clack/prompts` `tasks()` shows the string returned from each task callback as the completion label in the terminal. If `HeadroomResult.status` is `'skipped'`, the terminal will show "skipped" next to "Installing headroom" — which may look like a failure to a beginner user. Use a friendlier label:

```typescript
const labels: Record<HeadroomResult['status'], string> = {
  'installed': 'headroom installed',
  'already-installed': 'headroom already installed',
  'skipped': 'headroom skipped (Python 3.10+ not found)',
  'failed': 'headroom install failed — see note below',
}
return labels[result.status]
```

This is init.ts logic, not a change to the step itself.

---

## Pitfall: Telemetry in Tests

`sendTelemetry()` must be mockable in unit tests for `init.ts`. The existing pattern for steps is to pass the function as a parameter (`log: (msg: string) => void`). For telemetry, the simpler approach is to mock the module in vitest:

```typescript
// init.test.ts
vi.mock('../utils/telemetry.js', () => ({ sendTelemetry: vi.fn() }))
```

This avoids changing the call signature in `init.ts`. Verify the mock is in place before adding new tests that test post-init behavior.

---

## Pitfall: Fire-and-Forget in Python is Blocking

Python `urllib.request.urlopen` is synchronous. A 2-second timeout in the telemetry call will block `init_cmd.py` for up to 2 seconds if the endpoint is slow. Two options:

1. Use `threading.Thread(target=_send, daemon=True).start()` — truly fire-and-forget; process exit kills the thread cleanly
2. Use `urllib.request.urlopen(..., timeout=0.5)` — 500ms max block; simpler but still blocks

Recommendation: option 1 (daemon thread) for exact parity with the non-blocking JS behavior.

---

## Full File Change Map

| File | Status | Feature | Change |
|------|--------|---------|--------|
| `packages/npm/src/steps/install-headroom.ts` | MODIFY | 1 | Return `HeadroomResult` instead of `void` |
| `packages/npm/src/steps/configure-mcp.ts` | MODIFY | 1 | Return `McpResult` instead of `void` |
| `packages/npm/src/commands/init.ts` | MODIFY | 1, 2 | Consume return values; call `sendTelemetry()` |
| `packages/npm/src/steps/install-headroom.test.ts` | MODIFY | 1 | Update assertions for new return shape |
| `packages/npm/src/steps/configure-mcp.test.ts` | MODIFY | 1 | Update assertions for new return shape |
| `packages/npm/src/utils/telemetry.ts` | NEW | 2 | Fire-and-forget counter |
| `packages/pip/src/goodvibes_cli/steps/install_headroom.py` | MODIFY | 1 | Return `dict` with status key |
| `packages/pip/src/goodvibes_cli/steps/configure_mcp.py` | MODIFY | 1 | Return `dict` with status key |
| `packages/pip/src/goodvibes_cli/commands/init_cmd.py` | MODIFY | 1, 2 | Consume return values; call `send_telemetry()` |
| `packages/pip/src/goodvibes_cli/utils/telemetry.py` | NEW | 2 | Mirror of telemetry.ts |
| `packages/npm/src/commands/upgrade.ts` | MODIFY (optional) | 3 | Add headroom validation task if re-run during update is in scope |
| `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py` | MODIFY (optional) | 3 | Mirror of upgrade.ts change |
| `README.md` | MODIFY | 3 | Document `goodvibes update` as canonical command |

**Net new files: 2** (`telemetry.ts`, `telemetry.py`). All other changes are in-place modifications.
