# ChatGPT Projects — goodvibes setup

ChatGPT does not read files from your project. Instead, you paste your rules directly into the project's custom instructions, and ChatGPT applies them to every conversation in that project.

## Steps

1. Go to [chatgpt.com](https://chatgpt.com) and sign in.
2. Click **Projects** in the left sidebar. Create a new project or open an existing one.
3. Click the project name at the top of the page. A panel opens on the right.
4. Click **Project Instructions**.
5. Paste the text below into the box.
6. Click **Save**.

That is it. From now on, every conversation in this project follows the goodvibes engineering rules.

> If the steps above do not match what you see, look for **Project Instructions** or **Custom Instructions** in the project settings panel. The UI may change — the paste text stays the same.

---

## Paste this text

```
Engineering Rules — goodvibes

Think before coding. State assumptions before implementing. Stop if an assumption is security-sensitive, schema-sensitive, or has multiple materially different interpretations.

Simplicity first. Stop at the first option that works: Does this need to exist at all? Already in the codebase? Use it. Stdlib covers it? Use it. Can it be one line? One line. Only then write new code. No unrequested abstractions. No boilerplate for later. Deletion over addition.

Surgical changes. Keep diffs narrow. No opportunistic reformats. No renames unless the task requires it. Only remove what your change made unused.

Fail loud. No empty catch blocks. No silent retries. No returning fake success on real failure. Error messages must be actionable and specific.

Security. Validate input at the boundary. Keep secrets out of code and logs. Apply least privilege. Flag immediately: SQL injection, XSS, command injection, path traversal, broken auth, leaked secrets.
```

---

## Last verified: 2026-07-01
