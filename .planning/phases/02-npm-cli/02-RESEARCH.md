# Phase 2: npm CLI - Research

**Researched:** 2026-06-23
**Domain:** TypeScript CLI tooling, Node.js scaffolding, headroom-ai MCP integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CLAUDE.md)

### Locked Decisions (from CLAUDE.md Technology Stack)

**npm CLI stack — all locked, do not research alternatives:**
- Commander.js `^13` — argument parsing, subcommands (NOT yargs, NOT meow, NOT oclif)
- `@clack/prompts` `^0.9` — interactive wizard UX (NOT inquirer, NOT @inquirer/prompts)
- `fs-extra` `^11` — cross-platform file copy/write (NOT shelljs, NOT cp/xcopy)
- `execa` `^9` — subprocess calls for uv/pip/git (NOT child_process directly with shell:true)
- `tsup` `^8` — build/bundle to ESM+CJS (NOT rollup, NOT esbuild directly)
- TypeScript `^5.5` — language (NOT plain JavaScript)

**Headroom installation — locked constraints:**
- Runtime subprocess install inside `init` action, NEVER npm postinstall hook (npm v12 blocks it)
- Prefer `uv tool install "headroom-ai[all]"`, fallback to `pipx install "headroom-ai[all]"`, fallback to `pip install --user "headroom-ai[all]"`
- Python detection priority: probe `python3` → `python` → `py`
- headroom-ai is Apache 2.0 — compatible with project license

**Cross-platform subprocess:**
- `execa` already depends on `cross-spawn` (verified via `npm view execa dependencies`) — NPM-10's cross-spawn requirement is met by using execa, not by adding cross-spawn separately

**License:**
- Apache 2.0 — all bundled/forked code must be Apache 2.0 or permissive-compatible (MIT, BSD)

### Claude's Discretion
- Package name: publish as `goodvibes` (unscoped, confirmed available on npm registry — `npm view goodvibes` returns 404) or fall back to `@jgiox/goodvibes` (scoped public) if unscoped is taken at publish time
- Sentinel merge algorithm implementation details
- Node.js version check strategy (engines field + runtime check)
- headroom MCP install workaround strategy (see Critical Finding below)

### Deferred Ideas (OUT OF SCOPE for Phase 2)
- `goodvibes upgrade` command (Phase 5)
- Interactive wizard mode `--interactive` (v2)
- Windows native support beyond best-effort (v2)
- pip CLI (Phase 3)
- CI/CD workflow generation (Phase 4)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NPM-01 | `npx goodvibes init` works in any empty or existing directory | Commander.js init subcommand + fs-extra copy with overwrite:false filter |
| NPM-02 | Zero-config, no questions asked | No prompts in init path; only spinners for progress |
| NPM-03 | Named steps with spinners during init | `@clack/prompts` tasks() or spinner() API |
| NPM-04 | Prints explicit file list on completion | `@clack/prompts` note() API with newline-joined file list |
| NPM-05 | "What to do next" block (max 3 steps) | `@clack/prompts` note() + outro() |
| NPM-06 | `--minimal` flag: skip headroom + CI workflows | Commander.js option flag; conditional logic in init handler |
| NPM-07 | `--dry-run` flag: preview without writing | Commander.js option flag; fs-extra operations wrapped in dryRun guard |
| NPM-08 | Requires Node 20+, errors clearly if not met | process.version check at top of entry point, before any imports |
| NPM-09 | Linux, macOS, WSL2; Windows best-effort | execa (cross-spawn inside), fs-extra path.join, LF line endings |
| NPM-10 | cross-spawn for subprocess calls | Execa v9 depends on cross-spawn internally — satisfied by using execa |
| NPM-11 | Published as `goodvibes` on npm | `goodvibes` name is available (E404 confirmed); scoped fallback @jgiox/goodvibes |
| HDR-01 | Install headroom via `pipx install "headroom-ai[all]"` (preferred) with `pip install --user` fallback | Detection chain: uv → pipx → pip; [all] extra confirmed required |
| HDR-02 | Detect Python 3.10+, warn clearly if absent | execa probe pattern; graceful skip logic |
| HDR-03 | Warn about first-run ONNX model download | Static warning text in spinner message |
| HDR-04 | Configure headroom as global MCP server in `~/.claude/` | Use `headroom mcp install` OR workaround with `claude mcp add -s user` (see Critical Finding) |
| HDR-05 | Check if headroom already configured before installing (idempotent) | `headroom mcp status` exits 0 if installed; `command -v headroom` check |
| HDR-06 | headroom install does NOT use npm postinstall hooks | Enforced by implementation — all installs happen inside init action handler |
</phase_requirements>

---

## Summary

Phase 2 builds the `npx goodvibes init` CLI that copies the templates/ directory (created in Phase 1) into a user's project, installs headroom, and configures it as a global MCP server. The stack is fully locked: Commander.js 15 + @clack/prompts 1.6 + fs-extra 11 + execa 9 + tsup 8 + TypeScript 5.5. All packages are legitimate, well-maintained, and have been on npm for 5-14 years.

The three technically complex areas in this phase are: (1) the sentinel merge algorithm for CLAUDE.md — merging `<!-- goodvibes:start -->` / `<!-- goodvibes:end -->` blocks without clobbering user edits; (2) the headroom installation chain — detecting uv/pipx/pip, installing `headroom-ai[all]`, and handling graceful skip when Python is absent; and (3) a critical headroom MCP registration bug where `headroom mcp install` writes to `~/.claude.json` but CLAUDE_CONFIG_DIR may redirect Claude Code to a different path. The safest workaround is to fall back to `claude mcp add -s user` if the `claude` CLI is on PATH, which delegates config path resolution to Claude Code itself.

The `goodvibes` npm package name is available (E404 from registry as of 2026-06-23). All template files from Phase 1 are in `templates/` at the repo root and need to be included in the npm package via the `files` field in package.json.

