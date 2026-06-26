# Engineering Journal

Log what you built, what you learned, and what you want to revisit.

---

## 2026-06-23 — Initialized project and completed Phase 1: template content & repo foundation

**What I did:** Started the goodvibes project from scratch using the GSD planning workflow.
Defined 54 requirements across 5 phases and a full roadmap. Phase 1 delivered the canonical
template files: `templates/CLAUDE.md` (97 lines, sentinel-wrapped), the caveman skill fork
(8 files from juliusbrussee/caveman, Apache 2.0 verified), the goodvibes-hygiene skill, and
8 docs templates (CONTRIBUTING, SECURITY, JOURNAL, CHANGELOG, GitHub issue/PR templates,
onboarding guide). Added LICENSE (Apache 2.0) and NOTICE at repo root. Wrote a smoke-test
harness (`scripts/verify-phase1.sh`) covering all 22 Phase 1 requirements. A code review
caught 4 shell scripting bugs in verify-phase1.sh (eval injection, `&&/||` exit guard,
`dirname` anchoring, headroom attribution URL) — all fixed before merge.

**What I learned:** `((var++))` inside a `set -e` shell script exits with code 1 when var is
zero because `((0))` evaluates to false. Must use `var=$((var + 1))` instead. This burned time
during the smoke harness — now documented in every verify script. Bash arithmetic is not
arithmetic; it is a conditional.

**Decisions made:** CLAUDE.md sentinel format locked as `<!-- goodvibes:start -->` /
`<!-- goodvibes:end -->` with `# goodvibes: v1.0.0` version stamp inside. This format must be
byte-identical across npm and pip CLIs so `goodvibes upgrade` can work in Phase 5.

**Next time:** Run the smoke harness earlier in the task sequence — finding the `((var++))` bug
at commit time rather than mid-review would have saved one fix round.

---

## 2026-06-23 — Phase 2: built and published the npm CLI (@jgiox/goodvibes@1.0.0)

**What I did:** Planned and executed Phase 2 in five plans across three waves. Wave 0 created
the `packages/npm/` scaffold (package.json, tsup/tsconfig, Commander stub, vitest config, test
stubs). Wave 1 implemented the four-case sentinel merge algorithm (`sentinel-merge.ts`) and the
file copy engine (`copy-templates.ts`) in 02-02, and the headroom integration stack
(`detect-python.ts`, `install-headroom.ts`, `configure-mcp.ts`) in 02-03 — both TDD with 40+
tests. Wave 2 wired the complete `init` action with `@clack/prompts tasks()` named spinner
steps. Wave 3 finalized `.npmignore`, verified the pack manifest, and published.

E2E testing found two runtime bugs not caught by unit tests: `install-headroom.ts` re-threw
non-ENOENT build failures (hnswlib C++ compile error on WSL2 without build tools), and
`configure-mcp.ts` crashed when `which headroom` returned ENOENT because headroom hadn't
installed. Both fixed to soft-fail with plain-English remediation messages — init now always
exits 0 regardless of headroom outcome.

npm blocked the name `goodvibes` (too similar to `good-vibes`). Published as `@jgiox/goodvibes`
instead. PyPI will face the same wall — `goodvibes` is taken by the Paton Group chemistry
package. Pip CLI will publish as `jgiox-goodvibes`.

**What I learned:** `npx <scoped-package> <args>` fails silently when run from inside the
package's own `node_modules` directory — always test from a clean location (`cd ~`). npm's
name-similarity check is aggressive: hyphen vs no-hyphen is blocked. Plan for scoped/suffixed
fallback names before publishing anything. headroom's `[all]` extra pulls hnswlib which has
no prebuilt wheel — any machine without a C++ toolchain will fail the install. Soft-fail is
not optional; it is a correctness requirement for a bootstrapping tool.

**Decisions made:** headroom install uses a runtime uv→pipx→pip chain rather than a declared
npm/pip dependency. This is the right call: a broken headroom install should never block the
rest of `goodvibes init`. All other files are written first; headroom is best-effort.
MCP registration uses `claude mcp add -s user headroom <absolute-path>` as primary (handles
CLAUDE_CONFIG_DIR correctly) with `headroom mcp install` as fallback — because headroom
issue #872 means `headroom mcp install` ignores CLAUDE_CONFIG_DIR.

