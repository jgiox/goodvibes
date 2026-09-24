# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.7.1] — 2026-08-06

### Fixed

- `goodvibes doctor` headroom check now uses `headroom --version` instead of `headroom compress --help`; the previous probe exited non-zero on installed headroom versions, always reporting a false failure

## [1.7.0] — 2026-07-27

### Added

- `goodvibes update` command — compares each template file against a `.goodvibes.json` SHA-256 manifest to distinguish managed-unmodified files (safe to overwrite) from user-modified files (skip by default); supports `--dry-run` and `--force`
- `.goodvibes.json` manifest — written by `goodvibes init` after every successful run; records the SHA-256 digest and goodvibes version for each managed template file
- `goodvibes update --dry-run` — previews three labelled categories without writing: files to overwrite, files to skip (user-modified), and net-new files not yet in the manifest
- `templates/.claude/settings.json` — Claude Code permission file; auto-approves read/edit/test/commit, prompts for push, denies force-push and hard-reset

### Changed

- `goodvibes update` replaces the `goodvibes upgrade` alias; the upgrade command still exists but `update` now uses manifest-aware logic instead of blind overwrite
- CLAUDE.md engineering rules updated across all 14 supported IDEs: "Simplicity first" renamed to "Make the smallest complete change" with an explicit completeness requirement; "Proof of work" section added; "Action tiers" table added differentiating read/edit/commit/push/deploy authorization levels
- Anonymous telemetry: `goodvibes init` sends a single counter ping to a Cloudflare Worker on first run; no personal data collected; respects `DO_NOT_TRACK`, `GOODVIBES_NO_TELEMETRY`, and `CI` environment variables

### Fixed

- CLAUDE.md sentinel guard: `<!-- goodvibes:start -->` without a matching `<!-- goodvibes:end -->` no longer corrupts the file; the block is now treated as an append target

## [1.6.2] — 2026-07-02

### Added

- Package rename: npm package is now `goodvibes-cli` (was `@jgiox/goodvibes`); pip package is now `goodvibes-cli` (was `jgiox-goodvibes`); old names are deprecated/tombstoned with redirect messages
- CI `check-stamps` job: fails CI when `packages/npm/package.json`, `packages/pip/pyproject.toml`, and `templates/CLAUDE.md` version stamps diverge
- Publish smoke-test jobs: after each npm/pip publish, CI installs from the public registry and runs `goodvibes init --dry-run` to confirm the release is working before users hit it
- `goodvibes doctor` now shows `goodvibes vX.Y.Z` as the first line of its output panel
- Dedicated README.md pages for the npm and PyPI package listings
- Tombstone stub: `jgiox-goodvibes` v2.0.0 on PyPI depends on `goodvibes-cli`, so `pip install jgiox-goodvibes` auto-upgrades to the new name

### Changed

- `goodvibes upgrade --dry-run` diff labels changed from symbols (`~`, `+`, `=`) to plain English (`updated`, `new`, `unchanged`)

## [1.6.1] — 2026-07-02

### Fixed

- `goodvibes upgrade` incorrectly reported "already up to date" when a newer version was available — version comparison now reads the installed package version instead of the template package version

## [1.6.0] — 2026-07-01

### Added

- `goodvibes update` command — alias for `goodvibes upgrade` (VCC-01)
- `goodvibes doctor` command — checks headroom, git identity, CLAUDE.md, and sentinel block; exits non-zero on any failure (VCC-02)
- `goodvibes --version` now reads version from package.json dynamically (VCC-03)
- `docs/getting-started.md` template — beginner flow guide from init to first commit (VCC-04)
- Headroom install step now shows "what is headroom?" description and skips gracefully if already installed (VCC-05)
- Platform setup guides for Cursor, Windsurf, Kiro, Replit Agent, and Bolt.new with ponytail activation instructions (VCC-06)

## [1.5.0] - 2026-07-01

### Added

- `replit.md` — Replit Agent reads this from project root automatically; encodes goodvibes engineering rules
- `.bolt/prompt` — Bolt.new reads this when the project opens; encodes the same rules in plain text
- `docs/platform-setup/chatgpt.md` — beginner guide for pasting goodvibes rules into ChatGPT Projects custom instructions
- `docs/platform-setup/base44.md` — beginner guide for Base44 AI controls
- README IDE compatibility table: added Codex CLI, Lovable, Replit Agent, Bolt.new

## [1.4.0] - 2026-06-30

### Added

