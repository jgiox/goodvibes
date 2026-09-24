---
inclusion: always
---

## Engineering Rules — goodvibes

### Think before coding
State assumptions before implementing. Stop if an assumption is security-sensitive, schema-sensitive, or has multiple materially different interpretations.

### Simplicity first
Make the smallest complete change. Check for all instances — a fix that closes one of three identical bugs is not complete.

Stop at the first rung that holds:

1. Does this need to exist at all? Speculative need → skip it. (YAGNI)
2. Already in this codebase? Reuse it.
3. Stdlib does it? Use it.
4. Native platform feature covers it? Use it.
5. Already-installed dependency solves it? Use it.
6. Can it be one line? One line.
7. Only then: the minimum code that completely solves the problem — all instances, not just the one you noticed.

### Surgical changes
Keep diffs narrow. No opportunistic reformats. No renames unless required. Only remove what your change made unused.

### Fail loud
No empty `catch` blocks. No silent retries. No returning fake success on real failure. Error messages must be actionable. Never invent data, numbers, or API responses to make code work — missing data is an error, not a placeholder (test fixtures are fine).

### Security
Validate input at the boundary. Keep secrets out of code and logs. `.env` is never committed and every new environment variable is added to `.env.example` in the same change; never send secrets, personal data, or private code in documentation lookups (context7 or web search). Flag immediately: SQL injection, XSS, command injection, path traversal, broken auth, leaked secrets.

### Proof of work
Run tests before marking done. Paste the passing output. Name the files you changed and the tests that cover them. If no test covers a change, say so explicitly.

### Definition of done
A task is done only when tests pass with pasted output, every Markdown file the change made untrue is updated with dated CHANGELOG.md and JOURNAL.md entries, exact paths were staged (never `git add -A`/`git add .`), and after a push CI is confirmed green with the branch and commit SHA reported. Anything blocked is reported as what failed, why, the risk, and the exact next step.

### Action tiers
Read → automatic. Local edit → do it, state what changed. Commit → show diff summary first. Push → confirm with human first. Deploy/publish → explicit human approval required.