**Next time:** Add a `test:integration` target that runs a real `goodvibes init` into a tmpdir
as part of CI. The two E2E bugs were only caught by manual testing — the unit test mocks were
too permissive. Integration tests with a real tmp directory would have caught both.

---

## 2026-06-24 — Dog-fooded goodvibes in its own repo; pushed to GitHub; planned Phase 3

**What I did:** Ran `npx @jgiox/goodvibes init` from the project root — bootstrapping goodvibes
with goodvibes. The caveman/goodvibes-hygiene skills were written to `.claude/skills/`, the
sentinel block was merged into `CLAUDE.md`, and all doc templates were copied to the repo root.
headroom and MCP registration succeeded. Pushed all 64 commits to `github.com/jgiox/goodvibes`
after rewriting commit author emails from `igiokas@gmail.com` to the GitHub no-reply address
(`6995207+jgiox@users.noreply.github.com`) using `git filter-repo --commit-callback`.

Planned Phase 3 (pip CLI): 4 plans, 3 waves. Research found `goodvibes` taken on PyPI (Paton
Group, v4.3.0 — same name collision pattern as npm). Decided on `jgiox-goodvibes` to mirror
npm scoping. headroom stays runtime-only (not a declared pip dependency) for the same reason
it's runtime-only in npm: hnswlib has no prebuilt wheel. Templates bundled via hatchling
`force-include` (declarative, no build script needed). Plan checker caught 4 blockers — all
fixed before committing the plan set.

**What I learned:** GitHub's email privacy protection blocks `git push` if any commit contains
a real email address and the account has "Block command line pushes" enabled. The fix is a
GitHub automation token (bypasses 2FA) plus `git filter-repo --commit-callback` to rewrite
history before the first push. `git filter-repo` removes the remote as a safety measure —
must re-add it manually after. The `/plugin marketplace` command only works in the Claude Code
CLI terminal app, not the VS Code extension. Ponytail cannot be installed from VS Code until
Anthropic ships plugin support to the extension.

**Decisions made:** Phase 3 pip CLI will use Typer ^0.15 + Rich ^14 (locked in CLAUDE.md).
PyPI package name: `jgiox-goodvibes`. Template bundling: hatchling force-include with a Wave 0
dotfile inspection step to confirm `.claude/` and `.github/` survive the wheel build. A GitHub
Actions publish workflow will be added for both npm (on release tag) and pip (on release tag,
using PyPI trusted publishing).

**Next time:** Set up the GitHub Actions publish workflows before the first manual publish, not
after. Manual publish requires 2FA automation tokens and extra steps that would be avoided by
a tag-triggered workflow.

---

## 2026-06-24 — Phase 4 Plan 01: TDD scaffolding + smoke harness

- Added detect-project-type.test.ts (5 failing RED tests for CI-05)
- Added test_detect_project_type.py (5 failing RED tests for CI-05)
- Added scripts/verify-phase4.sh (smoke harness for template file + content checks)
- Tests are intentionally RED — implementation ships in Plan 03

---

## 2026-06-24 — Phase 4 Plan 02: GitHub Actions template authoring

- Authored ci-node.yml, ci-python.yml, ci-both.yml under templates/.github/workflows/
- Authored security.yml (CodeQL security-extended), dependency-review.yml (PR gate), dependabot.yml (3 ecosystems)
- All templates use verified action versions from RESEARCH.md

---

## 2026-06-24 — Phase 4 Plan 03 Task 1: detectProjectType (TS) + copyTemplates CI variant selection

- Created packages/npm/src/utils/detect-project-type.ts (ProjectType + detectProjectType)
- Modified packages/npm/src/steps/copy-templates.ts (projectType param, CI filter, rename, dest-walk return)
- Added CI variant selection tests to copy-templates.test.ts (3 new tests in describe block)
- Updated init.test.ts assertions to expect 5th projectType arg in copyTemplates calls (Rule 1 auto-fix)
- Wired detectProjectType into packages/npm/src/commands/init.ts
- npm test GREEN (all 53 tests pass including 5 detectProjectType tests from Plan 01 and 3 new CI variant tests)

