# Base44 — goodvibes setup

Base44 does not read files from your project. Instead, you paste your rules into the AI controls panel, and Base44 applies them to every AI interaction in that project.

## Steps

1. Go to [base44.com](https://base44.com) and sign in.
2. Open your project.
3. Find the **AI controls** panel — it is usually in the top-right corner or under project Settings.
4. Click **Custom Instructions**.
5. Paste the text below into the box.
6. Click **Save**.

That is it. From now on, every AI action in this project follows the goodvibes engineering rules.

> If the steps above do not match what you see, look for **Custom Instructions** or **AI controls** in the project settings. The UI may change — the paste text stays the same.

> **Base44 Skills** is a separate feature for saving reusable instruction sets. goodvibes does not require it — pasting into Custom Instructions is enough.

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
