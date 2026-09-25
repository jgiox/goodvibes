# goodvibes in Replit Agent

**What you get:** the goodvibes rules (plan first, keep changes small, run the tests, record decisions in `JOURNAL.md`, ask before risky steps), for every Replit Agent task in this project. If the project is also on GitHub, the GitHub checks run on it as for any other tool.

The git commit check also works here: `goodvibes init` adds a git hook that blocks any commit that leaves out `JOURNAL.md`.

**What you do not get:** the Claude Code guard rails (the read guard, the session-start check and the permissions; Replit Agent has no hooks for them), the Claude Code skills such as caveman, `goodvibes usage`, and the Claude Code slash commands. goodvibes sets up context7 and headroom for Claude Code only, and does not install anything inside Replit. See [Getting started](../getting-started.md) for what each piece does.

## Setup

`goodvibes init` wrote `replit.md` into your project. Replit Agent reads it from the project root.

1. Get the goodvibes files into your Replit project, for example by pushing this folder to GitHub (see [Git and GitHub basics](../onboarding.md)) and importing it into Replit.
2. Check that `replit.md` is at the top level of the project, next to `JOURNAL.md`.
3. Commit `replit.md` to git. Replit Agent may rewrite this file, and a commit lets you get your version back.

If your Replit project does not have the goodvibes files, create `replit.md` at the top level of the project and paste in the contents of `replit.md` from the folder where you ran `goodvibes init`.

## Check that the rules are on

Ask Replit Agent: "Which rules do you follow in this project?" The answer should mention the goodvibes engineering rules, for example reading `JOURNAL.md` before acting.

## Turn it off

Delete `replit.md`, or remove the goodvibes rules from it.
