# Replit Agent — goodvibes setup

Replit Agent does not read files from your project automatically. Instead, you provide the rules as a system prompt for the Agent.

## One-time setup

1. Open your Repl.
2. Find **System prompt** or **AI instructions** in the Agent settings panel.
3. Copy the text from `CLAUDE.md` — specifically the section between `<!-- goodvibes:start -->` and `<!-- goodvibes:end -->`.
4. Paste into the system prompt field and click **Save**.

That is it. Replit Agent will follow the goodvibes rules for every task in this project.

> If you do not see a system prompt field, look for **Agent instructions** or **Custom rules** in the project settings.

## Ponytail on Replit

Once the system prompt is set, Replit Agent follows the ponytail rules for every task: minimal code, no over-engineering, and explicit error handling. The AI will tell you if it is skipping something because it is not needed yet.

## Headroom

Replit manages its own context. Headroom is not applicable inside Replit — skip the headroom install step if you are Replit-only.

---

## Last verified: 2026-07-01
