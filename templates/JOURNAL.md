# Engineering Journal

This is the handoff record for this project. Every agent or tool that works here (Claude Code, Codex, Cursor, Copilot, or any other) must read it before acting and treat its entries as binding decisions, unless the user overrides one. Never ask the user for something an entry already answers.

Add one entry at the end of every task. Never rewrite or delete earlier entries.

In Claude Code, a commit is blocked until this file is staged. That check runs only for commits Claude Code makes itself; other tools and manual commits rely on the rule above.

## Entry template

```
## YYYY-MM-DD — [one sentence describing what you worked on]

**What I did:** [2-3 sentences describing the work completed]

**Files changed:** [every file added, edited, or deleted]

**Why:** [the reason for the change, and any decision the next session must respect]

**Tests run:** [the command and the result, e.g. "npm test: 42 passed"]

**Docs updated:** [README, CHANGELOG, or "none"]

**Next time:** [what to do next session, or what to watch out for]
```

## Example entry

## 2026-06-23 — Added user login page

**What I did:** Created a login form with email and password fields. Wired it to the
existing /api/auth/login endpoint. Added basic error messages for wrong credentials.

**Files changed:** src/pages/login.tsx, src/api/auth.ts, src/pages/login.test.tsx

**Why:** First step toward accounts. Used a plain fetch call instead of a library because
the project has only one API call so far; revisit if that grows.

**Tests run:** npm test: 12 passed

**Docs updated:** CHANGELOG.md

**Next time:** Add a loading spinner while the login request is in flight.
