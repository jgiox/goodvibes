# goodvibes-cli

> One command. Production-grade project. No config.

[![npm](https://img.shields.io/npm/v/goodvibes-cli?style=flat-square)](https://www.npmjs.com/package/goodvibes-cli)
[![PyPI](https://img.shields.io/pypi/v/goodvibes-cli?style=flat-square)](https://pypi.org/project/goodvibes-cli/)
[![CI](https://img.shields.io/github/actions/workflow/status/jgiox/goodvibes/ci.yml?style=flat-square)](https://github.com/jgiox/goodvibes/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](https://github.com/jgiox/goodvibes/blob/main/LICENSE)

goodvibes is a single-command bootstrap for people who want to vibe code with an LLM and not worry about the rest. Run `npx goodvibes-cli init`, start coding, and everything else — code hygiene, token efficiency, git discipline, CI/CD — happens automatically in the background.

## Quick start

```sh
npx goodvibes-cli init
```

That's it. No install required.

## What you get

`goodvibes init` sets up five things in your project:

1. **CLAUDE.md** — Engineering rules that Claude reads automatically on every session: think before coding, simplicity first, fail loud, keep a journal, update tests
2. **IDE rule files** — The same rules, adapted for your AI coding tool. Supports 14 AI coding tools out of the box: Claude Code, Cursor, GitHub Copilot, Windsurf, Devin Desktop, Kiro, Antigravity, Cline, Amazon Q, Continue.dev, OpenAI Codex CLI, Lovable, Replit Agent, and Bolt.new
3. **caveman skill** — Compresses Claude's output so you get more done per context window
4. **ponytail rules** — Keeps code minimal; no over-engineering
5. **headroom** — Compresses what Claude reads, so context lasts longer (requires Python 3.10+; skipped gracefully if absent)

Running it a second time is safe — existing files are not overwritten, and CLAUDE.md is merged rather than replaced.

## Flags

```sh
goodvibes init --dry-run    # Preview files without writing anything
goodvibes init --minimal    # Skip headroom install, all .github/ files, and docs/
```

## Requirements

- Node.js 20+
- git
- A GitHub account (for CI)

**Windows users:** Use WSL2 for the best experience.

## IDE support

`goodvibes init` writes a rule file for each supported AI coding tool. All rule files encode the same engineering principles and activate automatically — no user configuration needed.

| IDE | File written | Activation |
|-----|-------------|------------|
| Claude Code | `CLAUDE.md` | Automatic |
| Cursor | `.cursor/rules/goodvibes.mdc` | Automatic (`alwaysApply: true`) |
| GitHub Copilot | `.github/copilot-instructions.md` | Automatic |
| Windsurf | `.windsurfrules` | Automatic |
| Devin Desktop | `.devin/rules/goodvibes.md` | Automatic |
| Kiro | `.kiro/steering/goodvibes.md` | Automatic |
| Antigravity | `GEMINI.md` | Automatic |
| Cline | `.clinerules/goodvibes.md` | Automatic |
| Amazon Q | `.amazonq/rules/goodvibes.md` | Automatic |
| Continue.dev | `.continue/rules/goodvibes.md` | Automatic |
| OpenAI Codex CLI | `AGENTS.md` | Automatic |
| Lovable | `AGENTS.md` + `CLAUDE.md` | Automatic |
| Replit Agent | `replit.md` | Automatic |
| Bolt.new | `.bolt/prompt` | Automatic |

## Links

- [GitHub](https://github.com/jgiox/goodvibes) — source, issues, discussions
- [Getting started](https://github.com/jgiox/goodvibes/blob/main/docs/getting-started.md)
- [Changelog](https://github.com/jgiox/goodvibes/blob/main/CHANGELOG.md)
- [Python package](https://pypi.org/project/goodvibes-cli/) — `pip install goodvibes-cli`

## License

Apache 2.0
