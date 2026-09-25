# Getting started with goodvibes

goodvibes gives your AI coding assistant a set of working rules, adds guard rails that stop common mistakes, and sets up GitHub to check every change. This guide explains what `goodvibes init` just did, walks you through your first change, and then covers each piece: what it is, how it helps you, what it does, and how to turn it off.

## What just happened

`goodvibes init` did three things.

1. **It gave your AI tool working rules.** The rules tell the AI to plan first, keep changes small, run the tests, write down decisions and ask before risky steps. They are plain text files that your AI tool reads on its own. Claude Code reads `~/.claude/rules/goodvibes.md` (`~` means your home folder), or this project's `CLAUDE.md` if you used `--scope project`. Every other tool reads its own rule file, listed in the [README](https://github.com/jgiox/goodvibes#works-with).
2. **It added guard rails to your AI tool.** Hooks (small scripts an AI tool runs before certain actions) and permissions stop a few common mistakes before they happen. All of them work in Claude Code. Two of the hooks, the journal check and the read guard, also run in Codex CLI, Gemini CLI, GitHub Copilot, Cursor, Devin CLI, Windsurf and Kiro.
3. **It added files to this folder.** `JOURNAL.md` (a log of decisions), `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, a `CLAUDE.md` with a project section for you to fill in, these guides, rule files and hook files for other AI tools, and GitHub workflows that test and scan every change.

By default the rules and guard rails apply to every project on your computer, not just this one. [Global or one project](https://github.com/jgiox/goodvibes#global-or-one-project) in the README lists exactly what went where.

You do not need to understand any of this to start. To check that everything is in place, run:

```sh
goodvibes doctor
```

## Your first change

The loop is the same in every AI tool: ask, check, save, share.

1. **Open this folder in your AI tool.** For Claude Code, open a terminal in this folder and run `claude`. For Cursor, Windsurf, Kiro and the others, open the folder as a project.
2. **Describe your project once (optional).** Open `CLAUDE.md` and fill in the three lines under "Project": what this is, what matters most, and any limits. The rules tell the AI to look there before asking you questions.
3. **Ask for one small thing.** For example: "Add a page that says hello." A small request gives a small change that is easy to check.
4. **Let the AI work.** The rules tell it to state its assumptions, make the smallest change that works, run the tests, and add an entry to `JOURNAL.md`. If it says "done" without showing the test output, ask for the output.
5. **Check what changed.** Run `git status` to see which files changed and `git diff` to see the changed lines. If the AI changed more than you asked for, ask it to undo the extra part.
6. **Save a checkpoint (a commit).** Name each file you want to save, plus `JOURNAL.md`:

   ```sh
   git add src/hello.html JOURNAL.md
   git commit -m "feat: add hello page"
   ```

   Naming files one by one keeps stray files, such as a `.env` file with passwords, out of your history. If git says "not a git repository", this folder is not under git yet: see [Git and GitHub basics](onboarding.md#start-a-new-project). In Claude Code, the AI can run both commands for you without asking. In every tool, and when you commit yourself, the [journal check](#journal-check-claude-code-only) stops a commit that leaves out `JOURNAL.md`.
7. **Share it (a push).** `git push` sends your commits to GitHub, where the [checks](#github-checks-ci) run. Claude Code always asks you before it pushes. New to branches and pull requests? Read [Git and GitHub basics](onboarding.md).

## Rules and ponytail: how the AI works

**What it is.** The rules are a page of plain instructions for the AI. ponytail is the part of the rules about minimalism: write as little code as the task needs.

**Why it helps you.** Left alone, AI assistants add code and libraries you did not ask for, hide errors, and say "done" without proof. Each of those costs you time later. The rules turn the habits of a careful developer into orders the AI follows from the first message.

**What it does.** The main rules:

- **Start of every session:** read `JOURNAL.md` first, and never ask you something the project files already answer.
- **Think before coding:** write down assumptions; stop and ask when a request could mean different things.
- **Surgical changes:** touch only what the task needs; no reformatting or renaming on the side.
- **Fail loud:** no hidden errors, no fake success, no made-up data.
- **Security:** never open `.env` files or keys; ask you for the value instead.
- **Definition of done:** tests pass with the output shown, docs are updated, `CHANGELOG.md` and `JOURNAL.md` get an entry, and only named files are staged.
- **Action tiers:** reading and editing are automatic; commits come with a summary; pushing needs your OK; publishing and deploying need your explicit approval.

ponytail adds a ladder the AI climbs before writing code. It stops at the first rung that works:

1. Does this need to exist at all?
2. Does the codebase already have it?
3. Does the standard library do it?
4. Does the platform do it?
5. Does an installed dependency do it?
6. Can it be one line?
7. Only then: the least code that completely solves the problem.

Claude Code gets the full ponytail ruleset, with three levels (lite, full, ultra; the default is full). Every other tool gets the same ladder under "Simplicity first" in its rule file.

**Turn it off.**

- For one Claude Code session: type `stop ponytail` or `normal mode`.
- Claude Code, permanently: delete `~/.claude/rules/goodvibes.md`. `goodvibes update` does not bring it back. With `--scope project`, the rules are the block between `<!-- goodvibes:start -->` and `<!-- goodvibes:end -->` in `CLAUDE.md`; you can delete that block, but `goodvibes update` adds it back.
- Other tools: delete that tool's rule file, for example `.cursor/rules/goodvibes.mdc`.

The optional `/ponytail-review` (check your changes for over-building) and `/ponytail-audit` (check the whole project) commands need the ponytail plugin and work in the Claude Code terminal only. To install it, type these in Claude Code:

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

## caveman: shorter replies

**What it is.** A reply style: short, clipped sentences with no filler. It is on from the first reply in every AI tool, because the goodvibes rules turn it on. In Claude Code it is also a skill (a set of instructions Claude Code loads), which holds the full style guide.

**Why it helps you.** Every word the AI writes costs tokens and fills the context window (the working memory of a session). Shorter replies leave more room for your code, so a session lasts longer before it has to start over.

**What it does.** goodvibes starts every session at the strongest level, `ultra`: the AI drops filler words, uses short forms such as "DB", "auth" and "fn", and writes arrows for cause and effect ("token expired → 401"). Code, file names, commands, error messages, commit messages, pull requests and docs are never shortened. For security warnings and steps that cannot be undone, the AI switches back to full sentences.

`ultra` takes some getting used to. If the replies are too terse, say so, or type one of these:

- `/caveman full` (in other tools: "caveman full"): short sentences, no abbreviations.
- `/caveman lite` (in other tools: "caveman lite"): normal sentences, just no filler.
- `stop caveman` (or `normal mode`): off for the rest of the session.

goodvibes also installs these Claude Code skills: `caveman-commit` and `caveman-review` (short commit messages and review comments), `caveman-help` (a quick reference), `goodvibes-hygiene` (on-demand over-engineering audits) and `model-regression` (a before-and-after check whenever a change can move a model or a score).

**Turn it off for good.** Delete the "Replies" section from the rules: in `~/.claude/rules/goodvibes.md` for Claude Code, or in your tool's rule file (for example `.cursor/rules/goodvibes.mdc`). `goodvibes update` keeps a rules file you edited. With `--scope project`, the Claude Code rules live in the goodvibes block of `CLAUDE.md`, which `goodvibes update` rewrites, so type `stop caveman` there instead. To remove a skill, delete its folder: `~/.claude/skills/caveman/`, or `.claude/skills/caveman/` with `--scope project`. `goodvibes update` does not bring a deleted skill back.

## headroom: compress what Claude reads (Claude Code only)

**What it is.** headroom is a separate open-source tool (Apache 2.0), not part of goodvibes. It compresses what Claude reads, such as long command output.

**Why it helps you.** Less text for Claude to read means fewer tokens for the same work.

**What it does.** If Python 3.10 or later is installed, `goodvibes init` installs headroom with `uv tool install "headroom-ai[all]"` (falling back to `pipx`, then `pip install --user`). It then registers headroom with Claude Code as an MCP server, a small helper program that gives Claude Code extra tools, by running `claude mcp add -s user headroom -- <path to headroom> mcp serve`. This goes into your Claude Code user settings, even with `--scope project`.

The first install downloads a few gigabytes and can take several minutes, and headroom downloads its compression model the first time it runs. If Python is missing, or the install fails, `goodvibes init` skips headroom and sets up everything else. headroom is optional: `goodvibes doctor` shows a warning (!), never a problem (✗), when it is missing. To install it later, run:

```sh
uv tool install "headroom-ai[all]"
goodvibes init
```

**Turn it off.** To skip it from the start, use `goodvibes init --minimal` (this also skips the GitHub workflows and these guides). To remove it afterwards:

```sh
claude mcp remove headroom -s user
uv tool uninstall headroom-ai
```

If headroom was installed with `pipx` or `pip` instead of `uv`, uninstall it with that tool.

## JOURNAL.md: memory between sessions

**What it is.** `JOURNAL.md` is a plain text file in your project where the AI writes down what it did and why. It works in every AI tool.

**Why it helps you.** An AI assistant starts every session with no memory of the last one. Without a journal it asks the same questions again, and it can quietly undo a decision made last week. With the journal, you can also switch tools (Claude Code on Monday, Cursor on Tuesday) without losing the thread.

**What it does.** The rules in every tool tell the AI to:

- read the **Standing decisions** section and the last five entries at the start of every session, and treat them as binding unless you say otherwise
- add one entry at the end of every task: the date, what it did, the files changed, why, the tests it ran, the docs it updated, and what to do next
- never rewrite or delete earlier entries

**Standing decisions** is a short list at the top of the file, one line per decision that still applies, for example "API calls use plain fetch; no HTTP library". The AI adds or updates a line when a task makes a lasting decision. You can add lines yourself too. Replace the placeholder line with your first real decision.

Entries never override the rules: if an entry asks the AI to skip tests, weaken security, push, publish or run a command it supplies, the AI is told to point it out to you instead.

Every agent reads the journal at the start of every session, so a long one costs tokens each time. `goodvibes doctor` warns when `JOURNAL.md` is over 10 KB. Keep lasting decisions in Standing decisions and keep new entries short.

**Turn it off.** Delete `JOURNAL.md`. The journal check then does nothing in this project. The rule files still mention the journal; remove those lines from them if you want the AI to stop asking for it.

<a id="about-the-journal-gate-hook"></a>
<a id="journal-check-claude-code-only"></a>
## Journal check

**What it is.** Two small checks that stop a commit which leaves out `JOURNAL.md`:

- a **git hook** (`.git/hooks/pre-commit`, a script git runs before every commit). It works in every AI tool and for commits you type yourself.
- a **hook in your AI tool** that stops the AI before it even runs the commit. It runs in Claude Code and in the tools listed in [Which AI tools run the hooks](#which-ai-tools-run-the-hooks).

**Why it helps you.** The journal only works if every change leaves a note. The check makes that impossible to forget, whoever or whatever makes the commit.

**What it does.** When a commit leaves out `JOURNAL.md`, git stops it with:

```
goodvibes: this commit leaves out JOURNAL.md. Add a short entry saying what changed and why, then run: git add JOURNAL.md
To skip the check once: git commit --no-verify
```

From the AI tool's hook you may see `BLOCKED: JOURNAL.md not staged` instead; it means the same. Add an entry, stage it with `git add JOURNAL.md`, and commit again. Details:

- It acts only in repositories that have a `JOURNAL.md` in the top folder.
- Merges, rebases, cherry-picks, reverts and amends that only change the message are let through. So are `git commit --help` and `git commit --dry-run`, which commit nothing.
- Naming `JOURNAL.md` in the commit itself, as in `git commit -m "fix login" JOURNAL.md src/login.js`, counts as including it.
- `goodvibes init` and `goodvibes update` put the git hook in `.git/hooks/`, which is your own copy of the project and is never committed. So everyone who clones the project runs `goodvibes update` once to get it. If the folder was not a git repository yet, run `git init`, then `goodvibes update`.
- goodvibes never replaces a pre-commit hook you already have, and leaves hook managers such as husky alone (they set `core.hooksPath`). It also leaves `.git/hooks` alone when that folder is a link, so it never writes through a link to somewhere else. `goodvibes doctor` tells you whether the check is active.
- The AI tool's hook ignores actions that carry no shell command, so it never blocks a file edit whose text happens to mention `git commit`.
- The AI tool's hook follows the commit to the right repository, including `cd somewhere && git commit`, `git -C somewhere commit`, and the folder Gemini CLI or Windsurf says the command runs in. If it cannot tell which repository a commit runs in, it blocks with a "cannot verify" message; run the commit as its own command from inside the repository.
- Both are a safety net for honest mistakes, not a security boundary.

**Turn it off.**

- Once: `git commit --no-verify`.
- For a terminal session: set `GOODVIBES_JOURNAL_CHECK=off` (git hook only).
- For good: delete `.git/hooks/pre-commit`; `goodvibes update` does not add it back (`goodvibes init` does). For the Claude Code hook, delete the `PreToolUse` entry whose command starts with `: goodvibes-journal-gate` from `~/.claude/settings.json` and from this project's `.claude/settings.json`; `goodvibes update` does not add it back. For the other tools, delete the entry whose command starts with `: goodvibes-journal-gate` from that tool's hook file (listed in [Which AI tools run the hooks](#which-ai-tools-run-the-hooks)).

<a id="about-the-read-guard-claude-code-only"></a>
<a id="read-guard-claude-code-only"></a>

## Read guard

**What it is.** A second hook, in Claude Code and the same other tools as the journal check. It runs before the AI reads a file, searches files or runs a terminal command.

**Why it helps you.** Reading a whole large file fills the context window and costs tokens, usually for one function Claude could have found with a search. Reading a secrets file puts your passwords in the conversation.

**What it does.**

- **Big files:** when Claude tries to read a whole file over 800 lines or 100 KB at once (with its Read tool, or with `cat`, `less`, `more`, `nl`, a large `head` or `tail`, or `sed -n 1,5000p`), the hook stops it and tells it to read a range of lines or search with Grep first. Reading a range, and piping into `head`, `tail`, `grep` or `wc`, is allowed. In other tools, the read guard understands each tool's own way of reading a file, for example a line range given as a start and an end line. Images, PDFs and notebooks opened with Claude Code's Read tool are not limited. Change the limits with the `GOODVIBES_READ_GUARD_LINES` and `GOODVIBES_READ_GUARD_KB` environment variables.
- **Secret files:** it stops Claude from reading `.env` files, anything in `~/.ssh`, `~/.aws/credentials`, `.git-credentials`, `.netrc`, and `.pem`, `id_rsa`, `id_ed25519`, `id_ecdsa` or `id_dsa` files, and tells it to ask you for the value it needs. Capital letters (`.ENV`) and patterns that could match one of these files (`cat .env*`) count too. Searches (Grep and similar) are checked for these files, but not for size. `.env.example`, `.env.sample` and `.env.template` stay readable.

It is best-effort, a safety net and not a security boundary: it catches the common ways to read a file, not every one. For example, a script that opens the file itself gets past it.

**Turn it off.** Start Claude Code (or your other AI tool) with `GOODVIBES_READ_GUARD=off` set, which turns off both parts. Other tools see it only if they pass your environment on to their hooks; Gemini CLI running in CI does not:

```sh
GOODVIBES_READ_GUARD=off claude
```

To remove it for good, delete the `PreToolUse` entry whose command starts with `: goodvibes-read-guard` from `~/.claude/settings.json` and from this project's `.claude/settings.json`, and from the other tools' hook files. `goodvibes update` does not add it back. The [permissions](#permissions-claude-code-only) still stop Claude's own Read tool from opening `.env` files and keys.

### Which AI tools run the hooks

The journal check and the read guard run in these tools. Every file runs the exact same two scripts.

| Tool | Where the hooks are |
|---|---|
| Claude Code | `~/.claude/settings.json` and this project's `.claude/settings.json` |
| Cursor | No file of its own: it runs the hooks in `.claude/settings.json` while its "Include Third-Party Plugins, Skills, and Other Configs" setting is on (the default) |
| GitHub Copilot CLI | `.claude/settings.json` and `.github/hooks/goodvibes.json`, so each check runs twice (same result) |
| GitHub Copilot cloud agent, Copilot in VS Code | `.github/hooks/goodvibes.json` (written with `--minimal` too) |
| OpenAI Codex CLI | `.codex/hooks.json`. Codex asks you once to trust the project's hooks before they run (a review screen at startup) |
| Gemini CLI | `.gemini/settings.json`, under `BeforeTool`. Gemini runs project hooks only in a trusted folder and shows a warning the first time it sees them |
| Devin CLI | `.devin/hooks.v1.json` |
| Windsurf | `.windsurf/hooks.json`, before a command and before a file read |
| Kiro | `.kiro/hooks/goodvibes.json` |

Not covered: Cline (its hooks stop the whole task instead of one action), Antigravity (its hook format is not documented well enough to target), Continue (its hooks are not switched on yet), Amazon Q Developer CLI (discontinued, replaced by Kiro), and Replit, Bolt, Lovable, Base44 and ChatGPT (no hooks). The git commit check still covers the journal in every tool that makes git commits.

`goodvibes update` merges the goodvibes hooks into an existing `.gemini/settings.json` or `.codex/hooks.json` and keeps your own settings and hooks. The other files are added if missing and left alone if you already have one. Claude Code asks before it edits any of these files, so an agent cannot quietly turn the checks off for another tool.

None of these tools were tested by running them: the file formats were checked against each tool's documentation or source code. The checks are POSIX sh scripts, so on Windows they may not run in tools other than Claude Code (unverified). The Copilot hook file sets only the `bash` field, so on Windows Copilot skips it rather than failing.

## Permissions (Claude Code only)

**What it is.** Three lists in Claude Code's settings: what Claude may do without asking, what it must ask you about first, and what it may never do.

**Why it helps you.** You are not interrupted for safe, everyday steps such as editing files, committing and running tests. You are always asked before anything that is hard to undo or leaves your computer, such as pushing, publishing or deploying. Force-push, `git reset --hard` and reading secret files are refused outright.

**What it does.** The full lists are in the README: [What Claude Code can do without asking](https://github.com/jgiox/goodvibes#what-claude-code-can-do-without-asking). The "ask" and "never" lists go into `~/.claude/settings.json` and this project's `.claude/settings.json`; the "without asking" list goes into the project file only. Claude asks before it edits either settings file itself, or any of the other tools' hook files.

**Turn it off.** Edit the `permissions` block in `.claude/settings.json` (and `~/.claude/settings.json`): remove a rule to drop it, or move it between `allow`, `ask` and `deny`. `goodvibes update` keeps your changes and does not put back rules you removed.

## Session-start check (Claude Code only)

**What it is.** A quick health check that runs once each time you start Claude Code.

**Why it helps you.** Small setup problems, such as git not knowing your name, surface at the start of a session instead of halfway through a task.

**What it does.** Claude Code runs `goodvibes doctor --quick`. It checks that git knows your name and email, that the goodvibes rules are in place (in a goodvibes project), and that `JOURNAL.md` is not over 10 KB. If all is well it prints nothing. If not, Claude sees a one-line note starting with `goodvibes doctor:` with the fix, and can tell you about it. It never stops Claude Code from starting.

It needs the `goodvibes` command installed on your computer. `goodvibes init` installs it by default; with `--scope project` it does not, and the check quietly skips itself. To install it:

```sh
npm install -g goodvibes-cli
```

or, with Python:

```sh
uv tool install goodvibes-cli
```

**Turn it off.** Delete the `SessionStart` entry whose command starts with `: goodvibes-doctor` from `~/.claude/settings.json` and from this project's `.claude/settings.json`. `goodvibes update` does not add it back.

## doctor: check your setup

**What it is.** A command that checks your goodvibes setup and tells you how to fix anything that is wrong.

**Why it helps you.** When something does not seem to work, one command tells you what is missing and the exact fix.

**What it does.** Run:

```sh
goodvibes doctor
```

It checks:

- that headroom is installed and working (optional)
- that the `goodvibes` command is installed, so the session-start check can run (optional)
- that git knows your name and email
- that the goodvibes rules are in place: `~/.claude/rules/goodvibes.md`, or with `--scope project` a `CLAUDE.md` with the goodvibes block
- that `JOURNAL.md` is not over 10 KB
- the MCP servers Claude Code uses (from `~/.claude.json` and this project's `.mcp.json`). It warns about a plain `http://` address, a password or key written straight into the file, a package downloaded without a fixed version every time the server starts, and a download piped into a shell. It never contacts the servers, and it names a setting that holds a secret without printing the secret.

