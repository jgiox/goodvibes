<!-- GSD:project-start source:PROJECT.md -->
## Project

**goodvibes**

goodvibes is a single-command bootstrap for people who want to vibe code with an LLM and not worry about the rest. Run `npx goodvibes init` (or fork the template), start coding, and everything else — code hygiene, token efficiency, git discipline, CI/CD — happens automatically in the background. It is an open-source Apache 2.0 starter kit targeting complete beginners who use Claude, Copilot, or any other LLM coding tool.

**Core Value:** One command gives a new vibe coder a production-grade project environment — the LLM is quietly guided to write clean minimal code, tokens are optimized so context never bloats, and git/CI enforces quality gates automatically, all without the user needing to understand any of it.

### Constraints

- **License**: Apache 2.0 — all bundled/forked code must be Apache 2.0 or permissive-compatible (MIT, BSD)
- **Zero-config**: The installer must work without any user configuration; sensible defaults for everything
- **Beginner-first**: Every doc, error message, and README section must assume the reader has never opened a terminal before
- **Language-agnostic core**: CLAUDE.md rules, skills, and CI templates must work for any language/stack
- **Headroom bundling**: headroom is Python/Rust — the pip installer can pull it as a dependency; the npm installer shells out to pip or documents the pip step clearly
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### npm CLI Package
- Zero dependencies — keeps `npx goodvibes init` cold-start lean (~18 ms vs ~35 ms for yargs on Node 20)
- Git-style subcommands (`init`, `update`, `check`) map naturally to its API
- MIT license — fully compatible with Apache 2.0
- 130M+ weekly downloads; the de facto standard for scaffolding CLIs (create-react-app, vue-cli, etc. all use it or Commander descendants)
- Meow is excellent for type inference but lacks subcommand support needed for future `goodvibes update` command
- ~4 KB gzipped vs. inquirer's much larger footprint — critical for npx cold-start experience
- TypeScript-native, ESM-first — no CommonJS shim pain
- Built-in `spinner`, `group()`, and cancellation handling cover 100% of a scaffolding wizard's needs
- Opinionated beautiful output with zero configuration — right for a "zero-config" tool aimed at beginners
- MIT license
- tsup outputs both ESM and CJS from one config — handles the ongoing Node.js dual-module mess without manual effort
- Single bundled file means no runtime resolution cost for npx users
- tsup is MIT licensed
- Adds `copy()`, `mkdirs()`, `outputFile()` with Promises on top of Node's native `fs`
- Uses `graceful-fs` internally, preventing `EMFILE` errors on Windows (too many open file handles)
- Avoids any platform-specific shell commands (`cp`, `xcopy`) — pure Node.js, cross-platform by construction
- Promise-based, no callback nesting
- Correct Windows shebang and PATHEXT handling out of the box
- No shell injection risk — args are passed as arrays, not strings
- Sindre Sorhus's most downloaded utility; battle-tested on all three platforms
| Package | Version | Purpose | License |
|---|---|---|---|
| `commander` | ^13 | Argument parsing, subcommands | MIT |
| `@clack/prompts` | ^0.9 | Interactive wizard UX | MIT |
| `fs-extra` | ^11 | Cross-platform file copy/write | MIT |
| `execa` | ^9 | Subprocess calls (pip, uv, git) | MIT |
| `tsup` | ^8 | Build / bundle | MIT |
| `typescript` | ^5.5 | Language | Apache 2.0 |
### pip CLI Package
- Built on Click (BSD-3-Clause, compatible with Apache 2.0) — inherits Click's battle-tested reliability
- Type-hint-driven API eliminates ~40% of the decorator boilerplate Click requires
- Since Typer 0.26.0, Click is vendored inside Typer — single install, no transitive version conflicts
- Auto-generated `--help` is beautiful without configuration
- MIT license
- Pure Python project — no conda-forge or system libraries needed, which is exactly uv's target use case
- Dramatically faster than pip/poetry for CI and local dev
- `uv tool install headroom-ai` is the recommended way to install headroom — use this in the goodvibes init flow
- MIT license; the Astral ecosystem is dominant for new Python tooling in 2025-2026
- Pixi is overkill here (designed for mixed conda/PyPI environments, data science, system libraries)
| Package | Version | Purpose | License |
|---|---|---|---|
| `typer` | ^0.15 | CLI framework | MIT |
| `rich` | ^14 | Terminal output (pulled in by typer[all]) | MIT |
| Python stdlib only | — | File copy (`shutil`, `pathlib`) | PSF |
### Cross-Platform File Injection
# Recursive copy
# Single file
### Headroom Bundling Strategy
### Monorepo vs Separate Packages
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
