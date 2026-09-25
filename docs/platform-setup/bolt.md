# goodvibes in Bolt.new

**What you get:** the goodvibes rules (plan first, keep changes small, run the tests, record decisions in `JOURNAL.md`, ask before risky steps), for the AI in your Bolt.new project. If the project is also on GitHub, the GitHub checks run on it as for any other tool.

**What you do not get:** the Claude Code guard rails (the journal check, the read guard, the session-start check and the permissions; Bolt.new has no hooks for them), the Claude Code skills such as caveman, `goodvibes usage`, and the Claude Code slash commands. goodvibes sets up context7 and headroom for Claude Code only, and does not install anything inside Bolt.new. See [Getting started](../getting-started.md) for what each piece does.

## Setup

`goodvibes init` wrote `.bolt/prompt` into your project. Bolt.new reads it when the project opens. It holds a shorter version of the goodvibes rules.

1. Get the goodvibes files into your Bolt.new project, for example by pushing this folder to GitHub (see [Git and GitHub basics](../onboarding.md)) and importing it into Bolt.new.
2. Check that the project has a `.bolt` folder with a file named `prompt` in it.

If your Bolt.new project does not have the file, paste the rules into the chat at the start of each session instead:

1. Open your Bolt.new project.
2. In the chat, type "Follow these engineering rules for all code you write:" and paste the whole of `.bolt/prompt` from the folder where you ran `goodvibes init`.

## Check that the rules are on

Ask in the chat: "Which rules do you follow in this project?" The answer should mention the goodvibes engineering rules, for example reading `JOURNAL.md` before acting.

## Turn it off

Delete `.bolt/prompt`.
