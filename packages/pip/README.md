# goodvibes-cli

**Guard rails for coding with AI. One command, no setup.**

[![PyPI](https://img.shields.io/pypi/v/goodvibes-cli?style=flat-square)](https://pypi.org/project/goodvibes-cli/)
[![npm](https://img.shields.io/npm/v/goodvibes-cli?style=flat-square)](https://www.npmjs.com/package/goodvibes-cli)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](https://github.com/jgiox/goodvibes/blob/main/LICENSE)

AI coding assistants write code fast, but left alone they over-build, read whole files until the context runs out, call things done without running the tests, forget earlier decisions, and run commands you would rather approve. goodvibes gives your AI tool clear working rules, adds checks that stop the most common mistakes, and sets up GitHub so every change is tested. Free, open source, no account or key.

## Quick start

```sh
pip install goodvibes-cli
goodvibes init
```

Or with [uv](https://docs.astral.sh/uv/): `uv tool install goodvibes-cli`, then `goodvibes init`. With Node.js instead: `npx goodvibes-cli init`.

Then open the folder in your AI coding tool and ask for what you want to build. Run `goodvibes doctor` to check the setup. [Getting started](https://github.com/jgiox/goodvibes/blob/main/docs/getting-started.md) walks you through your first change.

## What you get

- **Rules for 14 AI tools**: Claude Code, Cursor, GitHub Copilot, Windsurf, Devin Desktop, Kiro, Antigravity, Cline, Amazon Q, Continue.dev, OpenAI Codex CLI, Lovable, Replit Agent and Bolt.new. Plan first, smallest change that works, tests before "done", decisions recorded in `JOURNAL.md`, ask before risky steps.
- **Journal check in every tool**: a git hook blocks any commit that leaves out `JOURNAL.md`, from any AI tool or from you.
- **Claude Code guard rails**: whole-file reads of big files and reads of `.env`, SSH keys and credential files are blocked; it asks before pushing, publishing, deploying or editing its own settings, and refuses force-push and `git reset --hard`.
- **Checks in more AI tools**: the journal check and the read guard also run as hooks in Codex CLI, Gemini CLI, GitHub Copilot, Cursor, Devin CLI, Windsurf and Kiro. Not tested by running those tools; see [Guard rails in other AI tools](https://github.com/jgiox/goodvibes#guard-rails-in-other-ai-tools).
- **Fewer tokens**: the read guard, caveman (short replies from the first message; `/caveman full` or `stop caveman` if too terse), headroom (compresses what Claude reads) and `goodvibes usage` (where your tokens went).
- **context7**: current library docs for Claude Code, Cursor and VS Code (GitHub Copilot). Free, no key.
- **GitHub checks**: tests, CodeQL and gitleaks scans, dependency review, a file size check, and Dependabot.

By default the Claude Code parts are set up for every project on your computer (in `~/.claude`) and the project files go in the current folder. `--scope project` keeps everything in the folder. Existing files and your own settings are kept. Details: [What goodvibes init sets up](https://github.com/jgiox/goodvibes#what-goodvibes-init-sets-up).

## Commands

| Command | What it does |
|---|---|
| `goodvibes init` | Set goodvibes up. `--scope project`, `--minimal` (skips headroom, `.github/` and `docs/`), `--dry-run` |
| `goodvibes doctor` | Check the setup and your MCP servers: ✓ fine, ! warning, ✗ problem |
| `goodvibes update` | Bring goodvibes files up to date, keeping your edits. Shows the plan and asks once; `--dry-run` only shows it |
| `goodvibes upgrade` | Install the newest goodvibes, then run `update`. In a folder with no goodvibes setup (and none in `~/.claude`), it only installs and says how to update a project |
| `goodvibes usage` | Tokens used by recent Claude Code sessions in this project. `--all`, `--days N`, `--json`. Offline |

## Requirements

- Python 3.10 or later, and [git](https://git-scm.com/downloads)
- Optional: a GitHub account for the CI checks

Linux, macOS and Windows through WSL2 are supported; native Windows is best effort.

## Privacy

`goodvibes init` sends one anonymous install count: an empty request with a random ID, nothing about you or your code (the server sees your IP address, as with any request). It is skipped in CI (when `CI` is set to anything other than `0` or `false`). Set `DO_NOT_TRACK=1` (or `true`, `yes`) or `GOODVIBES_NO_TELEMETRY=1` to turn it off. `doctor` and `usage` never send anything.

## Links

- [Full README](https://github.com/jgiox/goodvibes#readme): every file goodvibes writes, the permissions, updating, and uninstalling
- [Getting started](https://github.com/jgiox/goodvibes/blob/main/docs/getting-started.md), [FAQ](https://github.com/jgiox/goodvibes/blob/main/FAQ.md), [Changelog](https://github.com/jgiox/goodvibes/blob/main/CHANGELOG.md)
- [npm package](https://www.npmjs.com/package/goodvibes-cli): `npx goodvibes-cli init`
- [Issues](https://github.com/jgiox/goodvibes/issues)

## License

Apache 2.0
