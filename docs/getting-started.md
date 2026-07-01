# Getting started with goodvibes

You ran `goodvibes init`. Here is what happens next.

## What was set up

goodvibes wrote several files into your project: `CLAUDE.md` with engineering rules and the ponytail minimalism ruleset, AI rule files for your coding tool (Cursor, Windsurf, Kiro, GitHub Copilot, and others), CI workflows for automated quality checks, and docs templates including this one. Everything runs automatically — no configuration needed.

## Your first change

1. **Open your project in your AI coding tool.** Cursor, Windsurf, Kiro, and GitHub Copilot all pick up the goodvibes rules automatically. The AI will follow minimal-code and fail-loud principles from the first message.
2. **Tell the AI what you want to build.** Describe the feature in plain language — the rules guide the AI to keep code simple and surgical.
3. **Review the diff before you commit.** Check that the AI only changed what you asked. The rules encourage narrow diffs — if the change looks too large, ask the AI to trim it.
4. **Run `git add . && git commit -m "feat: your change here"`.** This saves a checkpoint in your project history so you can always go back.
5. **Run `git push`.** This sends your work to GitHub, where it is safe even if your machine breaks.

## Check your setup

Run `goodvibes doctor` to verify everything is working. It checks that headroom is installed, your git identity is configured, and the goodvibes rules are in place.

## Useful commands

| Command | What it does |
|---------|--------------|
| `goodvibes update` | Re-sync goodvibes files to the latest version |
| `goodvibes doctor` | Check that headroom, git, and rules are all working |
| `goodvibes upgrade --dry-run` | Preview what `goodvibes update` would change |

## What is headroom?

headroom compresses the AI's memory of your project so you spend fewer tokens per session. It runs automatically in the background when Claude Code is active — you do not need to invoke it manually.