Each line starts with ✓ (fine), ! (a warning) or ✗ (a problem), and a "How to fix" list follows. Optional parts such as headroom only ever warn. The last line says `Ready.`, `Ready, with N warning(s).` or `Not ready: N problem(s).`. Only problems make `doctor` exit with an error. It never sends anything over the network.

**Turn it off.** There is nothing to turn off: it runs only when you type it, and in its quick form through the session-start check.

## usage: see where your tokens went (Claude Code only)

**What it is.** A command that shows how many tokens your recent Claude Code sessions used.

**Why it helps you.** Tokens are what AI use costs. Seeing which sessions were expensive, and how full the context window got, tells you when to start a fresh session.

**What it does.** Run:

```sh
goodvibes usage
```

It reads Claude Code's local session logs (in `~/.claude/projects/`) for this project, from the last 7 days, and shows the 10 most recent sessions with their total tokens, cache hit rate (the share of input Claude reused from its cache, which is cheaper) and peak context (the most text Claude held at once). A `!` marks a session whose peak context passed 160,000 tokens, near the 200,000 limit of most Claude models; starting a fresh session is cheaper.

- `--all`: every project, not just this one
- `--days N`: the last N days instead of 7
- `--json`: output for scripts

It works offline and reads only token counts, never what you or Claude wrote. Claude Code's log format can change, so the numbers are best effort.