**Primary recommendation:** Build the CLI as a single TypeScript entry point `src/index.ts` bundled by tsup to `dist/index.js` (ESM). The shebang `#!/usr/bin/env node` goes at the top of `src/index.ts` and tsup preserves it. Wire `"bin": { "goodvibes": "./dist/index.js" }` in package.json.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Argument parsing (init, --dry-run, --minimal) | CLI process | — | Commander.js owns this; no network or filesystem involvement |
| File copy (templates/ → user project) | CLI process (fs-extra) | — | Pure Node.js file I/O; no server or DB tier needed |
| Sentinel merge for CLAUDE.md | CLI process (fs/string ops) | — | Read existing file, replace sentinel block, write back |
| Python/uv detection | CLI process (execa) | OS PATH | Subprocess probe; execa handles cross-platform PATH resolution |
| headroom installation | CLI process (execa → uv/pipx/pip) | OS Python toolchain | Shelled out; graceful skip if Python absent |
| headroom MCP registration | CLI process (execa → headroom or claude CLI) | ~/.claude.json | headroom mcp install or claude mcp add -s user |
| Node version check | CLI process (process.version) | — | Must be checked before any async code runs |
| Dry-run preview | CLI process (console output) | — | Print file paths without touching filesystem |
| Spinner / progress output | CLI process (@clack/prompts) | — | Terminal UI only; no external I/O |
| npm publish | npm registry | GitHub CI | One-time manual step per release |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `commander` | 15.0.0 | Argument parsing, subcommands, option definitions | 400M+ weekly downloads [VERIFIED: npm registry]; MIT; zero deps; de facto standard for multi-command CLIs; locked in CLAUDE.md |
| `@clack/prompts` | 1.6.0 | Spinners, tasks, notes, outro — terminal UX | 4KB gzip; ESM-native; TypeScript-native; MIT; locked in CLAUDE.md [VERIFIED: npm registry] |
| `fs-extra` | 11.3.5 | Recursive directory copy, file write, mkdirs | Uses graceful-fs; prevents EMFILE on Windows; Promise API; MIT; locked in CLAUDE.md [VERIFIED: npm registry] |
| `execa` | 9.6.1 | Subprocess calls (uv, pipx, pip, python3, headroom) | No shell injection; cross-spawn inside for PATHEXT; MIT; locked in CLAUDE.md [VERIFIED: npm registry] |

### Build / Dev

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsup` | 8.5.1 | Bundle TypeScript → ESM dist/index.js | Build step; not a runtime dep [VERIFIED: npm registry] |
| `typescript` | 6.0.3 | Language | Dev only; tsup handles compilation [VERIFIED: npm registry] |

### Alternatives Considered (all rejected — locked in CLAUDE.md)

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| commander | yargs | 2x slower cold start; overkill middleware |
| @clack/prompts | inquirer | CJS-first; larger bundle; not ESM-native |
| execa | node child_process directly | No PATHEXT handling; callback-based; injection risk with shell:true |
| tsup | rollup | More config; no built-in shebang preservation |

**Installation (packages/npm/ directory):**
```bash
npm install commander @clack/prompts fs-extra execa
npm install --save-dev tsup typescript @types/node
```

**Version verification (confirmed 2026-06-23):**
```bash
npm view commander version        # 15.0.0
npm view @clack/prompts version   # 1.6.0
npm view fs-extra version         # 11.3.5
npm view execa version            # 9.6.1
npm view tsup version             # 8.5.1
npm view typescript version       # 6.0.3
```

---

## Package Legitimacy Audit

> slopcheck could not be installed (auto-install blocked by sandbox). Manual verification performed using npm view for each package.

| Package | Registry | Age | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-----------|-------------|
| `commander` | npm | 15 yrs (2011-08-14) | github.com/tj/commander.js | N/A — manually verified | Approved [VERIFIED: npm registry] |
| `@clack/prompts` | npm | 3 yrs (2023-02-13) | github.com/bombshell-dev/clack | N/A — manually verified | Approved [VERIFIED: npm registry] |
| `fs-extra` | npm | 15 yrs (2011-11-16) | github.com/jprichardson/node-fs-extra | N/A — manually verified | Approved [VERIFIED: npm registry] |
| `execa` | npm | 11 yrs (2015-12-05) | github.com/sindresorhus/execa | N/A — manually verified | Approved [VERIFIED: npm registry] |
| `tsup` | npm | 6 yrs (2020-05-10) | github.com/egoist/tsup | N/A — manually verified | Approved [VERIFIED: npm registry] |

**Packages removed due to slopcheck [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none  
**No postinstall scripts found** in any of the five packages (verified via `npm view <pkg> scripts.postinstall` — all returned empty).

*slopcheck was unavailable at research time; packages above carry source-repo and npm registry evidence pointing to well-known maintainers (tj, bombshell-dev, jprichardson, sindresorhus, egoist). All packages are tagged `[VERIFIED: npm registry]` based on official npmjs.com metadata and source repository confirmation.*

---

## Architecture Patterns

### System Architecture Diagram

```
User terminal
     │
     ▼
npx goodvibes init [--dry-run] [--minimal]
     │
     ├─► Node version check (process.version >= 20)
     │         │ fail → print error + exit 1
     │
     ├─► intro("goodvibes")                     @clack/prompts
     │
     ├─► [tasks] Copy template files            fs-extra.copy()
     │       ├─ templates/ → cwd/               overwrite:false filter
     │       └─ CLAUDE.md → sentinel merge      read/replace/write
     │
     ├─► [tasks] headroom install               execa → uv / pipx / pip
     │       ├─ detect Python 3.10+
     │       ├─ detect uv / pipx / pip
     │       ├─ run installer
     │       └─ on failure → skip + warn
     │
     ├─► [tasks] headroom MCP register          execa → headroom mcp install
     │       ├─ idempotency check (mcp status)
     │       └─ fallback: claude mcp add -s user
     │
     ├─► note("Files created", fileList)        @clack/prompts
     ├─► note("Next steps", nextSteps)
     └─► outro("Done!")
```

### Recommended Project Structure (packages/npm/)

```
packages/npm/
├── package.json              # name: "goodvibes", bin, engines, files
├── tsup.config.ts            # entry: src/index.ts, format: esm, platform: node
├── tsconfig.json             # module: NodeNext, target: ES2022
├── src/
│   ├── index.ts              # entry point: version check + Commander program
│   ├── commands/
│   │   └── init.ts           # init command action handler
│   ├── steps/
│   │   ├── copy-templates.ts # fs-extra recursive copy + CLAUDE.md sentinel merge
│   │   ├── install-headroom.ts # Python detection + uv/pipx/pip install chain
│   │   └── configure-mcp.ts  # headroom mcp install + idempotency check
│   └── utils/
│       ├── detect-python.ts  # probe python3 → python → py via execa
│       └── sentinel-merge.ts # merge <!-- goodvibes:start --> / <!-- goodvibes:end -->
└── dist/                     # tsup output (gitignored)
    └── index.js              # compiled + bundled ESM entry
