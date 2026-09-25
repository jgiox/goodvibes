# goodvibes in ChatGPT Projects

**What you get:** a short version of the goodvibes rules (think before coding, keep changes small, fail loud, keep secrets out of code) in every conversation in one ChatGPT project.

**What you do not get:** anything that needs your project files. There is no `JOURNAL.md`, no Claude Code guard rails (the journal check, the read guard, the session-start check and the permissions), no skills such as caveman, and no context7 or headroom. The GitHub checks run only on code you put in a GitHub project set up with goodvibes. See [Getting started](../getting-started.md) for what each piece does.

## Setup

ChatGPT does not read files from your project, so you paste the rules into the project's instructions once.

1. Go to [chatgpt.com](https://chatgpt.com) and sign in.
2. Click **Projects** in the left sidebar. Create a new project or open an existing one.
3. Click the project name at the top of the page. A panel opens on the right.
4. Click **Project Instructions**.
5. Paste the text below into the box.
6. Click **Save**.

From now on, every conversation in this project follows these rules.

If the steps do not match what you see, look for **Project Instructions** or **Custom Instructions** in the project settings panel. The screens may change; the text to paste stays the same.

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

Delete the text from **Project Instructions** and click **Save**.

## Last verified: 2026-07-01