**Turn it off.** There is nothing to turn off: it runs only when you type it.

<a id="what-is-context7"></a>

## context7: current library docs (Claude Code, Cursor, VS Code)

**What it is.** context7 is an MCP server that gives your AI tool current documentation for libraries and frameworks. It is free and needs no account or key.

**Why it helps you.** An AI model learned its libraries at one point in time. When a library changes, the AI keeps writing the old way. With context7, the AI can look up the current docs first, and the rules tell it to check an API before stating a guess as fact.

**What it does.** `goodvibes init` sets context7 up in three tools:

| Tool | Where |
|---|---|
| Claude Code | Your Claude Code user settings, or this project's `.mcp.json` with `--scope project` |
| Cursor | `.cursor/mcp.json` in this project |
| VS Code (GitHub Copilot) | `.vscode/mcp.json` in this project |
| Windsurf | Not set up for you: see [Windsurf setup](platform-setup/windsurf.md) for the manual step |

**In Claude Code.** By default, `goodvibes init` adds context7 to your Claude Code user settings, so it works in every project:

```sh
claude mcp add --transport http --scope user context7 https://mcp.context7.com/mcp
```

If the `claude` command was not installed when you ran `goodvibes init`, it printed this command for you to run later. Run `claude mcp list` to see it.

With `--scope project`, context7 is in this project's `.mcp.json` instead. The first time Claude Code opens a project with an `.mcp.json`, it asks whether to trust the project's MCP servers; say yes. Until you do, `claude mcp list` shows context7 as "Pending approval" and it stays off. If you declined by mistake, run `claude mcp reset-project-choices` and open Claude Code again.

