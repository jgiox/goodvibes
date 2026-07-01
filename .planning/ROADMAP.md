# Roadmap: goodvibes

## Overview

goodvibes delivers a single-command bootstrap CLI for AI-assisted (vibe) coding projects. The build order is content-first: template files must exist before either CLI can copy them, the npm CLI is built and validated before the pip CLI is ported from it, CI scaffolding depends on the project-type detection module built in the npm phase, the upgrade command builds on version-stamp infrastructure laid in Phase 1, and the GitHub template repo is a capstone promotion of all validated artifacts. Five phases, no wasted steps.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Template Content & Repo Foundation** - Author the canonical template files (CLAUDE.md, skills, docs, license) that both CLIs will copy (completed 2026-06-23)
- [x] **Phase 2: npm CLI** - Build `npx goodvibes init` with full headroom integration, sentinel merge, and project-type detection (completed 2026-06-23)
- [x] **Phase 3: pip CLI** - Port the npm CLI to Python and publish to PyPI as `jgiox-goodvibes` (PyPI name; `goodvibes` taken by chemistry package) (completed 2026-06-24)
- [x] **Phase 4: CI/CD Scaffolding** - Validate and harden generated GitHub Actions workflows for both project types (completed 2026-06-25)
- [x] **Phase 5: Upgrade Command & Template Repo** - Implement `goodvibes upgrade` and publish the GitHub template repo as the click-to-fork entry point (completed 2026-06-25)
- [x] **Phase 6: UX Hardening** - Harden both CLIs for existing projects, fix --minimal scope and --dry-run --minimal combination, and replace raw stack traces with plain-English remediation messages (completed 2026-06-26)
- [x] **Phase 7: README & Demo** - Ship the hero README with badges and an animated demo GIF recorded against the hardened CLI output (completed 2026-06-27)
- [x] **Phase 8: Multi-IDE Expansion** - Extend goodvibes to write rule files for 10 AI coding IDEs and tools: Cursor, GitHub Copilot, Windsurf/Devin Desktop, Kiro, Antigravity, AGENTS.md (cross-tool), Cline, Amazon Q Developer, Continue.dev. Includes Cursor alwaysApply troubleshooting note. (completed 2026-06-30)
- [x] **Phase 9: OpenAI/Codex & Vibe-coding Platform Expansion** - Extend goodvibes to serve users of OpenAI Codex CLI, Replit Agent, Bolt.new, Lovable, ChatGPT Projects, and Base44. (completed 2026-07-01)
- [x] **Phase 10: Vibe Coder Completeness** - Ship the commands and guides that turn a successful `goodvibes init` into a complete, confident vibe-coding setup: `goodvibes update`, `goodvibes doctor`, `goodvibes --version`, headroom install transparency, newbie flow guide, and ponytail discipline guidance for non-Claude Code IDE users. (completed 2026-07-01)

## Phase Details

### Phase 1: Template Content & Repo Foundation

**Goal**: All canonical template files exist, are manually testable in a real project, and the repo has its license and attribution in place
**Depends on**: Nothing (first phase)
**Requirements**: CLAUDEMD-01, CLAUDEMD-02, CLAUDEMD-03, CLAUDEMD-04, CLAUDEMD-05, CAV-01, CAV-02, CAV-03, HYG-01, HYG-02, HYG-03, DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, DOCS-07, REPO-01, REPO-02, REPO-03, REPO-04
**Success Criteria** (what must be TRUE):

  1. A developer can copy the templates/ directory into a blank project, open it in Claude Code, and see CLAUDE.md rules applied without any manual steps
  2. CLAUDE.md is 80-100 lines, includes a `<!-- goodvibes:start -->` sentinel block and a `# goodvibes: v1.0.0` version stamp, and auto-activates ponytail on open
  3. `.claude/skills/caveman/` is present with a verified Apache 2.0 NOTICE file and works without any configuration
  4. `.claude/skills/goodvibes-hygiene/` wraps ponytail commands and its post-install instructions reference the ponytail marketplace install step
  5. All docs files (CONTRIBUTING.md, SECURITY.md, JOURNAL.md, CHANGELOG.md, issue templates, PR template, onboarding guide) exist with meaningful content (no TODO placeholders) and the repo root has LICENSE and NOTICE files

**Plans**: 4 plans
Plans:

- [x] 01-01-PLAN.md — Smoke-test harness (scripts/verify-phase1.sh) and templates/CLAUDE.md with sentinel block
- [x] 01-02-PLAN.md — caveman skill fork (8 files verbatim) and goodvibes-hygiene skill authoring
- [x] 01-03-PLAN.md — LICENSE, NOTICE, README.md, packages/ monorepo placeholders
- [x] 01-04-PLAN.md — 8 docs templates (CONTRIBUTING, SECURITY, JOURNAL, CHANGELOG, issue templates, PR template, onboarding)

