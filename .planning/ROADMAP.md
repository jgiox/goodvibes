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
- [ ] **Phase 4: CI/CD Scaffolding** - Validate and harden generated GitHub Actions workflows for both project types
- [ ] **Phase 5: Upgrade Command & Template Repo** - Implement `goodvibes upgrade` and publish the GitHub template repo as the click-to-fork entry point

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

- [ ] 04-01-PLAN.md — Wave 0: RED unit tests for detectProjectType (TS + Python) + verify-phase4.sh smoke harness
- [ ] 04-02-PLAN.md — Wave 0: Author 6 static CI/CD template files (ci-node.yml, ci-python.yml, ci-both.yml, security.yml, dependency-review.yml, dependabot.yml)

**Wave 1** *(blocked on Wave 0 completion)*

- [ ] 04-03-PLAN.md — Wave 1: Implement detect-project-type utilities + extend copy-templates CI variant selection (TS + Python) — tests GREEN

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 04-04-PLAN.md — Wave 2: Human verification checkpoint — generated CI passes on first push

**UI hint**: no

### Phase 5: Upgrade Command & Template Repo

**Goal**: `goodvibes upgrade` re-syncs a project's goodvibes-managed files to the latest version, and the GitHub template repo is published as the zero-install entry point
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4
**Requirements**: UPG-01, UPG-02, UPG-03, UPG-04
**Success Criteria** (what must be TRUE):

  1. Running `npx goodvibes upgrade` (or `goodvibes upgrade`) in a project initialized with an older version updates CLAUDE.md, skill files, and CI workflows to the latest published version
  2. User edits to CLAUDE.md content outside sentinel blocks are preserved after upgrade; the upgrade command prints a diff-style summary of what changed before applying any changes
  3. The `jgiox/goodvibes-template` repo is marked as a GitHub template and contains all validated files from Phase 1-4; a user can click "Use This Template," open the result in Claude Code, and have CLAUDE.md rules take effect immediately

**Plans**: TBD
**UI hint**: no

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

Note: Phase 3 (pip CLI) and Phase 4 (CI scaffolding) have no dependency on each other and can be parallelized if two implementers are available. Both depend only on Phase 2.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Template Content & Repo Foundation | 4/4 | Complete   | 2026-06-23 |
| 2. npm CLI | 5/5 | Complete | 2026-06-23 |
| 3. pip CLI | 4/4 | Complete   | 2026-06-24 |
| 4. CI/CD Scaffolding | 0/4 | Not started | - |
| 5. Upgrade Command & Template Repo | 0/TBD | Not started | - |
