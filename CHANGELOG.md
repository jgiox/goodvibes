# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- The journal check and the read guard now run in more AI tools, not only Claude Code. `goodvibes init` writes each tool's hook file: `.codex/hooks.json` (Codex CLI), `.gemini/settings.json` (Gemini CLI), `.github/hooks/goodvibes.json` (GitHub Copilot cloud agent and Copilot in VS Code), `.devin/hooks.v1.json` (Devin CLI), `.windsurf/hooks.json` (Windsurf) and `.kiro/hooks/goodvibes.json` (Kiro). Cursor and the Copilot CLI already run the checks from `.claude/settings.json`. Every file runs the exact same two scripts. `goodvibes update` merges the goodvibes hooks into an existing `.gemini/settings.json` or `.codex/hooks.json` and keeps your own settings and hooks. Codex and Gemini ask you once to trust a project's hooks before they run. Not covered: Cline (its hooks stop the whole task instead of one action), Antigravity, Continue, Amazon Q, Replit, Bolt and Lovable. The git commit check still covers the journal in every tool
- The read guard understands each tool's file-read format: Gemini CLI `read_file` with `start_line` and `end_line`, Kiro `fs_read`, Devin `read`, Windsurf `pre_read_code`, and a `path` key where a tool sends one instead of `file_path`. The journal check reads Windsurf's `command_line`, and it now ignores any action that carries no shell command, so a tool that runs every hook for every action (Copilot in VS Code) never blocks a file edit whose text mentions `git commit`
- context7 in Cursor and VS Code (GitHub Copilot): `goodvibes init` writes `.cursor/mcp.json` and `.vscode/mcp.json` with the context7 server, in every scope and with `--minimal`. `goodvibes update` adds or refreshes only the `context7` entry, keeps your other servers, and never brings back an entry or file you deleted. Windsurf keeps its MCP servers outside the project, so its setup note explains the one manual step

### Security

- Claude Code also asks before editing the other tools' hook files (`.codex/hooks.json`, `.gemini/settings.json`, `.github/hooks/`, `.devin/hooks.v1.json`, `.windsurf/hooks.json`, `.kiro/hooks/`), so an agent cannot quietly turn the checks off for another tool
- Claude Code also asks before editing `.cursor/mcp.json` and `.vscode/mcp.json`, so an agent cannot quietly add an MCP server for Cursor or VS Code

### Fixed

- `goodvibes init` inside your Claude Code settings folder (`~/.claude`, or `CLAUDE_CONFIG_DIR`) now does the global part only. Before, it wrote project files there, including a `CLAUDE.md` that Claude Code then loaded in every project, and replaced the global `.goodvibes.json`, so later updates treated the global rules and skills as edited by you and never updated them again. `--scope project` there now stops with an error
- `goodvibes init` (npm) no longer fails half done with a wrong "no write permission" message when one folder in the project cannot be read. It now checks only the paths it writes, instead of reading the whole project (including `node_modules`)
- `goodvibes init --minimal` now writes Copilot's rules (`.github/copilot-instructions.md`) and hooks (`.github/hooks/`), and `goodvibes update` adds them to projects set up with `--minimal`. It still skips the workflows, scripts, Dependabot, issue and pull request templates and `docs/`, and the `--minimal` help says so
- A project whose CI is written as `.github/workflows/*.yaml` now counts as having its own workflows, so `init` no longer adds the goodvibes CI next to it
- `goodvibes init --dry-run` lists `.github/workflows/ci.yml`, the file it writes, instead of the `ci-<type>.yml` template name
- pip: an existing `CLAUDE.md` is no longer listed as both written and skipped
- The "Next steps" after `init` give both ponytail commands (`/plugin marketplace add DietrichGebert/ponytail` and `/plugin install ponytail@ponytail`) and say they are optional and run in the Claude Code terminal
- `goodvibes update --force` help now says it skips the confirmation prompt; files you edited are still kept
- `goodvibes upgrade` run outside a goodvibes project (for example in your home folder) now says the new version is installed and how to update a project, instead of ending with a "No .goodvibes.json ... not set up here yet" box that looked like the upgrade had failed
- `goodvibes update` no longer crashes (pip) or damages the file (npm) when a JSON file it merges is valid but has a key of the wrong type, for example `"mcpServers": []` in `.cursor/mcp.json`, `"hooks": []` in `.claude/settings.json`, or a `permissions.deny` written as one string instead of a list. npm used to split such a string into single characters and save that. The file is now left unchanged, and update names the key to fix
- File Size check in projects that already have their own GitHub workflows: `goodvibes init` now adds `.github/workflows/file-size.yml` together with the script it runs (the other goodvibes workflows are still skipped there), and `goodvibes update` adds it to projects that got only the script. An existing `file-size.yml` is never overwritten, and `--minimal` still skips all of `.github/`

