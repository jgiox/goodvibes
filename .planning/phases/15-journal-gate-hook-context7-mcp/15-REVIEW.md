---
phase: 15-journal-gate-hook-context7-mcp
reviewed: 2026-09-06T11:32:58Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - templates/.claude/settings.json
  - .claude/settings.json
  - packages/npm/src/steps/journal-gate-hook.integration.test.ts
  - packages/pip/tests/test_journal_gate_hook.py
findings:
  critical: 3
  warning: 4
  info: 1
  total: 8
status: issues
---

# Phase 15: Code Review Report (Plan 15-05 gap closure)

**Reviewed:** 2026-09-06T11:32:58Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues

## Summary

This round reviews plan 15-05, which was meant to close `15-REVIEW.md` CR-01 — the journal-gate hook validating the wrong repository when the intercepted command uses `git -C <path>` to target a repo different from the hook's own cwd.

**Prior CR-01: verified FIXED for its reported scope.** I extracted the live hook command from `templates/.claude/settings.json` and executed it directly (via `sh -c "<hook>"`, feeding real JSON payloads) against real git repos, reproducing the exact three scenarios named in the plan's must-haves (Test D bypass, Test E false-block, Test F target-merge-exemption). All three now behave correctly:
- cwd=staged, `-C <unstaged-repo>` → BLOCKED (exit 2) — bypass closed
- cwd=unstaged, `-C <staged-repo>` → ALLOWED (exit 0) — false-block closed
- cwd=clean, `-C <mid-merge-repo>` → ALLOWED (exit 0) — exemption now evaluated against the target

However, black-box probing beyond the plan's Test D/E/F matrix found that the fix's approach — extracting a `-C <path>` argument from raw command text with `sed` and blindly trusting/routing through it — opens **three new, more severe bypasses** than the one it closed, all confirmed by direct execution against the real hook command (not just static reading):

1. **A trivial universal bypass**: pointing `-C` at *any* path that isn't a valid git repo (e.g. `/tmp`, a typo, a nonexistent dir) makes `git rev-parse --absolute-git-dir` fail, which the hook treats as "not in a git repo, nothing to gate" and silently allows — **regardless of the real target repo's staged state**. `git -C /tmp commit -am "fix"` run from an unstaged repo passes with exit 0.
2. **Cross-invocation contamination**: the `TARGETDIR` extraction regex greedily grabs *any* `git ... -C <path>` occurring anywhere in the full command text, not specifically the one attached to the `git commit` being gated. A chained command like `git commit -am "fix" && git -C /some/other/repo status` gets routed to the unrelated repo and can bypass the gate entirely.
3. **Space-in-path regression of the original bug**: the quote-stripping step runs *before* `TARGETDIR` extraction and strips double-quoted spans indiscriminately — including a quoted `-C` path itself (e.g. `git -C "/Users/john doe/repo" commit`). This silently empties `TARGETDIR`, falling back to checking the hook's own cwd and reintroducing the exact original CR-01 bypass for any repo path containing a space (a realistic case on Windows/macOS).

None of items 1–3 are exercised by the plan's Test D/E/F (or by any test in either integration suite) — all three tests use single, unchained `git -C <dir> commit` invocations against directories with no spaces, which happen to always resolve to a valid repo.

The two settings.json copies remain byte-identical for the `hooks` block (verified via JSON deep-equal, including the gitignored `packages/npm/templates/.claude/settings.json` prebuild mirror), so no regression there.

## Critical Issues

### CR-01: `-C` target that fails `git rev-parse` silently allows any commit (fail-open, trivially exploitable)

**File:** `templates/.claude/settings.json:39`, `.claude/settings.json:16` (identical hook `command` string)

**Issue:** The new `GITDIR=$(GIT rev-parse --absolute-git-dir 2>/dev/null) || exit 0` line treats *any* failure to resolve the git dir — including a `-C` target that simply doesn't exist or isn't a git repository — the same as "not running inside a git repo, nothing to check," and allows the commit unconditionally. Before this plan, `-C` was never parsed, so this fail-open path only triggered in the genuinely rare case of running the hook outside any git repo. Now that `-C` is actively extracted and trusted, an attacker (or a confused LLM) can force this fail-open path on command with zero setup:

