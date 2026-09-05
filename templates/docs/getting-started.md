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

## About the journal-gate hook

The journal-gate hook only gates `git commit` when it runs through Claude Code's own Bash tool — it does not intercept a commit you type directly in a terminal. Other AI coding tools or IDEs (Cursor, Copilot, and others) have no equivalent hook mechanism, so this enforcement does not apply there.

## What is context7?

context7 is an MCP server that gives Claude Code live, up-to-date library documentation lookups, so the AI stops guessing at APIs from stale training data. It works out of the box with no signup or API key.

If you hit rate limits, you can set a `CONTEXT7_API_KEY` environment variable and add a `headers` block to your `.mcp.json` for higher limits:

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

Never commit a literal key — only the `${CONTEXT7_API_KEY}` reference. Claude Code shows a one-time "trust this project's MCP servers" prompt the first time it loads a project with an `.mcp.json`; approving it is what enables context7 tool calls.