## [1.10.0] - 2026-09-25

### Added

- Journal check in every tool: `goodvibes init` and `update` install a git pre-commit hook (`.git/hooks/pre-commit`) that blocks any commit leaving out `JOURNAL.md`, whether it comes from Cursor, Copilot, another AI tool or you. It lets merges, rebases, cherry-picks, reverts and message-only amends through, never replaces a pre-commit hook you already have, leaves `core.hooksPath` setups such as husky alone, and stays deleted if you delete it. `git commit --no-verify` skips it once; `GOODVIBES_JOURNAL_CHECK=off` turns it off. `goodvibes doctor` reports whether it is active
- Read guard hook (Claude Code): stops whole-file reads of big files (over 800 lines or 100 KB) through the Read tool or `cat`/`less`/`more`/`nl`/large `head`, `tail` and `sed -n` ranges, and tells Claude to read a range or search instead. It also stops reads of `.env` files (not `.env.example`), SSH keys, cloud and git credential files and private keys. `GOODVIBES_READ_GUARD=off` turns it off; `GOODVIBES_READ_GUARD_LINES` and `GOODVIBES_READ_GUARD_KB` change the limits
- `goodvibes usage`: an offline report of the tokens recent Claude Code sessions used (input, output, cache read and write, cache hit rate, peak context), from Claude Code's local logs. `--all`, `--days N`, `--json`. Best effort, because Claude Code's log format is internal
- `goodvibes doctor` checks MCP servers in `~/.claude.json` and `.mcp.json` and warns about plain `http://` addresses, secrets written into the file, launchers that fetch an unpinned package on every start, and downloads piped into a shell. It never contacts a server or prints a secret
- `goodvibes doctor` warns when `JOURNAL.md` is over 10 KB, including in the session-start check
- `JOURNAL.md` starts with a "Standing decisions" section, and the rules tell agents to read it plus the last five entries instead of the whole journal
- Rules: ask for `--json`/`--porcelain`/`-q` output and summarise it; change approach after the same failure twice; confirm results on the current commit; say "not found" only for the places searched; dry-run first; a regression test must fail without its fix. `CLAUDE.md` also says what to keep when context is summarised
- File Size CI check: a new code file may have at most 500 lines and a file already over the limit may not grow; per-file limits in `.github/file-size-limits.json`. Adapted from block/buzz (Apache-2.0)
- CI templates cancel superseded pull request runs, have job time limits, and dependency review allows only permissive licences. Dependabot waits 7 days before proposing a new release
- Tests keep each shipped skill under 12 KB, and hook test cases live in shared files that the npm and pip tests both run

### Changed

- caveman is on at its `ultra` level from the first reply in every AI tool: every rule file has a "Replies" section that turns it on, and Claude Code also loads the caveman skill. Code, commands, error messages, commits, pull requests and docs are never shortened. `/caveman full` or `stop caveman` switch it down or off
- Docs rewritten for both beginners and experienced developers: the README (what goodvibes is, who it is for, how the three layers work), FAQ, getting started, git basics, and the setup notes for each AI tool. They say clearly which parts work in every tool (rules, GitHub checks) and which only in Claude Code (hooks, permissions, skills)
- `goodvibes doctor` has three levels: ✓ fine, ! warning, ✗ problem. headroom and the `goodvibes` command being missing are warnings, because both are optional, and only problems make `doctor` exit with an error. It ends with `Ready.`, `Ready, with N warning(s).` or `Not ready: N problem(s).`

