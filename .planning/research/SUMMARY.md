# Research Summary: goodvibes

**Project:** goodvibes
**Domain:** Single-command developer bootstrapper for AI-assisted (vibe) coding
**Researched:** 2026-06-23
**Confidence:** HIGH

---

## Executive Summary

goodvibes is an open-source CLI that gives complete beginners a fully configured AI-coding environment in one command. The core value proposition is specific: it delivers both sides of the token economy (caveman for output compression, headroom for input compression) plus engineering discipline (CLAUDE.md rules, ponytail minimalism enforcement) and CI/CD scaffolding — all from a single `npx goodvibes init` or `goodvibes init`. No comparable tool as of June 2026 addresses this intersection. The closest alternatives (ClaudeForge, vibe-engineering, standalone headroom) require multiple manual steps and assume baseline developer knowledge goodvibes' target users don't have.

The recommended build approach mirrors create-next-app and create-hono: templates bundled as static files inside the CLI package, copied to the current working directory at runtime. A two-repo structure is required — `goodvibes` (CLI source, published to npm + PyPI) and `goodvibes-template` (GitHub template repo, purely deliverable files) — because a GitHub template repo copies its entire root, which is incompatible with having CLI source code at the same root. Both CLIs copy from identical `templates/` directories; the pip package syncs from the npm package's `templates/` at publish time. The product is written in TypeScript (npm CLI) and Python (pip CLI), using Commander.js, @clack/prompts, fs-extra, and execa on the Node side; Typer and stdlib shutil/pathlib on the Python side.

The most critical risk is npm v12 (shipping July 2026, warnings already active in npm 11.16+) which blocks all `postinstall` lifecycle scripts by default — this is a ship-blocker if headroom installation is implemented as a postinstall hook. Headroom must be installed as explicit runtime logic inside the `init` command itself, never a lifecycle hook. The second category of risk is the beginner UX trap: scaffolding tools that overwhelm users with output, overwrite existing files silently, or produce cryptic errors reliably drive beginners away on first use. Every error path must print plain-English remediation. Every successful run must end with a single clear "what to do next" instruction.

---

## Recommended Stack (prescriptive, specific versions)

### npm CLI

| Package | Version | Purpose |
|---|---|---|
| `commander` | ^13 | Argument parsing and subcommands |
| `@clack/prompts` | ^0.9 | Interactive wizard UX (~4 KB gzipped, ESM-native) |
| `fs-extra` | ^11 | Cross-platform file copy/write (no shell commands) |
| `execa` | ^9 | Subprocess calls (uv, pip, headroom) with Windows safety |
| `tsup` | ^8 | Build and bundle (outputs ESM + CJS from one config) |
| `typescript` | ^5.5 | Language |

**Why Commander not yargs:** Zero dependencies, ~18 ms cold start vs ~35 ms for yargs, git-style subcommands needed for future `goodvibes update`. **Why @clack/prompts not inquirer:** 4 KB vs inquirer's heavy footprint, TypeScript-native, ESM-first, built-in spinner and group primitives. **Why execa not child_process.spawn:** Windows PATHEXT and shebang handling built in; no shell injection risk.

### pip CLI

| Package | Version | Purpose |
|---|---|---|
| `typer` | ^0.15 | CLI framework (Click vendored since 0.26.0, MIT) |
| `rich` | ^14 | Terminal output (pulled in by typer[all]) |
| Python stdlib only | -- | File copy via `shutil` and `pathlib` |