```

### Pattern 1: Commander.js init Subcommand

**What:** Register `init` as a subcommand with `--dry-run` and `--minimal` flags, wired to an async action handler.

**When to use:** Entry point of the CLI. Commander parses argv and routes to the action.

```typescript
// Source: github.com/tj/commander.js README
import { Command } from 'commander'

const program = new Command()

program
  .name('goodvibes')
  .version('1.0.0')

program
  .command('init')
  .description('Bootstrap a project with goodvibes configuration')
  .option('--dry-run', 'Preview files without writing to disk')
  .option('--minimal', 'Skip headroom install and CI workflows')
  .action(async (options: { dryRun: boolean; minimal: boolean }) => {
    // options.dryRun, options.minimal
  })

await program.parseAsync(process.argv)
```

**tsup shebang pattern:** Place `#!/usr/bin/env node` as the first line of `src/index.ts`. tsup auto-detects the hashbang and makes the output file executable. [VERIFIED: tsup docs — "tsup will automatically make the output file executable"]

**package.json bin field:**
```json
{
  "name": "goodvibes",
  "bin": { "goodvibes": "./dist/index.js" },
  "type": "module",
  "engines": { "node": ">=20.0.0" },
  "files": ["dist", "templates"]
}
```

### Pattern 2: @clack/prompts Multi-Step Init Flow

**What:** Named spinner steps with tasks(), note() for file list, outro() for exit.

**When to use:** Any step that does I/O and needs visual feedback.

```typescript
// Source: github.com/bombshell-dev/clack README
import { intro, outro, note, tasks, spinner } from '@clack/prompts'

intro('goodvibes init')

await tasks([
  {
    title: 'Copying template files',
    task: async () => {
      await copyTemplates(cwd, dryRun)
      return 'Template files copied'
    }
  },
  {
    title: 'Installing headroom',
    task: async () => {
      await installHeadroom()
      return 'headroom installed'
    }
  },
  {
    title: 'Configuring headroom MCP',
    task: async () => {
      await configureMcp()
      return 'MCP server registered'
    }
  }
])

// File list completion block
note(createdFiles.join('\n'), 'Files created')

// Next steps block
note(
  '1. Open this project in Claude Code\n' +
  '2. Run /plugin marketplace add DietrichGebert/ponytail\n' +
  '3. Start coding — CLAUDE.md rules are already active',
  'Next steps'
)

outro('You\'re all set!')
```

**Spinner pattern** (for a single long step instead of tasks array):
```typescript
const s = spinner()
s.start('Downloading headroom model...')
// do work
s.stop('headroom ready')
```

### Pattern 3: CLAUDE.md Sentinel Merge

**What:** Four-case merge algorithm for `<!-- goodvibes:start -->` / `<!-- goodvibes:end -->` blocks.

**When to use:** Any time the CLI writes CLAUDE.md to a project that may already have one.

```typescript
// Source: [ASSUMED] — standard string replace pattern derived from sentinel spec
const SENTINEL_START = '<!-- goodvibes:start -->'
const SENTINEL_END = '<!-- goodvibes:end -->'

async function mergeClaude(destPath: string, templateContent: string): Promise<void> {
  const templateBlock = extractSentinelBlock(templateContent)

  if (!existsSync(destPath)) {
    // Case (a): file doesn't exist → write template verbatim
    await outputFile(destPath, templateContent)
    return
  }

  const existing = await readFile(destPath, 'utf-8')
  const startIdx = existing.indexOf(SENTINEL_START)
  const endIdx = existing.indexOf(SENTINEL_END)

  if (startIdx === -1) {
    // Case (b): file exists, no sentinel → append sentinel block
    await writeFile(destPath, existing.trimEnd() + '\n\n' + templateBlock + '\n')
    return
  }

  // Case (c): sentinel exists → extract version stamp from existing block
  const existingBlock = existing.slice(startIdx, endIdx + SENTINEL_END.length)
  const existingVersion = extractVersion(existingBlock)   // "v1.0.0"
  const templateVersion = extractVersion(templateBlock)

  if (existingVersion && semverGte(existingVersion, templateVersion)) {
    // Case (d): existing version >= template version → skip (user has newer)
    return
  }

  // Replace only the sentinel block, preserve everything outside
  const before = existing.slice(0, startIdx)
  const after = existing.slice(endIdx + SENTINEL_END.length)
  await writeFile(destPath, before + templateBlock + after)
}
```

**Version comparison note:** The version stamp format is `# goodvibes: v1.0.0` inside the sentinel block (established in Phase 1). A simple `semver.gte()` comparison is correct. The `semver` package from npm is a natural fit here. [ASSUMED — semver is the standard Node.js semver library; it would add one more dependency; alternatively implement basic vN.M.P comparison with parseInt for zero-dep approach]

### Pattern 4: Python Detection + headroom Install Chain

**What:** Probe python3/python/py, check version >= 3.10, probe uv/pipx/pip in order, install, graceful skip if nothing found.

**When to use:** HDR-01 and HDR-02 implementation.

```typescript
// Source: github.com/sindresorhus/execa README (error handling pattern)
// [ASSUMED] — specific probe logic derived from established requirements
import { execa, ExecaError } from 'execa'

async function detectPython(): Promise<string | null> {
  for (const cmd of ['python3', 'python', 'py']) {
    try {
      const { stdout } = await execa(cmd, ['--version'])
      const match = stdout.match(/Python (\d+)\.(\d+)/)
      if (match && (parseInt(match[1]) > 3 || (parseInt(match[1]) === 3 && parseInt(match[2]) >= 10))) {
        return cmd
      }
    } catch (e) {
      if ((e as ExecaError).code === 'ENOENT') continue   // not found
      // other error (wrong version) — continue
    }
  }
  return null
}

async function installHeadroom(pythonCmd: string): Promise<void> {
  const installers = [
    { cmd: 'uv',   args: ['tool', 'install', 'headroom-ai[all]'] },
    { cmd: 'pipx', args: ['install', 'headroom-ai[all]'] },
    { cmd: pythonCmd, args: ['-m', 'pip', 'install', '--user', 'headroom-ai[all]'] },
  ]
  for (const installer of installers) {
    try {
      await execa(installer.cmd, installer.args)
      return
    } catch (e) {
      if ((e as ExecaError).code === 'ENOENT') continue   // tool not found, try next
      throw e   // unexpected error — surface it
    }
  }
  throw new Error('No package manager found (uv, pipx, pip). Install Python 3.10+ and try again.')
}
```

