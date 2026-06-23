---
phase: 01-template-content-repo-foundation
reviewed: 2026-06-23T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - scripts/verify-phase1.sh
  - templates/CLAUDE.md
  - templates/.github/ISSUE_TEMPLATE/bug_report.yml
  - templates/.github/ISSUE_TEMPLATE/feature_request.yml
  - templates/.github/PULL_REQUEST_TEMPLATE.md
  - templates/CONTRIBUTING.md
  - templates/SECURITY.md
  - templates/JOURNAL.md
  - templates/CHANGELOG.md
  - templates/docs/onboarding.md
  - templates/.claude/skills/caveman/SKILL.md
  - templates/.claude/skills/caveman/README.md
  - templates/.claude/skills/cavecrew/SKILL.md
  - templates/.claude/skills/cavecrew/README.md
  - templates/.claude/skills/caveman-commit/SKILL.md
  - templates/.claude/skills/caveman-compress/SKILL.md
  - templates/.claude/skills/caveman-help/SKILL.md
  - templates/.claude/skills/caveman-review/SKILL.md
  - templates/.claude/skills/caveman-stats/SKILL.md
  - templates/.claude/skills/goodvibes-hygiene/SKILL.md
  - LICENSE
  - NOTICE
  - README.md
findings:
  blocker: 4
  warning: 4
  suggestion: 2
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-23
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Reviewed all source files added in commits `35ec478..35896e3` (Phase 01). The static content — LICENSE, prose docs, GitHub templates, CLAUDE.md — is well-formed. The bash smoke test has four correctness defects, two of which can produce false-negative (silently passing) results, making the gate unreliable. The caveman skill fork is incomplete: two SKILL.md files reference runtime artefacts (scripts/, hooks/) that were not included in the fork, and the cavecrew README has three broken cross-links. The NOTICE file has a conflicting headroom source URL.

---

## Blockers

### BL-01: verify-phase1.sh silently passes when run from wrong directory

**File:** `scripts/verify-phase1.sh:16-34`
**Issue:** Every `check()` call uses bare relative paths (`templates/CLAUDE.md`, `NOTICE`, `README.md`). There is no `cd` to the repository root. Running the script from any directory other than the repo root causes every file-existence test to fail, but those failures are captured by `check()` and recorded as `FAIL` counts — `set -e` never fires. The gate correctly exits 1 in that case, but the operator sees failures against paths that actually exist, with no indication the working directory is wrong. More critically, if a CI job runs this from `scripts/` (a common pattern), the gate is perpetually red for the wrong reason, or the inverse — if relative paths accidentally resolve to something else, the gate is silently green.

**Fix:**
```bash
# Add near top of script, before the first check() call:
cd "$(dirname "$0")/.."
```

---

### BL-02: `eval` in `check()` is a command-injection vector if ever called with dynamic input

**File:** `scripts/verify-phase1.sh:7`
**Issue:** `if eval "$2" > /dev/null 2>&1` executes the second argument as arbitrary shell code. All current callers pass hard-coded string literals, so there is no live injection path today. However, the function signature publicly accepts `$2` and evaluates it, making this a trap: any future caller that passes a computed or user-supplied string (e.g., a file path derived from an environment variable) will have shell injection. The pattern is also invisible to static analysis tools.