If you hit rate limits, get a free key from context7 and add it. In your user settings (the key stays out of every project):

```sh
claude mcp remove context7 -s user
claude mcp add --transport http --scope user --header "Authorization: Bearer YOUR_KEY" context7 https://mcp.context7.com/mcp
```

In a project `.mcp.json`, set a `CONTEXT7_API_KEY` environment variable and reference it:

```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "Authorization": "Bearer ${CONTEXT7_API_KEY}"
      }
    }
  }
}
```

Never commit the key itself, only the `${CONTEXT7_API_KEY}` reference.

**In Cursor and VS Code.** The files are in the project whichever scope you chose, because those tools do not read the Claude Code settings. Each holds only the context7 server. You can add your own servers to the same file: `goodvibes update` adds or refreshes only the `context7` entry and keeps the rest. In Cursor you can see it under Cursor Settings, Tools & MCP. To use a key in these tools, follow context7's setup notes for your tool at [context7.com/docs/resources/all-clients](https://context7.com/docs/resources/all-clients), and keep the key in an environment variable, never in the file.

**Turn it off.** Run `claude mcp remove context7 -s user`. With `--scope project`, delete the `context7` entry from `.mcp.json`. In Cursor or VS Code, delete the `context7` entry from `.cursor/mcp.json` or `.vscode/mcp.json`, or the whole file. `goodvibes update` does not bring back anything you deleted.

