# goodvibes in Kiro

**What you get:** the goodvibes rules (plan first, keep changes small, run the tests, record decisions in `JOURNAL.md`, ask before risky steps), in every Kiro conversation in this project. The GitHub checks run on your code as for any other tool.

**What you do not get:** the Claude Code guard rails (the journal check, the read guard, the session-start check and the permissions), the Claude Code skills such as caveman, `goodvibes usage`, and the Claude Code slash commands such as `/ponytail-review`. goodvibes sets up context7 and headroom for Claude Code only. See [Getting started](../getting-started.md) for what each piece does.

## Setup

There is nothing to do. `goodvibes init` wrote `.kiro/steering/goodvibes.md` into your project. Kiro calls rule files like this "steering files". This one starts with `inclusion: always`, so Kiro applies it to every conversation in the project.

## Check that the rules are on

Open the project in Kiro and ask: "Which rules do you follow in this project?" The answer should mention the goodvibes engineering rules, for example reading `JOURNAL.md` before acting.

## Turn it off

Delete `.kiro/steering/goodvibes.md`. `goodvibes update` does not bring it back.