**UI hint**: no

### Phase 2: npm CLI

**Goal**: `npx goodvibes init` works end-to-end in any empty or existing directory on Linux, macOS, and WSL2, installs headroom without using postinstall hooks, and is published to npm
**Depends on**: Phase 1
**Requirements**: NPM-01, NPM-02, NPM-03, NPM-04, NPM-05, NPM-06, NPM-07, NPM-08, NPM-09, NPM-10, NPM-11, HDR-01, HDR-02, HDR-03, HDR-04, HDR-05, HDR-06
**Success Criteria** (what must be TRUE):

  1. Running `npx goodvibes init` in an empty directory produces all expected files with named spinner steps visible throughout, prints an explicit file list on completion, and exits with a "what to do next" block of 3 or fewer steps
  2. Running `npx goodvibes init` a second time in the same directory does not overwrite user edits outside sentinel blocks; headroom install is skipped if already configured
  3. `npx goodvibes init --dry-run` prints every file that would be written without touching the filesystem; `--minimal` skips headroom and CI workflows
  4. When Python 3.10+ is absent, headroom install is skipped gracefully with a plain-English remediation message and the overall init still exits 0 with all other files created
  5. The CLI is published to npm as `goodvibes` and `npx goodvibes init` resolves and runs without any prior install step

**Plans**: 5 plansPlans:
**Wave 1**

- [x] 02-01-PLAN.md — Wave 0: verify-phase2.sh harness + packages/npm/ scaffold (package.json, tsup, tsconfig, entry stub, vitest, test stubs)
- [x] 02-02-PLAN.md — Wave 1: sentinel-merge.ts (4-case CLAUDE.md merge) + copy-templates.ts (bulk copy orchestrator)
- [x] 02-03-PLAN.md — Wave 1: detect-python.ts + install-headroom.ts + configure-mcp.ts (headroom integration)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-04-PLAN.md — Wave 2: commands/init.ts complete action handler + index.ts wiring

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-05-PLAN.md — Wave 3: .npmignore + package.json publish finalization + npm publish human checkpoint

**UI hint**: no

### Phase 3: pip CLI

**Goal**: `pip install jgiox-goodvibes && goodvibes init` produces an identical result to the npm CLI on Linux, macOS, and WSL2, and the package is published to PyPI as `jgiox-goodvibes`
**Depends on**: Phase 2
**Requirements**: PIP-01, PIP-02, PIP-03, PIP-04, PIP-05
**PyPI name note**: `goodvibes` is taken on PyPI by an actively-maintained computational chemistry package (Paton Research Group, v4.3.0). Package name is `jgiox-goodvibes` (mirrors npm `@jgiox/goodvibes`). The CLI entry point command remains `goodvibes` (per D-04). PIP-04 target adjusted accordingly.
**headroom note**: headroom-ai is installed at runtime (uv→pipx→pip chain, same as Phase 2 npm pattern) — NOT declared as a pyproject.toml dependency (D-02). headroom-ai[all] passes as a literal list element to subprocess.run; no shell=True.
**Success Criteria** (what must be TRUE):

  1. `pip install jgiox-goodvibes && goodvibes init` in a blank directory produces the same file set as the npm CLI with identical output behavior (spinner steps, file list, next-steps block)
  2. headroom-ai[all] is installed at runtime via uv→pipx→pip chain with graceful degradation; `headroom mcp install` (or `claude mcp add`) configures the global MCP server
  3. The pip package is published to PyPI as `jgiox-goodvibes`; wheel is py3-none-any (pure Python, all platforms); goodvibes command entry point works after install
  4. Running the pip CLI on Python 3.9 or lower prints a clear version error and exits non-zero

**Plans**: 4 plans

**Wave 0**

- [x] 03-01-PLAN.md — Wave 0: verify-phase3.sh smoke harness + packages/pip/ scaffold (pyproject.toml jgiox-goodvibes, __init__.py, __main__.py version guard, test stubs x4)

**Wave 1** *(parallel — no file conflicts)*

- [x] 03-02-PLAN.md — Wave 1a: sentinel_merge.py (4-case CLAUDE.md merge, stdlib only) + copy_templates.py (shutil.copytree orchestrator) with 22 passing tests
- [x] 03-03-PLAN.md — Wave 1b: detect_python.py + install_headroom.py (uv→pipx→pip chain) + configure_mcp.py (Strategy B primary, Strategy A fallback) with 14 passing tests

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-04-PLAN.md — Wave 2: init_cmd.py (Typer command) + main.py (wiring) + publish-pip.yml (trusted publishing) + PyPI publish human checkpoint

