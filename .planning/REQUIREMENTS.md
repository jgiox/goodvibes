# Requirements: goodvibes

**Defined:** 2026-06-23
**Core Value:** One command gives a vibe coder a fully configured project — token efficiency and engineering discipline happen automatically in the background.

## v1 Requirements

### CLI — npm

- [ ] **NPM-01**: User can run `npx goodvibes init` in any empty or existing directory and get a fully configured project
- [ ] **NPM-02**: CLI runs without asking any questions (zero-config, fully opinionated defaults)
- [ ] **NPM-03**: CLI displays named steps with spinners during init (not silent)
- [ ] **NPM-04**: CLI prints an explicit file list of everything it created or modified on completion
- [ ] **NPM-05**: CLI prints a "what to do next" block (max 3 steps) after install
- [ ] **NPM-06**: CLI supports `--minimal` flag (skip headroom install, skip CI workflows) for advanced users who want only the Claude skills + CLAUDE.md
- [ ] **NPM-07**: CLI supports `--dry-run` flag to preview what would be written without touching the filesystem
- [ ] **NPM-08**: CLI requires Node 20 LTS or higher and errors clearly if not met
- [ ] **NPM-09**: CLI works on Linux and macOS; Windows documented as best-effort (WSL recommended)
- [ ] **NPM-10**: CLI uses `cross-spawn` for all subprocess calls to avoid Windows PATH issues
- [ ] **NPM-11**: npm package published as `goodvibes` (or `@jgiox/goodvibes`)

### CLI — pip

- [ ] **PIP-01**: User can run `pip install goodvibes && goodvibes init` and get the same result as `npx goodvibes init`
- [ ] **PIP-02**: pip CLI is a Python port of the npm CLI with identical output behavior
- [ ] **PIP-03**: pip package lists `headroom-ai[all]` as a declared dependency (installs automatically with `pip install goodvibes`)
- [ ] **PIP-04**: pip package published to PyPI as `goodvibes`
- [ ] **PIP-05**: pip CLI requires Python 3.10+ and errors clearly if not met

### CLAUDE.md

- [x] **CLAUDEMD-01**: `init` writes a `CLAUDE.md` to the target project root (or merges into existing using sentinel blocks)
- [x] **CLAUDEMD-02**: CLAUDE.md is 80–100 lines — curated from karpathy rules and Code Directions.md to only what a vibe coder needs every session
- [x] **CLAUDEMD-03**: CLAUDE.md includes a version stamp (e.g. `# goodvibes: v1.0.0`) for future upgrade compatibility
- [x] **CLAUDEMD-04**: CLAUDE.md auto-activates ponytail minimalism rules (no manual `/ponytail` invocation required)
- [x] **CLAUDEMD-05**: CLAUDE.md covers: think before coding, simplicity first, surgical changes, fail loud, security basics, journal requirement — and nothing else

### caveman Skill

- [ ] **CAV-01**: `init` writes the caveman Claude skill to `.claude/skills/caveman/` in the target project
- [ ] **CAV-02**: caveman skill is forked from `juliusbrussee/caveman` with full attribution and Apache 2.0 NOTICE file
- [ ] **CAV-03**: caveman skill works out of the box with no configuration required

### goodvibes-hygiene Skill

- [ ] **HYG-01**: `init` writes a `goodvibes-hygiene` Claude skill to `.claude/skills/goodvibes-hygiene/`
- [ ] **HYG-02**: Skill wraps the key ponytail commands (`/ponytail-review`, `/ponytail-audit`) with goodvibes-specific context
- [ ] **HYG-03**: Skill instructs the user to install ponytail via `/plugin marketplace add DietrichGebert/ponytail` and surfaces this in the post-install "what to do next" block

### headroom Integration

- [ ] **HDR-01**: `init` installs `headroom-ai[all]` via `pipx install headroom-ai[all]` (preferred) with `pip install --user` as fallback
- [ ] **HDR-02**: Before installing, CLI detects Python 3.10+ and warns clearly if absent (skip headroom gracefully, do not fail the whole init)
- [ ] **HDR-03**: CLI warns the user that the first headroom run will download an ONNX model and may take 1–3 minutes
- [ ] **HDR-04**: `init` configures headroom as a global MCP server in `~/.claude/` (not project-scoped)
- [ ] **HDR-05**: `init` checks if headroom is already configured before installing (idempotent — safe to run twice)
- [ ] **HDR-06**: headroom installation does NOT use npm postinstall hooks (blocked in npm v12)

### GitHub Actions Scaffolding

- [ ] **CI-01**: `init` writes `.github/workflows/ci.yml` — runs tests and lint for detected project type (Node or Python)
- [ ] **CI-02**: `init` writes `.github/workflows/security.yml` — CodeQL + dependency audit
- [ ] **CI-03**: `init` writes `.github/workflows/dependency-review.yml` — blocks PRs with high-severity deps
- [ ] **CI-04**: `init` writes `.github/dependabot.yml` — weekly updates for GitHub Actions, npm, and pip
- [ ] **CI-05**: CLI detects project type (presence of `package.json` or `pyproject.toml`/`requirements.txt`) and generates the appropriate CI workflow; defaults to both if neither exists
- [ ] **CI-06**: Generated workflows pass on the first push with zero additional user configuration

### Docs Scaffolding

- [ ] **DOCS-01**: `init` writes `CONTRIBUTING.md` with the git fork/branch/PR workflow explained for beginners
- [ ] **DOCS-02**: `init` writes `SECURITY.md` with private vulnerability reporting guidance
- [ ] **DOCS-03**: `init` writes `JOURNAL.md` with template and example entry
- [ ] **DOCS-04**: `init` writes `CHANGELOG.md` with Unreleased section ready
- [ ] **DOCS-05**: `init` writes `.github/ISSUE_TEMPLATE/bug_report.yml` and `feature_request.yml`
- [ ] **DOCS-06**: `init` writes `.github/PULL_REQUEST_TEMPLATE.md` with the standard checklist
- [ ] **DOCS-07**: `init` writes `docs/onboarding.md` — beginner guide covering git clone, branch, PR workflow in plain language

