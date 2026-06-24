# Stack Research: goodvibes

**Researched:** 2026-06-23
**Overall confidence:** HIGH (npm), HIGH (pip), MEDIUM (headroom bundling), MEDIUM (monorepo)

---

## Recommended Stack

### npm CLI Package

**Framework: Commander.js v12+**

Use Commander.js, not yargs or meow. Rationale:
- Zero dependencies — keeps `npx goodvibes init` cold-start lean (~18 ms vs ~35 ms for yargs on Node 20)
- Git-style subcommands (`init`, `update`, `check`) map naturally to its API
- MIT license — fully compatible with Apache 2.0
- 130M+ weekly downloads; the de facto standard for scaffolding CLIs (create-react-app, vue-cli, etc. all use it or Commander descendants)
- Meow is excellent for type inference but lacks subcommand support needed for future `goodvibes update` command

**Interactive prompts: @clack/prompts**

Use `@clack/prompts`, not inquirer. Rationale:
- ~4 KB gzipped vs. inquirer's much larger footprint — critical for npx cold-start experience
- TypeScript-native, ESM-first — no CommonJS shim pain
- Built-in `spinner`, `group()`, and cancellation handling cover 100% of a scaffolding wizard's needs
- Opinionated beautiful output with zero configuration — right for a "zero-config" tool aimed at beginners
- MIT license

**Language / bundler: TypeScript + tsup**

Write the CLI in TypeScript, bundle with tsup (powered by esbuild). Rationale:
- tsup outputs both ESM and CJS from one config — handles the ongoing Node.js dual-module mess without manual effort
- Single bundled file means no runtime resolution cost for npx users
- tsup is MIT licensed

**File system operations: fs-extra (MIT)**

Use `fs-extra` for all file copy / mkdir / template injection operations. It:
- Adds `copy()`, `mkdirs()`, `outputFile()` with Promises on top of Node's native `fs`
- Uses `graceful-fs` internally, preventing `EMFILE` errors on Windows (too many open file handles)
- Avoids any platform-specific shell commands (`cp`, `xcopy`) — pure Node.js, cross-platform by construction

**Subprocess calls: execa v9+ (MIT)**

Use `execa` for any subprocess invocations (e.g., calling `uv tool install headroom-ai` during init). Rationale:
- Promise-based, no callback nesting
- Correct Windows shebang and PATHEXT handling out of the box
- No shell injection risk — args are passed as arrays, not strings
- Sindre Sorhus's most downloaded utility; battle-tested on all three platforms

**Core dependencies summary:**

| Package | Version | Purpose | License |
|---|---|---|---|
| `commander` | ^13 | Argument parsing, subcommands | MIT |
| `@clack/prompts` | ^0.9 | Interactive wizard UX | MIT |
| `fs-extra` | ^11 | Cross-platform file copy/write | MIT |
| `execa` | ^9 | Subprocess calls (pip, uv, git) | MIT |
| `tsup` | ^8 | Build / bundle | MIT |
| `typescript` | ^5.5 | Language | Apache 2.0 |

All MIT — no compatibility issue with the project's Apache 2.0 license.

---

### pip CLI Package

**Framework: Typer**

Use Typer, not Click directly or argparse. Rationale:
- Built on Click (BSD-3-Clause, compatible with Apache 2.0) — inherits Click's battle-tested reliability
- Type-hint-driven API eliminates ~40% of the decorator boilerplate Click requires
- Since Typer 0.26.0, Click is vendored inside Typer — single install, no transitive version conflicts
- Auto-generated `--help` is beautiful without configuration
- MIT license

**Templating: No copier or cookiecutter**

goodvibes does not need a templating engine. The Python CLI's job is to copy static files (CLAUDE.md, workflow YAMLs, skill files) into the user's project — these are not parameterized templates that vary per user. Use Python's built-in `shutil.copy2()` and `pathlib.Path` for file injection. This is simpler, has zero additional dependencies, and avoids the `copier`/`cookiecutter` learning curve for contributors.

