# goodvibes

> One command. Production-grade project. No config.

[![npm](https://img.shields.io/npm/v/%40jgiox%2Fgoodvibes?style=flat-square)](https://www.npmjs.com/package/@jgiox/goodvibes)
[![PyPI](https://img.shields.io/pypi/v/jgiox-goodvibes?style=flat-square)](https://pypi.org/project/jgiox-goodvibes/)
[![CI](https://img.shields.io/github/actions/workflow/status/jgiox/goodvibes/ci.yml?style=flat-square)](https://github.com/jgiox/goodvibes/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](LICENSE)

[![demo](docs/demo.gif)](docs/demo.gif)

## Quick start

```sh
npx @jgiox/goodvibes init
```

Or with Python:

```sh
pip install jgiox-goodvibes
goodvibes init
```

## What you get

`goodvibes init` copies four things into your project:

1. **CLAUDE.md** — Engineering rules that Claude reads automatically on every session: think before coding, simplicity first, fail loud, keep a journal, update tests
2. **caveman skill** — Compresses Claude's output so you get more done per context window
3. **ponytail rules** — Keeps code minimal; no over-engineering
4. **headroom** — Compresses what Claude reads, so context lasts longer (requires Python 3.10+; skipped gracefully if absent)

Running it a second time is safe — existing files are not overwritten, and CLAUDE.md is merged rather than replaced.

## Flags

```sh
goodvibes init --dry-run    # Preview files without writing anything
goodvibes init --minimal    # Skip headroom install, all .github/ files, and docs/
```

`--minimal` skips: `.github/` (workflows, issue templates, PR template, dependabot, Copilot instructions) and `docs/`. All IDE rule files (Cursor, Windsurf, Devin Desktop, Kiro, Antigravity, AGENTS.md, Cline, Amazon Q, Continue.dev) are written by `--minimal` — they are AI configuration, not scaffolding.

## What you need first

| Requirement | Why | Install |
|-------------|-----|---------|
| **git** | Version control — goodvibes sets up git-friendly CI | [git-scm.com](https://git-scm.com/downloads) |
| **GitHub account** | Where your code lives; CI runs here | [github.com/signup](https://github.com/signup) |
| **Node.js 20+** | Required for `npx @jgiox/goodvibes init` (the npm CLI) | [nodejs.org](https://nodejs.org) |
| **Python 3.10+** | Required only for `pip install jgiox-goodvibes` (optional) | [python.org](https://python.org/downloads) |

**Windows users:** Use WSL2 for the best experience — install it from the Microsoft Store or with `wsl --install` in PowerShell.

## Platform support

| Platform | Status |
|----------|--------|
| Linux | ✓ Supported |
| macOS | ✓ Supported |
| WSL2 (Windows) | ✓ Supported |
| Windows (native) | Best-effort |

## IDE compatibility

`goodvibes init` writes a rule file for each supported AI coding tool. All rule files encode the same engineering principles as `CLAUDE.md` and activate automatically — no user configuration needed.

| IDE | File written | Minimum version | Activation |
|-----|-------------|-----------------|------------|
| Claude Code | `CLAUDE.md` | Any | Automatic — loaded on every session |
| Cursor | `.cursor/rules/goodvibes.mdc` | 0.45+ | Automatic — `alwaysApply: true` in frontmatter |
| GitHub Copilot | `.github/copilot-instructions.md` | VS Code Copilot extension | Automatic — applied to all Copilot Chat requests |
| Windsurf (legacy) | `.windsurfrules` | Any Windsurf build | Automatic — applied to every Cascade conversation |
| Devin Desktop | `.devin/rules/goodvibes.md` | Any Devin Desktop build | Automatic — applied to every Devin conversation |
| Kiro | `.kiro/steering/goodvibes.md` | Any | Automatic — `inclusion: always` in frontmatter |
| Antigravity | `GEMINI.md` | Any | Automatic — loaded on every session |
| AGENTS.md (cross-tool) | `AGENTS.md` | Any | Automatic — read by Zed, Aider, JetBrains Junie, and 10+ other tools |
| Cline | `.clinerules/goodvibes.md` | Any | Automatic — loaded for all Cline conversations |
| Amazon Q Developer | `.amazonq/rules/goodvibes.md` | Any | Automatic — loaded as project rules in VS Code and JetBrains |
| Continue.dev | `.continue/rules/goodvibes.md` | Any | Automatic — applied to all Continue requests |

**Note for GitHub Copilot users:** If instructions do not activate, check that the VS Code setting `github.copilot.chat.codeGeneration.useInstructionFiles` is enabled (it is on by default in recent versions).

**Note on ponytail audit commands:** The minimalism rules (ponytail ladder) are embedded in every IDE rule file above and are always active. On-demand audit commands (`/ponytail-review`, `/ponytail-audit`) require the Claude Code CLI terminal — they are not available in any non-Claude-Code IDE.

## Docs

- [docs/onboarding.md](docs/onboarding.md) — git and GitHub basics for complete beginners
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
- [SECURITY.md](SECURITY.md) — reporting vulnerabilities
- [CHANGELOG.md](CHANGELOG.md) — what changed in each release