**Python version minimum:** 3.10+ (driven by headroom-ai's hard requirement, not a choice).

**No templating engine needed.** goodvibes copies static files. `shutil.copytree(dirs_exist_ok=True)` + `pathlib.Path` is sufficient. No copier, no cookiecutter.

**Package manager for development:** uv. `uv tool install headroom-ai[all]` is the idiomatic 2025 install pattern and the preferred path in the init flow.

### Line endings and cross-platform safety

Ship all template files with LF. `.gitattributes` must enforce `text=auto eol=lf`. Never use shell commands (`cp`, `mkdir -p`, `rm -rf`) — use `fs-extra` (Node) and `shutil`/`pathlib` (Python) exclusively. Always use `path.join()` not string path concatenation.

---

## Key Architecture Decisions

### Two-repo structure (required, not optional)

- **`jgiox/goodvibes`** — CLI source repo, published to npm as `goodvibes` and to PyPI as `goodvibes`. Contains `src/` (TypeScript), `goodvibes/` (Python package), and `templates/` (canonical template files).
- **`jgiox/goodvibes-template`** — GitHub template repo. Contains only deliverable files (CLAUDE.md, `.claude/skills/`, `.github/workflows/`, `docs/`). Zero CLI machinery. Users click "Use This Template" and get a clean repo.

GitHub template repos copy their entire root to the new repo. Having TypeScript source, `package.json`, and `pyproject.toml` at the root alongside user-facing files produces a confusing fork experience. The two-repo model is the correct resolution — used by create-hono and confirmed by copier's own FAQ recommending "one template = one repo."

**Template sync:** `goodvibes/templates/` (in the CLI repo) is the canonical source of truth. A `sync-templates.yml` GitHub Actions workflow copies it to `jgiox/goodvibes-template` on every release. The pip package's `goodvibes/templates/` is auto-synced from `templates/` at publish time via a build step.

### CLI repo layout

```
goodvibes/                    (CLI repo root)
  bin/goodvibes.js            (npm bin entry)
  src/
    index.ts                  (Commander CLI entrypoint)
    init.ts                   (orchestrates init flow)
    copy.ts                   (fs-extra file copy)
    merge_claude_md.ts        (sentinel-based CLAUDE.md merge)
    headroom.ts               (uv/pip subprocess with graceful fallback)
    detect.ts                 (detects existing files, project type)
  templates/                  (bundled static files -- source of truth)
    CLAUDE.md
    .claude/skills/caveman/
    .claude/skills/goodvibes-hygiene/
    .github/workflows/
    docs/
    CONTRIBUTING.md  SECURITY.md  JOURNAL.md  CHANGELOG.md
  goodvibes/                  (Python package)
    cli.py  init.py  copy.py  merge_claude_md.py  headroom.py
    templates/                (auto-copied from ../templates/ at pip publish)
  tests/
  package.json
  pyproject.toml
  .github/workflows/
    publish-npm.yml  publish-pip.yml  sync-templates.yml
```

### CLAUDE.md merge strategy: sentinel-based

Three scenarios the CLI handles:

1. No CLAUDE.md exists: copy bundled file directly.
2. CLAUDE.md exists, no goodvibes markers: prepend the goodvibes block (delimited by `<!-- goodvibes:start -->` / `<!-- goodvibes:end -->`), preserve user content below.
3. CLAUDE.md exists with goodvibes markers: replace the sentinel-delimited block with fresh content; preserve everything outside.

This is the same pattern as husky and lint-staged config injection. It is simple, deterministic, and reversible. CLAUDE.md content is static text — no Jinja/Handlebars variables.

### Headroom integration

**npm CLI:** Runtime subprocess after file copy. Priority chain: detect `uv` on PATH -> `uv tool install "headroom-ai[all]"`, else fall back to `pip install --user "headroom-ai[all]"`. Then run `headroom mcp install` (writes to `~/.claude/` MCP config). If Python 3.10+ is absent: print one-line manual step, update CLAUDE.md Setup section, continue with exit 0.

**pip CLI:** Declare `headroom-ai[mcp]` as a `[project.dependencies]` entry — installs automatically. Run `headroom mcp install` via subprocess post-copy.

`headroom mcp install` is a one-time user-level operation, not per-project. The init command must not re-run it on subsequent invocations.

---

## Table Stakes Features (must ship in v1)

These are features users expect from any scaffolding tool. Missing one makes goodvibes feel broken.

1. **Single-command invocation** — `npx goodvibes init` and `goodvibes init` both work without pre-install steps beyond the runtime; no root/admin required on macOS, Linux, and WSL2.
2. **Immediate visible progress** — output within 100 ms; spinner with named step labels for anything over 500 ms; step count ("Step 2 of 4") to prevent abandonment during the 15-30 second headroom install.
3. **Files placed where expected** — writes into current working directory with no surprise subdirectories; lists every file created at end of init.
4. **Clear post-install "what now" message** — visually distinct summary block under 24 lines; maximum 3 "next steps"; link to docs for everything else.
5. **Non-destructive with explicit overwrite prompt** — check-before-write for every file; default to NO on overwrite; `--force` flag for CI and re-init scenarios.
6. **Works in existing projects** — detects project type via file sniffing (`package.json`, `pyproject.toml`); appends to `.gitignore` rather than replacing; does not reinitialize git.
7. **Readable error messages with fixes** — every error path prints: what failed + what to do + one URL; exit non-zero on all failures.
8. **Useful `--help`** — one-line description per option; at least two examples; no jargon.

---

## Differentiators (what makes goodvibes unique)

These features constitute the product's reason to exist over cloning a template.

1. **Both sides of token compression bundled** — caveman (output, ~65% reduction) + headroom (input, 60-95% reduction) installed and configured in one command. No other bootstrap tool addresses both sides of the token economy.
2. **AI-agent-aware CLAUDE.md as primary artifact** — battle-tested baseline engineering rules (plan-before-code, commit conventions, token-efficient patterns) before the user's first LLM session. ClaudeForge does this but requires Claude Code already running; goodvibes does it before the first session.
3. **Code minimalism enforcement (ponytail)** — "lazy senior dev" decision ladder installed as a skill; reduces generated code by 54-94%. Beginners reliably get over-engineered LLM output; this encodes minimalism as a default behavior, not a user skill to develop.
4. **CI/CD from day one** — scaffolds `.github/workflows/ci.yml` that works out of the box for detected project type. Beginners push broken code to main repeatedly; goodvibes installs the guard rail automatically.
5. **Living docs scaffold wired into CLAUDE.md** — `docs/` directory with `ARCHITECTURE.md`, `DECISIONS.md`, `ONBOARDING.md` stubs; CLAUDE.md references them so Claude updates them as the project grows. Solves the session amnesia problem.
6. **GitHub template as zero-install entry point** — two acquisition paths: code-path (`npx`/`pip`) and click-path (GitHub "Use This Template"). The click-path meets complete beginners who don't know what npm is.

**Features explicitly deferred to v2+:**
- `goodvibes update` / `goodvibes sync` command (re-sync templates to latest version)
- Project-type detection that customizes CI workflow beyond Node/Python
- CLAUDE.md customization wizard
- Telemetry or usage analytics
- Windows native (non-WSL) PowerShell support

---

## Critical Pitfalls to Avoid

### CRITICAL-1: npm v12 postinstall blocker (ship-stopper)

npm v12 (July 2026, warnings already active in npm 11.16+) blocks all `preinstall`/`install`/`postinstall` lifecycle scripts by default. Any headroom installation placed in a postinstall hook will silently do nothing on npm v12 without a user-visible error. Beginners have no recovery path.

**Mitigation:** headroom installation must be explicit runtime logic inside the `init` command itself, never a lifecycle hook. This is the design constraint that makes `npx goodvibes init` the single intentional trigger for everything.

### CRITICAL-2: Windows cross-spawn requirement

`npx goodvibes` fails on Windows with `spawn ENOENT` if the CLI uses raw `child_process.spawn` without shell handling. Windows does not natively execute shell scripts; `.cmd` wrapper lookup requires shell invocation that Node does not enable by default.

**Mitigation:** Use the `cross-spawn` npm package for all subprocess calls, or use `execa` (which handles this internally). Never hardcode `python3` — Windows uses `python`. Use `path.join()` exclusively. Test on `windows-latest` GitHub Actions runner from day one.

### CRITICAL-3: Python detection must handle fragmented environments

Users may have Python 2 aliased to `python`, system Python requiring sudo, pyenv/conda shims that intercept calls, or PATH not updated after install. headroom silently installs to the wrong environment or the binary lands in a directory not on PATH.

**Mitigation:** Priority chain at runtime: probe `python3` -> `python` -> `py` (Windows launcher), verify `sys.version_info >= (3, 10)`. Recommend `pipx install headroom-ai` over `pip install` for PATH reliability. Print the exact path of the installed binary. If Python is absent: skip headroom gracefully and print the manual install step — never fail the entire init.

### CLAUDE.md 80-line hard limit

CLAUDE.md files over 80-100 lines cause Claude to follow fewer instructions, not more. Claude Code's system prompt already consumes ~50 instruction slots. Context compaction summarizes CLAUDE.md "into oblivion" in long sessions. Auto-generated CLAUDE.md files (produced by LLMs) perform worse than no file at all.

**Mitigation:** Ship a hand-curated, opinionated CLAUDE.md under 80 lines. No more than 10 ALWAYS/NEVER directives. No linter rules, formatter config, or personality instructions. Move task-specific rules to `.claude/skills/` so they load only when relevant. Include the comment: `# Keep this file under 80 lines. Prefer code-enforced rules over written rules.`

### Silent failure / partial success

Any `catch` block that logs to stderr but exits 0 produces a half-scaffolded project that looks complete. Beginners blame themselves, not the tool.

**Mitigation:** Every error path exits non-zero. Install a global unhandled rejection handler. After init, run a self-check that verifies each expected file exists and headroom is accessible. Print an explicit status summary: what installed, what was skipped, what failed — with reasons.

### Overwriting existing files without warning

Running `goodvibes init` in an existing project must not silently clobber hand-edited CLAUDE.md or existing CI workflows.

**Mitigation:** Check-before-write for every file. Default overwrite prompt to NO. Detect non-empty git repo and print a warning: "Running in existing repo. Only missing files will be created." Support `--force` for CI/re-init.

---

## Recommended Phase Order

Derived from dependency analysis across all 4 researchers. Architecture research and features research converge on this ordering.

### Phase 1: Template content + project scaffolding

**Rationale:** The templates are the product. The CLI is a delivery vehicle. Content must exist and be manually testable before any CLI is built. This is also when the npm v12 architecture decision, cross-platform constraints, CLAUDE.md size limit, and file-overwrite protection must be locked in.

**Delivers:**
- Finalized `CLAUDE.md` (under 80 lines, sentinel-delimited goodvibes block)
- `.claude/skills/caveman/` (fork of juliusbrussee/caveman, Apache 2.0 verified)
- `.claude/skills/goodvibes-hygiene/` (ponytail wrapper skill)
- `docs/` scaffold with meaningful stub content (not TODO placeholders)
- License audit and `THIRD_PARTY_LICENSES` file
- Project repo structure: `goodvibes` CLI repo + `goodvibes-template` repo created

**Avoids:** QUALITY-1 (CLAUDE.md too long), BEGINNER-3 (empty placeholder docs), BEGINNER-5 (opaque skill files), QUALITY-7 (Apache 2.0 NOTICE omission)

**Gate:** Template files manually testable — copy to a fresh project, open with Claude Code, verify CLAUDE.md rules are followed and skills activate.

### Phase 2: npm CLI (`npx goodvibes init`)

**Rationale:** npm is the highest-reach delivery path for a vibe coding audience. Building npm before pip validates the copy logic, merge logic, and headroom subprocess pattern before porting to Python. npm v12 postinstall blocker must be addressed here.

**Delivers:**
- `bin/goodvibes.js` entry point
- `src/copy.ts` (fs-extra template copy to cwd)
- `src/merge_claude_md.ts` (sentinel-based CLAUDE.md merge, all 3 scenarios)
- `src/headroom.ts` (uv/pip subprocess with graceful fallback + Python detection priority chain)
- `src/detect.ts` (project type detection, existing file detection, git repo detection)
- `src/init.ts` (orchestration with @clack/prompts spinner steps)
- Published to npm as `goodvibes`
- Exit non-zero on all error paths; post-init self-check

**Stack:** Commander ^13, @clack/prompts ^0.9, fs-extra ^11, execa ^9, tsup ^8, TypeScript ^5.5

**Avoids:** CRITICAL-1 (postinstall), CRITICAL-2 (Windows spawn), CRITICAL-3 (Python detection), CRITICAL-4 (silent failure), QUALITY-4 (overwriting files), BEGINNER-1 (info overload), BEGINNER-4 (no git init)

**Gate:** `npx goodvibes init` in an empty directory produces all expected files. Merges correctly with existing CLAUDE.md. Passes on macOS, Linux, and Windows CI.

### Phase 3: pip CLI (`goodvibes init`)

**Rationale:** Mirrors Phase 2 in Python. Builds on the same `templates/` source. headroom's dependency on Python 3.10+ makes the pip CLI the natural home for headroom as a declared dependency.

**Delivers:**
- `goodvibes/cli.py` (Typer entry point)
- `goodvibes/copy.py` (importlib.resources + shutil.copytree)
- `goodvibes/merge_claude_md.py` (port of TypeScript sentinel logic)
- `goodvibes/headroom.py` (headroom-ai[mcp] as declared dependency + `headroom mcp install` subprocess)
- `pyproject.toml` with `[tool.setuptools.package-data]` for templates
- `sync-templates.yml` GitHub Actions workflow
- Published to PyPI as `goodvibes`
- cibuildwheel matrix for headroom Rust wheel platform coverage

**Stack:** Typer ^0.15, Rich ^14, Python stdlib shutil/pathlib, Python 3.10+

**Avoids:** QUALITY-5 (maturin/PyO3 cross-compilation — native builds only via matrix)

**Gate:** `pip install goodvibes && goodvibes init` produces identical result to npm CLI. Wheels available for all major platforms.

### Phase 4: GitHub Actions CI/CD scaffolding

**Rationale:** The scaffolded CI workflow must work out of the box without any user configuration. Generating a workflow that fails on first push breaks trust with beginners immediately. This phase requires the validated project-type detection from Phase 2.

**Delivers:**
- `.github/workflows/ci.yml` generated per detected project type (Node or Python)
- Only `GITHUB_TOKEN` used — no external secrets referenced
- YAML validated by `js-yaml` before written to disk
- `security.yml`, `dependency-review.yml`, ISSUE_TEMPLATE, PULL_REQUEST_TEMPLATE, `dependabot.yml`
- Post-init message: "GitHub Actions workflow written. Push to main to activate."

**Avoids:** QUALITY-6 (wrong directory, missing permissions, undefined secrets), BEGINNER-4 (git not initialized)

**Gate:** Scaffolded CI workflow passes on first push for both Node and Python projects with no user modifications.

### Phase 5: GitHub template repo (`goodvibes-template`)

**Rationale:** The template repo promotes validated content from Phases 1-4. Publishing it before CLIs are tested risks beginners forking a repo with broken or unvalidated content.

**Delivers:**
- `jgiox/goodvibes-template` repo marked as GitHub template
- README with "Use This Template" as hero action
- All validated deliverable files from `templates/`
- CLAUDE.md "Getting Started" section explaining manual headroom install step
- Template badge and links to `npx goodvibes init` for full experience

**Gate:** User forks template, opens CLAUDE.md in Claude Code, Claude follows rules. README hero path is clear.

### Phase ordering rationale

1. **Content before delivery** — templates must be validated before either CLI can copy them. Phase 1 is always first.
2. **npm before pip** — npm is higher reach; testing copy/merge/headroom in TypeScript before porting to Python catches design flaws once, not twice.
3. **CI scaffold requires project-type detection** — depends on detection module built in Phase 2. Phase 4 cannot start until Phase 2 is done.
4. **Template repo is a promotion artifact** — must reflect tested, validated content. Phase 5 is always last.

Phases 3 and 4 can be parallelized if two developers are available.

### Research flags

**Phases needing deeper research during planning:**
- **Phase 2 (headroom subprocess):** `uv tool install headroom-ai[all]` first-run behavior — ONNX model download size and latency not benchmarked. Needs testing before UX copy (spinner messaging, timeout thresholds) is finalized.
- **Phase 2 (Windows Python detection):** Windows `python` command may open Microsoft Store on Windows 11 without Python installed. Needs explicit Windows CI testing early in Phase 2.
- **Phase 3 (headroom Rust wheels):** cibuildwheel + maturin-action matrix is the prescribed approach but wheel smoke tests need explicit validation. Alpine (musl) wheel coverage needs a decision.

**Phases with standard patterns (research not needed):**
- **Phase 1 (template content):** Authoring static Markdown and YAML files.
- **Phase 2 (Commander/fs-extra/execa):** All three documented to HIGH confidence with official sources.
- **Phase 5 (GitHub template repo):** Fully documented; no unknowns.

---

## Open Questions for Planning

Unresolved decisions that must be answered before the relevant phase begins.

1. **Headroom first-run latency:** How long does `uv tool install headroom-ai[all]` take on a cold cache, including ONNX model download? If over 30 seconds, spinner UX needs "this may take a minute" copy and `--skip-headroom` becomes more prominent.

2. **Windows `python` command behavior:** On Windows 11 without Python installed, `python` may open the Microsoft Store instead of printing an error. Does `execa('python', ['--version'])` throw or hang in this scenario? The Python detection chain must handle this explicitly.

3. **`headroom mcp install` idempotency:** Does running `headroom mcp install` twice on the same machine corrupt the MCP config or gracefully skip? Must be confirmed before Phase 2's headroom.ts implementation.

4. **Template sync mechanism:** The pip package needs access to `templates/`. Options: (a) copy at pip publish time via build step — recommended; (b) symlink during development — breaks on Windows; (c) git subtree from goodvibes-template. The exact build step mechanism in `pyproject.toml` or a pre-publish script needs specifying.

5. **caveman license verification:** caveman (juliusbrussee/caveman) must be confirmed Apache 2.0 compatible before bundling. If it carries GPL or LGPL, the distribution model changes. Hard gate for Phase 1.

6. **Template versioning for `goodvibes update`:** The `goodvibes update` command is v2, but the sentinel-based CLAUDE.md merge and versioning in Phase 1 must be forward-compatible. Decide in Phase 1 whether to add `# goodvibes: v1.0.0` comment to the CLAUDE.md template.

7. **Alpine Linux / musl wheel support:** Does goodvibes target Alpine? If yes, Phase 3 must include musl wheel builds. Common in Docker-based dev environments. Needs an explicit yes/no decision.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (npm) | HIGH | Commander, @clack/prompts, fs-extra, execa, tsup all verified against official sources and npmjs.com metadata |
| Stack (pip) | HIGH | Typer, uv, shutil/pathlib verified; Python 3.10+ minimum confirmed by headroom-ai PyPI metadata |
| Stack (headroom bundling) | MEDIUM | uv tool install pattern verified in uv docs; headroom-ai Apache 2.0 confirmed; first-run behavior and ONNX download size not benchmarked |
| Features | HIGH | Table stakes from clig.dev and create-next-app patterns; differentiators verified against live tools (caveman GitHub stars, ponytail stats, headroom docs) |
| Architecture | HIGH (core), MEDIUM (headroom integration specifics) | Two-repo pattern confirmed by copier FAQ and create-hono precedent; sentinel merge confirmed by husky/lint-staged pattern; headroom MCP install idempotency not confirmed |
| Pitfalls | HIGH | npm v12 postinstall blocker verified via GitHub Changelog; CLAUDE.md 80-line limit from multiple independent sources including Anthropic engineering blog; Windows spawn issue verified via npm bug trackers |

**Overall confidence:** HIGH — all critical architectural decisions have high-confidence backing. The two MEDIUM areas (headroom first-run behavior, Windows Python detection) are implementation details resolvable with targeted testing in Phase 2, not architecture questions that would change the phase structure.

### Gaps to address

- **headroom first-run latency:** Benchmark in Phase 2 before writing spinner copy. If over 60 seconds, offer `--skip-headroom` as a prominently documented flag.
- **Windows Python detection edge case:** Write an explicit test for the Microsoft Store redirect behavior early in Phase 2. May require detecting the Store redirect and treating it as "Python not found."
- **caveman license:** Confirm Apache 2.0 compatibility in Phase 1 before any bundling work begins. Check the upstream repo's LICENSE file and any NOTICE file.
- **Template versioning for future `goodvibes update`:** Decide in Phase 1 whether to add `# goodvibes: v1.0.0` comment to CLAUDE.md template. Changing this later requires a migration.

---

## Sources

### Primary (HIGH confidence)
- [Commander vs Yargs 2026 — PkgPulse](https://www.pkgpulse.com/guides/commander-vs-yargs-2026)
- [@clack/prompts — The Modern Alternative to Inquirer.js](https://dev.to/chengyixu/clackprompts-the-modern-alternative-to-inquirerjs-1ohb)
- [uv tools documentation — astral.sh](https://docs.astral.sh/uv/guides/tools/)
- [headroom — GitHub](https://github.com/chopratejas/headroom) / [headroom-ai — PyPI](https://pypi.org/project/headroom-ai/)
- [headroom MCP docs](https://headroom-docs.vercel.app/docs/mcp)
- [npm v12 blocking postinstall — GitHub Changelog](https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/)
- [GitHub Docs: Creating a template repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository)
- [copier FAQ: one template = one repo](https://copier.readthedocs.io/en/stable/faq/)
- [npm CLI template bundling pattern — Peter Mekhaeil](https://www.petermekhaeil.com/how-to-build-an-npx-starter-template/)
- [Python importlib.resources — setuptools docs](https://setuptools.pypa.io/en/latest/userguide/datafiles.html)
- [clig.dev — Command Line Interface Guidelines](https://clig.dev/)
- [Writing a good CLAUDE.md — HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [I Wrote 200 Lines of Rules for Claude Code. It Ignored Them All.](https://dev.to/minatoplanb/i-wrote-200-lines-of-rules-for-claude-code-it-ignored-them-all-4639)
- [Best practices for Claude Code — Anthropic](https://code.claude.com/docs/en/best-practices)
- [Effective context engineering for AI agents — Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Typer — PyPI](https://pypi.org/project/typer/)
- [execa — GitHub (sindresorhus)](https://github.com/sindresorhus/execa)

### Secondary (MEDIUM confidence)
- [Fixing spawn npx ENOENT on Windows 11](https://fransiscuss.com/2025/04/22/fix-spawn-npx-enoent-windows11-mcp-server/)
- [10 CLAUDE.md Mistakes](https://www.termdock.com/en/blog/claude-md-common-mistakes)
- [Common GitHub Actions Mistakes Beginners Make](https://docs.bswen.com/blog/2026-04-13-github-actions-common-mistakes/)
- [maturin cross-compilation issue #613](https://github.com/PyO3/maturin/issues/613)
- [Real Python: pipx guide](https://realpython.com/python-pipx/)
- [Python package managers: uv vs pixi? — Jacob Tomlinson](https://jacobtomlinson.dev/posts/2025/python-package-managers-uv-vs-pixi/)
- [ponytail — Minimalism Plugin for AI Agents](https://www.everydev.ai/tools/ponytail)
- [Building with LLMs at Scale: The Pain Points — DEV Community](https://dev.to/laurent_charignon/building-with-llms-at-scale-part-1-the-pain-points-3c0o)
- [create-hono CLI structure — Context7](https://context7.com/honojs/create-hono/llms.txt)

---

*Research completed: 2026-06-23*
*Ready for roadmap: yes*
