# goodvibes in Windsurf

**What you get:** the goodvibes rules (plan first, keep changes small, run the tests, record decisions in `JOURNAL.md`, ask before risky steps), in every Cascade conversation in this project. The GitHub checks run on your code as for any other tool.

The git commit check also works here: `goodvibes init` adds a git hook that blocks any commit that leaves out `JOURNAL.md`.

**What you do not get:** the Claude Code guard rails (the read guard, the session-start check and the permissions), the Claude Code skills such as caveman, `goodvibes usage`, and the Claude Code slash commands such as `/ponytail-review`. goodvibes sets up context7 and headroom for Claude Code only; you can add context7 to Windsurf yourself (see below). See [Getting started](../getting-started.md) for what each piece does.

## Setup

There is nothing to do. `goodvibes init` wrote `.windsurfrules` into your project, and Windsurf reads it in every Cascade conversation. It holds the same rules as `AGENTS.md`.

## Check that the rules are on

Open the project in Windsurf and ask Cascade: "Which rules do you follow in this project?" The answer should mention the goodvibes engineering rules, for example reading `JOURNAL.md` before acting.

## Add context7 yourself

context7 gives the AI current docs for the libraries you use. It is free and needs no account or key. goodvibes does not add it to Windsurf, because Windsurf keeps its MCP servers in one file for your whole computer (`mcp_config.json`), not in the project, and goodvibes does not change other tools' settings outside your project.

1. In Windsurf, open the MCP settings and click **View Raw Config**. This opens `mcp_config.json`.
2. Add `context7` inside `mcpServers`, next to any servers already there. If the file is empty, paste all of this:

   ```json
   {
     "mcpServers": {
       "context7": {
         "serverUrl": "https://mcp.context7.com/mcp"
       }
     }
   }
   ```

3. Save the file.

Windsurf uses `serverUrl` here, not `url` as Cursor does. To remove context7 later, delete the `context7` entry.

## Turn it off

Delete `.windsurfrules`. `goodvibes update` does not bring it back.