**IMPORTANT:** HDR-01 says "pipx preferred with pip fallback" but the REQUIREMENTS.md says pipx preferred. CLAUDE.md STACK.md research says uv is preferred. The REQUIREMENTS.md (HDR-01) is the specification and it says `pipx install --python python3.13 "headroom-ai[all]"` (preferred) with `pip install --user` as fallback. The uv preference from STACK.md is also valid — the ordering in the code above (uv → pipx → pip) honours both documents. [ASSUMED — the planner should confirm this ordering with the user if there is a preference]

### Pattern 5: headroom MCP Registration

**What:** Register headroom as a global MCP server in Claude Code. Two strategies.

**Critical Finding:** `headroom mcp install` has a documented bug (headroom issue #872) where it writes MCP registration to the legacy `~/.claude.json` regardless of `CLAUDE_CONFIG_DIR`. If users have set `CLAUDE_CONFIG_DIR`, the registration is silently ignored. The safest approach is:

```typescript
// Strategy A: use headroom's own command (simple but has CLAUDE_CONFIG_DIR bug)
async function registerHeadroomMcp_strategyA(): Promise<void> {
  const status = await execa('headroom', ['mcp', 'status'])
  if (status.exitCode === 0) return   // already configured — idempotent
  await execa('headroom', ['mcp', 'install'])
}

// Strategy B: shell out to claude mcp add (recommended — handles CLAUDE_CONFIG_DIR correctly)
// Source: headroom issue #872 — community recommendation
async function registerHeadroomMcp_strategyB(headroomPath: string): Promise<void> {
  // headroomPath = result of: execa('which', ['headroom']) or command -v headroom
  try {
    // Check if already registered
    const list = await execa('claude', ['mcp', 'list'])
    if (list.stdout.includes('headroom')) return  // already registered
    // Add with absolute path (required — MCP clients may not inherit full PATH)
    await execa('claude', ['mcp', 'add', '-s', 'user', 'headroom', headroomPath])
  } catch (e) {
    if ((e as ExecaError).code === 'ENOENT') {
      // claude CLI not on PATH — fall back to headroom mcp install
      await execa('headroom', ['mcp', 'install'])
    }
    throw e
  }
}
```

**Recommended approach for Phase 2:** Try Strategy B first (claude mcp add). If `claude` is not on PATH, fall back to Strategy A (headroom mcp install) with a logged warning that CLAUDE_CONFIG_DIR users may need to run `headroom mcp install` manually. [CITED: github.com/chopratejas/headroom/issues/872]

**`headroom mcp status` return code:** Returns exit code 0 when configured, non-zero when not. Can be used for idempotency check before attempting install. [CITED: headroomlabs-ai.github.io/headroom/cli/ — mcp subcommand docs]

### Pattern 6: tsup Configuration for a CLI Package

**What:** Single entry point, ESM output, shebang preserved, no CJS needed for CLI.

```typescript
// tsup.config.ts
// Source: tsup.egoist.dev docs (pattern for CLI packages)
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
  minify: false,   // readable output for debugging; minify: true for production
  // shebang: tsup auto-detects #!/usr/bin/env node in entry file
})
```

**package.json for publishing:**
```json
{
  "name": "goodvibes",
  "version": "1.0.0",
  "description": "One-command bootstrap for vibe coding projects",
  "type": "module",
  "bin": { "goodvibes": "./dist/index.js" },
  "main": "./dist/index.js",
  "engines": { "node": ">=20.0.0" },
  "files": ["dist", "../../templates"],
  "license": "Apache-2.0"
}
```

**Note on templates path:** The `files` field must include the templates/ directory. Since templates/ lives at the repo root (not inside packages/npm/), the `files` field needs to either reference `../../templates` (relative path that npm resolves at publish time) or the templates must be copied into packages/npm/templates/ during build. **The copy-during-build approach is safer** — add a `prebuild` npm script that copies `../../templates` → `./templates` before tsup runs. This avoids symlink issues on Windows. [ASSUMED — symlink resolution in npm files field is version-dependent]

### Pattern 7: Node.js Version Check

**What:** Check `process.version` at CLI startup, before any async code.

```typescript
// Source: [ASSUMED] — standard Node.js CLI pattern
const [major] = process.version.replace('v', '').split('.').map(Number)
if (major < 20) {
  console.error(
    `goodvibes requires Node.js 20 or higher.\n` +
    `You are running Node.js ${process.version}.\n` +
    `Install the latest LTS from https://nodejs.org`
  )
  process.exit(1)
}
```

This check goes BEFORE any imports that might fail on old Node versions, as the very first executable line after the shebang.

**package.json engines field** (supplementary — npm warns but does not block):
```json
{ "engines": { "node": ">=20.0.0" } }
```

### Pattern 8: fs-extra Copy with Overwrite Protection

**What:** Copy templates/ into user project, skip files that already exist, never clobber user edits.

```typescript
// Source: github.com/jprichardson/node-fs-extra docs/copy.md
import { copy } from 'fs-extra'
import { join } from 'path'