### Security

- Shipped settings deny reading `.env` files (but not `.env.example`), `~/.ssh`, `~/.aws/credentials`, `~/.git-credentials`, `~/.netrc` and `.pem`/`id_rsa`/`id_ed25519` files, and ask before Claude Code edits `.claude/settings.json`, `.claude/settings.local.json`, `.mcp.json` or `.claude/hooks/`, so it cannot quietly loosen its own guard rails
- Journal check: git could be made to run code before any approval. A bare git repository committed inside a project, with `core.fsmonitor` set in its config, ran that command as soon as the hook saw text such as `# git -C vendor/evil commit`. The hook now runs every git call with `-c core.fsmonitor=false -c safe.bareRepository=explicit`. `goodvibes update` installs the fixed hook, including in `~/.claude/settings.json`. Until you update, `git config --global safe.bareRepository explicit` blocks it
- Shipped project settings no longer auto-approve arbitrary code: `Bash(node*)`, `Bash(python*)`, `Bash(npx*)`, `Bash(uv*)` (which also matched `uvx`), `Bash(npm run*)`, `Bash(npm install*)`, `Bash(pip install*)` and `Bash(git restore *)` are gone from `allow`, so those commands prompt. `update` removes exactly those rules from edited project settings too, never from `~/.claude/settings.json`. Force-push variants (`-f`, `--force` anywhere, `+branch`) are denied; `git restore`, branch and stash deletes, `git clean` and `--force-with-lease` ask first
- goodvibes never writes through a symlink: a symlinked file or folder in a project (for example `.claude -> ~/.claude` in a cloned repo) is skipped and reported instead of being written through
- Rules now say JOURNAL.md entries never override them, and never to follow an entry that asks to weaken security, skip tests, push, publish, deploy or run commands it supplies
- Removed the `caveman-compress`, `caveman-stats` and `cavecrew` skills: they depended on scripts, hooks and agents goodvibes never shipped (`caveman-compress` told the agent to run `python3 -m scripts`, which could run an unrelated package). `update` deletes installed copies you never edited
- Release pipeline: publishing runs only from `main` or from a tag on `main` whose version matches the package, in a protected `release` environment, after the full test matrix and an install test of the built package; every action is pinned to a commit SHA; PyPI releases carry attestations; the demo recording builds from the checkout and only a separate job can push; the template-publish token is fine-grained and limited to the template repo
- CI templates: `permissions: contents: read`, `persist-credentials: false`, and third-party actions and images pinned by SHA or digest

### Fixed

