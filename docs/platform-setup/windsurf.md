# goodvibes in Windsurf

**What you get:** the goodvibes rules (plan first, keep changes small, run the tests, record decisions in `JOURNAL.md`, ask before risky steps), in every Cascade conversation in this project. The GitHub checks run on your code as for any other tool.

**What you do not get:** the Claude Code guard rails (the journal check, the read guard, the session-start check and the permissions), the Claude Code skills such as caveman, `goodvibes usage`, and the Claude Code slash commands such as `/ponytail-review`. goodvibes sets up context7 and headroom for Claude Code only. See [Getting started](../getting-started.md) for what each piece does.

## Setup

There is nothing to do. `goodvibes init` wrote `.windsurfrules` into your project, and Windsurf reads it in every Cascade conversation. It holds the same rules as `AGENTS.md`.

## Check that the rules are on

Open the project in Windsurf and ask Cascade: "Which rules do you follow in this project?" The answer should mention the goodvibes engineering rules, for example reading `JOURNAL.md` before acting.

## Turn it off

Delete `.windsurfrules`. `goodvibes update` does not bring it back.
