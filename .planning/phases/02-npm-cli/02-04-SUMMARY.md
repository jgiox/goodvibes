---
phase: 02-npm-cli
plan: "04"
subsystem: cli-tooling
tags: [typescript, commander, clack-prompts, init-command, dry-run, minimal, tdd, esm, fs-extra]

dependency_graph:
  requires:
    - phase: 02-npm-cli
      plan: "02"
      provides: copyTemplates, listTemplateFiles, resolveTemplatesDir signatures
    - phase: 02-npm-cli
      plan: "03"
      provides: installHeadroom(log), configureMcp(log) signatures
  provides:
    - packages/npm/src/commands/init.ts (registerInitCommand — complete action handler)
    - packages/npm/src/commands/init.test.ts (5 passing unit tests, all behaviors covered)
    - packages/npm/src/index.ts (updated entry point wiring registerInitCommand)
  affects:
    - Phase 5 (update command will follow same registerXCommand pattern)

tech-stack:
  added: []
  patterns:
    - "registerXCommand(program) pattern: subcommand registration extracted from index.ts into commands/*.ts files — index.ts stays minimal"
    - "@clack/prompts tasks() API: array of {title, task(message)} objects; task returns string caption"
    - "Commander boolean option normalization: options.dryRun ?? false handles undefined when flag not provided"
    - "Probe-based resolveTemplatesDir: existsSync check on dist-relative path, fallback to source-relative — handles both vitest (source) and runtime (dist) without conditional compilation"
    - "ESM named export fix: fs-extra (CJS) does not export readFile/writeFile as named ESM exports — use node:fs/promises instead"
    - "TDD RED/GREEN: test file committed first (fails), then implementation committed (passes)"

key-files:
  created:
    - packages/npm/src/commands/init.ts
    - packages/npm/src/commands/init.test.ts
  modified:
    - packages/npm/src/index.ts
    - packages/npm/src/steps/copy-templates.ts
    - packages/npm/src/utils/sentinel-merge.ts
    - scripts/verify-phase2.sh

key-decisions:
  - "registerInitCommand(program) exported from commands/init.ts — keeps index.ts as a thin entry point; follows registerXCommand pattern established for Phase 5"
  - "options.dryRun ?? false normalization: Commander sets boolean flags to undefined (not false) when absent; explicit fallback prevents subtle truthy checks from misbehaving"
  - "Probe-based resolveTemplatesDir: probing both dist-relative and source-relative paths rather than build-time conditional — simpler, no tsup plugin needed, zero test infrastructure changes"
  - "node:fs/promises for readFile/writeFile: fs-extra is CJS and Node 20 ESM named export interop does not expose all fs-extra re-exports; stdlib is always available"
  - "verify-phase2.sh stub checks updated: NPM-06-DRYRUN-SRC and NPM-07-MINIMAL-SRC pointed at index.ts (old stub location); corrected to commands/init.ts"

metrics:
  duration: "7 minutes"
  completed: "2026-06-23"
  tasks_completed: 2
  files_created: 2
  files_modified: 4
---

# Phase 02 Plan 04: Init Command Integration Summary

Wire the complete `goodvibes init` command by composing copyTemplates, installHeadroom, and configureMcp into a @clack/prompts tasks() flow with --dry-run and --minimal flag handling.

## What Was Built

`commands/init.ts` exports `registerInitCommand(program)` which wires the `init` subcommand with:
- 3 named @clack/prompts spinner steps: "Copying template files", "Installing headroom", "Configuring headroom MCP"
- `--dry-run`: lists files with "Would write:" prefix via `listTemplateFiles`, skips all writes and step 2/3
- `--minimal`: runs only the copy step with `minimal=true`, skips installHeadroom and configureMcp
- "Files created" note with full file list; "Next steps" note with exactly 3 items; `outro("You're all set!")`

`index.ts` updated to import and call `registerInitCommand(program)` — the inline stub replaced by proper command module.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] fs-extra named ESM exports unavailable**
- **Found during:** Task 2 (smoke test of `node dist/index.js init --dry-run`)
- **Issue:** `sentinel-merge.ts` and `copy-templates.ts` imported `readFile`/`writeFile` from `fs-extra`. fs-extra is CJS; Node 20 ESM named export interop does not bridge these to `readFile`/`writeFile` (they come from Node's `fs` module, not fs-extra's own API).
- **Fix:** Changed both files to import `readFile`, `writeFile` from `node:fs/promises`; kept `outputFile`, `pathExists`, `copy` from `fs-extra` (these are properly exported by fs-extra's CJS as named ESM interop)
- **Files modified:** `packages/npm/src/utils/sentinel-merge.ts`, `packages/npm/src/steps/copy-templates.ts`
- **Commit:** 9bdb46e

**2. [Rule 1 - Bug] resolveTemplatesDir path incorrect in dist bundle**
- **Found during:** Task 2 (dry-run threw ENOENT `/home/ygiokas/templates`)
- **Issue:** Original `resolveTemplatesDir()` used `new URL('../../../../templates', import.meta.url)` designed for source file depth (`src/steps/`). When tsup bundles into `dist/index.js` (1 level deep), the same relative path resolves to `/home/ygiokas/templates` (wrong).
- **Fix:** Probe-based approach: check `existsSync('../templates')` relative to `import.meta.url` (dist path, correct at runtime); fallback to `../../../../templates` (source path, correct for vitest). Both the existing copy-templates tests and the new dry-run smoke test pass.
- **Files modified:** `packages/npm/src/steps/copy-templates.ts`
- **Commit:** 9bdb46e

**3. [Rule 1 - Bug] verify-phase2.sh stub checks pointing at wrong file**
- **Found during:** Post-task verification (`bash scripts/verify-phase2.sh`)
- **Issue:** NPM-06-DRYRUN-SRC and NPM-07-MINIMAL-SRC checked `src/index.ts` for `dry-run`/`minimal` strings (written when plan expected stub wiring in index.ts). After refactor to `commands/init.ts`, index.ts no longer contains these strings.
- **Fix:** Updated both checks to reference `src/commands/init.ts`; full phase gate now passes (32/32).
- **Files modified:** `scripts/verify-phase2.sh`
- **Commit:** 13eecd3

## Verification

All success criteria met:

| Check | Result |
|-------|--------|
| `commands/init.ts` exports `registerInitCommand` | PASS |
| `index.ts` imports `registerInitCommand` with `.js` extension | PASS |
| `head -1 index.ts` is `#!/usr/bin/env node` | PASS |
| `npm run build` exits 0 | PASS |
| `node dist/index.js init --help` shows `--dry-run` and `--minimal` | PASS |
| `node dist/index.js init --dry-run` exits 0, no stdin block, shows CLAUDE.md | PASS |
| `npm test` exits 0 — 45 tests passing | PASS |
| `bash scripts/verify-phase2.sh` — 32/32 checks, Phase 2 gate: PASS | PASS |

## Self-Check: PASSED

All committed files exist and all commits verified in git log.