```
$ cd <repoB>   # JOURNAL.md unstaged
$ echo '{"tool_name":"Bash","tool_input":{"command":"git -C /tmp commit -am \"fix\""}}' | sh -c "<hook>"
$ echo $?
0        # ALLOWED — /tmp is not a git repo, rev-parse fails, hook silently exits 0
```
Confirmed via direct execution (`git -C /tmp commit -am fix` and `git commit -am fix && git -C /tmp status`, both exit 0 regardless of the real repo's staged state). This is a full bypass of the journal-gate's entire purpose using a single extra flag, and violates this project's own "fail loud" rule (CLAUDE.md: "No returning fake success on real failure").

**Fix:** Only treat rev-parse failure as "nothing to gate" when no `-C` was requested at all. If a `-C` target was specified but cannot be resolved, fail closed (block) rather than allow:

```sh
if [ -n "$TARGETDIR" ]; then
  GITDIR=$(GIT rev-parse --absolute-git-dir 2>/dev/null) || { echo "BLOCKED: cannot verify JOURNAL.md state for -C target \"$TARGETDIR\"" >&2; exit 2; }
else
  GITDIR=$(git rev-parse --absolute-git-dir 2>/dev/null) || exit 0
fi
```

### CR-02: `-C` extraction is not bound to the `git commit` invocation being gated — an unrelated `-C` elsewhere in the command line hijacks routing

**File:** `templates/.claude/settings.json:39`, `.claude/settings.json:16`

**Issue:** `TARGETDIR=$(printf "%s" "$UNQUOTED" | sed -nE "s/.*(^|[[:space:]])git[[:space:]]+-C[[:space:]]+([^[:space:]]+).*/\2/p")` matches against the *entire* unquoted command text with a greedy leading `.*`, so it captures whichever `git ... -C <path>` occurs latest in the line — even when that invocation has nothing to do with the `git commit` that triggered the gate. Confirmed:

```
cwd = repoB (JOURNAL.md unstaged, no -C on the actual commit)
command: git commit -am "fix" && git -C <repoA, staged> status
-> exit 0   # WRONG: real commit targets repoB (unstaged) via no -C, but TARGETDIR
             # picks up repoA from the unrelated trailing `git -C ... status`, and the
             # check passes against repoA's staged state instead of repoB's.
```
The same happens in the opposite chain order (`git -C <dir> status && git commit -am "fix"`). This means any compound Bash command containing a second, unrelated `git -C <path>` invocation can silently redirect (or defeat) the gate for a completely separate `git commit` call in the same line — a realistic pattern, since LLM-generated commands frequently chain multiple git calls with `&&`.

**Fix:** Scope `-C` extraction to the same "clause" as the matched `commit` token — e.g. split `$UNQUOTED` on shell separators (`&&`, `||`, `;`, `|`) first and only inspect the segment that matched the `commit` detection regex, rather than running `TARGETDIR` extraction against the whole line:

```sh
COMMIT_CLAUSE=$(printf "%s" "$UNQUOTED" | tr ';|&' '\n' | grep -E "(^|[[:space:]])git([[:space:]]+[^[:space:]]+)*[[:space:]]+commit([[:space:]]|$)" | tail -1)
TARGETDIR=$(printf "%s" "$COMMIT_CLAUSE" | sed -nE "s/.*(^|[[:space:]])git[[:space:]]+-C[[:space:]]+([^[:space:]]+).*/\2/p")
```
(Adjust separator handling for `&&`/`||` as multi-char tokens if using `tr`, or use a proper `sed`/`awk` split.)

### CR-03: quoted `-C` paths (containing spaces) are erased by the earlier quote-stripping step, reintroducing the original CR-01 bypass

**File:** `templates/.claude/settings.json:39`, `.claude/settings.json:16`

**Issue:** `UNQUOTED` is computed by stripping *all* double-quoted spans (`s/\\"[^"]*\\"/ /g`) before `TARGETDIR` is extracted from `$UNQUOTED`. This is correct for stripping commit-message content, but it also destroys a quoted `-C` argument, which is required whenever the target path contains a space:

```
cwd = repoA (JOURNAL.md staged)
command: git -C "/path/with a space/repoB" commit -am "fix"    # repoB unstaged
-> exit 0   # WRONG: TARGETDIR extraction finds nothing (the quoted path was already
             # blanked out by the quote-stripping step), so the hook falls back to
             # checking the hook's own cwd (repoA, staged) and allows — the exact
             # original CR-01 bypass, reintroduced for any path containing a space.
```
Confirmed via direct execution against a real repo whose path contains a space. This is not a purely theoretical edge case: this project's own docs (`docs/getting-started.md`) target Windows/WSL and macOS beginners, whose home directories and cloud-synced folders (`OneDrive`, `My Documents`, usernames with spaces) commonly contain spaces.

**Fix:** Extract `TARGETDIR` from the raw `$CMD` (before quote-stripping) with a regex that handles both quoted and unquoted `-C` arguments, e.g.:

```sh
TARGETDIR=$(printf "%s" "$CMD" | sed -nE 's/.*(^|[[:space:]])git[[:space:]]+-C[[:space:]]+(\\"([^"]*)\\"|['"'"']([^'"'"']*)['"'"']|([^[:space:]]+)).*/\3\4\5/p')
```
or, more simply, run a dedicated extraction pass on `$CMD` for `-C` *before* computing `UNQUOTED`, so the quote-stripping step never gets a chance to consume the `-C` argument.

**Note:** CR-01/02/03 above compound each other and share a root cause: parsing shell command syntax with `sed`/`grep` string surgery cannot robustly reconstruct what a real shell parser (and git's own arg parsing) would do. Given the plan explicitly chose "full -C support" over a fail-closed policy specifically to satisfy the Test E allow-scenario, closing all three gaps above with more regex layering will likely keep producing new edge cases of the same shape. A more robust option worth reconsidering: fail closed (block, with an actionable message) whenever `-C` is detected *at all* in a compound command (`&&`/`||`/`;`/`|` present) or when the `-C` value cannot be unambiguously isolated, and only attempt the full extraction+route path for the simple, single-invocation case that Test D/E/F actually cover.

## Warnings

### WR-01: No automated check that the two hand-duplicated hook strings stay in sync

**File:** `templates/.claude/settings.json:39`, `.claude/settings.json:16`

**Issue:** Carried forward from the prior review — still true. Both `journal-gate-hook.integration.test.ts` (line 12) and `test_journal_gate_hook.py` (line 19) read the hook command exclusively from `templates/.claude/settings.json`; neither suite asserts that `.claude/settings.json`'s `hooks` block still matches it. Verified by hand this round (`JSON.stringify(a.hooks) === JSON.stringify(b.hooks)` → `true`), but nothing in CI enforces this — a future hand-edit to either copy can silently drift with no test failure.

**Fix:** Add one assertion per suite comparing the two files' `hooks` blocks for deep equality, e.g. in `journal-gate-hook.integration.test.ts`:
```ts
it('keeps .claude/settings.json hooks in sync with templates/.claude/settings.json', () => {
  const templates = JSON.parse(readFileSync(join(resolveTemplatesDir(), '.claude', 'settings.json'), 'utf-8'))
  const dogfood = JSON.parse(readFileSync(join(repoRoot, '.claude', 'settings.json'), 'utf-8'))
  expect(dogfood.hooks).toEqual(templates.hooks)
})
```

### WR-02: Hook logic remains an unreadable, quadruple-escaped one-liner — directly implicated in this round's regressions

**File:** `templates/.claude/settings.json:39`

**Issue:** Carried forward and reinforced by this round's findings: CR-01/02/03 above are exactly the class of subtle regex-interaction bug this format makes almost impossible to review by eye (JSON string escaping → shell double-quote escaping → ERE escaping, now with a fourth interacting concern: the *order* of quote-stripping vs. `-C` extraction). Two escaping bugs were already fixed in `15-04`; this plan added three more defects in the same string while fixing one. The trend suggests the inline-one-liner format itself is a quality risk, not just the current logic.

**Fix:** Extract the hook body to a real script file (e.g. `templates/.claude/hooks/journal-gate.sh`), referenced from `settings.json` via a relative path. This removes two of the four escaping layers, makes the diff for future fixes reviewable, and allows shellcheck/unit-testing the script directly instead of only through end-to-end `sh -c` execution.

### WR-03: `.claude/settings.json` allow-lists unrestricted `rm -rf *` with a hardcoded personal path (pre-existing, file in this round's scope)

**File:** `.claude/settings.json:4-5`

**Issue:** Carried forward — not touched by this plan (only the `hooks` block changed), but the file is in this round's review scope. `permissions.allow` still contains `"Bash(rm -rf *)"` with no corresponding `deny`, and a contributor-specific absolute path `"Bash(node /home/ygiokas/GoodVibes/packages/npm/dist/index.js init)"` checked into shared version control.

**Fix:** Scope the `rm -rf` allowance to a specific safe subpath or remove it; replace the hardcoded absolute path with a relative one (`Bash(node packages/npm/dist/index.js init)`).

### WR-04: New Test D/E/F only cover the single-invocation, no-spaces case — the added coverage gives false confidence about `-C` handling

**File:** `packages/npm/src/steps/journal-gate-hook.integration.test.ts:109-139`, `packages/pip/tests/test_journal_gate_hook.py:108-136`

**Issue:** All three new adversarial tests construct `otherRepoDir` via `join(repoDir, 'other-repo')` / `repo_dir / "other-repo"` (no spaces, under the OS tmpdir) and invoke `git -C <dir> commit -am "fix"` as the *only* git invocation in the command string. This is exactly the shape needed to prove the original CR-01 fix works, but it structurally cannot catch CR-01/02/03 above (fail-open on invalid target, cross-invocation contamination, or space-in-path). The suite now reports "15/15 passing" and "cross-repo -C adversarial cases covered," which overstates the actual robustness of the fix.

**Fix:** Add regression tests for the three new scenarios found in this review before attempting further fixes, e.g.:
```ts
it('does NOT allow a commit via a -C target that is not a git repository (fail-open regression)', async () => {
  const { exitCode } = await runHook(`git -C /tmp commit -am "fix"`, repoDir) // repoDir unstaged
  expect(exitCode).not.toBe(0)
})
it('does NOT let an unrelated -C invocation earlier/later in a chained command override routing for the real commit', async () => {
  const otherRepoDir = join(repoDir, 'other-repo') // staged
  const { exitCode } = await runHook(`git commit -am "fix" && git -C ${otherRepoDir} status`, repoDir) // repoDir unstaged
  expect(exitCode).toBe(2)
})
```

### WR-05: Stale TDD-era comment in the npm integration test still describes a transient RED-phase state that no longer applies

**File:** `packages/npm/src/steps/journal-gate-hook.integration.test.ts:8-10`

**Issue:** Carried forward from the prior review — not removed by this plan, even though this plan touched this exact file (added Test D/E/F below it). The comment still reads: *"At this point in the plan (RED step) `hooks` does not exist yet, so this throws/returns undefined and every test below fails — that's the intended RED signal for Task 1."* All 15 tests in the file now pass; the comment describes an implementation-history detail of a different, earlier plan (15-04's Task 1), not current behavior, and violates this project's own commenting convention (WHY, not process narration; one line max).

**Fix:** Delete lines 9-10; keep only line 8 (`// Extracts the hook's inline command string from the real templates/.claude/settings.json.`).

## Info

### IN-01: Text-pattern `git ... commit` matching remains inherently spoofable, and this round's chaining bypass (CR-02) is a concrete instance of it

**File:** `templates/.claude/settings.json:39`

**Issue:** Carried forward from the prior review. The hook detects "is this a commit" and "what's the target repo" purely via `grep`/`sed` against raw command text, with no actual shell/argument parsing. CR-02 in this review is a direct, concrete manifestation of this limitation (a second, textually-present `git -C` invocation changes the outcome for an unrelated `git commit`). This is not fully fixable without a real parser and is a reasonable tradeoff for a zero-dependency hook, but should be documented as a known limitation rather than discovered anew each review round.

**Fix:** Add a short, explicit note to `docs/getting-started.md`'s hook section: the hook matches on literal command text, not parsed shell syntax, and compound commands mixing multiple `git` invocations (via `&&`, `;`, `|`) are not reliably gated.

---

_Reviewed: 2026-09-06T11:32:58Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
