# Pitfalls Research: goodvibes

**Domain:** Single-command developer tool bootstrapper for LLM-assisted vibe coding
**Researched:** 2026-06-23
**Overall confidence:** HIGH (npm v12 critical finding verified via GitHub Changelog; CLAUDE.md pitfalls verified via multiple authoritative sources; cross-platform issues verified via official npm bug trackers)

---

## Critical Pitfalls (Ship-Blockers)

These will prevent goodvibes from working at all for a meaningful portion of users. Address in Phase 1–2.

---

### CRITICAL-1: npm v12 Blocks postinstall Scripts by Default (July 2026)

**What goes wrong:**
npm v12 (shipping July 2026, warnings already active in npm 11.16+) will block all `preinstall`, `install`, and `postinstall` lifecycle scripts from executing unless the user explicitly allowlists them. If goodvibes uses a postinstall script to install headroom (the Python/Rust binary), it will silently do nothing on npm v12 without any obvious error.

**Why it happens:**
This is a deliberate supply-chain security hardening by npm. Any package with a `postinstall` entry in package.json now requires the consuming project to run `npm approve-scripts` or add an `allowScripts` entry to their package.json. Beginners will not know to do this.

**Consequences:**
- `npx goodvibes init` completes with exit 0 but headroom is never installed
- User's project has no context compression — a silent, invisible failure
- Beginners have no way to diagnose what is missing
- npm v12 also blocks `--allow-git` and `--allow-remote` by default, breaking any dependency on git URLs or remote tarballs

**Warning signs:**
- Using `postinstall` in package.json to invoke `pip install` or download binaries
- Any dependency that uses `node-gyp rebuild` implicitly
- CI pipelines that start producing warnings about `allowScripts` with npm 11.16+

**Prevention:**
- Do NOT rely on `postinstall` for headroom installation. Make headroom installation a separate explicit step: `npx goodvibes init` should call headroom setup as part of its own runtime logic, not as a lifecycle hook.
- The init command itself downloads/installs headroom at runtime, making it visible and user-controllable.
- Ship pre-built binaries as platform-specific npm optionalDependencies (one package per OS/arch) so no build step is needed.
- Alternatively, distribute headroom as a standalone PyPI package and instruct users to `pip install headroom` separately, with the init command checking for it and printing a clear message if missing.

**Which phase:** Phase 1 (core installer design) — must be decided before any postinstall code is written.

