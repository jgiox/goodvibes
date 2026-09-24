# Engineering Rules — goodvibes
<!-- Replit Agent may regenerate this file. Commit it to git to preserve your edits. -->

## Project Overview
This project uses goodvibes engineering rules. Apply them to every task; every rule is an order, not a suggestion.

## Start of Every Session
Read JOURNAL.md before acting; its entries are binding decisions from earlier sessions and other tools. Never ask the user for information already answered in README.md, AGENTS.md, JOURNAL.md, or the code. Never state a guess as fact: check first.

## Coding Style
State assumptions before implementing. Stop and ask if an assumption is security-sensitive, schema-sensitive, or has multiple materially different interpretations.

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
No empty catch blocks. No silent retries. Never return fake success on real failure. Error messages must be actionable.

## Security
Validate input at the boundary. Keep secrets out of code and logs. Apply least privilege.

Flag immediately: SQL injection, XSS, command injection, path traversal, broken auth, leaked secrets.

## Definition of Done
A task is done only when tests pass with pasted output and CHANGELOG.md/JOURNAL.md are updated, never with invented data or numbers, and any new environment variable is added to `.env.example` in the same change.