**Fix:** Replace `eval` with a true subshell that does not require evaluation, or use a dedicated test helper:
```bash
check() {
  # Pass a function name or use bash function reference instead of eval
  # For the specific tests here, all are either `test`/`[`/`grep` invocations.
  # Simplest safe option: accept a subshell command string but quote defensively.
  if bash -c "$2" > /dev/null 2>&1; then
```
Longer-term: refactor each check to call a named function rather than passing shell code strings.

---

### BL-03: `&& ... ||` idiom on line 38 gives wrong exit status if `echo` fails

**File:** `scripts/verify-phase1.sh:38`
**Issue:**
```bash
[ $fail -eq 0 ] && echo "Phase 1 gate: PASS" || { echo "Phase 1 gate: FAIL"; exit 1; }
```
If `[ $fail -eq 0 ]` is **true** but `echo "Phase 1 gate: PASS"` fails (e.g., a broken pipe in CI log capture), the `||` branch runs, printing `"Phase 1 gate: FAIL"` and calling `exit 1` even though all checks passed. This is the classic `&&...||` antipattern — the `||` guards against the entire left side, not just the `[` test.

**Fix:**
```bash
if [ "$fail" -eq 0 ]; then
  echo "Phase 1 gate: PASS"
else
  echo "Phase 1 gate: FAIL"
  exit 1
fi
```

---

### BL-04: NOTICE contains wrong headroom source URL

**File:** `NOTICE:25`
**Issue:** The headroom attribution links to `https://github.com/headroomlabs-ai/headroom`, but the project's own CLAUDE.md (source: STACK.md) links to `https://github.com/chopratejas/headroom` as the canonical headroom repository. This is a legal attribution document; pointing to the wrong upstream repo is an attribution failure under Apache 2.0 Section 4(d), which requires correct attribution notices.

**Fix:** Verify the canonical headroom repository URL and update NOTICE line 25 accordingly. If the real upstream is `chopratejas/headroom` (as cited in STACK.md), change:
```
https://github.com/headroomlabs-ai/headroom
```
to:
```
https://github.com/chopratejas/headroom
```

---

## Warnings

### WR-01: CLAUDEMD-04 smoke test does not verify the closing sentinel

**File:** `scripts/verify-phase1.sh:19`
**Issue:**
```bash
check "CLAUDEMD-04" "grep -q 'goodvibes:start' templates/CLAUDE.md"
```
Only the opening sentinel `<!-- goodvibes:start -->` is checked. A truncated or corrupted `templates/CLAUDE.md` that is missing `<!-- goodvibes:end -->` passes this gate. The installer's update logic presumably relies on both sentinels for safe block replacement — a missing closing sentinel would cause it to corrupt the user's CLAUDE.md.

**Fix:**
```bash
check "CLAUDEMD-04" "grep -q 'goodvibes:start' templates/CLAUDE.md && grep -q 'goodvibes:end' templates/CLAUDE.md"
```

---

### WR-02: README.md relative links are broken in the goodvibes repository itself

**File:** `README.md:20-24`
**Issue:**
```markdown
- [onboarding.md](docs/onboarding.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [CHANGELOG.md](CHANGELOG.md)
```
These files exist under `templates/` but not at the goodvibes repo root. On GitHub, clicking any of these four links from the README returns a 404. The README is the face of the project; broken links on the landing page undermine credibility and confuse new contributors.

**Fix (option A):** Add symlinks at repo root pointing into `templates/`:
```
CONTRIBUTING.md -> templates/CONTRIBUTING.md
SECURITY.md -> templates/SECURITY.md
CHANGELOG.md -> templates/CHANGELOG.md
docs/ -> templates/docs/
```
**Fix (option B):** Prefix the links with `templates/`:
```markdown
- [onboarding.md](templates/docs/onboarding.md)
- [CONTRIBUTING.md](templates/CONTRIBUTING.md)
```
Option B is safer (no symlinks in git), but choose whichever fits the intended project layout for goodvibes itself.

---

### WR-03: caveman-compress SKILL.md references `scripts/__main__.py` that does not exist

**File:** `templates/.claude/skills/caveman-compress/SKILL.md:22-26`
**Issue:**
> The compression scripts live in `scripts/` (adjacent to this SKILL.md). If the path is not immediately available, search for `scripts/__main__.py` next to this SKILL.md.

There is no `scripts/` directory alongside this SKILL.md in the fork. The caveman fork copied only the SKILL.md files, not the Python runtime. When a user invokes `/caveman-compress`, the model will attempt `python3 -m scripts <filepath>` from the skill directory, fail, and the skill silently does nothing (or produces a confusing error). This is a broken skill that ships as functional.

**Fix:** Either (a) include the `scripts/` Python package from the upstream caveman repository in the fork, or (b) add a note at the top of the SKILL.md that the Python backend is not bundled in this fork and document the manual install step. Option (a) is required for the skill to actually work.

---

### WR-04: caveman-stats SKILL.md references `hooks/caveman-stats.js` that does not exist

**File:** `templates/.claude/skills/caveman-stats/SKILL.md:10`
**Issue:**
> This skill is delivered by `hooks/caveman-stats.js` (read by `hooks/caveman-mode-tracker.js` on `/caveman-stats`). The model itself does not compute the numbers.

No `hooks/` directory was included in the fork. The skill declares that the model does nothing when it fires — which means `/caveman-stats` produces no output at all. This is a silently broken command; a beginner invoking it gets no response.

**Fix:** Either include `hooks/caveman-stats.js` and `hooks/caveman-mode-tracker.js` from the upstream caveman repository, or remove `caveman-stats` from the bundled skill set until the hooks infrastructure is added.

---

## Suggestions

### SG-01: cavecrew README has three broken relative links to non-existent agents/

**File:** `templates/.claude/skills/cavecrew/README.md:38-41`
**Issue:** The README links to:
```
../../agents/cavecrew-investigator.md
../../agents/cavecrew-builder.md
../../agents/cavecrew-reviewer.md
../../README.md
```
Resolved from `templates/.claude/skills/cavecrew/`, `../../` points to `templates/.claude/`. Neither `templates/.claude/agents/` nor `templates/.claude/README.md` exists. These were valid links in the upstream caveman monorepo but are dangling in the fork. The caveman/README.md has the same problem with `../../README.md`. These are harmless for LLM skill loading (skills are read as text, not link-followed) but will 404 for any human browsing the installed project on GitHub.

**Fix:** Either include the referenced agent definition files in the fork, or update the links to point to the upstream GitHub URLs so they remain navigable:
```markdown
- [`cavecrew-investigator`](https://github.com/juliusbrussee/caveman/blob/main/agents/cavecrew-investigator.md)
```

---

### SG-02: NOTICE ponytail attribution uses run-together name `DietrichGebert`

**File:** `NOTICE:17`
**Issue:** The copyright line reads `Copyright 2026 DietrichGebert` — the full name has no space. If the upstream author's display name is "Dietrich Gebert" (two words), this is a misspelling in a legal attribution. The GitHub handle `DietrichGebert` appears correct for the URL, but the copyright field in a NOTICE file should use the author's legal/display name.

**Fix:** Verify the correct name on the ponytail GitHub profile and update accordingly:
```
Copyright 2026 Dietrich Gebert
```

---

_Reviewed: 2026-06-23_
_Reviewer: Claude (adversarial code review)_
_Depth: standard_
