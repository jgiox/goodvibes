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

By default this sets goodvibes up for every project on your computer (rules, skills, hooks and context7 in `~/.claude`, plus the `goodvibes` command installed globally) and adds the project files to the current folder. Add `--scope project` to keep everything inside this one project. Details: [Global or one project](https://github.com/jgiox/goodvibes#global-or-one-project).

## What you get

1. **Engineering rules for Claude**: think before coding, simplicity first, fail loud, keep a journal, update tests. In `~/.claude/rules/goodvibes.md` by default, or this project's `CLAUDE.md` with `--scope project`
2. **IDE rule files**: the same rules for 14 AI coding tools: Claude Code, Cursor, GitHub Copilot, Windsurf, Devin Desktop, Kiro, Antigravity, Cline, Amazon Q, Continue.dev, OpenAI Codex CLI, Lovable, Replit Agent, and Bolt.new
3. **Skills**: caveman (shorter replies, so context lasts longer), model-regression (loaded only when a change touches model or metric code) and others
4. **ponytail rules**: keeps code minimal; no over-engineering
5. **headroom**: compresses what Claude reads, so context lasts longer (requires Python 3.10+; skipped gracefully if absent)
6. **Journal check (Claude Code only)**: Claude Code cannot `git commit` until `JOURNAL.md` is staged
7. **context7 (Claude Code)**: up-to-date library docs, free, no key
8. **Session check (Claude Code only)**: `goodvibes doctor --quick` runs when Claude Code starts and stays silent unless something needs fixing

Running it a second time is safe: existing files are not overwritten, and your own settings are kept.

## Commands and flags

```sh
goodvibes init --dry-run         # Preview files without writing anything
goodvibes init --minimal         # Skip headroom install, all .github/ files, and docs/
goodvibes init --scope project   # Everything inside this project only (default: global)
goodvibes update                 # Bring goodvibes files up to date; keeps your edits (--dry-run to preview)
goodvibes upgrade                # Install the newest goodvibes, then run update
goodvibes doctor                 # Check the setup and print a fix for anything missing
```

## Requirements

- Node.js 22.12+
- git
- A GitHub account (for CI)

**Windows users:** Use WSL2 for the best experience.

**Privacy:** `goodvibes init` sends one anonymous install count: an empty request with a random ID, nothing about you or your code (the server sees your IP address, as with any request). Set `DO_NOT_TRACK=1` (or `true`, `yes`) or `GOODVIBES_NO_TELEMETRY=1` to turn it off.

## IDE support

`goodvibes init` writes a rule file for each supported AI coding tool. All rule files encode the same engineering principles and activate automatically — no user configuration needed.

| IDE | File written | Activation |
|-----|-------------|------------|
| Claude Code | `~/.claude/rules/goodvibes.md` (default) or `CLAUDE.md` | Automatic |
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
