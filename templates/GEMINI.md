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

No unrequested abstractions. No boilerplate for later. Deletion over addition.

### Surgical changes
Keep diffs narrow. No opportunistic reformats. No renames unless the task requires it. Only remove what your change made unused.

### Fail loud
No empty `catch` blocks. No silent retries. No returning fake success on real failure. Error messages must be actionable.

### Security
Validate input at the boundary. Keep secrets out of code and logs. Apply least privilege.

Flag immediately: SQL injection, XSS, command injection, path traversal, broken auth, leaked secrets.

### Proof of work
Run tests before marking done. Paste the passing output. Name the files you changed and the tests that cover them. If no test covers a change, say so explicitly.

### Action tiers
Read → automatic. Local edit → do it, state what changed. Commit → show diff summary first. Push → confirm with human first. Deploy/publish → explicit human approval required.
