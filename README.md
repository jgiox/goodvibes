# goodvibes

> One command. Production-grade project. No config.

[![npm](https://img.shields.io/npm/v/goodvibes-cli?style=flat-square)](https://www.npmjs.com/package/goodvibes-cli)
[![PyPI](https://img.shields.io/pypi/v/goodvibes-cli?style=flat-square)](https://pypi.org/project/goodvibes-cli/)
[![CI](https://img.shields.io/github/actions/workflow/status/jgiox/goodvibes/ci.yml?style=flat-square)](https://github.com/jgiox/goodvibes/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](LICENSE)

## Quick start

```sh
npx goodvibes-cli init
```

Or with Python:

```sh
pip install goodvibes-cli
goodvibes init
```

This sets goodvibes up for every project on your computer and adds the project files to the current folder. Add `--scope project` to keep everything inside this one project; see [Global or one project](#global-or-one-project).

[![demo](docs/demo.gif)](docs/demo.gif)

## What you get

`goodvibes init` sets up eight things:

1. **Engineering rules for Claude** — think before coding, simplicity first, fail loud, keep a journal, update tests. By default in `~/.claude/rules/goodvibes.md` so every project gets them; with `--scope project`, in this project's `CLAUDE.md`
2. **IDE rule files** — The same rules, adapted for your AI coding tool. Supports 14 AI coding tools out of the box: Claude Code, Cursor, GitHub Copilot, Windsurf, Devin Desktop, Kiro, Antigravity, Cline, Amazon Q, Continue.dev, OpenAI Codex CLI, Lovable, Replit Agent, and Bolt.new
3. **caveman skill** — Compresses Claude's output so you get more done per context window (defaults to `ultra`; type `/caveman full` or `stop caveman` if replies get too terse). Also ships a `model-regression` skill that Claude Code loads only when a change touches model, scoring or metric code: baseline first, same evaluation before and after, revert on degradation
4. **ponytail rules** — Keeps code minimal; no over-engineering
5. **headroom** — Compresses what Claude reads, so context lasts longer (requires Python 3.10+; skipped gracefully if absent)
6. **Journal check (Claude Code only)**: A hook stops Claude Code from running `git commit` until `JOURNAL.md` is staged. By default it goes in `~/.claude/settings.json` and acts only in repos that have a `JOURNAL.md`; with `--scope project` it goes in this project's `.claude/settings.json`. It only gates commits made through Claude Code's own Bash tool. It does not gate commits you type in a terminal, commits from your editor's Git panel, or commits made by any other AI tool or IDE. Your own settings are kept: goodvibes adds its entries next to yours. With `--scope project`, if the project already had a `.claude/settings.json`, `goodvibes init` leaves it alone; run `goodvibes update` afterwards to add the hook. It checks the repository the commit really runs in, including `cd somewhere && git commit` and `git -C somewhere commit`; if it cannot tell which repository that is, it blocks and says so, and running the commit as its own command fixes it. It is a safety net for honest mistakes, not a security barrier.
7. **context7 (Claude Code)**: Connects Claude Code to [context7](https://github.com/upstash/context7) for up-to-date library docs. Free, no account or key. By default it is added to your Claude Code user settings, so every project has it. With `--scope project` it goes in this project's `.mcp.json` instead, and Claude Code asks you once to trust the project's MCP servers; say yes. An optional free key raises the rate limit: see [docs/getting-started.md](docs/getting-started.md#what-is-context7)
8. **Session check (Claude Code only)**: When Claude Code starts, `goodvibes doctor --quick` checks that git knows your name and email and that the goodvibes rules are in place. It prints nothing when all is well; otherwise Claude sees a one-line fix. See [docs/getting-started.md](docs/getting-started.md#session-start-check-claude-code-only)

Running it a second time is safe — existing files are not overwritten, and CLAUDE.md is merged rather than replaced.

`goodvibes update` brings an existing project up to date. It first lists everything it will change, in this folder and in `~/.claude`, and asks you once (`--force` skips the question; `--dry-run` only shows the list).

- Files you never edited are replaced with the new version. Files you edited are left alone.
- `.claude/settings.json` and `.mcp.json` are the exception: update adds only the goodvibes parts (the journal check, the ask and deny rules, context7), keeps everything you added, and removes the auto-approve rules older goodvibes versions put there (see below).
- A goodvibes file or setting you delete stays deleted. `goodvibes init` brings deleted files back if you want them.
- Skills goodvibes no longer ships are removed, unless you edited them.
- goodvibes never writes through a symlink, and if the goodvibes block in your `CLAUDE.md` is damaged (for example a start line without its end line), update leaves the file alone and tells you what to fix.

### What Claude Code can do without asking

In a goodvibes project, Claude Code runs these without a prompt: reading and editing files, `git add`, `git commit`, `git status`, `git diff`, `git log`, `git show`, `git branch`, `git stash`, `git fetch`, and your tests (`npm test`, `pytest`, `uv run pytest`, `python -m pytest`).

It asks you first before `git push`, publishing, deploying, `git restore`, deleting a branch or stash, `git clean`, and every other command, including installing packages and running `node`, `python`, `npx` or `uv`. It refuses force-push (`--force`, `-f`, `+branch`) and `git reset --hard`.

Up to version 1.9.1, goodvibes also auto-approved `node`, `python`, `npx`, `uv`, `npm run` and package installs. Any command can run through those, which made the ask and deny rules easy to get around, so `goodvibes update` now removes exactly those rules from your project settings. Rules you wrote yourself are kept.

## Global or one project

By default `goodvibes init` sets goodvibes up for every project on your computer, then adds the project files to the folder you ran it in:

| Where | What |
|---|---|
| Your computer | The `goodvibes` command, installed globally (npm, or `uv tool` for Python) so the session check can run |
| `~/.claude/rules/goodvibes.md` | The engineering rules, loaded by Claude Code in every project |
| `~/.claude/skills/` | caveman, goodvibes-hygiene, model-regression and the other skills |
| `~/.claude/settings.json` | The journal check, the session check, ask-before-push/publish/deploy rules, and deny rules for force-push and hard reset. Your own settings are kept, and goodvibes never adds "allow" rules here |
| Claude Code user MCP settings | context7 |
| This folder | `JOURNAL.md`, `CHANGELOG.md`, CI workflows, rule files for other AI tools, `.claude/settings.json`, and a `CLAUDE.md` with just a project section to fill in |

What this changes in your other projects: Claude Code asks before `git push`, publishing or deploying, and refuses force-push and `git reset --hard`. The journal check only acts in repos that have a `JOURNAL.md`, and the session check stays silent outside goodvibes projects. Running `goodvibes init` in your home folder does the global part only.

To keep everything inside one project instead, with nothing written outside it:

```sh
npx goodvibes-cli init --scope project
```

To undo the global part: delete `~/.claude/rules/goodvibes.md` and the goodvibes skills from `~/.claude/skills/`, remove the goodvibes entries from `~/.claude/settings.json`, and run `claude mcp remove context7 -s user`. `goodvibes update` does not put back anything you removed.

## Flags

```sh
goodvibes init --dry-run    # Preview files without writing anything
goodvibes init --minimal    # Skip headroom install, all .github/ files, and docs/
goodvibes init --scope project   # Everything inside this project only (default: global)
```

## Commands

| Command | What it does |
|---------|--------------|
| `goodvibes init` | Set goodvibes up (see above) |
| `goodvibes update` | Bring this project's goodvibes files, and the global setup if you use it, up to date with the goodvibes you have installed. Add `--dry-run` to preview |
| `goodvibes upgrade` | Install the newest goodvibes, then run `update` with it. Add `--dry-run` to preview without installing anything |
| `goodvibes doctor` | Check that git, headroom and the goodvibes rules are set up, with a fix for anything missing |
| `goodvibes --version` | Show the installed version |

`--minimal` skips: `.github/` (workflows, issue templates, PR template, dependabot, Copilot instructions) and `docs/`. All IDE rule files (Cursor, Windsurf, Devin Desktop, Kiro, Antigravity, AGENTS.md, Cline, Amazon Q, Continue.dev, replit.md, .bolt/prompt) are written by `--minimal` — they are AI configuration, not scaffolding.

## What you need first

| Requirement | Why | Install |
|-------------|-----|---------|
| **git** | Version control — goodvibes sets up git-friendly CI | [git-scm.com](https://git-scm.com/downloads) |
| **GitHub account** | Where your code lives; CI runs here | [github.com/signup](https://github.com/signup) |
| **Node.js 22.12+** | Required for `npx goodvibes-cli init` (the npm CLI) | [nodejs.org](https://nodejs.org) |
| **Python 3.10+** | Required only for `pip install goodvibes-cli` (optional) | [python.org](https://python.org/downloads) |

**Windows users:** Use WSL2 for the best experience — install it from the Microsoft Store or with `wsl --install` in PowerShell.

## Platform support

| Platform | Status |
|----------|--------|
| Linux | ✓ Supported |
| macOS | ✓ Supported |
| WSL2 (Windows) | ✓ Supported |
| Windows (native) | Best-effort |

## IDE compatibility

`goodvibes init` writes a rule file for each supported AI coding tool. All rule files encode the same engineering principles as the Claude Code rules and activate automatically — no user configuration needed.

| IDE | File written | Minimum version | Activation |
|-----|-------------|-----------------|------------|
| Claude Code | `~/.claude/rules/goodvibes.md` (default) or `CLAUDE.md` (`--scope project`) | Any | Automatic, loaded on every session |
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
| OpenAI Codex CLI | `AGENTS.md` | Any | Automatic — Codex reads AGENTS.md from project root |
| Lovable | `AGENTS.md` + `CLAUDE.md` | Any | Automatic — Lovable reads both from repo root |
| Replit Agent | `replit.md` | Any | Automatic — Replit Agent reads replit.md from project root |
| Bolt.new | `.bolt/prompt` | Any | Automatic — read when project is opened in Bolt |

**Note for GitHub Copilot users:** If instructions do not activate, check that the VS Code setting `github.copilot.chat.codeGeneration.useInstructionFiles` is enabled (it is on by default in recent versions).

**Note on ponytail audit commands:** The minimalism rules (ponytail ladder) are embedded in every IDE rule file above and are always active. On-demand audit commands (`/ponytail-review`, `/ponytail-audit`) require the Claude Code CLI terminal — they are not available in any non-Claude-Code IDE.

## Privacy

`goodvibes init` sends one anonymous install count: an empty request with a random ID made fresh for that run. Nothing about you, your machine or your code is included, though like any web request the server sees your IP address. It is skipped in CI (`CI=true`). To turn it off, set `DO_NOT_TRACK=1` (or `true`, `yes`) or `GOODVIBES_NO_TELEMETRY=1`. The counter has no accounts or keys, so its totals are approximate.

## Docs

- [FAQ.md](FAQ.md) — common issues: where goodvibes put its files, update vs upgrade, package name migration
- [docs/getting-started.md](docs/getting-started.md) — first steps after `goodvibes init`
- [docs/onboarding.md](docs/onboarding.md) — git and GitHub basics for complete beginners
- [docs/platform-setup/cursor.md](docs/platform-setup/cursor.md) — Cursor ponytail setup
- [docs/platform-setup/windsurf.md](docs/platform-setup/windsurf.md) — Windsurf ponytail setup
- [docs/platform-setup/kiro.md](docs/platform-setup/kiro.md) — Kiro ponytail setup
- [docs/platform-setup/replit.md](docs/platform-setup/replit.md) — Replit Agent setup
- [docs/platform-setup/bolt.md](docs/platform-setup/bolt.md) — Bolt.new setup
- [docs/platform-setup/chatgpt.md](docs/platform-setup/chatgpt.md) — ChatGPT Projects setup
- [docs/platform-setup/base44.md](docs/platform-setup/base44.md) — Base44 setup
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
- [SECURITY.md](SECURITY.md) — reporting vulnerabilities
- [CHANGELOG.md](CHANGELOG.md) — what changed in each release
