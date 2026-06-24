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
