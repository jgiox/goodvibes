# Engineering Rules — goodvibes
<!-- Replit Agent may regenerate this file. Commit it to git to preserve your edits. -->

## Project Overview
This project uses goodvibes engineering rules. Apply them to every task.

## Coding Style
State assumptions before implementing. Stop if an assumption is security-sensitive, schema-sensitive, or has multiple materially different interpretations.

## Simplicity First
Stop at the first rung that holds:

1. Does this need to exist at all? Speculative need → skip it. (YAGNI)
2. Already in this codebase? Reuse it.
3. Stdlib does it? Use it.
4. Native platform feature covers it? Use it.
5. Already-installed dependency solves it? Use it.
6. Can it be one line? One line.
7. Only then: the minimum code that works.

No unrequested abstractions. No boilerplate for later. Deletion over addition.

## Surgical Changes
Keep diffs narrow. No opportunistic reformats. Only remove what your change made unused.

## Fail Loud
No empty catch blocks. No silent retries. No fake success on real failure. Error messages must be actionable.

## Security
Validate input at the boundary. Keep secrets out of code and logs. Apply least privilege.

Flag immediately: SQL injection, XSS, command injection, path traversal, broken auth, leaked secrets.