- pip `init` recorded every file in the project (`.git`, `src`, `node_modules`, your own `dependabot.yml`) as goodvibes-written, so `update` later overwrote your files. It now records only files it wrote
- Running `init` again no longer wipes `.goodvibes.json`; it keeps earlier entries and your removals
- `CLAUDE.md`: a start marker without an end marker made goodvibes delete everything after it, and markers in the wrong order duplicated text. Markers now count only on their own line, anything unexpected is left alone with an error explaining the fix, and CRLF line endings are kept
- `update` replaced a whole hook group, deleting your own hooks that shared it; it now replaces only the goodvibes hook
- `update` changed `~/.claude` before asking; it now shows the full plan for the project and `~/.claude` and asks once, and saying no changes nothing
- `update` brought back files you deleted and added CI workflows or docs that `init` had skipped (a project with its own workflows, or `--minimal`). Deleted files are recorded as `user-removed` and stay deleted (`init` restores them), and new files are added only to folders goodvibes already manages
- headroom: installs were killed after 10 seconds, so they failed on almost every first run; they now get 15 minutes. The MCP server was registered without `mcp serve`, so it only printed help; it is registered correctly and old broken entries are repaired
- npm crashed on Node 20 with `TEXT_ENCODINGS.union is not a function`; Node 22.12 or later is now required and older Node gets a clear message
- Windows: pip `update` rejected every file, and manifest keys with backslashes broke the settings merge; keys are now always stored with forward slashes
- Version comparison handled pre-releases wrongly (npm) or crashed on them (pip); `1.9.1rc1`, `-beta.1` and `.post1` now compare correctly
- A `.goodvibes.json` that is not valid JSON (for example after a git merge conflict) is reported as such, with exit 1, instead of "not set up"
- `upgrade` works under `python -m goodvibes_cli`, does not try to install anything under `uvx`, says when it cannot reach PyPI, re-runs itself through Node on every platform, and prints an actionable message instead of a stack trace when `npm install -g` fails
- pip: `init` reports when `goodvibes` was installed but is not on PATH yet, and finds its templates when run from a source checkout
- JSON files goodvibes writes are written atomically and keep non-ASCII text; a settings file that is JSON but not an object is reported instead of crashing
- Journal check: commits glued to operators (`npm test&&git commit`, `true|git commit`, `$(git commit ...)`), backslash line continuations, and commits after a full-line comment were not detected; `--amend` anywhere exempted the whole command; `cd dir && git commit` was checked against the wrong repository; `git -C ~/p` was blocked. All fixed, and it no longer blocks `git log | grep commit`, `git help commit` or `git cat-file commit`. It is also much faster on very long commands
- CI templates: Python CI failed for projects using `uv add --dev` (`[dependency-groups]`); npm caching failed without a lockfile; CodeQL and dependency review failed on private repos without GitHub Advanced Security
- `DO_NOT_TRACK=true` and `yes` now opt out of telemetry, not only `1`

- `goodvibes upgrade` (pip) said "Updated to X" while staying on the old version: `init` installed the CLI as `uv tool install goodvibes-cli==<version>`, and `uv tool upgrade` never moves past that pin. `init` now installs `goodvibes-cli>=<version>`, `upgrade` installs `goodvibes-cli>=<latest>` (which replaces an existing pin), and in both packages the re-run checks it is on the new version and otherwise stops with exit 1 and the exact fix command. Existing pinned installs: run `uv tool install goodvibes-cli@latest` once
- npm `goodvibes init` from an older version (for example an old `npx` cache) no longer downgrades a newer global `goodvibes`
- `goodvibes update` with no `.goodvibes.json` here or in `~/.claude` no longer claims the project was set up before v1.2.0; it says goodvibes is not set up there yet and to run `goodvibes init`

## [1.9.1] - 2026-09-24

### Fixed

- `goodvibes upgrade` now installs the newest goodvibes and then runs `goodvibes update`. Its old copy step wrote the full rules block into global-scope projects (so Claude Code loaded the rules twice), rewrote `.goodvibes.json` with only the files it touched (npm), and installed the new version even under `--dry-run`
- pip test runs no longer send an install count to the telemetry endpoint
- Journal gate: a commit on any line after the first of a multi-line command was not detected and went through without a journal entry; the gate now checks each line. It also no longer treats the word "commit" inside a heredoc body (or on a later line of an unrelated command) as a commit. Heredoc end markers may contain punctuation (`<<END-MARK`), and a heredoc that never ends is checked like normal lines. Heredocs that feed a shell or `ssh` (`bash <<EOF`, `cat <<EOF | sh`, `sudo bash <<EOF`) are still checked, and `git -C` in a multi-line command is blocked as ambiguous. `goodvibes update` brings the new hook into existing projects and `~/.claude/settings.json`
- pip `goodvibes init` installs `goodvibes` with `uv tool install` when the only copy on PATH is inside the active virtualenv, so the session check works outside that venv

### Changed