## GitHub checks (CI)

**What it is.** CI (continuous integration) means GitHub runs checks on your code every time you push or open a pull request. goodvibes adds the checks as workflow files in `.github/workflows/`. They start working once your project is on GitHub.

**Why it helps you.** The rules and guard rails guide the AI; the checks verify the result, whichever tool or person wrote the code. A red ✗ on a pull request tells you something broke before it reaches your main branch.

**What it does.**

| Workflow | When it runs | What it checks |
|---|---|---|
| `ci.yml` | Pushes to `main`, pull requests to `main` | Your tests. For Node.js (Node 22 and 24): `npm install`, `npm run build` and `npm test` if they exist, and `npm run lint` (a warning if there is no lint script). For Python (3.10, 3.11, 3.12): installs with `uv`, lints with `ruff`, runs `pytest` if there are `test_*.py` files (for a `requirements.txt` project it installs `pytest` too) |
| `security.yml` | Pushes to `main`, pull requests to `main`, every Monday | CodeQL looks for security bugs in your Python, JavaScript and TypeScript code (it is skipped when there is none yet); gitleaks looks for passwords and keys in your whole git history |
| `dependency-review.yml` | Pull requests to `main` | Every new dependency must have a permissive licence (MIT, Apache 2.0, BSD, ISC and a few others) |
| `file-size.yml` | Every pull request, pushes to `main` | Code files stay small (see below) |