If variable substitution is ever needed (e.g., inserting the user's GitHub repo name), use Python's `str.replace()` or `string.Template` from the standard library — not a full templating framework.

**Package manager: uv (for development and installation)**

Recommend `uv` for the goodvibes pip package development workflow. Rationale:
- Pure Python project — no conda-forge or system libraries needed, which is exactly uv's target use case
- Dramatically faster than pip/poetry for CI and local dev
- `uv tool install headroom-ai` is the recommended way to install headroom — use this in the goodvibes init flow
- MIT license; the Astral ecosystem is dominant for new Python tooling in 2025-2026
- Pixi is overkill here (designed for mixed conda/PyPI environments, data science, system libraries)

**Python version target: 3.10+**

headroom-ai requires Python 3.10+, so goodvibes pip package must also declare `python_requires = ">=3.10"`. This is a hard lower bound driven by the dependency, not a choice.

**Core dependencies summary:**

| Package | Version | Purpose | License |
|---|---|---|---|
| `typer` | ^0.15 | CLI framework | MIT |
| `rich` | ^14 | Terminal output (pulled in by typer[all]) | MIT |
| Python stdlib only | — | File copy (`shutil`, `pathlib`) | PSF |

---

### Cross-Platform File Injection

**Use pure Node.js / pure Python — no shell commands.**

The single most important rule for cross-platform safety is: never use shell commands in scaffolding scripts. `cp`, `xcopy`, `mkdir -p`, and `rm -rf` all have platform-specific behavior or require `shell: true` in subprocess calls (which opens injection vectors).

**npm side:**

```js
import { copy, outputFile, ensureDir } from 'fs-extra'

// Copy a template directory into the user's project
await copy(templateSrcDir, targetDir, { overwrite: false, errorOnExist: false })

// Write a single generated file
await outputFile(path.join(targetDir, 'CLAUDE.md'), claudeMdContent)
```

`fs-extra.copy()` is recursive, handles nested directories, and works identically on Windows, macOS, and Linux.

**Path handling:** Always use `path.join()` or `path.resolve()` — never string concatenate paths with `/` or `\\`. On Windows, `path.join` uses backslashes automatically; `fs-extra` normalizes them for file operations.

**Python side:**

```python
import shutil
from pathlib import Path

# Recursive copy
shutil.copytree(src, dest, dirs_exist_ok=True)

# Single file
shutil.copy2(src_file, dest_file)
```

`pathlib.Path` handles separator normalization. `shutil.copytree(dirs_exist_ok=True)` (Python 3.8+) merges into existing directories without error.

**Line endings:** Ship all template files with LF (`\n`). Git's `.gitattributes` should enforce `text=auto eol=lf` on the goodvibes repo to prevent Windows CRLF commits corrupting YAML/shell scripts.

**Executable bits on shell scripts:** When copying GitHub Actions workflow files or shell scripts, preserve permissions with `shutil.copy2()` (copies metadata) on Python side, and set mode explicitly with `fs.chmod()` on the npm side if needed.

---

### Headroom Bundling Strategy

**Verdict: Runtime subprocess install via `uv tool install`, with graceful fallback.**

headroom-ai is available on both PyPI (`pip install headroom-ai`) and npm (`npm install headroom-ai`). The npm package is a TypeScript SDK that requires a running Python proxy server — it is NOT a standalone installer. This rules out making headroom-ai an npm dependency.

**Recommended flow in `goodvibes init`:**

1. Detect Python 3.10+ on the user's PATH (try `python3 --version`, then `python --version` on Windows)
2. Detect `uv` on PATH — if present, install via `uv tool install "headroom-ai[all]"` (installs into isolated tool env, globally available, idiomatic 2025 approach)
3. Fallback: if no `uv`, run `pip install --user "headroom-ai[all]"` via `execa` (npm) or `subprocess` (Python)
4. If Python is not found at all: print a clear warning, skip headroom installation, and note in the generated CLAUDE.md that headroom must be installed manually
5. Verify installation by running `headroom --version` as a subprocess

**Do NOT use npm `postinstall` hooks** to install Python packages. npm v12 is actively blocking and warning on postinstall scripts as a supply-chain security measure. A postinstall hook that calls `pip` would also fail silently on systems without Python, giving beginners a confusing partial installation.

**Do NOT declare headroom-ai as an npm `optionalDependencies`**. The npm headroom-ai package is a proxy client, not the compression tool itself. Installing it as an npm dep would pull in an SDK that won't work without the Python server running.

**Detection utility (Node.js):**

```ts
import { execa } from 'execa'

async function detectPython(): Promise<string | null> {
  for (const cmd of ['python3', 'python']) {
    try {
      const { stdout } = await execa(cmd, ['--version'])
      const match = stdout.match(/Python (\d+\.\d+)/)
      if (match && parseFloat(match[1]) >= 3.10) return cmd
    } catch {}
  }
  return null
}
```

**headroom's license: Apache 2.0** — fully compatible with goodvibes Apache 2.0. No conflict.

---

### Monorepo vs Separate Packages

**Verdict: Single Git repo, two separate top-level package directories, no monorepo tooling.**

goodvibes ships as two packages: `goodvibes` on npm and `goodvibes` on PyPI. The functional overlap is small (both copy the same set of template files), but the implementation languages are completely different. A monorepo tool like Turborepo or Nx only makes sense when tasks meaningfully cross package boundaries (shared type definitions, cross-package test runs, unified build pipelines). That doesn't apply here.

**Recommended structure:**

```
goodvibes/                     (git root, Apache 2.0)
  packages/
    npm/                       (npm package — TypeScript/Commander CLI)
      package.json
      src/
      templates/               (shared template files live HERE)
    pip/                       (pip package — Python/Typer CLI)
      pyproject.toml
      goodvibes/
        templates -> symlink to ../../npm/templates   (or copy via build step)
  .github/
    workflows/
  CLAUDE.md
  CONTRIBUTING.md
```

**Key design decision: single source of truth for templates.** Both the npm and pip installers inject identical files (CLAUDE.md, workflow YAMLs, skill files) into the user's project. Store these in `packages/npm/templates/` as the canonical source. The pip package either symlinks this directory during development or copies it as part of the pip build step (via `package_data` in `pyproject.toml`).

**Why not Turborepo/Nx?** Both are JavaScript-ecosystem-centric. Cross-language orchestration (running `uv run pytest` from the same task graph as `pnpm test`) requires significant configuration with no real benefit for a two-package project. A root `Makefile` or a root `package.json` with a few scripts is sufficient.

**Why not separate repos?** Keeping both packages in one repo means template updates (adding a new GitHub Actions workflow, updating CLAUDE.md) touch one commit, one PR, one changelog entry. Divergence between npm and pip behavior is caught in one place.

**No workspace manager needed:** pnpm workspaces or npm workspaces are not needed because the two packages don't share Node.js code. The npm package has its own `package.json`; the pip package has its own `pyproject.toml`. Root-level scripts (`make release-npm`, `make release-pip`) are sufficient.

---

## What NOT to Use and Why

| Tool | Category | Why Not |
|---|---|---|
| **yargs** | npm argument parsing | 2x slower cold start than Commander, larger footprint, overkill features (middleware, custom completion) not needed for simple `init` command |
| **meow** | npm argument parsing | No built-in subcommand support; would require manual dispatch for future `goodvibes update` |
| **inquirer / @inquirer/prompts** | npm prompts | Larger bundle, CommonJS-first (needs shim for ESM), @clack/prompts covers all needed prompt types with less code |
| **oclif** | npm CLI framework | Full framework with code generation, plugin system, Heroku-style architecture — massive overkill for a two-command installer |
| **copier / cookiecutter** | Python templating | goodvibes copies static files, not parameterized templates; `shutil.copytree` is sufficient; adding a templating dep increases contributor friction |
| **pixi** | Python env management | Designed for conda/scientific computing; adds complexity not needed for a pure-PyPI Python CLI |
| **poetry** | Python packaging | uv is faster and is the current recommendation; poetry adds lockfile complexity not needed for a CLI-only package |
| **postinstall npm hooks** | headroom installation | npm v12 actively blocks these as security risk; fails silently when Python is absent; gives beginners confusing errors |
| **npm optionalDependencies: headroom-ai** | headroom bundling | The npm headroom-ai package is a proxy client SDK, not the compression tool; installing it without the Python server running does nothing |
| **Turborepo / Nx** | Monorepo tooling | JS-ecosystem-centric, no meaningful cross-language benefit for two-package project |
| **Bazel / Pants** | Monorepo tooling | Extreme engineering overhead for what is essentially `make release-npm && make release-pip` |
| **shell: true in subprocess** | Cross-platform execution | Opens shell injection vector; execa (Node) and subprocess without shell=True (Python) are safe alternatives |

---

## Confidence Levels

| Area | Confidence | Rationale |
|---|---|---|
| Commander.js for npm | HIGH | Verified: 130M weekly downloads, MIT license, zero deps confirmed on npmjs.com; comparison data from PkgPulse benchmarks |
| @clack/prompts | HIGH | Verified: 4KB gzip confirmed, MIT, ESM-native; multiple independent sources converge on this as modern default |
| fs-extra for file ops | HIGH | Verified: standard in every major Node.js scaffolding tutorial; graceful-fs Windows behavior documented |
| execa for subprocess | HIGH | Verified: Sindre Sorhus repo, MIT, most-downloaded process utility; Windows PATHEXT handling confirmed in docs |
| tsup for bundling | HIGH | Verified: standard ESM+CJS bundler for CLI packages in 2025; used by major projects |
| Typer for pip CLI | HIGH | Verified: MIT, built on Click BSD-3, Click vendored since 0.26.0; PyPI metadata confirmed |
| uv for pip tooling | HIGH | Verified: dominant Python package manager for pure-PyPI projects in 2025-2026; astral.sh docs |
| shutil / pathlib for file ops | HIGH | Python stdlib — no research needed |
| headroom install via uv tool install | MEDIUM | headroom-ai Apache 2.0 confirmed on PyPI and GitHub; uv tool install pattern verified in uv docs; but exact behavior of `uv tool install headroom-ai[all]` on first-run (download size, ONNX model pull) not benchmarked — may be slow on first init, needs UX consideration |
| Python detection logic (python3 vs python) | MEDIUM | Windows behavior of `python` command is inconsistent (may open Microsoft Store); WSL adds PATH complexity; recommend testing explicitly on Windows 11 + WSL2 |
| Single-repo two-package structure | MEDIUM | Common pattern for dual-language CLI tools but no canonical reference; inferred from general monorepo guidance and project constraints |
| npm postinstall prohibition | HIGH | Verified: npm v12 blog post explicitly names this as security improvement being enforced |

---

## Sources

- [Commander vs Yargs 2026 — PkgPulse](https://www.pkgpulse.com/guides/commander-vs-yargs-2026)
- [CLI Framework Comparison: Commander vs Yargs vs Oclif — Grizzly Peak](https://www.grizzlypeaksoftware.com/library/cli-framework-comparison-commander-vs-yargs-vs-oclif-utxlf9v9)
- [commander — npm](https://www.npmjs.com/package/commander)
- [@clack/prompts — The Modern Alternative to Inquirer.js (DEV Community)](https://dev.to/chengyixu/clackprompts-the-modern-alternative-to-inquirerjs-1ohb)
- [Ink vs @clack/prompts vs Enquirer 2026 — PkgPulse](https://www.pkgpulse.com/guides/ink-vs-clack-vs-enquirer-interactive-cli-nodejs-2026)
- [fs-extra — npm](https://www.npmjs.com/package/fs-extra)
- [Building a Modern CLI Scaffolder from Scratch — Montek](https://www.montek.dev/post/building-a-modern-cli-scaffolder-from-scratch)
- [execa — GitHub (sindresorhus)](https://github.com/sindresorhus/execa)
- [tsup — npm](https://www.npmjs.com/package/tsup)
- [TypeScript in 2025 with ESM and CJS — Liran Tal](https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing)
- [Click vs Typer — Who Wins in 2025? — PyInns](https://www.pyinns.com/tools/click-vs-typer)
- [Typer alternatives page — tiangolo.com](https://typer.tiangolo.com/alternatives/)
- [typer — PyPI](https://pypi.org/project/typer/)
- [Python package managers: uv vs pixi? — Jacob Tomlinson](https://jacobtomlinson.dev/posts/2025/python-package-managers-uv-vs-pixi/)
- [When should I choose pixi over uv? — pydevtools](https://pydevtools.com/handbook/explanation/when-should-i-choose-pixi-over-uv/)
- [uv tools documentation — astral.sh](https://docs.astral.sh/uv/guides/tools/)
- [From Cookiecutter to Copier, uv, and Just — Medium](https://medium.com/@gema.correa/from-cookiecutter-to-copier-uv-and-just-the-new-python-project-stack-90fb4ba247a9)
- [headroom — GitHub (chopratejas)](https://github.com/chopratejas/headroom)
- [headroom-ai — PyPI](https://pypi.org/project/headroom-ai/)
- [Headroom Installation docs — Vercel](https://headroom-docs.vercel.app/docs/installation)
- [npm v12 blocks postinstall — aikido.dev](https://www.aikido.dev/blog/npm-v12-block-postinstall)
- [Guides to Cross-Platform Scripts in package.json — 8hob.io](https://8hob.io/posts/guides-creating-cross-platform-nodejs-scripts/)