**UI hint**: no

### Phase 4: CI/CD Scaffolding

**Goal**: The CI/CD workflows generated by `goodvibes init` pass on the first push for both Node and Python project types with zero additional user configuration
**Depends on**: Phase 2
**Requirements**: CI-01, CI-02, CI-03, CI-04, CI-05, CI-06
**Success Criteria** (what must be TRUE):

  1. `goodvibes init` in a Node project (package.json present) writes a ci.yml that runs tests and lint and passes on the first push to a new GitHub repo without any user edits
  2. `goodvibes init` in a Python project (pyproject.toml or requirements.txt present) writes a ci.yml that runs tests and lint and passes on the first push with no user edits
  3. `goodvibes init` in an empty directory (no package.json or pyproject.toml) writes workflows for both Node and Python; all pass on first push
  4. `security.yml`, `dependency-review.yml`, and `dependabot.yml` are written and functional; `dependabot.yml` covers GitHub Actions, npm, and pip update channels

**Plans**: 4 plans

**Wave 0** *(parallel — no file conflicts)*

- [x] 04-01-PLAN.md — Wave 0: RED unit tests for detectProjectType (TS + Python) + verify-phase4.sh smoke harness
- [x] 04-02-PLAN.md — Wave 0: Author 6 static CI/CD template files (ci-node.yml, ci-python.yml, ci-both.yml, security.yml, dependency-review.yml, dependabot.yml)

**Wave 1** *(blocked on Wave 0 completion)*

- [x] 04-03-PLAN.md — Wave 1: Implement detect-project-type utilities + extend copy-templates CI variant selection (TS + Python) — tests GREEN

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-04-PLAN.md — Wave 2: Human verification checkpoint — generated CI passes on first push

**UI hint**: no

### Phase 5: Upgrade Command & Template Repo

**Goal**: `goodvibes upgrade` re-syncs a project's goodvibes-managed files to the latest version, and the GitHub template repo is published as the zero-install entry point
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4
**Requirements**: UPG-01, UPG-02, UPG-03, UPG-04
**Success Criteria** (what must be TRUE):

  1. Running `npx goodvibes upgrade` (or `goodvibes upgrade`) in a project initialized with an older version updates CLAUDE.md, skill files, and CI workflows to the latest published version
  2. User edits to CLAUDE.md content outside sentinel blocks are preserved after upgrade; the upgrade command prints a diff-style summary of what changed before applying any changes
  3. The `jgiox/goodvibes-template` repo is marked as a GitHub template and contains all validated files from Phase 1-4; a user can click "Use This Template," open the result in Claude Code, and have CLAUDE.md rules take effect immediately

**Plans**: 3 plans

**Wave 0**

- [x] 05-01-PLAN.md — Wave 0: RED unit tests for upgrade command (TS + Python) + verify-phase5.sh smoke harness

**Wave 1** *(blocked on Wave 0 completion)*

- [x] 05-02-PLAN.md — Wave 1: Implement upgrade command (TS + Python) — tests GREEN; wire into index.ts and main.py

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-03-PLAN.md — Wave 2: publish-template.yml workflow + push templates/ to jgiox/goodvibes-template + human verification checkpoint

**UI hint**: no

### Phase 6: UX Hardening

**Goal**: Users running `goodvibes init` against an existing project receive accurate feedback about what was written vs skipped, failures surface as plain-English remediation messages, and `--minimal` filters the correct file set in both live and dry-run modes
**Depends on**: Phase 5
**Requirements**: UX-01, UX-02, UX-03, UX-04, MIN-01, MIN-02
**Success Criteria** (what must be TRUE):

  1. Running `goodvibes init` in a non-empty directory shows a notice before any files are written, and the completion summary reports "X files written, Y files skipped (already exist)" as separate counts — not a flat combined list
  2. Running `goodvibes init` when `ci.yml` already exists in the destination leaves the existing file unchanged and reports it as skipped, not overwritten
  3. Running `goodvibes init --minimal` skips all of `.github/` (workflows, issue templates, PR template, dependabot) and `docs/` — and the completion next-steps block notes what was skipped and how to add it later
  4. Running `goodvibes init --dry-run --minimal` shows only the files that `--minimal` would actually write — CLAUDE.md and skills — without listing CI or docs files
  5. Common failures (no Python detected, EACCES/EPERM on file write, headroom build error) print a plain-English "What failed / Why / How to fix" message and exit 1 without a raw Node.js or Python stack trace visible to the user