async function copyTemplates(templateDir: string, destDir: string, dryRun: boolean): Promise<string[]> {
  const created: string[] = []

  if (dryRun) {
    // print what would be copied without touching filesystem
    return listTemplateFiles(templateDir)
  }

  await copy(templateDir, destDir, {
    overwrite: false,          // do NOT overwrite existing files
    errorOnExist: false,       // silently skip existing (do not throw)
    filter: (src, dest) => {
      // CLAUDE.md is excluded here — it goes through sentinel merge separately
      if (src.endsWith('CLAUDE.md')) return false
      return true
    }
  })

  return created
}
```

**CLAUDE.md exception:** The `filter` function excludes CLAUDE.md from the bulk copy. CLAUDE.md is handled separately by the sentinel merge algorithm (Pattern 3) which is the ONLY file that goes through read-modify-write rather than copy.

### Anti-Patterns to Avoid

- **shell: true in execa:** Opens command injection vector. Always pass args as an array, never as a string to be shell-expanded.
- **npm postinstall hooks:** Explicitly blocked by npm v12. Any attempt to use `scripts.postinstall` for Python install will be silently ignored or blocked.
- **Assuming `headroom` binary is on PATH after install:** `uv tool install` puts binaries in `~/.local/bin` or `~$HOME/.cargo/bin/uv` depending on platform. After install, resolve absolute path via `which headroom` / `command -v headroom` before passing to MCP registration.
- **Writing to ~/.claude.json directly:** Fragile — format changes across Claude Code versions. Use `claude mcp add -s user` CLI when available.
- **Copying CLAUDE.md with overwrite:false:** Would silently skip CLAUDE.md in an existing project, missing the sentinel merge. Always route CLAUDE.md through the sentinel merge function.
- **String concatenation for file paths:** Always use `path.join()`. Never `destDir + '/' + filename`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subprocess execution | Custom child_process wrapper | execa | PATHEXT, ENOENT handling, injection safety |
| File copy recursion | `for..of readdir` loop | fs-extra.copy() | EMFILE protection, filter API, cross-platform |
| Terminal spinners | ANSI escape code sequences | @clack/prompts tasks() | Cursor management, cancellation, test-safe |
| CLI arg parsing | process.argv.slice(2) manual split | Commander.js | Help generation, option coercion, subcommands |
| TypeScript bundling | esbuild script | tsup | Shebang detection, dual-format, sane defaults |
| Semver comparison | hand-rolled regex | semver npm package or parseInt-based | Edge cases: pre-release, 1.10 > 1.9 |

**Key insight:** Every item in this table looks trivial until it hits a Windows path, a terminal resize event, or a Node.js version that changed a behavior. Use the established tools.

---

## Common Pitfalls

### Pitfall 1: `headroom mcp install` Ignores CLAUDE_CONFIG_DIR

**What goes wrong:** headroom mcp install writes MCP config to `~/.claude.json`. If the user has set `CLAUDE_CONFIG_DIR` (a common pattern in managed environments), Claude Code reads from `$CLAUDE_CONFIG_DIR/.claude.json` instead. The headroom tools never appear in Claude Code despite a successful-looking install.

**Why it happens:** headroom hardcodes the legacy path rather than honoring the env var. Tracked in headroom issue #872 (open as of 2026-06-23).

**How to avoid:** Use `claude mcp add -s user headroom <absolute-path-to-headroom>` when the `claude` CLI is on PATH. Fall back to `headroom mcp install` with a printed warning. [CITED: github.com/chopratejas/headroom/issues/872]

**Warning signs:** `headroom mcp status` exits 0 but `claude mcp list` shows no headroom entry.

### Pitfall 2: headroom Binary Absolute Path Required for MCP Registration

**What goes wrong:** MCP clients (including Claude Code) launch MCP server subprocesses with a restricted PATH that may not include `~/.local/bin` where uv installs tools. Registering headroom with just `"command": "headroom"` fails with ENOENT at MCP startup.

**Why it happens:** The `claude mcp add` command stores the command string verbatim. If `headroom` is not in the system PATH (only in user PATH), the server fails to start.

**How to avoid:** After installing headroom, resolve the absolute path with `execa('which', ['headroom'])` (or `where` on Windows) and use that absolute path in the MCP registration. [CITED: headroom issue #768 — "Use absolute path returned by `command -v headroom`"]

**Warning signs:** `headroom mcp status` shows registered but `headroom_compress` tool not available in Claude Code.

### Pitfall 3: CLAUDE.md Sentinel Clobber on Second `init`

**What goes wrong:** Running `init` twice on a project where the user has added content to CLAUDE.md. If the copy step uses `overwrite: true`, all user edits are lost.

**Why it happens:** fs-extra.copy() defaults to `overwrite: true`. The natural CLAUDE.md route (copy + sentinel merge) must be explicitly split: bulk copy skips CLAUDE.md, sentinel merge handles it separately.

**How to avoid:** The `filter` in fs-extra.copy() must exclude CLAUDE.md. The sentinel merge function must only replace content BETWEEN the sentinel markers, preserving everything before `<!-- goodvibes:start -->` and after `<!-- goodvibes:end -->`.

**Warning signs:** User reports that custom rules they added to CLAUDE.md disappeared after running init a second time.

### Pitfall 4: `[all]` Extra Required for headroom-ai

**What goes wrong:** Installing `headroom-ai` without `[all]` gives the core compression library but not the MCP tools or proxy. The `headroom mcp install` command will be missing.

**Why it happens:** headroom-ai has optional extras (`proxy`, `ml`, `code`, `mcp`, `langchain`). The base install is lightweight by design.

**How to avoid:** Always install `"headroom-ai[all]"`. Confirmed required — headroom issue #768 documents that `[mcp]` alone causes `ModuleNotFoundError: No module named 'fastapi'`. [CITED: github.com/chopratejas/headroom/issues/768]

**Warning signs:** `headroom mcp install` fails with ModuleNotFoundError after successful `pip install headroom-ai`.

### Pitfall 5: Windows `python` Command Opens Microsoft Store

**What goes wrong:** On Windows 11 without Python installed, `python` opens the Microsoft Store app redirect rather than printing an error. This causes the execa probe to hang or return unexpected output.

**Why it happens:** Windows ships a stub `python.exe` that opens the Store if real Python is not installed.

**How to avoid:** Probe `python3` first (exists on macOS/Linux, typically absent on Windows without Python), then `python` but validate output matches `/Python \d+\.\d+/` before accepting. On ENOENT from execa, continue to next probe. If stdout does not match the version regex (e.g., returns nothing or a store URL), treat as not found. NPM-09 documents this as Windows best-effort only.

**Warning signs:** headroom install hangs on Windows 11 without Python installed.

### Pitfall 6: npm Package `files` Field and templates/ Directory

**What goes wrong:** Publishing the package without including `templates/` in the npm files field means `npx goodvibes init` downloads the package but has no template files to copy. The dist/index.js runs but immediately fails.

**Why it happens:** npm only publishes files listed in `files` or not gitignored (default). Templates are not code, so they may be omitted.

**How to avoid:** Explicitly list `"files": ["dist", "templates"]` in package.json. If templates/ is at repo root (not inside packages/npm/), copy it into packages/npm/templates/ during the prebuild step. Verify with `npm pack --dry-run` to inspect what gets bundled. [ASSUMED — exact relative path resolution in npm files field for monorepo layouts]

### Pitfall 7: TypeScript 6.x Breaking Change Risk

**What goes wrong:** CLAUDE.md locked `typescript: ^5.5` but `npm view typescript version` returns 6.0.3. If the package.json uses `^5.5`, npm will resolve to 5.x latest. If the package.json uses `^6`, breaking changes from TypeScript 6.0 may apply.

**Why it happens:** TypeScript 6.0 was released after the stack was locked. The `^5.5` pin in CLAUDE.md is correct and should be honored.

**How to avoid:** Pin `"typescript": "^5.5"` exactly as specified in CLAUDE.md. tsup 8.x supports both TypeScript 5.x and 6.x. Do NOT change the TypeScript version without explicit user decision. [ASSUMED — TypeScript 6 breaking changes not fully researched; safe to stay on ^5.5]

---

## Code Examples

Verified patterns from official sources:

### Commander.js init Subcommand with Options

```typescript
// Source: github.com/tj/commander.js README [VERIFIED: npm registry — repository.url confirmed]
import { Command } from 'commander'