**Source:** [GitHub Changelog: Upcoming breaking changes for npm v12](https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/), [npm v12 Migration Guide](https://npmv12guide.com/)

---

### CRITICAL-2: npx ENOENT / spawn Failures on Windows

**What goes wrong:**
`npx goodvibes` fails on Windows with `Error: spawn ENOENT` before any user-visible output appears. The user sees a cryptic Node.js error and gives up. This is the most common first-run failure mode for npx-based CLIs on Windows.

**Why it happens:**
Windows does not natively execute shell scripts. `npx` is itself a `.cmd` wrapper, not a binary. When another process spawns `npx` (e.g., from an IDE terminal, VS Code extension host, or a parent process), it may not use `cmd.exe` and therefore cannot find `npx.cmd`. Node's `child_process.spawn` does not invoke a shell by default — callers must pass `{shell: true}` on Windows. PATH on Windows is inherited differently from graphical process launches than from terminal sessions.

**Consequences:**
- Complete install failure on first run
- Error message references internal Node.js internals, not a user-readable message
- Beginner has no idea whether the tool, Node, or their machine is broken

**Warning signs:**
- Any `child_process.spawn('python', ...)` or `child_process.spawn('pip', ...)` without `{shell: true}` on Windows
- Hardcoded `python3` binary name (Windows uses `python`, not `python3`, by default)
- Using `/` as a path separator in any spawned command argument
- Paths containing spaces (e.g., `C:\Users\John Smith\`) not quoted

**Prevention:**
- Use `cross-spawn` npm package instead of raw `child_process.spawn` — handles `.cmd` extension lookup and shell invocation on Windows automatically.
- Never use `python3` — use `python` and verify version at runtime, or use the `py` launcher on Windows.
- Use `path.join()` and `path.resolve()` exclusively, never string concatenation for paths.
- Test on Windows via GitHub Actions `windows-latest` runner in CI from day 1.
- Ship a `.gitattributes` with `* text=auto` and `*.sh text eol=lf` to prevent CRLF contamination of any shell scripts.

**Which phase:** Phase 1 (CLI scaffolding foundation).

**Source:** [Fixing spawn npx ENOENT on Windows 11](https://fransiscuss.com/2025/04/22/fix-spawn-npx-enoent-windows11-mcp-server/), [cross-platform Node.js guide](https://alan.norbauer.com/articles/cross-platform-nodejs/)

---

### CRITICAL-3: Python Not Found / Wrong Python Version at Runtime

**What goes wrong:**
`goodvibes init` calls `pip install headroom` or invokes the headroom binary, which either silently uses Python 2 (on old systems), uses a system Python that conflicts with a venv, uses the wrong `pip` (global vs venv), or fails entirely because Python is not in PATH at all.

**Why it happens:**
Python environment management is the most fragmented part of the developer toolchain. Users may have:
- Python not installed (common on fresh Windows machines and macOS prior to Xcode CLI tools)
- Python 2 aliased to `python` (legacy Linux systems)
- System Python that requires sudo for global installs, but sudo breaks PATH
- Multiple Python versions via pyenv, conda, or Homebrew with conflicting shims
- PATH not updated after Python install (particularly common on Windows where the installer "Add Python to PATH" checkbox is unchecked by default)

**Consequences:**
- headroom silently installs to the wrong environment or fails with a pip error the user cannot interpret
- Even if installed, `headroom` binary is not on PATH (installed to `~/.local/bin` on Linux, which may not be in PATH on non-interactive shells)
- On Windows, `pip install --user` installs to `%APPDATA%\Python\PythonXY\Scripts`, which is almost never in PATH by default

**Warning signs:**
- Invoking `pip` or `python` without first validating they resolve to Python 3.8+
- Not checking that `headroom` binary is accessible after installation
- No fallback message with instructions if Python is absent

**Prevention:**
- At init time, probe for Python using a priority chain: `python3` → `python` → `py` (Windows launcher), then verify `sys.version_info >= (3, 8)`. Fail with a human-readable error and a link to python.org if absent.
- Recommend `pipx install headroom` over `pip install headroom` — pipx isolates the environment and always puts the binary on PATH.
- Consider distributing headroom as a pre-built binary via GitHub Releases and downloading directly during init (bypasses pip entirely for beginners).
- Print the exact PATH of the installed binary after installation so the user can verify it is accessible.

**Which phase:** Phase 2 (headroom integration).

**Source:** [Python packaging Python.org guide](https://packaging.python.org/guides/installing-using-pip-and-virtual-environments/), [Real Python: pipx guide](https://realpython.com/python-pipx/)

---

### CRITICAL-4: Silent Failures and Zero-Information Error Output

**What goes wrong:**
An error occurs during init (permissions, network timeout, missing dependency), the process exits with code 0, and the user's terminal shows either nothing or a generic JavaScript stack trace. The user assumes the tool worked.

**Why it happens:**
- Unhandled Promise rejections in Node.js do not always terminate the process in older Node versions
- `try/catch` blocks that log to stderr but still exit 0
- Subprocess errors (pip install failing) not propagated back to the parent process
- Network operations timing out silently

**Consequences:**
- User has a half-scaffolded project that looks complete
- CLAUDE.md is written but headroom is not installed, so context compression never activates
- GitHub Actions workflow is scaffolded but has a wrong GITHUB_TOKEN permission — CI silently fails on first push
- Beginner blames themselves, not the tool

**Warning signs:**
- Any `catch(e => console.error(e))` without `process.exit(1)`
- Missing exit codes in subprocess wrappers
- No end-to-end smoke test that verifies all created artifacts are present and valid

**Prevention:**
- Every error path must: (1) print a human-readable message explaining what failed and what to do, (2) exit with a non-zero code.
- Install a global unhandled rejection handler that catches async failures.
- After init completes, run a self-check that verifies each expected file exists and headroom is accessible. Print a clear summary: what succeeded, what was skipped, what failed.
- CI must test the full `npx goodvibes init` flow end-to-end, not just unit tests.

**Which phase:** Phase 1 (CLI foundations) and Phase 2 (headroom integration).

**Source:** [Error Handling in CLI Tools](https://medium.com/@czhoudev/error-handling-in-cli-tools-a-practical-pattern-thats-worked-for-me-6c658a9141a9), [Shopify CLI error handling principles](https://shopify.github.io/cli/cli/error_handling.html)

---

## Common Mistakes (Quality Issues)

These do not block the tool from working but will kill adoption or reputation.

---

### QUALITY-1: CLAUDE.md That Is Too Long and Gets Ignored

**What goes wrong:**
The shipped CLAUDE.md template is comprehensive and detailed — 150+ lines covering style rules, architecture notes, workflow commands, and persona instructions. Claude Code follows maybe 30% of it. Users report the tool "doesn't work as advertised."

**Why it happens:**
Claude Code's system prompt already consumes approximately 50 instructions. Research on frontier LLMs shows instruction-following degrades uniformly beyond ~150–200 total instructions. Context compaction in long sessions summarizes CLAUDE.md "into oblivion." Additionally, Anthropic wraps CLAUDE.md content with a reminder that says "this context may or may not be relevant" — giving the model explicit permission to ignore it.

Auto-generated CLAUDE.md files (produced by an LLM during init) perform worse than no file at all, reducing task success rates by 0.5–2% while increasing inference costs by over 20%.

**Anti-patterns to ship without:**
- `ALWAYS use functional components` / `NEVER use any` — absolute directives cause brittle behavior at exceptions
- Personality instructions like `You are a senior engineer. Think step by step.` — wastes instruction budget
- Restating ESLint/Prettier/tsconfig rules already enforced by tooling
- Task workflows and deployment checklists inside CLAUDE.md (use `.claude/skills/` instead)
- Any CLAUDE.md over 80 lines that covers everything at once

**Warning signs:**
- CLAUDE.md generated by an LLM without human curation
- More than 10 `ALWAYS`/`NEVER` directives
- Includes linter rules, formatter config, or type-system preferences

**Prevention:**
- Ship a minimal, opinionated CLAUDE.md template: build/test commands, directory layout, 3–5 architecture constraints, nothing else.
- Move task-specific instructions to `.claude/skills/` so they load only when relevant.
- Include a comment in the template: `# Keep this file under 80 lines. Prefer code-enforced rules over written rules.`
- Consider shipping pre-commit hooks or ESLint configs alongside CLAUDE.md to enforce rules mechanically — mechanical enforcement always beats written rules.

**Which phase:** Phase 1 (template authoring).

**Source:** [I Wrote 200 Lines of Rules for Claude Code. It Ignored Them All.](https://dev.to/minatoplanb/i-wrote-200-lines-of-rules-for-claude-code-it-ignored-them-all-4639), [10 CLAUDE.md Mistakes](https://www.termdock.com/en/blog/claude-md-common-mistakes), [Writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)

---

### QUALITY-2: npx Cold-Start Latency Kills First Impressions

**What goes wrong:**
`npx goodvibes init` takes 10–30 seconds before anything appears on screen. Beginners Ctrl-C thinking it has hung, or assume their internet is broken.

**Why it happens:**
npx downloads the package on first run, resolves dependencies, and in some versions cleans up the cache after execution. The download is blocking and produces no output. Any transitive dependency tree makes this worse. npm itself can take 3+ seconds even for cached packages in some versions.

**Prevention:**
- Keep the npm package's dependency tree extremely lean. Use only dependencies you cannot write yourself in <50 lines.
- Print something to stdout within the first 500ms of execution — even a version line or a spinner — so the user knows the process is alive.
- Consider publishing the package with a small bundle (use `esbuild` to bundle dependencies into a single JS file) to minimize resolution time.
- Document expected install time in the README so users know to wait.

**Which phase:** Phase 1 (package publishing setup).

---

### QUALITY-3: GitHub Template Repo: No Auto-Sync and Lost Commit History

**What goes wrong:**
Users create a repo from the goodvibes GitHub template. Six months later, goodvibes ships an important CLAUDE.md update. There is no way for existing users to get the update. Their `git log` shows only a single "Initial commit" with no lineage, so they cannot easily diff what changed.

**Why it happens:**
GitHub template repositories are explicitly designed to produce a clean, single-commit repo with no upstream tracking. This is a feature (clean history) but means there is no `git pull upstream` mechanism that users can run.

**Consequences:**
- The CLAUDE.md engineering rules become stale and fail to reflect the current goodvibes philosophy
- Users on old templates have different behaviors from new users, making support harder
- Any security fix to CI workflows does not reach existing projects

**Prevention:**
- Design the `npx goodvibes upgrade` (or `goodvibes sync`) command from day 1. It fetches the latest templates from the goodvibes GitHub repository and applies them, preserving user customizations.
- Use a versioned, self-describing format in CLAUDE.md (a `# goodvibes: v1.2.0` comment at the top) so the upgrade command can detect staleness.
- Consider the Copier/cookiecutter model: templates track an upstream version and can be re-applied with conflict resolution.
- Document that the template fork is a starting point, not a subscription, so users have correct expectations.

**Which phase:** Phase 3 (upgrade/sync command).

**Source:** [GitHub Docs: Creating a repository from a template](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template)

---

### QUALITY-4: Overwriting Existing Files Without Warning

**What goes wrong:**
A user runs `npx goodvibes init` in an existing project. The command silently overwrites their hand-edited CLAUDE.md, their existing `.github/workflows/ci.yml`, or their docs scaffold. They lose hours of work.

**Why it happens:**
Scaffolding tools default to "write everything" for simplicity. Many tools assume init is always run on an empty directory.

**Prevention:**
- Before writing any file, check if it exists. If it does, prompt: `CLAUDE.md already exists. Overwrite? [y/N]`
- Support a `--force` flag to skip prompts for automation.
- Detect a non-empty git repo and print a warning: `Running in existing repo. Only missing files will be created.`
- Write to `.goodvibes/` temp directory first, then move files with confirmation (so no partial writes on Ctrl-C).

**Which phase:** Phase 1 (CLI scaffolding logic).

**Source:** [Scaffold commands shouldn't overwrite existing files (Zapier)](https://github.com/zapier/zapier-platform/issues/17)

---

### QUALITY-5: Maturin/PyO3 Cross-Compilation Failures for headroom Rust Wheels

**What goes wrong:**
headroom (Python/Rust, bundled via installer) produces wheels that:
- Fail on Alpine Linux (uses musl, not glibc — PyPI wheels built for manylinux do not work)
- Fail on older Linux distros that predate manylinux_2_17 (glibc 2.17 is the minimum since Rust 1.64)
- Produce silently broken wheels on cross-compilation (Linux → Windows, or Linux → macOS) where EXT_SUFFIX is wrong
- Fail on Windows ARM64 or macOS ARM64 (M-series) if wheels are only built for x86_64

**Why it happens:**
Rust-based Python extensions are compiled C extensions tied to a specific Python ABI, OS, and CPU architecture. Cross-compilation with maturin has several documented bugs: PYO3_CROSS_PYTHON_VERSION is ignored, EXT_SUFFIX may be wrong, and macOS cross-compilation from Linux fails with `Py_ENABLE_SHARED is not defined`.

**Prevention:**
- Use `cibuildwheel` with maturin-action in CI to build wheels for all supported platforms in a matrix: linux x86_64, linux aarch64, windows x86_64, macOS x86_64, macOS arm64.
- Use manylinux_2_17 docker images for Linux builds (not cross-compilation) to ensure glibc compatibility.
- Build musl wheels separately using `musllinux_1_2` for Alpine users.
- Run wheel smoke tests on each target platform in CI before publishing to PyPI.
- Never cross-compile for production; always build natively on each target platform via GitHub Actions matrix.

**Which phase:** Phase 2 (headroom distribution CI).

**Source:** [maturin cross-compilation issue #613](https://github.com/PyO3/maturin/issues/613), [manylinux Rust build guide](https://michaelbommarito.com/wiki/programming/tools/manylinux-rust-builds/)

---

### QUALITY-6: GitHub Actions Workflow: Wrong Directory, Missing Permissions, Undefined Secrets

**What goes wrong:**
The scaffolded `.github/workflows/ci.yml` fails on first push with one of:
- `Error: .github/workflows/ci.yml: No such file or directory` (because the file was written to `.github/workflow/` without the `s`)
- `Resource not accessible by integration` (missing `permissions:` block for GITHUB_TOKEN)
- `Context access might be invalid: secrets.CODECOV_TOKEN` (secret referenced but not defined in repo settings)
- The workflow only runs on the user's feature branch and never runs on main (because they never pushed to main)

**Why it happens:**
GitHub Actions is silently strict: wrong directory = ignored without error; missing permissions = cryptic API error; undefined secrets = empty string (not an error). Beginners cannot distinguish "workflow not running" from "workflow not found."

**Prevention:**
- Validate the generated workflow file with a YAML linter (e.g., `js-yaml` in the CLI) before writing it.
- Default `permissions:` to the minimum needed, explicitly. Do not rely on repository defaults.
- Do not reference external secrets (Codecov, Snyk, etc.) in the default scaffolded workflow — use only `GITHUB_TOKEN` which is always available.
- Add a comment in the CI file: `# If this workflow doesn't appear in the Actions tab, check the directory is .github/workflows/ (with an 's')`
- In the init output, print: `GitHub Actions workflow written. Push to main to activate it.`

**Which phase:** Phase 3 (CI/CD scaffolding).

**Source:** [Common GitHub Actions Mistakes Beginners Make](https://docs.bswen.com/blog/2026-04-13-github-actions-common-mistakes/), [GitHub Actions Security Best Practices](https://blog.gitguardian.com/github-actions-security-cheat-sheet/)

---

### QUALITY-7: Apache 2.0 NOTICE File Omission When Forking MIT-Licensed Code

**What goes wrong:**
goodvibes (Apache 2.0) incorporates or forks MIT-licensed dependencies. This is legally clean (MIT is more permissive than Apache 2.0). However: if goodvibes forks any Apache 2.0-licensed code (e.g., from another Apache-licensed tool), the NOTICE file from the original must be preserved and updated in the derivative work. Omitting or overwriting it is a Section 4d violation.

The reverse is also a problem: if goodvibes's Apache 2.0 code is incorporated into an MIT project downstream, the MIT project must now also carry Apache 2.0 attribution. This is a friction point for contributions from MIT-ecosystem users.

**Prevention:**
- Audit all dependencies and forks for their license at project start. Keep a `THIRD_PARTY_LICENSES` file updated.
- If forking any Apache 2.0 code: preserve the original `NOTICE` file, add a statement of modifications, and include your copyright.
- Use `license-checker` or `FOSSA` in CI to continuously audit license compliance.
- Document clearly that goodvibes is Apache 2.0 and what that means for downstream forks — write this in CONTRIBUTING.md.

**Which phase:** Phase 1 (project scaffolding), ongoing.

**Source:** [Apache Software Foundation: Applying Apache License](https://www.apache.org/legal/apply-license.html), [FOSSA: Open Source Licenses 101](https://fossa.com/blog/open-source-licenses-101-apache-license-2-0/)

---

## Pitfalls Specific to Beginners

This section addresses failure modes that intermediate developers avoid instinctively but complete beginners reliably hit.

---

### BEGINNER-1: Information Overload on First Run Causes Abandonment

**What goes wrong:**
The init command prints 80 lines of output including file paths, version numbers, configuration summaries, and setup instructions. The beginner reads none of it and closes the terminal. They have no idea what to do next.

**Why it happens:**
Tool authors are experts who find all configuration details meaningful. Beginners need exactly one piece of information: "what do I type next?" Everything else is noise that triggers decision fatigue.

**Prevention:**
- Follow the "one next step" principle: end every run with a single, visually distinct call to action. Example: `All done. Run: claude` or `Next: open your project in your editor and ask Claude to help.`
- Use visual hierarchy in terminal output: a summary box or colored section at the end that stands alone.
- Hide verbose output behind `--verbose`. Default output should be 10 lines or fewer.
- Do not ask more than one question during init (if any). Every prompt that appears causes some percentage of beginners to stop.

**Source:** [Why developers never finish your onboarding](https://business.daily.dev/blog/why-developers-never-finish-your-onboarding-and-how-to-fix-it)

---

### BEGINNER-2: Prerequisite Errors With No Actionable Guidance

**What goes wrong:**
`goodvibes init` fails because Node 18 is required but the user has Node 16. The error: `SyntaxError: Unexpected token '?.'`. Or Python is not found and the error is `python: command not found` with no further help.

**Why it happens:**
Most CLIs check prerequisites by failing, not by proactively diagnosing. Error messages from the JS runtime or OS shell are not designed for beginners.

**Prevention:**
- At the very start of init, proactively check all prerequisites: Node version, Python presence, git version, internet connectivity (if downloads are needed).
- If any check fails, print a beginner-friendly message: `Python 3.8+ is required but not found. Install it from https://python.org/downloads/` with no other output. Do not proceed.
- If Node version is wrong: `You have Node 16.x. goodvibes requires Node 18+. Update at https://nodejs.org`
- Phrase all error messages as: what is wrong + what to do to fix it + one URL. Never just the what.

---

### BEGINNER-3: Docs Scaffold Is Empty and Provides No Guidance

**What goes wrong:**
goodvibes scaffolds a `docs/` directory with placeholder files. The beginner opens them, sees `# TODO: Write your docs here`, and has no idea what "docs" means for their project or why they need them.

**Why it happens:**
Tool authors assume users understand documentation conventions. Beginners do not know what a README "should" contain, what an architecture doc is, or why they would need a CHANGELOG.

**Prevention:**
- Scaffold docs with meaningful stub content, not TODO placeholders. A `docs/README.md` that explains what belongs in each section.
- Include one worked example in the CLAUDE.md: a sample prompt that uses the engineering rules effectively.
- Add a `docs/GETTING_STARTED.md` that explains the goodvibes workflow (write CLAUDE.md → ask Claude → Claude follows rules → commit).

---

### BEGINNER-4: git Is Not Initialized, Workflow Files Are Never Activated

**What goes wrong:**
The user runs `npx goodvibes init` in a folder that is not a git repository. The GitHub Actions workflows are written to `.github/workflows/`, but since there is no git repo, there is no GitHub remote, and the user never pushes the files. The CI never runs. The user does not understand the relationship between local files and GitHub.

**Prevention:**
- During init, check `git rev-parse --git-dir` to detect if a git repo exists.
- If not: offer to run `git init && git add . && git commit -m "chore: goodvibes init"` (with confirmation).
- Print explicit instructions: `To activate GitHub Actions: create a repo at github.com/new, then run: git remote add origin <url> && git push -u origin main`
- Do not assume git knowledge. Do not assume GitHub knowledge.

---

### BEGINNER-5: The "Caveman" and "goodvibes-hygiene" Skills Are Opaque

**What goes wrong:**
The beginner sees `.claude/skills/caveman.md` and `.claude/skills/goodvibes-hygiene.md` in their scaffolded project. They do not know what these are, how to use them, whether they are required, or what happens if they delete them.

**Why it happens:**
The skills system is a goodvibes-specific abstraction that has no analog in beginner developer experience. The names ("caveman", "ponytail") are opaque without context.

**Prevention:**
- Each skill file must contain a comment block at the top explaining: what this skill does, when Claude will use it, and how to invoke it if needed manually.
- The post-init output must mention skills explicitly: `Claude skills installed in .claude/skills/. These teach Claude how to compress context and maintain code hygiene automatically.`
- Consider renaming skills to self-descriptive names for beginners: `context-compressor.md`, `code-hygiene.md`. Keep internal skill IDs stable.

---

## Phase-Mapped Prevention Plan

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|---------------|------------|
| Phase 1: CLI foundations | npm package design | CRITICAL-1: postinstall blocked by npm v12 | Make headroom install explicit runtime logic, not a lifecycle hook |
| Phase 1: CLI foundations | Windows support | CRITICAL-2: ENOENT spawn failure | Use cross-spawn; test on windows-latest in CI from day 1 |
| Phase 1: CLI foundations | File writing | QUALITY-4: overwriting existing files | Check-before-write + `--force` flag + partial-write protection |
| Phase 1: CLI foundations | UX | BEGINNER-1: information overload | Max 10 lines default output; single "next step" call to action at end |
| Phase 1: CLI foundations | UX | BEGINNER-4: no git repo | Detect git absence; offer to init; print GitHub setup instructions |
| Phase 1: CLI foundations | UX | BEGINNER-2: prerequisite errors | Proactive prerequisite checks with human-readable remediation links |
| Phase 1: CLI foundations | Error handling | CRITICAL-4: silent failures | Exit non-zero on all errors; post-init self-check verification |
| Phase 1: CLI foundations | Licensing | QUALITY-7: Apache 2.0 NOTICE | Audit dependencies; add THIRD_PARTY_LICENSES; add license-checker to CI |
| Phase 1: Template authoring | CLAUDE.md content | QUALITY-1: rules file too long | Ship a <80-line, opinionated CLAUDE.md; supplement with code-enforced hooks |
| Phase 1: Template authoring | Skills UX | BEGINNER-5: opaque skill files | Add explanatory header comment to every skill file; mention in init output |
| Phase 1: Template authoring | Docs scaffold | BEGINNER-3: empty placeholder docs | Scaffold with meaningful stub content and one worked example |
| Phase 2: headroom integration | Python detection | CRITICAL-3: Python not found | Priority-chain Python probe; recommend pipx; fallback to direct binary download |
| Phase 2: headroom integration | Binary distribution | QUALITY-5: maturin/PyO3 wheel failures | cibuildwheel matrix for all platforms; native builds only (no cross-compilation) |
| Phase 2: headroom integration | npm v12 | CRITICAL-1 (continued) | Confirm no postinstall script; headroom called at CLI runtime only |
| Phase 3: CI/CD scaffolding | GitHub Actions | QUALITY-6: wrong directory/permissions | Validate YAML before writing; use only GITHUB_TOKEN; print "push to main to activate" |
| Phase 3: CI/CD scaffolding | Template drift | QUALITY-3: template repos don't auto-sync | Design `goodvibes upgrade` command from day 1; version-stamp templates |
| Phase 3: CI/CD scaffolding | UX | BEGINNER-4: git not initialized | Check for git remote; print explicit push instructions after CI scaffold |

---

## Sources

- [GitHub Changelog: Upcoming breaking changes for npm v12](https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/)
- [Preparing for npm v12: install scripts become opt-in](https://github.com/orgs/community/discussions/198547)
- [Fixing "spawn npx ENOENT" on Windows 11](https://fransiscuss.com/2025/04/22/fix-spawn-npx-enoent-windows11-mcp-server/)
- [Cross-Platform Node.js](https://alan.norbauer.com/articles/cross-platform-nodejs/)
- [I Wrote 200 Lines of Rules for Claude Code. It Ignored Them All.](https://dev.to/minatoplanb/i-wrote-200-lines-of-rules-for-claude-code-it-ignored-them-all-4639)
- [10 CLAUDE.md Mistakes That Hurt Your AI Agent](https://www.termdock.com/en/blog/claude-md-common-mistakes)
- [Writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [CLAUDE.md: Helpful or Just Expensive Noise?](https://thomas-wiegold.com/blog/claude-md-helpful-or-expensive-noise/)
- [Anthropic: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [maturin cross-compilation issue #613](https://github.com/PyO3/maturin/issues/613)
- [manylinux Rust/PyO3 build guide](https://michaelbommarito.com/wiki/programming/tools/manylinux-rust-builds/)
- [Common GitHub Actions Mistakes Beginners Make](https://docs.bswen.com/blog/2026-04-13-github-actions-common-mistakes/)
- [GitHub Actions Security Best Practices](https://blog.gitguardian.com/github-actions-security-cheat-sheet/)
- [Apache Software Foundation: Applying Apache License](https://www.apache.org/legal/apply-license.html)
- [FOSSA: Open Source Licenses 101 - Apache License 2.0](https://fossa.com/blog/open-source-licenses-101-apache-license-2-0/)
- [Scaffold commands should not overwrite existing files](https://github.com/zapier/zapier-platform/issues/17)
- [Python packaging: pip and venv](https://packaging.python.org/guides/installing-using-pip-and-virtual-environments/)
- [Real Python: pipx](https://realpython.com/python-pipx/)
- [Why developers never finish your onboarding](https://business.daily.dev/blog/why-developers-never-finish-your-onboarding-and-how-to-fix-it)
- [GitHub Docs: Creating a repository from a template](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template)
- [Shopify CLI: Error handling principles](https://shopify.github.io/cli/cli/error_handling.html)
- [npm v12 breaking changes explainer](https://byteiota.com/npm-v12-breaking-changes-what-breaks-in-july-2026/)
