# goodvibes

## What This Is

goodvibes is a single-command bootstrap for people who want to vibe code with an LLM and not worry about the rest. Run `npx goodvibes init` (or fork the template), start coding, and everything else — code hygiene, token efficiency, git discipline, CI/CD — happens automatically in the background. It is an open-source Apache 2.0 starter kit targeting complete beginners who use Claude, Copilot, or any other LLM coding tool.

## Core Value

One command gives a new vibe coder a production-grade project environment — the LLM is quietly guided to write clean minimal code, tokens are optimized so context never bloats, and git/CI enforces quality gates automatically, all without the user needing to understand any of it.

## Four Layers (all invisible to the user after setup)

| Layer | Source | What it does automatically |
|-------|--------|---------------------------|
| **Output token compression** | caveman (juliusbrussee/caveman) | Claude skill that compresses verbose LLM output when invoked |
| **Input token compression** | headroom (headroomlabs-ai/headroom) | Bundled via installer; runs as proxy/MCP server reducing context 60–95% |
| **Code minimalism enforcement** | ponytail (DietrichGebert/ponytail) | Thin wrapper skill referencing ponytail plugin; enforces YAGNI, anti-bloat reviews |
| **Engineering discipline** | CLAUDE.md rules (karpathy + Code Directions.md) | LLM-facing rules for assumptions, simplicity, security, testing, journaling |

## Delivery Mechanism

Two equivalent paths — same result:

1. **Template fork** — Fork `github.com/jgiox/goodvibes` on GitHub; all files are already in place
2. **Installer** — `npx goodvibes init` or `pip install goodvibes && goodvibes init` in any empty or existing project folder

Both paths inject:
- `CLAUDE.md` with combined engineering rules
- `.claude/skills/caveman/` skill (output token compression)
- `.claude/skills/goodvibes-hygiene/` skill (ponytail wrapper + hygiene shortcuts)
- Headroom configured and ready (MCP config + optional proxy setup)
- `.github/workflows/` — CI, security scanning, dependency review
- `CONTRIBUTING.md`, `SECURITY.md`, `JOURNAL.md`, `CHANGELOG.md`
- `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/` — beginner onboarding guide, git basics, release process

## Requirements

### Validated

- [x] Template fork path: all files present at repo root — Validated in Phase 01
- [x] CLAUDE.md generated from combined karpathy + Code Directions.md rules — Validated in Phase 01
- [x] caveman skill bundled and ready (forked, Apache 2.0 compatible) — Validated in Phase 01
- [x] goodvibes-hygiene skill that wraps ponytail plugin and adds hygiene shortcuts — Validated in Phase 01
- [x] GitHub Actions CI workflow (test, lint, artifact) — Validated in Phase 04
- [x] GitHub Actions security workflow (CodeQL, pip-audit, npm audit) — Validated in Phase 04
- [x] Dependency review workflow (PR gate) — Validated in Phase 04
- [x] Dependabot config (actions, npm, pip) — Validated in Phase 04
- [x] Docs scaffold: CONTRIBUTING.md, SECURITY.md, JOURNAL.md, CHANGELOG.md — Validated in Phase 01
- [x] Issue templates (bug, feature) and PR template — Validated in Phase 01
- [x] Beginner onboarding docs (git basics, fork/clone/PR flow, CI explained) — Validated in Phase 01
- [x] Apache 2.0 LICENSE — Validated in Phase 01
- [x] Single-command bootstrap: `npx goodvibes init` sets up a fully configured project — Validated in Phase 02
- [x] `pip install goodvibes && goodvibes init` equivalent for Python-native users — Validated in Phase 03
- [x] `goodvibes upgrade` keeps existing projects current (npm + pip) — Validated in Phase 05
- [x] Click-to-fork GitHub template repo (`jgiox/goodvibes-template`) — Validated in Phase 05

### Active

- [ ] Publish npm package as `goodvibes` (or `@jgiox/goodvibes`)
- [ ] Publish pip package as `goodvibes`
- [ ] README with one-command quickstart as the hero action
- [ ] Headroom bundled/configured via installer (MCP + proxy option)

### Out of Scope

- Building a new LLM or agent framework — goodvibes wires together existing tools, it does not replace them
- Requiring users to understand or configure any of the four layers — setup must be zero-config
- Language-specific boilerplate beyond minimal CI examples — goodvibes is language-agnostic
- A web UI or dashboard — CLI + file injection only for v1

## Context

Audience: people who are new to coding and use LLM tools (Claude Code, GitHub Copilot, Cursor, etc.) to write code for them. They are comfortable running a command in a terminal but do not know git workflow, CI/CD, or engineering discipline conventions. The "magic behind the scenes" framing is deliberate — goodvibes should not lecture them; it should just work.

Source repos being forked or referenced:
- `juliusbrussee/caveman` — MIT → Apache 2.0 compatible; will be bundled directly
- `DietrichGebert/ponytail` — MIT; referenced via plugin marketplace, wrapped with goodvibes skill
- `headroomlabs-ai/headroom` — bundled as npm/pip dependency in the installer
- `multica-ai/andrej-karpathy-skills` CLAUDE.md + user's Code Directions.md — combined into the CLAUDE.md output

Target repository: `github.com/jgiox/goodvibes`
License: Apache 2.0

## Constraints

- **License**: Apache 2.0 — all bundled/forked code must be Apache 2.0 or permissive-compatible (MIT, BSD)
- **Zero-config**: The installer must work without any user configuration; sensible defaults for everything
- **Beginner-first**: Every doc, error message, and README section must assume the reader has never opened a terminal before
- **Language-agnostic core**: CLAUDE.md rules, skills, and CI templates must work for any language/stack
- **Headroom bundling**: headroom is Python/Rust — the pip installer can pull it as a dependency; the npm installer shells out to pip or documents the pip step clearly

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Apache 2.0 license | User requirement; adds explicit patent grant vs MIT | — Pending |
| Two delivery paths (fork + installer) | Meets users where they are: some know GitHub, some know npm/pip | — Pending |
| Headroom bundled via installer | Too heavy to copy into template (Python/Rust); installer can pip-install it | — Pending |
| Ponytail referenced not forked | Ponytail is a maintained plugin; reference keeps users on latest version | — Pending |
| caveman forked directly | Small skill file set, MIT-compatible, fits inside .claude/skills/ naturally | — Pending |
| Zero-config philosophy | New coders should not have to configure anything to get the benefits | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-25 after Phase 05 completion — upgrade command + template repo delivered*