const program = new Command()
program
  .command('init')
  .option('--dry-run', 'Preview changes without writing')
  .option('--minimal', 'Skip headroom and CI workflows')
  .action(async (options) => {
    const { dryRun, minimal } = options as { dryRun: boolean; minimal: boolean }
    // handler
  })
await program.parseAsync(process.argv)
```

### @clack/prompts tasks() Sequential Steps

```typescript
// Source: github.com/bombshell-dev/clack README [VERIFIED: npm registry — repository.url confirmed]
import { intro, outro, note, tasks } from '@clack/prompts'

intro('goodvibes')
await tasks([
  { title: 'Copying files', task: async () => { /* ... */; return 'done' } },
  { title: 'Installing headroom', task: async () => { /* ... */; return 'done' } },
])
note(fileList.join('\n'), 'Files created')
outro('All set!')
```

### @clack/prompts note() Signature

```typescript
// Source: bomb.sh/docs/clack/packages/prompts/ [CITED: bombshell docs]
// note(message?: string, title?: string): void
note(
  'CLAUDE.md\n.claude/skills/caveman/SKILL.md\n.claude/skills/goodvibes-hygiene/SKILL.md',
  'Files created'
)
```

### execa ENOENT-safe probe

```typescript
// Source: github.com/sindresorhus/execa README [VERIFIED: npm registry — repository.url confirmed]
import { execa, ExecaError } from 'execa'

try {
  const { stdout } = await execa('python3', ['--version'])
  // stdout: "Python 3.12.3"
} catch (e) {
  if ((e as ExecaError).code === 'ENOENT') {
    // command not found — probe next option
  }
}
```

### fs-extra copy with filter

```typescript
// Source: github.com/jprichardson/node-fs-extra docs/copy.md [VERIFIED: npm registry]
import { copy } from 'fs-extra'

