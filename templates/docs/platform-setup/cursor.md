# goodvibes in Cursor

**What you get:** the goodvibes rules (plan first, keep changes small, run the tests, record decisions in `JOURNAL.md`, ask before risky steps), in every Cursor chat in this project. The GitHub checks run on your code as for any other tool.

**What you do not get:** the Claude Code guard rails (the journal check, the read guard, the session-start check and the permissions), the Claude Code skills such as caveman, `goodvibes usage`, and the Claude Code slash commands such as `/ponytail-review`. goodvibes sets up context7 and headroom for Claude Code only. See [Getting started](../getting-started.md) for what each piece does.

## Setup

There is nothing to do. `goodvibes init` wrote `.cursor/rules/goodvibes.mdc` into your project. It starts with `alwaysApply: true`, so Cursor 0.45 or later loads it in every chat in this project.

## Check that the rules are on

Open the project in Cursor and ask in the chat: "Which rules do you follow in this project?" The answer should mention the goodvibes engineering rules, for example reading `JOURNAL.md` before acting.

## If you already have a `.cursorrules` file

goodvibes does not read or change an older `.cursorrules` file. If your project has one, check that it does not contradict the goodvibes rules.

## Turn it off

Delete `.cursor/rules/goodvibes.mdc`. `goodvibes update` does not bring it back.
