# goodvibes in Cursor

**What you get:** the goodvibes rules (plan first, keep changes small, run the tests, record decisions in `JOURNAL.md`, ask before risky steps), in every Cursor chat in this project. The GitHub checks run on your code as for any other tool.

The git commit check also works here: `goodvibes init` adds a git hook that blocks any commit that leaves out `JOURNAL.md`.

The journal check and the read guard run in Cursor too, from the Claude Code hooks in `.claude/settings.json`. Cursor runs those while its "Include Third-Party Plugins, Skills, and Other Configs" setting is on, which is the default. This was checked against Cursor's documentation or source code, not by running Cursor. See [Which AI tools run the hooks](../getting-started.md#which-ai-tools-run-the-hooks).

**What you do not get:** the other Claude Code guard rails (the session-start check and the permissions), the Claude Code skills such as caveman, `goodvibes usage`, and the Claude Code slash commands such as `/ponytail-review`. goodvibes sets up headroom for Claude Code only; context7 is set up for Cursor too (see below). See [Getting started](../getting-started.md) for what each piece does.

## Setup

There is nothing to do. `goodvibes init` wrote `.cursor/rules/goodvibes.mdc` into your project. It starts with `alwaysApply: true`, so Cursor 0.45 or later loads it in every chat in this project.

## Check that the rules are on

Open the project in Cursor and ask in the chat: "Which rules do you follow in this project?" The answer should mention the goodvibes engineering rules, for example reading `JOURNAL.md` before acting.

## context7: current library docs

`goodvibes init` also wrote `.cursor/mcp.json`, which adds the context7 server to Cursor for this project. With it, Cursor can look up the current docs for the libraries you use instead of guessing from old training data. It is free and needs no account or key. You can see it under Cursor Settings, Tools & MCP.

You can add your own MCP servers to the same file. `goodvibes update` adds or refreshes only the `context7` entry and keeps the rest. To turn context7 off, delete the `context7` entry, or the whole file if it holds nothing else. `goodvibes update` does not bring it back.

## If you already have a `.cursorrules` file

goodvibes does not read or change an older `.cursorrules` file. If your project has one, check that it does not contradict the goodvibes rules.

## Turn it off

Delete `.cursor/rules/goodvibes.mdc`. `goodvibes update` does not bring it back.