---

## 2026-06-24 — Phase 4 Plan 03 Task 2: detect_project_type (Python) + copy_templates CI variant selection

- Created packages/pip/src/goodvibes_cli/utils/detect_project_type.py (detect_project_type function)
- Modified packages/pip/src/goodvibes_cli/steps/copy_templates.py (project_type param, CI filter, rename, dest-walk return)
- Updated packages/pip/tests/conftest.py (replaced ci.yml fixture with ci-node/python/both.yml stubs)
- Added 3 CI variant selection tests and updated comment in test_copy_templates.py
- Wired detect_project_type into packages/pip/src/goodvibes_cli/commands/init_cmd.py
- pytest GREEN (56/56 tests pass including 5 detect_project_type tests from Plan 01)

---

## 2026-06-25 — Phase 4 Plan 04: Human verification of generated CI workflows

- Verified goodvibes init writes correct ci.yml for Python project (CI green: https://github.com/jgiox/test-gv-python/actions/runs/28152904156)
- Verified Dependency Review fires on PR and not on push (https://github.com/jgiox/test-gv-python/actions/runs/28152904169)
- Verified Security scan (CodeQL) passes with runtime language detection (https://github.com/jgiox/test-gv-python/actions/runs/28152904187)
- Dependabot recognized dependabot.yml and fired update checks for github-actions, pip, npm ecosystems
- Fixed two template bugs found during verification: `setup-uv@v8` → `v8.2.0` (no major alias exists); security.yml matrix replaced with runtime language detection shell step
- Phase 4 complete — CI/CD scaffolding ships for Node + Python projects

---

## 2026-06-25 — Phase 5 Plan 01: RED tests for upgrade command (TDD gate)

**What I did:** Added failing RED tests for the `goodvibes upgrade` subcommand before any implementation: `packages/npm/src/commands/upgrade.test.ts` (5 vitest tests), `packages/pip/tests/test_upgrade_cmd.py` (6 pytest tests), and `scripts/verify-phase5.sh` smoke harness. All tests fail intentionally — `upgrade.ts` and `upgrade_cmd.py` do not yet exist.

**Why:** TDD discipline per CLAUDE.md conventions — test contract locks in expected behavior before implementation ships in Plan 02.

**Files changed:** `packages/npm/src/commands/upgrade.test.ts` (created), `packages/pip/tests/test_upgrade_cmd.py` (created), `scripts/verify-phase5.sh` (created), `JOURNAL.md` (this entry).

**Tests run:** All tests RED as expected (`Cannot find module './upgrade.js'` for TS; `upgrade` subcommand not registered for Python).

**Docs updated:** JOURNAL.md (this entry).

---

## 2026-06-25 — Phase 5 Plan 02: upgrade subcommand implementation (RED → GREEN)

**What I did:** Implemented `goodvibes upgrade` in both TypeScript (`packages/npm/src/commands/upgrade.ts`) and Python (`packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py`). Both commands: detect installed version via sentinel block, compute file-level changes, support `--dry-run` (prints ~/=/+ summary, exits 0, writes nothing), apply updates via `mergeClaude`/`merge_claude` for CLAUDE.md and overwrite-copy for skill/workflow files. Wired into CLI entry points (`index.ts`, `main.py`). Added path traversal guard and explicit file allowlist.

**Why:** Phase 5 success criterion 1 & 2 — existing projects can run `goodvibes upgrade` to stay current without re-running init.

**Files changed:** `packages/npm/src/commands/upgrade.ts` (created), `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py` (created), `packages/npm/src/index.ts` (2 lines added), `packages/pip/src/goodvibes_cli/main.py` (2 lines added), `JOURNAL.md` (this entry).

**Tests run:** `cd packages/npm && npm test` — 58 passed (all 5 upgrade tests GREEN). `cd packages/pip && uv run --extra dev pytest -q` — 62 passed (all 6 upgrade tests GREEN). `bash scripts/verify-phase5.sh --quick` — PASS.

**Docs updated:** JOURNAL.md (this entry).

---

## 2026-06-25 — Phase 5 Plan 03: publish-template.yml workflow added

**What I did:** Created `.github/workflows/publish-template.yml` — a manual `workflow_dispatch` workflow that runs `git subtree push --prefix=templates` to push the contents of `templates/` to `jgiox/goodvibes-template` as the repo root. The initial push to the template repo must be performed by the user after creating the `jgiox/goodvibes-template` repo on GitHub and marking it as a Template repository. The workflow uses `${{ secrets.TEMPLATE_REPO_TOKEN }}` (classic PAT, repo scope) — no secrets hardcoded; no `shell: true`.

**Why:** Phase 5 success criterion 3 — a user can click "Use This Template" on `jgiox/goodvibes-template` and get a working CLAUDE.md-equipped project without running `goodvibes init`.

**Files changed:** `.github/workflows/publish-template.yml` (created), `JOURNAL.md` (this entry).

**Tests run:** YAML syntax verified by read-back; `grep` confirms `workflow_dispatch`, `goodvibes-template`, and `secrets.TEMPLATE_REPO_TOKEN` present; no `shell: true`.

**Docs updated:** JOURNAL.md (this entry).

---

## 2026-06-25 — CI fixes + upgrade command UAT bugs

**What I did:** Fixed three CI failures and two runtime bugs discovered during UAT:

1. **ANSI tokenization breaks `"dry-run"` substring check** — GitHub Actions sets `FORCE_COLOR=1`, causing Rich to emit separate ANSI escape segments for `--dry-run` at the hyphen. Fixed `test_main.py::test_init_help_has_dry_run` and `test_upgrade_cmd.py::test_upgrade_help_has_dry_run` to strip ANSI codes (`_ANSI.sub("", result.output)`) before asserting.

2. **`version_gte` crash on empty bundled version** — When `CLAUDE.md` has no goodvibes version sentinel, `detectBundledVersion` returns `None`/`null`. The old guard passed that as `""` to `version_gte`, causing `ValueError: invalid literal for int() with base 10: ''` in Python and a silent wrong-`true` result in TypeScript. Fixed: added `bundledVersion and` guard before calling `version_gte` in both `upgrade_cmd.py` and `upgrade.ts`.

3. **Test mock missing for `resolveTemplatesDir`** — After `vi.resetAllMocks()`, `resolveTemplatesDir` returns `undefined`. The 'skips upgrade when already up to date' test did not mock it, so `bundledVersion` was `null` after the new guard was added. Fixed by adding `vi.mocked(resolveTemplatesDir).mockReturnValue('/mock/templates')`.

4. **Smoke test pointed at wrong harness** — `ci.yml` smoke step ran `verify-phase3.sh --quick` after Phase 5 completed. Updated to `verify-phase5.sh`.

5. **Missing Phase 5 journal entries** — Plans 01 and 02 entries were lost in a `git checkout --theirs JOURNAL.md` merge conflict resolution during Wave 2 merge. Re-added manually.

**Why:** Discovered during live UAT of `goodvibes upgrade --dry-run` and GitHub CI audit.

**Files changed:** `packages/pip/tests/test_main.py`, `packages/pip/tests/test_upgrade_cmd.py`, `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py`, `packages/npm/src/commands/upgrade.ts`, `packages/npm/src/commands/upgrade.test.ts`, `.github/workflows/ci.yml`, `JOURNAL.md`.

**Tests run:** 62 Python tests GREEN with `FORCE_COLOR=1`. 58 TypeScript tests GREEN. `bash scripts/verify-phase5.sh --quick` — PASS.

**Docs updated:** JOURNAL.md (this entry).

---

## 2026-06-26 — template repo sync working; all Phase 5 UAT closed

**What I did:** Fixed `publish-template.yml` workflow — two bugs: (1) `actions/checkout@v4`
targeting Node 20 which GitHub now forces to run on Node 24 → upgraded to `@v7`; (2)
`git subtree push` failing 403 because `actions/checkout` installs a credential helper that
authenticates as `github-actions[bot]`, shadowing the PAT in the remote URL → added
`persist-credentials: false`. Switched from `git subtree push` to `git subtree split` +
`git push --force` to handle non-fast-forward when remote history diverges from CI clone.
Template repo (`jgiox/goodvibes-template`) now synced with latest `templates/`.

**Why:** Phase 5 success criterion 3 — fork flow UAT requires the template repo to be current.

**Files changed:** `.github/workflows/publish-template.yml`.

**Tests run:** Workflow passed on GitHub Actions. Template repo verified updated.

**Docs updated:** JOURNAL.md (this entry).

---

## 2026-06-26 — v1.2.0: commander downgrade + --version flag; both packages published

**What I did:** Fixed EBADENGINE warning on Node 20 — commander was at `^15` (requires Node >=22)
but `engines.node` declares `>=20.12.0`. Downgraded to `^13` (Node >=18) matching CLAUDE.md spec.
Added `--version` flag to pip CLI. Bumped all three version locations to 1.2.0. Triggered both
`publish-pip.yml` and `publish-npm.yml` via `workflow_dispatch` — both published successfully.
`npx @jgiox/goodvibes upgrade --dry-run` now runs warning-free on Node 20.

**Why:** Node engine mismatch between declared constraint and actual dependency requirement.

**Files changed:** `packages/npm/package.json`, `packages/pip/pyproject.toml`,
`templates/CLAUDE.md`, `packages/pip/src/goodvibes_cli/main.py`.

**Tests run:** 60 TS GREEN, 64 Python GREEN. Both publish CI workflows passed.

**Docs updated:** JOURNAL.md (this entry).

---

## 2026-06-26 — v1.1.0 published to PyPI; self-update UAT passed; --version flag added

**What I did:** Bumped all three version locations (pip `pyproject.toml`, npm `package.json`,
`templates/CLAUDE.md` sentinel) from 1.0.0 → 1.1.0. Triggered `publish-pip.yml` via
`workflow_dispatch` button — wheel published to PyPI. Ran live UAT: `uv tool install
jgiox-goodvibes` fetched 1.0.0; `goodvibes upgrade` detected 1.1.0 on PyPI, self-updated,
re-exec'd, and printed the full `What will change` diff (12 `+` new files, 1 `~` changed) —
end-to-end self-update flow confirmed working. Also added `--version` flag to the Typer CLI
(was missing; `goodvibes --version` previously errored).

**Why:** Close Phase 3 UAT (live PyPI install) and Phase 5 UAT (self-update flow).

**Files changed:** `packages/pip/pyproject.toml`, `packages/npm/package.json`,
`templates/CLAUDE.md`, `packages/pip/src/goodvibes_cli/main.py`.

**Tests run:** 64 Python GREEN. Publish CI passed. Live `goodvibes upgrade` UAT confirmed.

**Docs updated:** JOURNAL.md (this entry).

---

## 2026-06-26 — self-update + workflow_dispatch publish triggers

**What I did:**
1. `goodvibes upgrade` now self-updates the installed package before applying templates. Python checks PyPI via `urllib`, runs `uv tool upgrade jgiox-goodvibes` (falls back to `pip install --upgrade`), then `os.execve` re-execs the updated binary with `_GV_UPGRADING=1`. TypeScript checks npm registry via execa, runs `npm install -g @jgiox/goodvibes@{latest}`, then spawns the updated binary and exits. Second pass skips the version check and applies templates directly.
2. Added `workflow_dispatch:` trigger to `publish-npm.yml` and `publish-pip.yml` so releases can be triggered via the GitHub Actions UI button in addition to git tags.
3. Added 2 new tests per package (self-update triggers + skipped-when-env-set). Autouse fixture patches `_check_pypi_version` to `None` so baseline tests are unaffected by the new code path.

**Why:** Beginners shouldn't need to know about `npm install -g` or `uv tool upgrade` — `goodvibes upgrade` should be the one command that does everything.

**Files changed:** `packages/pip/src/goodvibes_cli/commands/upgrade_cmd.py`, `packages/npm/src/commands/upgrade.ts`, `packages/pip/tests/test_upgrade_cmd.py`, `packages/npm/src/commands/upgrade.test.ts`, `.github/workflows/publish-npm.yml`, `.github/workflows/publish-pip.yml`.

**Tests run:** 64 Python GREEN, 60 TypeScript GREEN.

**Docs updated:** JOURNAL.md (this entry). PyPI trusted publishing setup instructions provided to user for manual browser steps.