**Plans**: 3 plans

**Wave 1**

- [x] 06-01-PLAN.md — Wave 1: RED tests for npm package (copy-templates.test.ts + init.test.ts) covering UX-01 through MIN-02

**Wave 2** *(parallel pair — no file conflicts)*

- [x] 06-02-PLAN.md — Wave 2a: Implement npm package changes (copy-templates.ts + init.ts) — tests GREEN
- [x] 06-03-PLAN.md — Wave 2b: Python parity — RED tests + implementation (copy_templates.py + init_cmd.py + test files)

**UI hint**: no

### Phase 7: README & Demo

**Goal**: First-time visitors to the goodvibes repo understand what it does, see it working, and can start a project in under 30 seconds — all from the README alone
**Depends on**: Phase 6
**Requirements**: README-01, README-02, README-03, README-04, DEMO-01, DEMO-02
**Success Criteria** (what must be TRUE):

  1. The README hero shows a single copy-pasteable `npx goodvibes init` command above the fold, before any prerequisites section, that a new visitor can run in under 30 seconds
  2. Live npm version, PyPI version, CI status, and license badges appear in the README and each resolves to a non-error state (no gray "error" shields)
  3. An animated GIF embedded in the README shows `goodvibes init --minimal --dry-run` completing in a real terminal, is under 2MB, renders inline on GitHub without clicking "View raw," and reflects the post-Phase-6 hardened output (written/skipped counts visible)
  4. `npm package.json` description, keywords, and homepage and PyPI `pyproject.toml` description, keywords, and classifiers match the README; the README `Flags` section states exactly what `--minimal` skips
  5. `scripts/demo.tape` is committed alongside `docs/demo.gif` so any contributor can reproduce the GIF by running `vhs scripts/demo.tape`; `.github/workflows/vhs.yml` auto-regenerates the GIF when `demo.tape` changes on main

**Plans**: 3 plansPlans:
**Wave 1**

- [x] 07-01-PLAN.md — README hero redesign + npm/PyPI package metadata sync
- [x] 07-02-PLAN.md — VHS demo tape (scripts/demo.tape) + initial docs/demo.gif

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-03-PLAN.md — .github/workflows/vhs.yml auto-regen CI workflow

**UI hint**: no

### Phase 8: Multi-IDE Expansion

**Goal**: Running `goodvibes init` writes fully-formed AI rule files for Cursor, GitHub Copilot, Windsurf, and Kiro — the four leading VS Code-ecosystem AI coding tools — so that vibe coders who use any of those IDEs get the same engineering guardrails as Claude Code users, out of the box
**Depends on**: Phase 1 (template content), Phase 2 (npm CLI), Phase 3 (pip CLI), Phase 6 (UX hardening / no-clobber logic)
**Requirements**: IDE-01, IDE-02, IDE-03, IDE-04, IDE-05
**Success Criteria** (what must be TRUE):

  1. Running `goodvibes init` in a blank directory writes `.cursor/rules/goodvibes.mdc`, `.github/copilot-instructions.md`, `.windsurfrules`, and `.kiro/steering/goodvibes.md` in addition to `CLAUDE.md` and the existing template files
  2. Each IDE rule file encodes the same ponytail minimalism, fail-loud, security-first, and surgical-changes principles as `CLAUDE.md`, formatted in the native format of its target IDE — not a verbatim copy of CLAUDE.md
  3. Running `goodvibes init` in a project that already has a `.cursorrules` or `.cursor/rules/` directory does not overwrite existing rules — existing files are counted as skipped
  4. Running `goodvibes init --minimal` skips `.github/copilot-instructions.md` (consistent with `.github/` exclusion) but writes Cursor, Windsurf, and Kiro rule files (they are AI configuration, like CLAUDE.md, not scaffolding)
  5. README and template repo include a multi-IDE compatibility table listing each supported IDE, the file written, and the minimum IDE version or setting required to activate the rules

**Plans**: 3 plans

**Wave 1** *(parallel — no file conflicts)*

- [x] 08-01-PLAN.md — Wave 1a: Author four IDE rule template files (.cursor/rules/goodvibes.mdc, .github/copilot-instructions.md, .windsurfrules, .kiro/steering/goodvibes.md)
- [x] 08-02-PLAN.md — Wave 1b: Extend copy-templates test suites (TS + Python) with IDE file assertions (IDE-01, IDE-03, IDE-04 coverage)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08-03-PLAN.md — Wave 2: README multi-IDE compatibility table + update --minimal Flags description (IDE-05)