- Public docs describe the 1.9.0 global default: where each part lives, how to turn the journal and session checks off in `~/.claude/settings.json`, adding a context7 key at user scope, and what `update` vs `upgrade` do. The npm and PyPI package pages list all eight parts and the `update`, `upgrade` and `doctor` commands, and document the telemetry opt-out
- CONTRIBUTING (and the copy goodvibes installs) stages named files instead of `git add -A` and uses `feat/`/`fix/` branch names, matching the rules
- Bolt.new and Replit setup pages paste `AGENTS.md`, which every project has, instead of the `CLAUDE.md` block, which global-scope projects no longer carry

## [1.9.0] - 2026-09-24

### Added

- `goodvibes init --scope global|project`, default `global`. Global installs the `goodvibes` CLI globally (npm `install -g`, or `uv tool install` for Python) and writes the rules to `~/.claude/rules/goodvibes.md`, the skills to `~/.claude/skills/`, the hooks and ask/deny rules into `~/.claude/settings.json` (never `allow`), and context7 as a user-scope MCP server; the project gets its files minus the rules block, skills and `.mcp.json`, so nothing loads twice. Honors `CLAUDE_CONFIG_DIR`. Running init in the home folder does the global part only. `--scope project` keeps the 1.8.0 behaviour
- `.goodvibes.json` records the scope; `update` refreshes the global config for global-scope projects and never adds the rules block, skills or `.mcp.json` to them

### Changed

- The journal gate exits 0 in repos without a `JOURNAL.md`, so the global hook never blocks commits in unrelated repos
- `goodvibes doctor` (and `--quick`) checks the global rules file in global-scope projects, and `--quick` stays silent about CLAUDE.md outside goodvibes projects
- Getting-started no longer teaches `git add .`

## [1.8.0] - 2026-09-24

Published to PyPI only; npm moves from 1.7.1 straight to 1.9.0.

### Fixed

- npm `goodvibes init` no longer exits 1 before writing `.goodvibes.json` (`Cannot find module '../../package.json'` in the built CLI since 1.7.0); `doctor`, `update` and `upgrade` now report the real version instead of "unknown"
- `goodvibes update` no longer overwrites a file that existed before `init` (and so was never recorded in the manifest); it is kept and recorded as user-owned
- Journal gate no longer blocks `git add JOURNAL.md && git commit`, exact-path adds that include `JOURNAL.md`, `git add -A && git commit`, or `git commit -a` when `JOURNAL.md` has changes; `-C` targets and unparseable commands still fail closed
- `permissions.ask` now also covers publish/deploy forms that slipped past the prefix rules: `npx -y`/`--yes`, `npx wrangler@<version>`, `npx netlify-cli`, `npx firebase-tools`, `uv run twine`, `npm run deploy|release|publish`, `node node_modules/.bin/*`
- Onboarding no longer teaches `git add -A`, which the agent rules forbid; it now shows staging exact paths
- `goodvibes update` no longer drops user-modified (skipped) files from `.goodvibes.json` on write-back, so a second `update` run no longer reclassifies them as net-new and overwrites them — npm and pip
- `goodvibes update` now always refreshes the goodvibes sentinel block in a project's `CLAUDE.md`, even when the file has custom prose outside the block that previously kept its whole-file hash from ever matching
- `templates/.claude/settings.json` no longer auto-approves `git push`, npm/uv/twine publish, or wrangler/vercel/netlify/firebase deploy commands — closed via a new `permissions.ask` list

### Added