- `AGENTS.md` cross-tool rules file — natively read by Zed, Aider, JetBrains Junie, Jules, Amp, Codex CLI, and 10+ other tools
- `.clinerules/goodvibes.md` for Cline (VS Code extension)
- `.amazonq/rules/goodvibes.md` for Amazon Q Developer (VS Code and JetBrains)
- `.continue/rules/goodvibes.md` for Continue.dev
- `.devin/rules/goodvibes.md` for Devin Desktop (Windsurf rebrand, June 2026)
- `GEMINI.md` for Google Antigravity IDE
- Cursor `alwaysApply` troubleshooting note in `docs/onboarding.md`

### Changed

- README IDE compatibility table updated: Windsurf split into legacy (`.windsurfrules`) and Devin Desktop (`.devin/rules/`) rows; 5 new IDE rows added
- `goodvibes-hygiene` skill setup callout now lists all supported IDEs and clarifies that `/ponytail-review` and `/ponytail-audit` are Claude Code CLI only

## [1.3.0] - 2026-06-30

### Added

- `.cursor/rules/goodvibes.mdc` for Cursor IDE (`alwaysApply: true` frontmatter, MDC format)
- `.github/copilot-instructions.md` for GitHub Copilot (plain markdown, applied to all Copilot Chat requests)
- `.windsurfrules` for Windsurf / Devin Desktop (plain markdown, applied to every Cascade conversation)
- `.kiro/steering/goodvibes.md` for Kiro IDE (`inclusion: always` frontmatter)
- README `## IDE compatibility` section documenting all supported IDEs, file paths, and activation instructions

## [1.2.0] - 2026-06-27

### Added

- Hero README with one-command quickstart, badges (npm, PyPI, CI, license), and animated demo GIF
- VHS demo tape (`scripts/demo.tape`) for reproducible GIF generation in CI
- GitHub Actions workflow (`vhs.yml`) to auto-regenerate the demo GIF on README/tape changes

## [1.1.0] - 2026-06-26

### Added

- Non-empty project detection: shows a note before writing files if the destination is not empty
- Written/skipped file counts shown after `goodvibes init` completes
- `--minimal` flag: skips `.github/` (workflows, issue templates, PR template, dependabot) and `docs/`; writes only CLAUDE.md, skills, and IDE rule files
- `goodvibes upgrade` command: re-merges the CLAUDE.md sentinel block on existing projects

### Fixed

- `--dry-run --minimal` combination now correctly previews the filtered file list
- `ci.yml` guard: second `goodvibes init` run on an existing project skips rather than overwrites `ci.yml`
- Stack traces replaced with plain-English remediation messages for common failure modes (Python absent, headroom build failure, MCP registration error)

## [1.0.0] - 2026-06-24

### Added

- `npx @jgiox/goodvibes init` npm CLI (Commander.js, @clack/prompts, fs-extra, execa)
- `pip install jgiox-goodvibes && goodvibes init` pip CLI (Typer, Rich, shutil/pathlib)
- `CLAUDE.md` with engineering rules, ponytail minimalism ruleset, and `<!-- goodvibes:start -->` / `<!-- goodvibes:end -->` sentinel block for safe upgrades
- `.claude/skills/caveman/` skill for output token compression (forked from juliusbrussee/caveman, Apache 2.0)
- `.claude/skills/goodvibes-hygiene/` skill wrapping the ponytail plugin for on-demand complexity audits
- headroom integration: `uv tool install` → `pipx install` → `pip install` fallback chain with MCP registration
- GitHub Actions CI workflow (`ci.yml`) with Node.js and Python matrix builds
- GitHub Actions security workflow (`security.yml`): CodeQL, pip-audit, npm audit
- Dependency review workflow (`dependency-review.yml`) as a PR gate
- Dependabot configuration for actions, npm, and pip ecosystems
- `CONTRIBUTING.md`, `SECURITY.md`, `JOURNAL.md`, `CHANGELOG.md`
- Issue templates (bug report, feature request) and PR template
- `docs/onboarding.md` — git and GitHub basics for complete beginners
- `Apache-2.0` LICENSE and NOTICE file
- `goodvibes upgrade` command and GitHub template repo (`jgiox/goodvibes-template`)

[1.7.1]: https://github.com/jgiox/goodvibes/compare/npm-v1.7.0...npm-v1.7.1
[1.7.0]: https://github.com/jgiox/goodvibes/compare/npm-v1.6.2...npm-v1.7.0
[1.6.2]: https://github.com/jgiox/goodvibes/compare/v1.6.1...npm-v1.6.2
[1.6.1]: https://github.com/jgiox/goodvibes/compare/npm-v1.4.0...v1.6.1
[1.4.0]: https://github.com/jgiox/goodvibes/compare/pip-v1.0.0...npm-v1.4.0
[1.0.0]: https://github.com/jgiox/goodvibes/releases/tag/pip-v1.0.0