- goodvibes picks the Node.js tests if your project has a `package.json`, the Python tests if it has a `pyproject.toml` or `requirements.txt`, and both if it has both or neither. The Node.js tests are skipped while there is no `package.json`, and the Python tests while there is no `pyproject.toml` or `requirements.txt`, so a new, empty project gets a green check instead of a red one.
- CodeQL and dependency review need GitHub Advanced Security on private repositories, so they are skipped there and run on public ones.
- Every workflow gets a read-only token, and a newer push to a pull request cancels the older run.
- `.github/dependabot.yml` opens pull requests each week to update the GitHub Actions your workflows use, at most five open at a time. It waits 7 days after a release before proposing it. `goodvibes init` also adds your package manager when it finds its files: `npm` for a `package.json`, `uv` for a `uv.lock`, or else `pip` for a `requirements.txt` or a `pyproject.toml`. It adds no others, because Dependabot fails every week for a package manager whose files your project does not have. If you add one later, `goodvibes update` adds it too, as long as you have not edited the file. To add one by hand, put this block at the end of `.github/dependabot.yml`, and change `"npm"` to `"uv"` or `"pip"` if that is the one you need.

  ```yaml
    - package-ecosystem: "npm"
      directory: "/"
      schedule:
        interval: "weekly"
      open-pull-requests-limit: 5
      cooldown:
        default-days: 7
  ```