**UI hint**: no

### Phase 9: OpenAI/Codex & Vibe-coding Platform Expansion

**Goal**: Extend goodvibes to serve users of OpenAI Codex CLI, ChatGPT-based workflows, and the leading vibe-coding platforms (Lovable, Replit, Base44) — writing platform-native rule files where the platform supports them, and providing clear integration guides where it does not
**Depends on**: Phase 8 (multi-IDE rule file infrastructure)
**Requirements**: TBD — derived during planning
**Success Criteria** (what must be TRUE):

  1. Users running `goodvibes init` get rule files or integration artifacts for Codex CLI, Lovable, Replit, and Base44 where the platform supports file-based rules
  2. Platforms that don't support file injection have a documented one-time setup path (copy-paste system prompt, API/webhook integration, or configuration file) included in `docs/`
  3. README IDE compatibility table is updated with all newly supported platforms and the activation method for each
  4. All new template files are covered by tests in both the npm and pip suites
  5. A beginner vibe-coder landing on any of these platforms can follow the goodvibes setup path in under 5 minutes without leaving their platform

**Plans**: TBD

**UI hint**: no

### Phase 10: Vibe Coder Completeness

**Goal**: Ship the commands and guides that turn a successful `goodvibes init` into a complete, confident vibe-coding setup — `goodvibes update`, `goodvibes doctor`, `goodvibes --version`, headroom install transparency, a newbie "what now?" flow guide, and ponytail audit guidance for non-Claude Code IDE users
**Depends on**: Phase 9
**Requirements**: VCC-01, VCC-02, VCC-03, VCC-04, VCC-05, VCC-06
**Success Criteria** (what must be TRUE):

  1. `goodvibes update` re-runs the sentinel merge and copies updated template files into an existing project without overwriting user edits outside sentinel blocks; skipped on first-run directories
  2. `goodvibes doctor` prints a pass/fail checklist — headroom installed, git configured, CLAUDE.md present, sentinel block intact — with plain-English remediation for each failure, and exits non-zero when any check fails
  3. `goodvibes --version` prints the installed package version and exits 0
  4. `docs/getting-started.md` walks a complete beginner from "I just ran init" through their first vibe-coded feature — understand the rules, make a change, commit, push — completable in under 5 minutes
  5. The headroom install step shows explicit status (installing / already installed / skipped — Python not found) and a one-sentence explanation of what headroom does, so beginners are never confused about the silent step
  6. Non-Claude Code IDE users (Cursor, Windsurf, Replit, Bolt.new, etc.) get a "what do I do now?" section in their platform setup guide explaining how to apply ponytail discipline manually when Claude Code skills are unavailable

**Plans**: 3 plans

**Wave 1** *(parallel — no file conflicts)*

- [x] 10-01-PLAN.md — Wave 1a: CLI code changes — update alias, doctor command, --version fix, headroom transparency (npm + pip)
- [x] 10-02-PLAN.md — Wave 1b: Unit tests for all VCC-01/02/03/05 behaviors (npm + pip)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10-03-PLAN.md — Wave 2: Template docs (getting-started.md + 5 IDE ponytail guides) + CHANGELOG + JOURNAL + version bump to 1.6.0

**UI hint**: no

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

Note: Phase 3 (pip CLI) and Phase 4 (CI scaffolding) have no dependency on each other and can be parallelized if two implementers are available. Both depend only on Phase 2.

Phase 6 must complete before Phase 7 — the demo GIF must record the hardened CLI output (written/skipped summary, correct --minimal scope). Recording before Phase 6 would produce a GIF that does not match what users see after Phase 6 ships.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Template Content & Repo Foundation | 4/4 | Complete   | 2026-06-23 |
| 2. npm CLI | 5/5 | Complete | 2026-06-23 |
| 3. pip CLI | 4/4 | Complete   | 2026-06-24 |
| 4. CI/CD Scaffolding | 4/4 | Complete | 2026-06-25 |
| 5. Upgrade Command & Template Repo | 3/3 | Complete    | 2026-06-25 |
| 6. UX Hardening | 3/3 | Complete    | 2026-06-27 |
| 7. README & Demo | 3/3 | Complete    | 2026-06-29 |
| 8. Multi-IDE Expansion | 3/3 | Complete    | 2026-06-30 |
| 9. OpenAI/Codex & Vibe-coding Platform Expansion | 3/3 | Complete    | 2026-07-01 |
| 10. Vibe Coder Completeness | 3/3 | Complete   | 2026-07-01 |
