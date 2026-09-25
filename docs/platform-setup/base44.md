# goodvibes in Base44

**What you get:** a short version of the goodvibes rules (think before coding, keep changes small, fail loud, keep secrets out of code) for every AI action in one Base44 project.

**What you do not get:** anything that needs your project files. There is no `JOURNAL.md`, no Claude Code guard rails (the journal check, the read guard, the session-start check and the permissions), no skills such as caveman, and no context7 or headroom. The GitHub checks run only on code you put in a GitHub project set up with goodvibes. See [Getting started](../getting-started.md) for what each piece does.

## Setup

Base44 does not read files from your project, so you paste the rules into the project's AI controls once.

1. Go to [base44.com](https://base44.com) and sign in.
2. Open your project.
3. Find the **AI controls** panel. It is usually in the top-right corner or under the project settings.
4. Click **Custom Instructions**.
5. Paste the text below into the box.
6. Click **Save**.

From now on, every AI action in this project follows these rules.

If the steps do not match what you see, look for **Custom Instructions** or **AI controls** in the project settings. The screens may change; the text to paste stays the same.

Base44 also has a separate **Skills** feature for saving reusable instructions. goodvibes does not need it: pasting into Custom Instructions is enough.

## Paste this text

```
Engineering rules (goodvibes)

Think before coding. State assumptions before implementing. Stop if an assumption is security-sensitive, schema-sensitive, or has multiple materially different interpretations.

Simplicity first. Stop at the first option that works: Does this need to exist at all? Already in the codebase? Use it. Stdlib covers it? Use it. Can it be one line? One line. Only then write new code. No unrequested abstractions. No boilerplate for later. Deletion over addition.

Surgical changes. Keep diffs narrow. No opportunistic reformats. No renames unless the task requires it. Only remove what your change made unused.

Fail loud. No empty catch blocks. No silent retries. No returning fake success on real failure. Error messages must be actionable and specific.

Security. Validate input at the boundary. Keep secrets out of code and logs. Apply least privilege. Flag immediately: SQL injection, XSS, command injection, path traversal, broken auth, leaked secrets.
```

## Turn it off

Delete the text from **Custom Instructions** and click **Save**.

## Last verified: 2026-07-01