- If your project already had workflows (any `.yml` or `.yaml` file in `.github/workflows/`) when you ran `goodvibes init`, goodvibes added only `file-size.yml` and none of its other workflows. A project set up before this that has the file size script but not `file-size.yml` gets it on the next `goodvibes update`.

### File size check

AI tools read and edit small files more cheaply and more accurately. The file size check keeps code files small:

- A new or changed code file must stay at or under 500 lines.
- A file that is already over its limit may not grow. Move new code into a new file instead.

It compares your changes with the branch your pull request targets, or with the commit before a push. It checks common code files (`.js`, `.ts`, `.py`, `.go`, `.rs`, `.java` and others). It skips lockfiles, minified files, `dist/`, `build/`, `node_modules/`, `vendor/`, `.venv/`, binary files, and generated files (with `@generated` or `DO NOT EDIT` in their first five lines). To run it on your computer:

```sh
node .github/scripts/check-file-sizes.mjs
```

To change the limits, create `.github/file-size-limits.json` (goodvibes does not create it). Every key is optional:

```json
{
  "default": 500,
  "extensions": { ".py": 600 },
  "ignore": ["gen/**"],
  "allow": { "src/big.ts": 1200 }
}
```

- `default`: the limit for the built-in code file types.
- `extensions`: a different limit for one file type, or a new file type to check.
- `ignore`: files to skip. `*` matches any characters except `/`, `**` any number of folders, `?` one character.
- `allow`: the limit for one file.

When the check fails, its message suggests the exact `allow` line for the file. A mistake in this file (bad JSON, an unknown key, a limit that is not a whole number) fails the check with a message saying what to fix.

**Turn it off.** Delete the workflow file you do not want from `.github/workflows/`, for example `.github/workflows/file-size.yml`. For Dependabot, delete `.github/dependabot.yml`. `goodvibes update` does not bring deleted files back; `goodvibes init` does, if you change your mind.

## More help

- [FAQ](https://github.com/jgiox/goodvibes/blob/main/FAQ.md): common questions and fixes
- [README](https://github.com/jgiox/goodvibes#readme): every command, and how updating works
- [Git and GitHub basics](onboarding.md): for complete beginners