- `model-regression` Claude Code skill (on demand, not in CLAUDE.md): baseline before change, same evaluation after, tolerance declared up front, revert on degradation, a frozen-fixture regression test, and a before/after metric table
- `goodvibes doctor --quick`: local checks only (no headroom probe), silent when all pass, always exits 0; a `SessionStart` hook (matcher `startup`, 10 s timeout) runs it when Claude Code opens the project, and skips itself when goodvibes is not installed
- `goodvibes update` merges goodvibes-managed keys into a hand-edited `.claude/settings.json` / `.mcp.json`: ask/deny rules (add-only, never `allow`), marker-tagged hooks, and the context7 server; user keys are kept, `--dry-run` lists each key change, and a key you delete stays deleted (npm and pip)
- `ruff check` lint step in the Python CI templates (`ci-python.yml`, `ci-both.yml`)
- `gitleaks` secret-scan job in `security.yml`, alongside CodeQL
- Definition-of-done, `.env.example`, no-fabricated-data, and documentation-lookup-data-handling rules across every shipped agent-instruction template (`CLAUDE.md`, `AGENTS.md`, every per-IDE rule file, `replit.md`, `.bolt/prompt`)
- Journal-gate hook in `templates/.claude/settings.json` (also dogfooded in this repo's `.claude/settings.json`): a `PreToolUse` Bash hook, one inline shell command with no `jq` and no script file, that blocks Claude Code from running `git commit` unless `JOURNAL.md` is staged. Exempts `--amend` and in-progress merge/rebase; honors `git -C <path>`; blocks `git -C` combined with `&&`, `||`, `;` or `|` as ambiguous. Only gates commits made through Claude Code's own Bash tool
- `templates/.mcp.json`: context7 MCP server at the free public HTTP endpoint (`https://mcp.context7.com/mcp`), no key and no signup
- Getting-started docs: journal-gate scope, context7 trust prompt, and the optional `${CONTEXT7_API_KEY}` upgrade

### Changed

- Every agent rule file (CLAUDE.md, AGENTS.md and its six copies, Copilot, Cursor, Kiro, Replit, Bolt) is rewritten in directive language and opens with a session-start block: read JOURNAL.md first and treat it as binding, never re-ask for what README/CLAUDE/AGENTS/JOURNAL or the code already answers, never state a guess as fact
- New rules: dependency discipline, security review questions, branch hygiene, measure before optimizing; the CLAUDE.md goodvibes block is 8 lines shorter than 1.7.1
- `.github/copilot-instructions.md` states it is authoritative for Copilot; AGENTS.md states it is the cross-tool fallback, not a guarantee
- `JOURNAL.md` template is now a binding handoff record with fields matching the Journal rule
- caveman skill defaults to `ultra` (was `full`); getting-started explains what that changes and how to switch back
- A fresh `CLAUDE.md` starts with a "What this is / Core value / Constraints" section outside the goodvibes block
- CI templates no longer hide `uv sync` errors behind `2>/dev/null`
- CI templates emit a visible `::warning::` instead of silently passing when no tests or no lint script are found

### Known limitations

- `goodvibes init` does not touch an existing `.claude/settings.json` or `.mcp.json`; run `goodvibes update` afterwards to merge the goodvibes keys in
- The journal gate matches command text, so any Bash command that merely contains commit-like text (for example a heredoc that writes test code) is checked too
- On Windows without Git Bash, Claude Code runs hooks in PowerShell, where the journal gate and the session check do not run (Claude Code shows a hook error and continues)

## [1.7.1] — 2026-08-06

### Fixed

- `goodvibes doctor` headroom check now uses `headroom --version` instead of `headroom compress --help`; the previous probe exited non-zero on installed headroom versions, always reporting a false failure

## [1.7.0] — 2026-07-27

### Added

- `goodvibes update` command — compares each template file against a `.goodvibes.json` SHA-256 manifest to distinguish managed-unmodified files (safe to overwrite) from user-modified files (skip by default); supports `--dry-run` and `--force`
- `.goodvibes.json` manifest — written by `goodvibes init` after every successful run; records the SHA-256 digest and goodvibes version for each managed template file
- `goodvibes update --dry-run` — previews three labelled categories without writing: files to overwrite, files to skip (user-modified), and net-new files not yet in the manifest
- `templates/.claude/settings.json` — Claude Code permission file; auto-approves read/edit/test/commit, prompts for push, denies force-push and hard-reset

### Changed

- `goodvibes update` replaces the `goodvibes upgrade` alias; the upgrade command still exists but `update` now uses manifest-aware logic instead of blind overwrite
- CLAUDE.md engineering rules updated across all 14 supported IDEs: "Simplicity first" renamed to "Make the smallest complete change" with an explicit completeness requirement; "Proof of work" section added; "Action tiers" table added differentiating read/edit/commit/push/deploy authorization levels
- Anonymous telemetry: `goodvibes init` sends a single counter ping to a Cloudflare Worker on first run; no personal data collected; respects `DO_NOT_TRACK`, `GOODVIBES_NO_TELEMETRY`, and `CI` environment variables

### Fixed

- CLAUDE.md sentinel guard: `<!-- goodvibes:start -->` without a matching `<!-- goodvibes:end -->` no longer corrupts the file; the block is now treated as an append target

## [1.6.2] — 2026-07-02

### Added

- Package rename: npm package is now `goodvibes-cli` (was `@jgiox/goodvibes`); pip package is now `goodvibes-cli` (was `jgiox-goodvibes`); old names are deprecated/tombstoned with redirect messages
- CI `check-stamps` job: fails CI when `packages/npm/package.json`, `packages/pip/pyproject.toml`, and `templates/CLAUDE.md` version stamps diverge
- Publish smoke-test jobs: after each npm/pip publish, CI installs from the public registry and runs `goodvibes init --dry-run` to confirm the release is working before users hit it
- `goodvibes doctor` now shows `goodvibes vX.Y.Z` as the first line of its output panel
- Dedicated README.md pages for the npm and PyPI package listings
- Tombstone stub: `jgiox-goodvibes` v2.0.0 on PyPI depends on `goodvibes-cli`, so `pip install jgiox-goodvibes` auto-upgrades to the new name

### Changed

- `goodvibes upgrade --dry-run` diff labels changed from symbols (`~`, `+`, `=`) to plain English (`updated`, `new`, `unchanged`)

## [1.6.1] — 2026-07-02

### Fixed

- `goodvibes upgrade` incorrectly reported "already up to date" when a newer version was available — version comparison now reads the installed package version instead of the template package version

## [1.6.0] — 2026-07-01

### Added

- `goodvibes update` command — alias for `goodvibes upgrade` (VCC-01)
- `goodvibes doctor` command — checks headroom, git identity, CLAUDE.md, and sentinel block; exits non-zero on any failure (VCC-02)
- `goodvibes --version` now reads version from package.json dynamically (VCC-03)
- `docs/getting-started.md` template — beginner flow guide from init to first commit (VCC-04)
- Headroom install step now shows "what is headroom?" description and skips gracefully if already installed (VCC-05)
- Platform setup guides for Cursor, Windsurf, Kiro, Replit Agent, and Bolt.new with ponytail activation instructions (VCC-06)

## [1.5.0] - 2026-07-01

### Added

- `replit.md` — Replit Agent reads this from project root automatically; encodes goodvibes engineering rules
- `.bolt/prompt` — Bolt.new reads this when the project opens; encodes the same rules in plain text
- `docs/platform-setup/chatgpt.md` — beginner guide for pasting goodvibes rules into ChatGPT Projects custom instructions
- `docs/platform-setup/base44.md` — beginner guide for Base44 AI controls
- README IDE compatibility table: added Codex CLI, Lovable, Replit Agent, Bolt.new

## [1.4.0] - 2026-06-30

### Added

- `AGENTS.md` cross-tool rules file — natively read by Zed, Aider, JetBrains Junie, Jules, Amp, Codex CLI, and 10+ other tools
- `.clinerules/goodvibes.md` for Cline (VS Code extension)
- `.amazonq/rules/goodvibes.md` for Amazon Q Developer (VS Code and JetBrains)
- `.continue/rules/goodvibes.md` for Continue.dev
- `.devin/rules/goodvibes.md` for Devin Desktop (Windsurf rebrand, June 2026)
- `GEMINI.md` for Google Antigravity IDE
- Cursor `alwaysApply` troubleshooting note in `docs/onboarding.md`

### Changed

- README IDE compatibility table updated: Windsurf split into legacy (`.windsurfrules`) and Devin Desktop (`.devin/rules/`) rows; 5 new IDE rows added
- `goodvibes-hygiene` skill setup callout now lists all supported IDEs and clarifies that `/ponytail-review` and `/ponytail-audit` are Claude Code CLI only

## [1.3.0] - 2026-06-30

### Added

- `.cursor/rules/goodvibes.mdc` for Cursor IDE (`alwaysApply: true` frontmatter, MDC format)
- `.github/copilot-instructions.md` for GitHub Copilot (plain markdown, applied to all Copilot Chat requests)
- `.windsurfrules` for Windsurf / Devin Desktop (plain markdown, applied to every Cascade conversation)
- `.kiro/steering/goodvibes.md` for Kiro IDE (`inclusion: always` frontmatter)
- README `## IDE compatibility` section documenting all supported IDEs, file paths, and activation instructions

## [1.2.0] - 2026-06-27

### Added

- Hero README with one-command quickstart, badges (npm, PyPI, CI, license), and animated demo GIF
- VHS demo tape (`scripts/demo.tape`) for reproducible GIF generation in CI
- GitHub Actions workflow (`vhs.yml`) to auto-regenerate the demo GIF on README/tape changes

## [1.1.0] - 2026-06-26

### Added

- Non-empty project detection: shows a note before writing files if the destination is not empty
- Written/skipped file counts shown after `goodvibes init` completes
- `--minimal` flag: skips `.github/` (workflows, issue templates, PR template, dependabot) and `docs/`; writes only CLAUDE.md, skills, and IDE rule files
- `goodvibes upgrade` command: re-merges the CLAUDE.md sentinel block on existing projects

### Fixed

- `--dry-run --minimal` combination now correctly previews the filtered file list
- `ci.yml` guard: second `goodvibes init` run on an existing project skips rather than overwrites `ci.yml`
- Stack traces replaced with plain-English remediation messages for common failure modes (Python absent, headroom build failure, MCP registration error)

## [1.0.0] - 2026-06-24

### Added

- `npx @jgiox/goodvibes init` npm CLI (Commander.js, @clack/prompts, fs-extra, execa)
- `pip install jgiox-goodvibes && goodvibes init` pip CLI (Typer, Rich, shutil/pathlib)
- `CLAUDE.md` with engineering rules, ponytail minimalism ruleset, and `<!-- goodvibes:start -->` / `<!-- goodvibes:end -->` sentinel block for safe upgrades
- `.claude/skills/caveman/` skill for output token compression (forked from juliusbrussee/caveman, Apache 2.0)
- `.claude/skills/goodvibes-hygiene/` skill wrapping the ponytail plugin for on-demand complexity audits
- headroom integration: `uv tool install` → `pipx install` → `pip install` fallback chain with MCP registration
- GitHub Actions CI workflow (`ci.yml`) with Node.js and Python matrix builds
- GitHub Actions security workflow (`security.yml`): CodeQL, pip-audit, npm audit
- Dependency review workflow (`dependency-review.yml`) as a PR gate
- Dependabot configuration for actions, npm, and pip ecosystems
- `CONTRIBUTING.md`, `SECURITY.md`, `JOURNAL.md`, `CHANGELOG.md`
- Issue templates (bug report, feature request) and PR template
- `docs/onboarding.md` — git and GitHub basics for complete beginners
- `Apache-2.0` LICENSE and NOTICE file
- `goodvibes upgrade` command and GitHub template repo (`jgiox/goodvibes-template`)

[1.7.1]: https://github.com/jgiox/goodvibes/compare/npm-v1.7.0...npm-v1.7.1
[1.7.0]: https://github.com/jgiox/goodvibes/compare/npm-v1.6.2...npm-v1.7.0
[1.6.2]: https://github.com/jgiox/goodvibes/compare/v1.6.1...npm-v1.6.2
[1.6.1]: https://github.com/jgiox/goodvibes/compare/npm-v1.4.0...v1.6.1
[1.4.0]: https://github.com/jgiox/goodvibes/compare/pip-v1.0.0...npm-v1.4.0
[1.0.0]: https://github.com/jgiox/goodvibes/releases/tag/pip-v1.0.0
