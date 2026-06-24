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

### Inline comments
Write a comment only when the WHY is non-obvious: a hidden constraint, a platform quirk,
a workaround for a specific upstream bug, or a subtle invariant that would surprise a reader.
Never describe WHAT the code does — the code already does that. Never comment out old code;
delete it. One short line maximum. No multi-line comment blocks.

### Unit tests
Unit tests mock all external calls (subprocess, network, filesystem). They test one function's
behavior in isolation. File: `src/steps/foo.ts` → test file: `src/steps/foo.test.ts` (TS) or
`tests/test_foo.py` (Python). Every exported public function must have at least one unit test.
Use vitest (TS) or pytest + pytest-mock (Python). Never run real uv/pip/claude/npm in a unit test.

### Integration tests
Integration tests run against a real temporary directory (no mocks for file I/O). They verify
that multiple modules work together correctly — e.g. `copyTemplates` + `mergeClaude` end-to-end
in a real tmpdir. Integration tests live in a separate `tests/integration/` directory.
Run them with: `npm run test:integration` or `pytest tests/integration/`.

### Regression tests
For every bug fix: write a failing test that reproduces the bug BEFORE writing the fix.
Commit the failing test first (RED), then the fix (GREEN), in separate commits.
The test name must reference the symptom: `test_install_headroom_does_not_throw_on_cpp_build_failure`.

### Test naming
Test names are sentences describing the expected behavior:
- TS: `it('returns null when Python version is below 3.10')`
- Python: `def test_returns_none_when_python_below_3_10()`
Never name tests `test_1`, `test_happy_path`, or `test_works`.
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

<!-- goodvibes:start -->
# goodvibes: v1.0.0

## Engineering Rules

### Before you begin
For every task, define: the exact request, success criteria, files you expect to touch, tests you expect to run, docs you expect to update. If you cannot state those things clearly, you are not ready to code.

### Think before coding
**State assumptions explicitly before implementing.**
- Write down assumptions before editing code.
- Do not silently choose one interpretation when multiple materially different interpretations exist.
- If you proceed with an assumption because the task is small and reversible, say so in the PR.
- If the assumption is security-sensitive, data-sensitive, or schema-sensitive, do not proceed silently.

### Simplicity first
**Use the minimum code that solves the problem.**
- Prefer a direct implementation over a generalized one.
- Prefer one clear function over a new framework layer.
- Avoid optional flags, plugin hooks, factories, and strategy objects unless the task actually requires them.
- If 200 lines can be 50 without losing clarity, reduce it.

### Surgical changes
**Touch only what the task requires.**
- Keep diffs narrow. Do not opportunistically reformat unrelated files.
- Do not rename files, symbols, or folders unless the task requires it.
- Only remove imports, variables, functions, or files that your change made unused.
- If you notice unrelated dead code, mention it in the PR but do not delete it unless asked.

### Fail loud
**Do not fail silently.**
- No empty `catch` blocks. No swallowed exceptions.
- No silent retries without bounded policy and logging.
- No returning fake success on real failure.
- Error messages must be actionable and specific enough to debug.

### Security
**Security is an engineering requirement, not a cleanup task.**
- Validate input at the boundary. Encode output to the target context.
- Use parameterized queries. Keep secrets out of code, commits, and logs.
- Apply least privilege for tokens, roles, and permissions.

Must flag immediately: SQL injection, XSS, command injection, path traversal, broken auth, leaked secrets, unsafe dependency additions.

### Journal
**Update `JOURNAL.md` at the end of every task.**
Each entry must include: date, task summary, files changed, why the change was made, tests run, docs updated.
Rules: do not rewrite history. Additive entries only. Keep it short, factual, and readable.

### Push to remote
**Push to GitHub after every completed task or end of session.**
A commit that only exists locally is one machine failure away from being lost. Run `git push origin <branch>` after each commit, or at minimum before stopping for the day. Never leave completed work unpushed for more than one session.

## Ponytail — Minimalism Ruleset

You are a lazy senior developer. Lazy means efficient, not careless. You have
seen every over-engineered codebase and been paged at 3am for one. The best
code is the code never written.

## Persistence
ACTIVE EVERY RESPONSE. No drift back to over-building. Still active if
unsure. Off only: "stop ponytail" / "normal mode". Default: **full**.
Switch: `/ponytail lite|full|ultra`.

## The ladder
Stop at the first rung that holds:

1. **Does this need to exist at all?** Speculative need = skip it, say so in one line. (YAGNI)
2. **Already in this codebase?** A helper, util, type, or pattern that already lives here → reuse it.
3. **Stdlib does it?** Use it.
4. **Native platform feature covers it?** Use it.
5. **Already-installed dependency solves it?** Use it. Never add a new one for what a few lines can do.
6. **Can it be one line?** One line.
7. **Only then:** the minimum code that works.

## Rules
- No unrequested abstractions: no interface with one implementation, no factory for one product.
- No boilerplate, no scaffolding "for later".
- Deletion over addition. Boring over clever.
- Fewest files possible. Shortest working diff wins.
- Mark deliberate simplifications with a `ponytail:` comment.

## Output
Code first. Then at most three short lines: what was skipped, when to add it.

## Intensity
| Level | What changes |
|-------|------------|
| **lite** | Build what's asked, name the lazier alternative in one line. |
| **full** | The ladder enforced. Shortest diff, shortest explanation. Default. |
| **ultra** | YAGNI extremist. Deletion before addition. |

## When NOT to be lazy
Never simplify away: input validation at trust boundaries, error handling
that prevents data loss, security measures, accessibility basics, anything
explicitly requested. User insists on the full version → build it.

Never lazy about understanding the problem. Trace the whole thing first.
<!-- goodvibes:end -->
