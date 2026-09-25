# Getting started with goodvibes

You ran `goodvibes init`. Here is what happens next.

## What was set up

goodvibes put its engineering rules and the ponytail minimalism ruleset where Claude Code reads them in every project (`~/.claude/rules/goodvibes.md`), or in this project's `CLAUDE.md` if you used `--scope project`. It also wrote AI rule files for your coding tool (Cursor, Windsurf, Kiro, GitHub Copilot, and others), CI workflows for automated quality checks (tests, security scans, dependency review, and a file size check that stops code files from growing past 500 lines), and docs templates including this one. Everything runs automatically — no configuration needed.

## Your first change

1. **Open your project in your AI coding tool.** Cursor, Windsurf, Kiro, and GitHub Copilot all pick up the goodvibes rules automatically. The AI will follow minimal-code and fail-loud principles from the first message.
2. **Tell the AI what you want to build.** Describe the feature in plain language — the rules guide the AI to keep code simple and surgical.
3. **Review the diff before you commit.** Check that the AI only changed what you asked. The rules encourage narrow diffs — if the change looks too large, ask the AI to trim it.
4. **Run `git add path/to/changed/file JOURNAL.md` and then `git commit -m "feat: your change here"`.** Name each file you changed; this saves a checkpoint in your project history so you can always go back, without sweeping in stray files such as a `.env` with passwords.
5. **Run `git push`.** This sends your work to GitHub, where it is safe even if your machine breaks.

## Check your setup

