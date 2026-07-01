# Cursor — goodvibes setup

goodvibes init wrote `.cursor/rules/goodvibes.mdc` into your project. This file activates the ponytail minimalism rules automatically when you open the project in Cursor.

## Ponytail is already active

The rules enforce simplicity-first coding, fail-loud error handling, and surgical changes — no file you did not touch, no code you did not need. You do not need to paste anything. The rules are in `.cursor/rules/goodvibes.mdc` and Cursor loads them for every AI chat in this project.

## Verify activation

Open Cursor. In the AI chat, ask: "What are your active rules?" You should see a reference to goodvibes or ponytail in the response.

## If you use .cursorrules (legacy)

If your project has a `.cursorrules` file from before goodvibes, the `.cursor/rules/goodvibes.mdc` file is independent. Both will apply. You may want to merge them to avoid duplication.

## Headroom (context compression)

Cursor does not use Claude Code's MCP protocol. If you want context compression, install headroom separately and use it via its CLI. See [headroom docs](https://headroom-docs.vercel.app/).

---

## Last verified: 2026-07-01
