# Frequently asked questions

Answers to common questions about goodvibes, with the exact steps to fix the usual problems. Each answer starts in plain words and then gives the details: which file changes, which command to run, how to turn something off. For an overview of goodvibes, start with the [README](README.md).

- [Getting started](#getting-started)
  - [What is goodvibes, and do I need Claude Code?](#what-is-goodvibes-and-do-i-need-claude-code)
  - [Does goodvibes cost anything or need an account?](#does-goodvibes-cost-anything-or-need-an-account)
  - [Which AI tools does goodvibes work with?](#which-ai-tools-does-goodvibes-work-with)
  - [Will goodvibes overwrite my existing project?](#will-goodvibes-overwrite-my-existing-project)
  - [Where did goodvibes put its files?](#where-did-goodvibes-put-its-files)
  - [Why is the first `goodvibes init` so slow?](#why-is-the-first-goodvibes-init-so-slow)
  - [How do I remove goodvibes?](#how-do-i-remove-goodvibes)
- [Updating](#updating)
  - [What is the difference between `goodvibes update` and `goodvibes upgrade`?](#what-is-the-difference-between-goodvibes-update-and-goodvibes-upgrade)
  - [How does `goodvibes update` decide which files to change?](#how-does-goodvibes-update-decide-which-files-to-change)
  - [Will `goodvibes update` overwrite my `.claude/settings.json` or `.mcp.json`?](#will-goodvibes-update-overwrite-my-claudesettingsjson-or-mcpjson)
  - [I deleted a goodvibes file. Will `goodvibes update` bring it back?](#i-deleted-a-goodvibes-file-will-goodvibes-update-bring-it-back)
  - [Why does `goodvibes --version` still show the old version after `goodvibes upgrade`?](#why-does-goodvibes---version-still-show-the-old-version-after-goodvibes-upgrade)
  - [Why does my `CLAUDE.md` have the full rules block after `goodvibes upgrade`?](#why-does-my-claudemd-have-the-full-rules-block-after-goodvibes-upgrade)
- [Claude Code guard rails](#claude-code-guard-rails)
  - [Why is my commit blocked by the journal check?](#why-is-my-commit-blocked-by-the-journal-check)
  - [Why does Claude Code say "goodvibes read guard" and not read a file?](#why-does-claude-code-say-goodvibes-read-guard-and-not-read-a-file)
  - [Why does Claude Code ask before running `node`, `python` or `npm install`?](#why-does-claude-code-ask-before-running-node-python-or-npm-install)
  - [Why does `goodvibes doctor` say `JOURNAL.md` is too big?](#why-does-goodvibes-doctor-say-journalmd-is-too-big)
  - [What does `goodvibes usage` show, and is it accurate?](#what-does-goodvibes-usage-show-and-is-it-accurate)
- [Your data and privacy](#your-data-and-privacy)
  - [Does goodvibes collect any data?](#does-goodvibes-collect-any-data)
- [Fixing problems](#fixing-problems)
  - [Why does `goodvibes update` say the goodvibes block in `CLAUDE.md` is damaged?](#why-does-goodvibes-update-say-the-goodvibes-block-in-claudemd-is-damaged)
  - [Why does goodvibes say `.goodvibes.json` is not valid JSON?](#why-does-goodvibes-say-goodvibesjson-is-not-valid-json)
  - [Why did the File Size check fail on my pull request?](#why-did-the-file-size-check-fail-on-my-pull-request)
  - [Where can I get help if I am still stuck?](#where-can-i-get-help-if-i-am-still-stuck)
- [Older versions](#older-versions)
  - [Why does `goodvibes` say version 1.6.1, and how do I fix it?](#why-does-goodvibes-say-version-161-and-how-do-i-fix-it)

## Getting started

### What is goodvibes, and do I need Claude Code?

goodvibes sets up your project so an AI coding tool works more carefully. One command (`npx goodvibes-cli init`) gives the AI a clear set of working rules, adds checks that stop common mistakes, and sets up GitHub to test every change.

You do not need Claude Code. The rules work in 14 AI tools, including Cursor, GitHub Copilot and Windsurf, and the GitHub checks run whichever tool wrote the code. The journal check works everywhere too, as a git hook (a script git runs before every commit). The journal check and the read guard also run as hooks (small scripts an AI tool runs before an action) in Codex CLI, Gemini CLI, GitHub Copilot, Cursor, Devin CLI, Windsurf and Kiro: see [Guard rails in other AI tools](README.md#guard-rails-in-other-ai-tools). The session check, the permissions, the skills and `goodvibes usage` are Claude Code only. See [How it works](README.md#how-it-works).

### Does goodvibes cost anything or need an account?

No. goodvibes is free and open source under the Apache 2.0 licence. It needs no account, no service and no API key. context7, the library docs server it adds, also works without a key.

A [GitHub](https://github.com/signup) account is optional; you need one only if you want your code on GitHub and the checks to run there. Your AI tool has its own pricing, which goodvibes does not change.

### Which AI tools does goodvibes work with?

`goodvibes init` writes the same rules for 14 tools, each in the file that tool reads by itself: Claude Code, Cursor, GitHub Copilot, Windsurf, Kiro, Cline, OpenAI Codex CLI, Replit Agent, Bolt.new and more. [Works with](README.md#works-with) lists every tool and its file.

Slash commands such as `/ponytail-review` work only in the Claude Code terminal. In other tools the rules still apply.

### Will goodvibes overwrite my existing project?

No. You can run `goodvibes init` in a project that already has files, and run it again later.

- Files you already have are kept. goodvibes adds only the files that are missing, and records in `.goodvibes.json` which files it wrote, so it never treats yours as its own.
- `CLAUDE.md` is merged. With the default setup, an existing `CLAUDE.md` is left as it is. With `--scope project`, goodvibes adds its rules between a `<!-- goodvibes:start -->` line and a `<!-- goodvibes:end -->` line and leaves the rest of the file alone.
- Settings are merged. goodvibes adds its entries to `~/.claude/settings.json` and keeps yours. If your project already has a `.claude/settings.json`, `init` keeps it and `goodvibes update` later adds only the goodvibes entries.
- goodvibes never writes through a symlink (a shortcut to another file or folder). It skips that path and tells you.

To see the plan first without writing anything, run:

```sh
npx goodvibes-cli init --dry-run
```

### Where did goodvibes put its files?

By default, in two places. Things that should apply to every project go into your Claude Code settings folder (`~/.claude`): the rules (`rules/goodvibes.md`), the skills, and the hooks and ask and deny rules in `settings.json`. context7 goes into your Claude Code user MCP settings. Things that belong to one project go into the folder where you ran `goodvibes init`: `JOURNAL.md`, `CHANGELOG.md`, CI workflows, rule files for other AI tools, context7 for Cursor (`.cursor/mcp.json`) and VS Code (`.vscode/mcp.json`), hook files for other AI tools (`.codex/hooks.json`, `.gemini/settings.json`, `.github/hooks/goodvibes.json`, `.devin/hooks.v1.json`, `.windsurf/hooks.json`, `.kiro/hooks/goodvibes.json`), `.claude/settings.json`, and a `CLAUDE.md` with a project section to fill in.

If you ran `goodvibes init --scope project`, everything is inside the project and nothing was written to `~/.claude`. The one exception is headroom, which is always registered in your Claude Code user settings. The project's `.goodvibes.json` records which scope it uses, and `goodvibes update` follows it. [Global or one project](README.md#global-or-one-project) has the full table.

### Why is the first `goodvibes init` so slow?

The first time, goodvibes installs headroom, which compresses what Claude reads. It downloads a few gigabytes of model files and can take several minutes. Later runs skip it. To skip headroom entirely, run:

```sh
npx goodvibes-cli init --minimal
```

`--minimal` also skips `docs/` and the CI files in `.github/` (workflows, scripts, Dependabot, issue and pull request templates). Copilot's rules (`.github/copilot-instructions.md`) and hooks (`.github/hooks/`) are still added.

### How do I remove goodvibes?

goodvibes is plain files, so removing it means deleting them. Do the steps that match what you set up.

1. **The global part** (skip this if you used `--scope project`). Delete `~/.claude/rules/goodvibes.md` and the goodvibes skills in `~/.claude/skills/` (`caveman`, `caveman-commit`, `caveman-help`, `caveman-review`, `goodvibes-hygiene` and `model-regression`). In `~/.claude/settings.json`, remove the hooks whose command starts with `: goodvibes-` and the ask and deny rules goodvibes added (listed in [What Claude Code can do without asking](README.md#what-claude-code-can-do-without-asking)). Delete `~/.claude/.goodvibes.json`. Then remove context7:

   ```sh
   claude mcp remove context7 -s user
   ```

2. **headroom**, if it was installed:

   ```sh
   claude mcp remove headroom -s user
   uv tool uninstall headroom-ai
   ```

   If uv was not available, goodvibes installed it with `pipx install` or `pip install --user`; uninstall it the same way.

3. **The `goodvibes` command.** If you installed with npm (or used `npx`), run:

   ```sh
   npm uninstall -g goodvibes-cli
   ```

   If you installed with Python, run `uv tool uninstall goodvibes-cli`, or `pip uninstall goodvibes-cli` if you used pip.

4. **The git commit check.** Delete `.git/hooks/pre-commit` in each project where goodvibes installed it.

5. **The project files.** `.goodvibes.json` lists the files goodvibes wrote: each entry with a long hash value is one of them, and entries marked `user-owned` are your own files. Delete the ones you do not want, then delete `.goodvibes.json`. You may want to keep `JOURNAL.md` and `CHANGELOG.md`, which hold your project's history. With `--scope project`, also delete everything in `CLAUDE.md` from `<!-- goodvibes:start -->` to `<!-- goodvibes:end -->`.

## Updating

### What is the difference between `goodvibes update` and `goodvibes upgrade`?

`goodvibes update` brings your project's goodvibes files (and the global setup in `~/.claude`, if you use it) up to date with the goodvibes version you have installed. Files you edited are kept. It does not look for a newer version of goodvibes.

`goodvibes upgrade` first installs the newest goodvibes from npm or PyPI (whichever you installed from), then runs `goodvibes update` with it. Use it when you want the latest release in one step. To see whether a newer version exists and preview the update without installing or writing anything, run:

```sh
goodvibes upgrade --dry-run
```

If you run `goodvibes upgrade` in a folder goodvibes never set up, and you have no global setup in `~/.claude` either, it installs the new version and stops with "Nothing to update here". That is not an error. To update a project, go into its folder and run `goodvibes update`; for a new project, go into its folder and run `goodvibes init`. Never run `goodvibes init` in your home folder: with `--scope project` it would put the project files there. In your Claude Code settings folder (`~/.claude`) `init` does the global part only and never adds project files.

### How does `goodvibes update` decide which files to change?

When goodvibes writes a file, it records a fingerprint of its content (a SHA-256 hash) in `.goodvibes.json`. On `update`, it compares each file with that fingerprint:

- Same fingerprint: you never edited the file, so it is replaced with the copy from the version you have installed. Right after `init` this lists every goodvibes file, even though nothing new has been released. That is normal.
- Different fingerprint: you edited the file, so it is left alone.
- `CLAUDE.md` is always merged: only the goodvibes block between the marker lines is replaced.

`update` shows the full plan and asks once before writing. `goodvibes update --dry-run` shows the plan without writing.

### Will `goodvibes update` overwrite my `.claude/settings.json` or `.mcp.json`?

No. If you never edited them, update replaces them with the new version. If you edited them, or they were yours before `goodvibes init`, update only adds or refreshes the goodvibes parts: the journal check hook, the read guard hook, the session check, the ask and deny rules, and the context7 server. Your own permissions, hooks and MCP servers stay exactly as they are. It never adds "allow" rules to a file you edited.

The same goes for `.cursor/mcp.json` and `.vscode/mcp.json`: update adds or refreshes only the `context7` entry and keeps your other servers. If you delete the `context7` entry or the whole file, it stays deleted.

In `.gemini/settings.json` (Gemini CLI) and `.codex/hooks.json` (Codex CLI), update adds or refreshes only the goodvibes hooks and keeps your own settings and hooks. The other tools' hook files (`.github/hooks/goodvibes.json`, `.devin/hooks.v1.json`, `.windsurf/hooks.json`, `.kiro/hooks/goodvibes.json`) are added if missing and left alone if you already have one.

One exception: versions up to 1.9.1 put allow rules for `node`, `python`, `npx`, `uv`, `npm run`, `npm install`, `pip install` and `git restore` into the project settings. Those let any command run without a prompt, so update removes exactly those rules and lists each one it removes. Allow rules you wrote yourself are kept. It never touches allow rules in `~/.claude/settings.json`.

Run `goodvibes update --dry-run` first to see every entry it would add or change. If one of your JSON files is not valid JSON, update leaves it unchanged and tells you. The same goes for a file that is valid JSON but has a setting of the wrong type, for example `"mcpServers": []` (a list where goodvibes expects an object): update leaves it unchanged and names the key to fix.

If you delete a goodvibes part on purpose (for example the journal check hook), update remembers that in `.goodvibes.json` and does not add it back.

### I deleted a goodvibes file. Will `goodvibes update` bring it back?

No. update notices the file is gone, tells you once, and records it as removed in `.goodvibes.json`, so later updates leave it alone. If you want it back, run `goodvibes init`, which restores missing goodvibes files. If you create a file with the same name yourself, it is yours: goodvibes never overwrites it.

### Why does `goodvibes --version` still show the old version after `goodvibes upgrade`?

This affects the Python install. On 1.9.1 and earlier, `goodvibes init` installed the `goodvibes` command pinned to its own version, and `uv tool upgrade` never moves past a pin. `upgrade` did not check the result, so it printed "Updated" anyway. Run this once:

```sh
uv tool install goodvibes-cli@latest
goodvibes --version
```

That installs the newest version and removes the pin, so later upgrades work. From 1.10.0, `goodvibes upgrade` replaces the pin itself, and if the new version still does not take effect, it stops with an error and the exact command to run instead of saying "Updated".

### Why does my `CLAUDE.md` have the full rules block after `goodvibes upgrade`?

In 1.9.0, `upgrade` used its own copy step that ignored the install scope. If you ran `goodvibes upgrade` in a project set up with the global default, its `CLAUDE.md` may now contain the full rules block as well, so Claude Code reads the rules twice. Open `CLAUDE.md` and delete everything from `<!-- goodvibes:start -->` to `<!-- goodvibes:end -->`. Your own project section above it stays.

## Claude Code guard rails

### Why is my commit blocked by the journal check?

The journal check stops a commit that leaves out `JOURNAL.md`, so every change leaves a note for the next session. It is a git hook (`.git/hooks/pre-commit`), so it works in every AI tool and for commits you type yourself, plus a hook that stops the AI before it runs the commit, in Claude Code and the tools listed in [Guard rails in other AI tools](README.md#guard-rails-in-other-ai-tools). It acts only in repositories that have a `JOURNAL.md`.

If git says `this commit leaves out JOURNAL.md`, or your AI tool says `JOURNAL.md not staged`, add a short entry to the journal and stage it with the rest of the change. To skip the check once, use `git commit --no-verify`.

For example:

```sh
git add JOURNAL.md
```

If it says it "cannot verify" the commit: the check has to know which repository a commit runs in. When a command changes folder more than once, or the folder name uses a variable it cannot work out, it blocks instead of guessing. Run the commit on its own, from inside the repository, for example:

```sh
cd my-project
git add JOURNAL.md
git commit -m "Describe what you changed"
```

To turn the check off, see [Journal check](docs/getting-started.md#journal-check-claude-code-only).

### Why does Claude Code say "goodvibes read guard" and not read a file?

That is the read guard hook. It runs in Claude Code and in the tools listed in [Guard rails in other AI tools](README.md#guard-rails-in-other-ai-tools). It stops two kinds of read:

- **Big files**: a whole file over 800 lines or 100 KB. Claude should read part of it (a range of lines) or search it instead; it usually does this by itself after the message.
- **Secret files**: `.env` files, SSH keys and credential files. Claude should ask you for the one value it needs instead of reading the whole file.

If you really want Claude to read the file, set `GOODVIBES_READ_GUARD=off` before starting Claude Code (or your other AI tool), for example:

```sh
GOODVIBES_READ_GUARD=off claude
```

See [About the read guard](docs/getting-started.md#about-the-read-guard-claude-code-only) for the full list of files and how to change the limits.

### Why does Claude Code ask before running `node`, `python` or `npm install`?

Because goodvibes stopped auto-approving them. An allow rule like `node*` lets any command run without a prompt (for example a one-line script that force-pushes), which made the ask and deny rules pointless. Your tests still run without a prompt (`npm test`, `pytest`, `uv run pytest`, `python -m pytest`).

If you trust a specific command, add just that command to the `allow` list in your project's `.claude/settings.json`, for example:

```json
"Bash(npm run build)"
```

[What Claude Code can do without asking](README.md#what-claude-code-can-do-without-asking) lists every rule.

### Why does `goodvibes doctor` say `JOURNAL.md` is too big?

`goodvibes doctor` checks your setup and marks each line ✓ (fine), ! (a warning) or ✗ (a problem). It exits with an error only for problems. A `JOURNAL.md` over 10 KB is only a warning.

Agents read `JOURNAL.md` at the start of every session, so a long journal costs tokens every time. The rules tell them to read only the "Standing decisions" section at the top and the last five entries. Move decisions that still apply into "Standing decisions" (one line each) and keep new entries short. Never delete old entries; they are the project's history.

### What does `goodvibes usage` show, and is it accurate?

It reads the session logs Claude Code keeps on your computer (`~/.claude/projects`) and adds up the tokens each session in this project used over the last 7 days: new input, output, and input that came from the cache. A high cache hit rate is good, because cached input is cheaper. "Peak context" is the most the session held at once; a session over 160,000 tokens is marked `!`, because that is close to the 200,000-token limit of most Claude models, and starting a fresh session is usually cheaper.

`--days N` changes the time range, `--all` covers every project, and `--json` prints machine-readable output. It never sends anything anywhere and never shows what you or Claude wrote. Claude Code's log format is internal and can change, so treat the numbers as estimates.

## Your data and privacy

### Does goodvibes collect any data?

`goodvibes init` sends one anonymous install count: an empty request carrying a random ID made fresh for that run. Nothing about you, your machine or your code is included, though like any web request the server sees your IP address. It is skipped when `CI=true` (set by GitHub Actions and most CI services). To turn it off, set `DO_NOT_TRACK=1` (or `true`, `yes`) or `GOODVIBES_NO_TELEMETRY=1` in your environment before running `goodvibes init`. The counter has no accounts or keys, so anyone can add to it and its totals are only approximate.

`goodvibes usage` and `goodvibes doctor` never send anything. context7 is an online service: when your AI tool looks up library docs, the question goes to context7. The goodvibes rules tell the AI never to put secrets, personal data or private code in those lookups.

## Fixing problems

### Why does `goodvibes update` say the goodvibes block in `CLAUDE.md` is damaged?

goodvibes keeps its rules between a `<!-- goodvibes:start -->` line and a `<!-- goodvibes:end -->` line. If one of them is missing, doubled, or they are in the wrong order, goodvibes cannot tell which text is yours, so it changes nothing and stops with an error. Open `CLAUDE.md`, make sure there is exactly one start line followed later by exactly one end line (each on its own line), then run `goodvibes update` again. If in doubt, delete both lines and everything between them; the next update adds a fresh block and keeps the rest of your file.

### Why does goodvibes say `.goodvibes.json` is not valid JSON?

`.goodvibes.json` is how goodvibes remembers which files it wrote. It usually breaks when a git merge leaves conflict markers (`<<<<<<<`) in it. Open it and fix the conflict.

You can also delete the file and run `goodvibes init`, which recreates it. Your files are kept, but goodvibes then treats every file that is already there as yours, so `goodvibes update` stops refreshing them. Fixing the conflict avoids that.

If the message says `is not a valid goodvibes manifest`, the file is valid JSON but one entry is wrong: a setting of the wrong type, or a file path that is not a plain path inside the folder (for example one that starts with `/` or contains `..`). goodvibes stops instead of guessing, because a `.goodvibes.json` that came with a cloned project could otherwise make `goodvibes update` delete files that goodvibes never wrote. The message names the entry. Fix it or delete the file as described above.

### Why did the File Size check fail on my pull request?

goodvibes ships a CI check (an automatic test GitHub runs on every pull request) that keeps code files small, because AI tools read and edit small files more cheaply and more reliably. A code file may have at most 500 lines, and a file that is already longer may not grow. Ask your AI tool to move the new code into a new file.

If one file really must be bigger, give it its own limit in `.github/file-size-limits.json`, for example:

```json
{ "allow": { "src/big.ts": 900 } }
```

The check's message shows the exact line to add.

### Where can I get help if I am still stuck?

Open an issue and describe what you see: <https://github.com/jgiox/goodvibes/issues>

Include the output of these commands; that is usually enough to find the problem:

```sh
goodvibes --version
goodvibes doctor
```

If you installed with Python, also include the output of `uv tool list`.

## Older versions

### Why does `goodvibes` say version 1.6.1, and how do I fix it?

goodvibes was first published on PyPI as `jgiox-goodvibes`. If you installed it before the package was renamed to `goodvibes-cli`, the `goodvibes` command on your machine still points to the old package. You are affected if you see any of these:

- `goodvibes --version` prints **1.6.1**.
- The update header reads **"goodvibes upgrade"** when you run `goodvibes update`.
- `uv tool list` shows **`jgiox-goodvibes`** instead of **`goodvibes-cli`**.
- `uv tool upgrade goodvibes-cli` says **"goodvibes-cli is not installed"**.

The last one happens because the `goodvibes` command is a shortcut (symlink) into the old `jgiox-goodvibes` package, so upgrading `goodvibes-cli` changes nothing. Remove the old package and install the new one:

```sh
uv tool uninstall jgiox-goodvibes
uv tool install goodvibes-cli
```

If you installed with pip instead of uv, run these instead:

```sh
pip uninstall jgiox-goodvibes
pip install goodvibes-cli
```

Then check the version:

```sh
goodvibes --version
```

Any version above 1.6.1 means the fix worked. If you still see 1.6.1, close and reopen your terminal, then run `goodvibes --version` again.