Run `goodvibes doctor` to verify everything is working. It checks that headroom is installed, your git identity is configured, and the goodvibes rules are in place (`~/.claude/rules/goodvibes.md`, or the goodvibes block in `CLAUDE.md` if you used `--scope project`). It also looks over the MCP servers Claude Code uses (from `~/.claude.json` and this project's `.mcp.json`) and warns about risky setups: a plain `http://` address, a password or key written straight into the file, a package fetched without a pinned version on every start, or a download piped into a shell. It never contacts the servers and never prints a secret.

Each line starts with ✓ (fine), ! (a warning) or ✗ (a problem). Optional parts such as headroom only ever warn. The last line says `Ready.`, `Ready, with N warning(s).` or `Not ready: N problem(s).`, and only problems make `doctor` exit with an error.

## Useful commands

| Command | What it does |
|---------|--------------|
| `goodvibes update` | Bring goodvibes files up to date with the version you have installed; keeps your edits |
| `goodvibes update --dry-run` | Show what `goodvibes update` would change, without writing anything |
| `goodvibes upgrade` | Install the newest goodvibes, then run `goodvibes update` |
| `goodvibes doctor` | Check that headroom, git, rules and MCP servers are all set up well |
| `goodvibes usage` | Show the token use of your recent Claude Code sessions in this project; `--all` for every project |

## Why Claude's replies are so short (caveman)

goodvibes turns on the caveman skill at its strongest setting, `ultra`, so Claude's replies use far fewer tokens and your context lasts longer. In `ultra`, Claude drops filler words, uses short forms such as "DB", "auth" and "fn" in its explanations, and writes arrows for cause and effect ("token expired → 401"). Code, file names, commands and error messages are never shortened.

If the replies are too terse to follow, type one of these in Claude Code:

- `/caveman full`: short sentences, no abbreviations.
- `/caveman lite`: normal full sentences, just no filler.
- `stop caveman` (or `normal mode`): turns it off for the rest of the session.

This only affects Claude Code. Other tools use their own reply style.

## What is headroom?

headroom compresses the AI's memory of your project so you spend fewer tokens per session. It runs automatically in the background when Claude Code is active — you do not need to invoke it manually. The first install downloads a few gigabytes and can take several minutes; `goodvibes init --minimal` skips it.

## About the journal-gate hook

The journal-gate hook only gates `git commit` when it runs through Claude Code's own Bash tool — it does not intercept a commit you type directly in a terminal. Other AI coding tools or IDEs (Cursor, Copilot, and others) have no equivalent hook mechanism, so this enforcement does not apply there.

The hook lives in `~/.claude/settings.json` (or this project's `.claude/settings.json` if you used `--scope project`) and only acts in repos that have a `JOURNAL.md`. To turn it off, delete the `PreToolUse` entry whose command starts with `: goodvibes-journal-gate` from that file; `goodvibes update` will not add it back. Commits made from your editor's Source Control or Git panel are not gated either.

The check looks at the repository the commit really runs in, including `cd somewhere && git commit` and `git -C somewhere commit`. If a command changes folder more than once, or uses a folder name it cannot work out, it blocks with a "cannot verify" message instead of guessing; run the commit as its own command from inside the repository. It is a safety net for honest mistakes, not a security barrier: a determined agent can get around it.

## About the read guard (Claude Code only)

The read guard is a second Claude Code hook. It does two things:

- **Big files**: when Claude Code tries to read a whole file over 800 lines or 100 KB at once (with its Read tool, or with `cat`, `less`, `more`, `nl`, a large `head`/`tail`, or `sed -n 1,5000p`), the hook stops it and tells it to read a range or search with Grep first. Reading a whole big file fills the context window and costs tokens. Piping into `head`, `tail`, `grep` or `wc` is allowed. Change the limits with `GOODVIBES_READ_GUARD_LINES` and `GOODVIBES_READ_GUARD_KB`.
- **Secret files**: it stops Claude Code from reading `.env` files, SSH keys (anything in `~/.ssh`), `~/.aws/credentials`, `.git-credentials`, `.netrc` and `.pem`, `id_rsa`, `id_ed25519` or `id_ecdsa` files, and tells it to ask you for the value it needs. `.env.example`, `.env.sample` and `.env.template` stay readable.

Set `GOODVIBES_READ_GUARD=off` to turn off both parts, or delete the `PreToolUse` entry whose command starts with `: goodvibes-read-guard` from `~/.claude/settings.json` (or `.claude/settings.json` with `--scope project`); `goodvibes update` will not add it back. Like the journal check, it is a safety net, not a security barrier: it does not see every way a command can read a file.

## Session-start check (Claude Code only)

When you open Claude Code in this project, goodvibes runs `goodvibes doctor --quick` once. It checks that git knows your name and email and that the goodvibes rules are in place, and warns when `JOURNAL.md` is over 10 KB (agents read it at the start of every session, so a long one costs tokens each time; keep lasting decisions in its "Standing decisions" section and new entries short). If everything is fine it prints nothing. If something is wrong, Claude sees a one-line note with the fix and can tell you about it. It takes about a fifth of a second and never stops Claude Code from starting.

`goodvibes init` installs the `goodvibes` command globally so this check can run. If it is missing (for example you used `--scope project` with `npx`), the check skips itself; to install it, run `npm install -g goodvibes-cli` or `uv tool install goodvibes-cli`. To turn the check off, delete the `"SessionStart"` entry from `~/.claude/settings.json` (or `.claude/settings.json` with `--scope project`); `goodvibes update` will not add it back.

## What is context7?

context7 is an MCP server that gives Claude Code live, up-to-date library documentation lookups, so the AI stops guessing at APIs from stale training data. It works out of the box with no signup or API key.

By default goodvibes adds context7 to your Claude Code user settings, so it works in every project with no prompt. Run `claude mcp list` to see it. If the `claude` command was not installed when you ran `goodvibes init`, it printed the one command to run later.

If you hit rate limits, get a free key from context7 and re-add the server with it (the key is stored in your Claude Code user settings, not in any project):

```sh
claude mcp remove context7 -s user
claude mcp add --transport http --scope user --header "Authorization: Bearer YOUR_KEY" context7 https://mcp.context7.com/mcp
```

With `--scope project`, context7 is in this project's `.mcp.json` instead. Set a `CONTEXT7_API_KEY` environment variable and add a `headers` block for higher limits:

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

Never commit a literal key — only the `${CONTEXT7_API_KEY}` reference. For a project `.mcp.json`, Claude Code shows a one-time "trust this project's MCP servers" prompt the first time it loads a project with an `.mcp.json`; approving it is what enables context7 tool calls.

Until you approve it, `claude mcp list` shows context7 as "Pending approval" and it stays off. If you declined by mistake, run `claude mcp reset-project-choices` and open Claude Code again.