### Upgrade

- [ ] **UPG-01**: `npx goodvibes upgrade` (and `goodvibes upgrade`) re-syncs CLAUDE.md, skill files, and CI workflows to the latest published version of goodvibes
- [ ] **UPG-02**: Upgrade uses template version stamps to detect what was installed vs what is current
- [ ] **UPG-03**: Upgrade preserves user edits in CLAUDE.md outside sentinel blocks
- [ ] **UPG-04**: Upgrade prints a diff-style summary of what changed before applying

### Repo and License

- [ ] **REPO-01**: Apache 2.0 `LICENSE` file at repo root
- [ ] **REPO-02**: `NOTICE` file crediting caveman (juliusbrussee/caveman, MIT), ponytail (DietrichGebert/ponytail, MIT), and headroom (headroomlabs-ai/headroom, Apache 2.0)
- [ ] **REPO-03**: Repo README has `npx goodvibes init` as the hero action — the first thing a visitor sees
- [ ] **REPO-04**: Template files symlinked between npm and pip packages (single source of truth)

## v2 Requirements

### Enhanced CLI
- **NPM-V2-01**: `goodvibes update` — re-sync an existing install without full reinit
- **NPM-V2-02**: `--template <name>` flag for project-type-specific variants (e.g. `--template nextjs`, `--template fastapi`)
- **NPM-V2-03**: Interactive wizard mode (`--interactive`) for users who want to choose which layers to install

### Platform
- **PLAT-V2-01**: Full native Windows support (no WSL requirement)
- **PLAT-V2-02**: Alpine/musl wheel distribution for headroom

### Ecosystem
- **ECO-V2-01**: GitHub template repo (`jgiox/goodvibes-template`) as a click-to-fork alternative
- **ECO-V2-02**: headroom proxy mode setup as an optional step (for users who want session-level compression, not just MCP)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Plugin/extension marketplace | Yeoman failure mode — composability kills simplicity |
| Web UI or dashboard | CLI-only for v1; adds infrastructure complexity with no beginner benefit |
| Publishing to npm/PyPI automatically via CI | Manual publish for v1 — semantic-release is premature until release cadence is established |
| New AI/LLM agent framework | goodvibes wires existing tools; it does not replace them |
| Per-language boilerplate (React, FastAPI starters) | Language-agnostic is the constraint; boilerplate belongs in separate templates |
| Real-time token dashboard | headroom has its own dashboard; goodvibes does not duplicate it |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLAUDEMD-01 | Phase 1 | Complete |
| CLAUDEMD-02 | Phase 1 | Complete |
| CLAUDEMD-03 | Phase 1 | Complete |
| CLAUDEMD-04 | Phase 1 | Complete |
| CLAUDEMD-05 | Phase 1 | Complete |
| CAV-01 | Phase 1 | Pending |
| CAV-02 | Phase 1 | Pending |
| CAV-03 | Phase 1 | Pending |
| HYG-01 | Phase 1 | Pending |
| HYG-02 | Phase 1 | Pending |
| HYG-03 | Phase 1 | Pending |
| DOCS-01 | Phase 1 | Pending |
| DOCS-02 | Phase 1 | Pending |
| DOCS-03 | Phase 1 | Pending |
| DOCS-04 | Phase 1 | Pending |
| DOCS-05 | Phase 1 | Pending |
| DOCS-06 | Phase 1 | Pending |
| DOCS-07 | Phase 1 | Pending |
| REPO-01 | Phase 1 | Pending |
| REPO-02 | Phase 1 | Pending |
| REPO-03 | Phase 1 | Pending |
| REPO-04 | Phase 1 | Pending |
| NPM-01 | Phase 2 | Pending |
| NPM-02 | Phase 2 | Pending |
| NPM-03 | Phase 2 | Pending |
| NPM-04 | Phase 2 | Pending |
| NPM-05 | Phase 2 | Pending |
| NPM-06 | Phase 2 | Pending |
| NPM-07 | Phase 2 | Pending |
| NPM-08 | Phase 2 | Pending |
| NPM-09 | Phase 2 | Pending |
| NPM-10 | Phase 2 | Pending |
| NPM-11 | Phase 2 | Pending |
| HDR-01 | Phase 2 | Pending |
| HDR-02 | Phase 2 | Pending |
| HDR-03 | Phase 2 | Pending |
| HDR-04 | Phase 2 | Pending |
| HDR-05 | Phase 2 | Pending |
| HDR-06 | Phase 2 | Pending |
| PIP-01 | Phase 3 | Pending |
| PIP-02 | Phase 3 | Pending |
| PIP-03 | Phase 3 | Pending |
| PIP-04 | Phase 3 | Pending |
| PIP-05 | Phase 3 | Pending |
| CI-01 | Phase 4 | Pending |
| CI-02 | Phase 4 | Pending |
| CI-03 | Phase 4 | Pending |
| CI-04 | Phase 4 | Pending |
| CI-05 | Phase 4 | Pending |
| CI-06 | Phase 4 | Pending |
| UPG-01 | Phase 5 | Pending |
| UPG-02 | Phase 5 | Pending |
| UPG-03 | Phase 5 | Pending |
| UPG-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 54 total
- Mapped to phases: 54
- Unmapped: 0

---
*Requirements defined: 2026-06-23*
*Last updated: 2026-06-23 — traceability populated during roadmap creation*
