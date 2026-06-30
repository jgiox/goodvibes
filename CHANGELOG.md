# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