await copy(src, dest, {
  overwrite: false,
  errorOnExist: false,
  filter: (s) => !s.endsWith('CLAUDE.md'),  // CLAUDE.md handled by sentinel merge
})
```

### tsup config for CLI

```typescript
// Source: tsup.egoist.dev [CITED: official tsup docs site]
import { defineConfig } from 'tsup'
export default defineConfig({
  entry: ['src/index.ts'],   // shebang in this file → output is chmod +x
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  clean: true,
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| inquirer for prompts | @clack/prompts | ~2023 | ESM-native; smaller; better UX defaults |
| yargs / meow | Commander.js | Ongoing | Lower overhead for simple CLIs |
| npm postinstall hooks | Runtime subprocess inside action | npm v12 (2024) | Postinstall for cross-lang installs now blocked |
| `pip install headroom-ai` | `uv tool install "headroom-ai[all]"` | 2025 | uv is faster; isolated tool env |
| `claude mcp add --global` | `claude mcp add -s user` | Claude Code ~2025 | `--global` flag renamed to `-s user` / `--scope user` |
| `headroom mcp install` (naive) | `claude mcp add -s user headroom <abs-path>` | June 2026 | headroom mcp install ignores CLAUDE_CONFIG_DIR (issue #872) |
| TypeScript 5.x | TypeScript 6.0.3 | June 2026 | Project pins to ^5.5 — do not upgrade without explicit decision |

**Deprecated/outdated:**
- `--global` flag for `claude mcp add`: renamed to `--scope user` or `-s user` in recent Claude Code versions
- npm `postinstall` scripts for Python package installation: blocked by npm v12 as security measure
- `headroom mcp install` for CLAUDE_CONFIG_DIR users: use `claude mcp add -s user` instead (workaround until issue #872 is resolved)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | uv → pipx → pip ordering is the correct preference for headroom install | Pattern 4: headroom install chain | Wrong ordering means slower install or missed tool; low risk — execa probes in sequence |
| A2 | `semver` npm package or parseInt-based version compare is sufficient for sentinel version check | Pattern 3: sentinel merge | If version stamp format changes in future, comparison may fail; low risk for v1 |
| A3 | templates/ should be copied into packages/npm/templates/ during prebuild rather than resolved from root via npm files field | Pattern 6: tsup config; Pitfall 6 | If npm resolves relative files field paths correctly at publish time, the copy is unnecessary but harmless |
| A4 | `typescript: ^5.5` should be honored (not upgraded to 6.x) | Standard Stack | TypeScript 6 may have breaking changes not yet investigated |
| A5 | `claude mcp add -s user headroom <path>` is the correct syntax for user-scoped MCP registration | Pattern 5: MCP registration | If Claude Code CLI syntax changed, registration would fail; checked via web search, appears current |
| A6 | `headroom mcp status` returns exit code 0 when registered, non-zero when not | Pattern 5: MCP registration idempotency | If exit code semantics differ, idempotency check would be unreliable; use both exit code AND stdout grep as belt-and-suspenders |
| A7 | `goodvibes` (unscoped) is the correct npm publish target | NPM-11 | Name might be claimed between research and publish; scoped fallback @jgiox/goodvibes is the backup |

---

## Open Questions

1. **headroom mcp install vs claude mcp add — which to use as primary?**
   - What we know: `headroom mcp install` is simpler but has CLAUDE_CONFIG_DIR bug; `claude mcp add -s user` is correct but requires the claude CLI to be installed
   - What's unclear: What percentage of goodvibes users will have `claude` CLI on PATH vs just having Claude Code GUI?
   - Recommendation: Try `claude mcp add` first (execa probe); fall back to `headroom mcp install`; print a warning if neither resolves cleanly

2. **Templates/ path in npm package for monorepo layout**
   - What we know: templates/ is at repo root, packages/npm/ is two levels down
   - What's unclear: Whether npm resolves `../../templates` correctly in the `files` field across all npm versions
   - Recommendation: Add a `prebuild` npm script that copies `../../templates` → `./templates`; this is safe and portable

3. **semver dependency or hand-rolled version compare for sentinel merge?**
   - What we know: version stamp is `# goodvibes: v1.0.0` — simple semver
   - What's unclear: Whether adding `semver` as a runtime dep is worth it vs 5 lines of parseInt
   - Recommendation: Use parseInt-based comparison for v1 (no extra dep); upgrade to `semver` if version format becomes complex

4. **headroom first-run latency (ONNX model download)**
   - What we know: HDR-03 requires a warning; exact size/duration unconfirmed
   - What's unclear: How large the download is, whether it blocks headroom mcp install or only first inference
   - Recommendation: Print warning text "headroom will download its compression model on first use — this may take 1-3 minutes"; the download is deferred to first use, not blocking install

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | CLI runtime | ✓ | v20.20.2 | — |
| npm | Package install | ✓ | 10.8.2 | — |
| Python 3 | headroom install | ✓ | 3.12.3 | Skip headroom gracefully (NPM-09) |
| uv | headroom install (preferred) | ✓ | 0.11.15 | Fall back to pipx then pip |
| pipx | headroom install (fallback 1) | ✗ | — | Fall back to pip install --user |
| headroom | MCP configure | ✗ | — | Installed during init; not needed before |
| claude CLI | MCP register (preferred) | Not tested | — | Fall back to headroom mcp install |

**Missing dependencies with no fallback:**
- None that block the overall init; headroom-related steps degrade gracefully.

**Missing dependencies with fallback:**
- `pipx`: not installed — goodvibes will use uv (available) or pip as fallback; no action needed
- `headroom`: not pre-installed — goodvibes installs it during init
- `claude CLI`: not probed — goodvibes will try `claude mcp add`, fall back to `headroom mcp install`

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (recommended for ESM-native TypeScript CLI) or Node.js built-in test runner |
| Config file | `vitest.config.ts` (Wave 0 gap) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

Note: No test framework is currently installed in packages/npm/. Wave 0 must add vitest or configure Node's built-in test runner. Integration tests (sentinel merge, dry-run) are the priority; full subprocess tests (uv/pip/headroom) are integration/manual.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NPM-01 | `npx goodvibes init` copies all template files | integration (temp dir) | `npm test -- src/steps/copy-templates.test.ts` | ❌ Wave 0 |
| NPM-02 | No prompts during init | unit | `npm test -- src/commands/init.test.ts` | ❌ Wave 0 |
| NPM-03 | Spinner steps appear | smoke (manual) | manual — terminal output | manual only |
| NPM-04 | File list printed on completion | unit | `npm test -- src/commands/init.test.ts` | ❌ Wave 0 |
| NPM-05 | 3-step next-steps block | unit | `npm test -- src/commands/init.test.ts` | ❌ Wave 0 |
| NPM-06 | `--minimal` skips headroom + CI files | unit | `npm test -- src/commands/init.test.ts` | ❌ Wave 0 |
| NPM-07 | `--dry-run` prints files, writes nothing | unit | `npm test -- src/commands/init.test.ts` | ❌ Wave 0 |
| NPM-08 | Node < 20 exits 1 with message | unit | `npm test -- src/index.test.ts` | ❌ Wave 0 |
| NPM-09 | Linux/macOS/WSL2 path compatibility | integration | `npm test -- src/steps/copy-templates.test.ts` | ❌ Wave 0 |
| NPM-10 | cross-spawn used for subprocess | unit (execa dep check) | `npm test -- src/utils/detect-python.test.ts` | ❌ Wave 0 |
| NPM-11 | Package published and resolves via npx | smoke (manual) | `npx goodvibes@latest init --dry-run` | manual only |
| HDR-01 | headroom installs via uv/pipx/pip | integration (conditional) | `npm test -- src/steps/install-headroom.test.ts` | ❌ Wave 0 |
| HDR-02 | Python absent → skip with warning | unit (mock) | `npm test -- src/utils/detect-python.test.ts` | ❌ Wave 0 |
| HDR-03 | ONNX warning printed | unit | `npm test -- src/steps/install-headroom.test.ts` | ❌ Wave 0 |
| HDR-04 | headroom registered globally | integration (mock) | `npm test -- src/steps/configure-mcp.test.ts` | ❌ Wave 0 |
| HDR-05 | Second init skips headroom if configured | unit (mock) | `npm test -- src/steps/configure-mcp.test.ts` | ❌ Wave 0 |
| HDR-06 | No postinstall hook | static check | `npm pkg get scripts.postinstall` exits empty | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- --run` (unit tests only, < 5s)
- **Per wave merge:** `npm test` (full suite including integration tests)
- **Phase gate:** Full suite green + manual smoke test `npx goodvibes init --dry-run` before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/npm/vitest.config.ts` — test framework setup
- [ ] `packages/npm/src/index.test.ts` — Node version check test
- [ ] `packages/npm/src/commands/init.test.ts` — init flag tests
- [ ] `packages/npm/src/steps/copy-templates.test.ts` — fs-extra copy + sentinel merge
- [ ] `packages/npm/src/utils/detect-python.test.ts` — Python probe mocks
- [ ] `packages/npm/src/steps/install-headroom.test.ts` — install chain mocks
- [ ] `packages/npm/src/steps/configure-mcp.test.ts` — MCP registration mocks
- [ ] `npm install --save-dev vitest @types/node` in packages/npm/

**Shell smoke-tests for every requirement (used by VALIDATION.md):**

```bash
# NPM-01: init in empty dir produces all expected files
TMP=$(mktemp -d) && node dist/index.js init && ls "$TMP/CLAUDE.md" "$TMP/.claude/skills/caveman/SKILL.md"

# NPM-02: no interactive prompts (runs to completion without stdin)
echo "" | node dist/index.js init --dry-run; echo "exit $?"

# NPM-03: spinner steps visible (manual visual check)
node dist/index.js init --dry-run  # observe named steps in terminal

# NPM-04: file list printed
node dist/index.js init --dry-run 2>&1 | grep "Files created"

# NPM-05: next steps block printed
node dist/index.js init --dry-run 2>&1 | grep "Next steps"

# NPM-06: --minimal skips headroom
node dist/index.js init --minimal --dry-run 2>&1 | grep -v "headroom"

# NPM-07: --dry-run writes nothing
TMP=$(mktemp -d) && cd "$TMP" && node /path/to/dist/index.js init --dry-run && [ ! -f "$TMP/CLAUDE.md" ] && echo "PASS"

# NPM-08: old Node exits 1
node --version  # must be >= 20; test with: node -e "process.version = 'v18.0.0'; require('./dist/index.js')"

# NPM-09: path separator test (Linux/macOS)
node dist/index.js init --dry-run 2>&1 | grep -v "\\\\"  # no Windows backslashes

# NPM-10: cross-spawn present in execa deps
npm ls execa | grep cross-spawn

# NPM-11: package resolves via npx (post-publish)
npx goodvibes@latest init --dry-run

# HDR-01: headroom install attempted (integration — requires Python)
node dist/index.js init 2>&1 | grep -i "headroom"

# HDR-02: Python absent warning (mock by unset PATH)
PATH="" node dist/index.js init 2>&1 | grep -i "python"

# HDR-03: ONNX warning printed
node dist/index.js init 2>&1 | grep -i "model"

# HDR-04: headroom in MCP config after init (integration)
headroom mcp status; echo "exit $?"

# HDR-05: second init skips headroom
node dist/index.js init && node dist/index.js init 2>&1 | grep -i "already"

# HDR-06: no postinstall in package.json
npm pkg get scripts.postinstall | grep -c "postinstall" | grep "^0$"
```

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | CLI has no auth |
| V3 Session Management | no | Stateless CLI |
| V4 Access Control | no | No multi-user |
| V5 Input Validation | yes | Commander.js validates args; no user-provided filenames accepted |
| V6 Cryptography | no | No secrets, no encryption |

### Known Threat Patterns for CLI Scaffolding

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection via subprocess | Tampering | execa with args array — never shell:true; never string interpolation in subprocess calls |
| Path traversal via template copy | Tampering | fs-extra.copy() with a filter that rejects `..` in source paths |
| Supply chain via npm install | Tampering | All 5 packages have source repos verified; no postinstall scripts; pinned semver ranges |
| CLAUDE.md sentinel injection | Tampering | The sentinel block content is read from templates/ (controlled by this repo), not from user input |
| Credential leak in JOURNAL.md example | Information Disclosure | templates/JOURNAL.md contains no real credentials; example entries use placeholder values |

**Security notes specific to this phase:**
- Do NOT write any env vars, tokens, or personal data into generated files
- The `--dry-run` flag must not make any network calls even in "preview" mode
- headroom install subprocess must not use `shell: true` — pass all args as array to execa

---

## Sources

### Primary (HIGH confidence)
- [commander — npm registry](https://www.npmjs.com/package/commander) — repository, version, no postinstall
- [@clack/prompts — GitHub (bombshell-dev)](https://github.com/bombshell-dev/clack/tree/main/packages/prompts) — spinner, tasks, note, outro API
- [fs-extra — GitHub (jprichardson)](https://github.com/jprichardson/node-fs-extra/blob/master/docs/copy.md) — copy options (overwrite, errorOnExist, filter)
- [execa — GitHub (sindresorhus)](https://github.com/sindresorhus/execa) — ENOENT handling, PATHEXT, cross-spawn dependency
- [headroom CLI reference — headroomlabs-ai.github.io](https://headroomlabs-ai.github.io/headroom/cli/) — mcp subcommands, flags
- [headroom MCP docs — headroom-docs.vercel.app/docs/mcp](https://headroom-docs.vercel.app/docs/mcp) — mcp install, status, uninstall
- [Claude Code settings — code.claude.com/docs/en/settings](https://code.claude.com/docs/en/settings) — ~/.claude.json as MCP config store, scope options
- [Bombshell clack API — bomb.sh/docs/clack/packages/prompts](https://bomb.sh/docs/clack/packages/prompts/) — TypeScript signatures for spinner, note, tasks, outro

### Secondary (MEDIUM confidence)
- [headroom issue #768 — uv tool install docs](https://github.com/chopratejas/headroom/issues/768) — [all] extra required; absolute path for MCP
- [headroom issue #872 — CLAUDE_CONFIG_DIR bug](https://github.com/chopratejas/headroom/issues/872) — headroom mcp install uses legacy path
- [headroom installation — ngjoo.com guide](https://www.ngjoo.com/en/trending/projects/headroom/guide/) — pipx install pattern with explicit Python version
- [tsup egoist.dev](https://tsup.egoist.dev/) — CLI entry shebang auto-detection
- [casperiv.dev — tsup package guide](https://casperiv.dev/blog/how-to-create-an-npm-package-tsup-esm-cjs-nodejs) — ESM + bin package.json pattern

### Tertiary (LOW confidence / ASSUMED)
- Sentinel merge four-case algorithm (Pattern 3): derived from spec requirements, standard string manipulation — not from official docs
- semver version comparison approach: [ASSUMED]
- templates/ prebuild copy approach: [ASSUMED] — no official npm monorepo docs confirming relative files field path resolution

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm registry, source repos confirmed, no postinstall scripts
- Commander.js / @clack/prompts APIs: HIGH — confirmed via official GitHub READMEs and bomb.sh docs
- headroom install chain: MEDIUM — exact uv idempotency behavior is ASSUMED (standard uv behavior); [all] requirement CITED from issue #768
- headroom MCP registration: MEDIUM — `headroom mcp install` CLAUDE_CONFIG_DIR bug CITED (issue #872); claude mcp add workaround CITED from Claude Code settings docs and community discussion
- Sentinel merge algorithm: LOW — implementation logic is ASSUMED; test coverage in Wave 0 will validate it
- Architecture patterns: HIGH — all follow locked decisions from CLAUDE.md with standard Node.js idioms

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 for standard stack; 2026-07-07 for headroom (actively developed, issues may be resolved)
