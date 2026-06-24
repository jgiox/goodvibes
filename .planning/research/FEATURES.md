# Features Research: goodvibes

**Domain:** Developer bootstrapping / scaffolding CLI for AI-assisted (vibe) coding
**Researched:** 2026-06-23
**Overall confidence:** HIGH (tool landscape), HIGH (UX patterns), MEDIUM (AI-agent-specific setup space)

---

## Table Stakes (Must Have)

These are features users expect from any scaffolding tool. Missing one makes the product feel broken or untrustworthy.

### 1. Single-command invocation that actually works

**Why expected:** Every respected scaffolding tool (create-next-app, copier, degit, cookiecutter) delivers its core value from one command with no prerequisite steps beyond having the runtime installed. Beginners will not debug a two-step install.

**What this means for goodvibes:**
- `npx goodvibes init` — zero pre-install required, downloads and runs
- `goodvibes init` — works immediately after `pip install goodvibes`
- Both must succeed without root/admin on macOS, Linux, and Windows (WSL2 included)

**Anti-failure:** Provide a clear pre-check at the top of `init`: detect Node, Python, git. Report any missing prerequisites with a plain-English fix instruction before touching the filesystem.

### 2. Immediate visible progress

**Why expected:** The CLI UX canon (clig.dev, Lucas Costa's patterns article) is unanimous: output something meaningful within 100ms, show a spinner for anything over 500ms, never go silent for more than 2 seconds. Beginners will Ctrl-C if nothing appears to be happening.

**What this means for goodvibes:**
- `@clack/prompts` spinner wrapping each phase: copying files, installing headroom, configuring CI
- Named steps ("Installing headroom..." / "Writing CLAUDE.md..." / "Creating GitHub Actions...") so users know where they are
- Step count display ("Step 2 of 4") to prevent abandonment during slower phases (headroom install can take 15-30 seconds on first run)

### 3. Files actually placed where expected

**Why expected:** Scaffolding tools that drop files somewhere unexpected (wrong directory, buried under extra folder) are the most common complaint. create-next-app creates its own subdirectory; degit dumps into the current directory. The user's mental model must match the tool's behavior.

**What this means for goodvibes:**
- By default, write into the current working directory (user runs `npx goodvibes init` inside their project folder)
- No surprise subdirectories
- List every file written at the end of init: "Created: CLAUDE.md, .claude/skills/caveman/SKILL.md, .github/workflows/ci.yml, docs/README.md"
- Ask before overwriting any existing file — never silently clobber

### 4. Clear post-install "what now" message

**Why expected:** create-next-app, create-react-app, and npm init all conclude with a brief "next steps" block. Beginners have no mental model of what the tool just did; they need a map. clig.dev explicitly calls this "reduce time to value."

**What this means for goodvibes:**
```
 goodvibes init complete

 What was installed:
   CLAUDE.md              — Engineering rules for Claude Code
   .claude/skills/        — caveman (output compression) + ponytail (minimalism)
   .github/workflows/     — CI/CD pipeline
   docs/                  — Project documentation scaffold

 What to do next:
   1. Open CLAUDE.md and read it — Claude will use this every session
   2. Run: claude (or start your Claude Code session)
   3. Try: /caveman to see token compression in action

 Docs: https://github.com/jgiox/goodvibes
```

This block must be visually distinct (color + box), brief (fits one terminal screen), and copy-pasteable.

### 5. Non-destructive — ask before overwriting

**Why expected:** Beginners are scared of losing their work. Any tool that silently overwrites is dead on first use in an existing project. Copier and cookiecutter both have explicit conflict-resolution strategies. degit warns about existing directories.

**What this means for goodvibes:**
- Before each file write: check if it exists
- If it exists: ask "CLAUDE.md already exists. Overwrite? (y/N)" — default to NO
- Offer a `--force` flag for power users running in CI or re-init scenarios
- If the user says N for a file, skip it cleanly and list it in the "skipped" section of the summary

### 6. Works in an existing project (not just greenfield)

**Why expected:** The primary goodvibes use case is adding AI discipline to an already-started project. create-next-app only creates new projects; goodvibes must work in an existing directory. This is a key differentiator from most scaffolding tools that assume a blank directory.

**What this means for goodvibes:**
- `init` detects existing project type (Node/Python/other) via file sniffing (`package.json`, `pyproject.toml`, etc.)
- Writes files into current directory, merges where appropriate (e.g., appends to `.gitignore` rather than replacing it)
- Does NOT try to create a new project or reinitialize git

### 7. Readable error messages with fixes

**Why expected:** This is the single most differentiating factor in beginner-tool success, per clig.dev and npm's design philosophy. Cryptic Python tracebacks or Node stack traces tell beginners nothing actionable.

**What this means for goodvibes:**
- Wrap all subprocess calls (pip install, uv, git) in try/catch, translate failures into plain English
- Bad: `Error: ENOENT: no such file or directory, open '/usr/local/lib/node_modules/goodvibes/templates/CLAUDE.md'`
- Good: `Could not find goodvibes template files. Try reinstalling: npm install -g goodvibes@latest`
- Always end error messages with a suggested action or a URL

### 8. --help that actually helps

**Why expected:** Users hit `--help` immediately after installation. This is the first documentation most beginners will read.

**What this means for goodvibes:**
```
goodvibes init [options]

Bootstrap your project with AI engineering discipline.

Options:
  --skip-headroom    Skip headroom (input compression) installation
  --skip-ci          Skip GitHub Actions CI workflow generation
  --skip-docs        Skip docs/ scaffold generation
  --force            Overwrite existing files without prompting
  -h, --help         Display this message

Examples:
  npx goodvibes init
  goodvibes init --skip-headroom
```

No jargon. One-line description per option. At least two examples.

---

## Differentiators (What Makes goodvibes Special)

These features are not expected by users of generic scaffolding tools. They are goodvibes' specific value proposition and what justifies its existence over just cloning a template.

### 1. AI-agent-aware engineering rules (CLAUDE.md)

**What it is:** A pre-written CLAUDE.md that encodes LLM session discipline: preventing context drift, requiring plan-before-code, specifying token-efficient communication patterns, defining commit conventions, and setting code quality expectations.

**Why it differentiates:** No other one-command tool in the ecosystem (as of June 2026) ships a thoughtfully authored CLAUDE.md as the primary artifact. ClaudeForge generates CLAUDE.md from existing code analysis, but requires Claude Code already be installed and running. goodvibes ships a battle-tested baseline before the user's first session.

**Design principle:** The CLAUDE.md must be minimal and readable. The ClaudeForge hard cap of 150 lines is evidence-backed — bloated CLAUDE.md files cause Claude to ignore them. Ship ~80-100 lines covering only: project conventions, token rules, commit format, and the plan-first mandate.

### 2. Output token compression bundled at install (caveman)

**What it is:** The caveman skill (fork of juliusbrussee/caveman) auto-activates in Claude Code sessions and reduces output tokens by ~65% by making Claude respond in compressed, caveman-style prose — full technical accuracy, stripped of filler.

**Why it differentiates:** This is the unique combination. No other scaffolding tool addresses the cost problem of AI-assisted development. Beginners don't know they're burning tokens; they find out when their bill arrives. goodvibes installs the fix before the first session.

**Implementation note:** caveman activates automatically in Claude Code — no per-session invocation needed. This is a zero-friction addition that works invisibly.

### 3. Input token compression (headroom) installed and configured

**What it is:** headroom compresses tool outputs, logs, and RAG chunks before they reach the LLM — 60-95% fewer input tokens, same answer quality. goodvibes runs `uv tool install headroom-ai` and configures Claude Code to route through headroom's local proxy.

**Why it differentiates:** Combined with caveman (output) + headroom (input), goodvibes delivers what no other bootstrap tool offers: both sides of the token economy solved in one init command. The practical effect is 50-80% cost reduction on a typical vibe coding session.

**Interaction with Table Stakes:** headroom installation may fail (Python not found, network error). goodvibes MUST handle this gracefully — install what succeeds, report what failed, and update CLAUDE.md with a note about manual headroom setup if the automated install didn't work.

### 4. Code minimalism enforcement (ponytail)

**What it is:** The ponytail Claude Code plugin installs a "lazy senior dev" decision ladder — before generating code, Claude is forced to consider YAGNI, stdlib use, and minimal solutions. Reduces generated code by 54% on average (up to 94% where over-building would otherwise occur).

**Why it differentiates:** Beginners with LLMs consistently get over-engineered code. They don't know how to prompt for minimalism. ponytail encodes this as a default behavior, not a skill the user must develop.

**Evidence base:** ponytail has 48K+ GitHub stars and is actively maintained (DietrichGebert). Its `/ponytail-debt` command for tracking technical debt is a unique feature no other tool bundles.

### 5. GitHub Actions CI from day one

**What it is:** goodvibes generates `.github/workflows/ci.yml` covering: lint, test, and build on push/PR. Beginner-safe — the workflow runs without any configuration beyond what the user's package.json or pyproject.toml already provides.

**Why it differentiates:** CI is the first thing expert developers set up and the last thing beginners think about. A vibe coder pushing broken code to main repeatedly is the most common "vibe coding goes wrong" story. goodvibes installs the guard rails automatically.

**Design principle:** The generated workflow must work out of the box for the detected project type (Node or Python). It should NOT generate a workflow that immediately fails — the scaffold should detect what test/lint commands exist before writing them in.

### 6. Docs scaffold that Claude will actually use

**What it is:** A `docs/` directory with stub files: `ARCHITECTURE.md`, `DECISIONS.md`, `ONBOARDING.md`. These are CLAUDE.md-referenced so Claude Code knows to update them as the project grows.

**Why it differentiates:** Context decay ("the session amnesia problem") is the #1 reported pain point for LLM-assisted development. Providing and wiring Claude to use a living docs structure is a unique solve. Most scaffolding tools generate a blank README — goodvibes generates a structured knowledge base.

**Evidence base:** The CLAUDE.md → docs/ link is the pattern Anthropic itself recommends in their best practices guide. goodvibes ships this pre-configured.

### 7. GitHub template repo as zero-install entry point

**What it is:** github.com/jgiox/goodvibes is itself a "Use this template" GitHub template repo. Beginners who don't have npm or pip can get 80% of the value by clicking one button and getting a repository with all files pre-placed.

**Why it differentiates:** Creates two acquisition paths: code-path (npx/pip) and click-path (GitHub template). The click-path meets the complete beginner where they are — they may not even know what npm is.

**Important caveat:** The template repo path does not run headroom install or project-type detection. CLAUDE.md in the template should note this and link to `npx goodvibes init` for the full experience.

---

## Anti-Features (Deliberately NOT Building)

These are features that would frustrate beginners, create maintenance burden, or undermine goodvibes' core value. The evidence comes from studying where other scaffolding tools lost users.

### 1. Interactive questionnaire with more than 3 questions

**Why not:** create-next-app's 9-question wizard is cited as overwhelming for beginners unfamiliar with TypeScript/ESLint/App Router concepts. A vibe coder doesn't know what "ponytail minimalism enforcement" means — asking them is pointless. goodvibes should make good decisions by default and let users override with flags.

**What to do instead:** Zero questions by default. Run with intelligent defaults. Provide `--skip-X` flags for every bundled component for power users who want control.

**Maximum acceptable interaction:** One confirmation prompt ("This will create files in /path/to/your/project. Continue? (Y/n)") — that's it.

### 2. Template variable interpolation / project name prompts

**Why not:** goodvibes is not a project creator — it's a project enhancer. Asking for a project name or author email implies generating parameterized files, which is cookiecutter/copier territory. goodvibes copies static files and detects context automatically (from package.json, pyproject.toml, git config). Every template variable prompt increases cognitive load and time to value.

**What to do instead:** Detect the project name from the existing `package.json` / `pyproject.toml`. Use it silently where needed (e.g., in generated CI workflow names). Never prompt for it.

### 3. Requiring authentication or account creation

**Why not:** The most successful init tools (degit, create-next-app, create-react-app) work completely without accounts. Any gate before the value moment is a drop-off point. Complete beginners interpret "log in" as "this is not for me."

**What to do instead:** Everything ships and runs locally. No telemetry, no accounts, no API keys required at init time. If future features require GitHub auth (e.g., auto-creating a repo), make them opt-in and post-init.

### 4. Opinionated language / framework scaffolding

**Why not:** goodvibes is language-agnostic engineering discipline. It should not generate `tsconfig.json`, `eslintrc`, or `pytest.ini`. Those choices belong to the project. Adding them would make goodvibes conflict with create-next-app, create-react-app, etc. — the tools users are already using.

**What to do instead:** goodvibes sits above the framework layer. It adds AI-specific files (CLAUDE.md, skills) and CI scaffolding. It explicitly does NOT touch the build system, test framework, or linter config.

### 5. Auto-updating / post-install modification hooks

**Why not:** npm postinstall hooks are actively being blocked by npm v12 as a security measure. Any hook that runs automatically after `npm install goodvibes` creates a confusing experience (silent failures, unexpected filesystem changes) and a supply-chain attack surface. The broader problem: beginners don't understand hooks, so when they fail, there's no path to recovery.

**What to do instead:** `goodvibes init` is the explicit, intentional trigger. Nothing should happen without user intent. Every file written is announced.

### 6. Verbose wall-of-text output

**Why not:** Beginners scan — they don't read. A 50-line output after init is not documentation; it's noise. clig.dev: "nudge them towards the commands they're more likely to use" not "explain everything upfront."

**What to do instead:** Init output must fit in one terminal screen (< 24 lines). Every line earns its place. Use a "what to do next" block with maximum 3 items. Link to docs for everything else.

### 7. Silent failure or partial success without clear status

**Why not:** The second-worst thing a scaffolding tool can do (after destroying files) is complete "successfully" while quietly skipping components. If headroom install fails because Python is absent, the user must know that headroom is not installed — not just see a green checkmark.

**What to do instead:** Explicit status summary at the end of init:
```
  CLAUDE.md             installed
  caveman skill         installed
  ponytail skill        installed
  headroom              SKIPPED (Python 3.10+ not found — see docs/SETUP.md)
  GitHub Actions CI     installed
  docs/ scaffold        installed
```

### 8. "Kitchen sink" mode that installs everything including optional tools

**Why not:** The Yeoman failure mode: an ambitious ecosystem of composable generators that became a monolithic everything-bundler. Users didn't know which generators to trust, and the cognitive overhead of composition exceeded the value. goodvibes must stay focused: the exact set of tools described in the project brief, nothing more.

**What to do instead:** No plugin system, no marketplace, no extension points in v1. Curated defaults only. The skip flags exist for people who don't want something, not for adding third-party tools.

---

## Comparable Tools Analysis

| Tool | Category | What it Does Well | Goodvibes Difference |
|------|----------|-------------------|----------------------|
| **create-next-app** | Framework scaffolding | Zero-config Next.js setup, AGENTS.md generation as of 2025 | goodvibes is framework-agnostic; adds AI discipline layer, not app skeleton |
| **degit** | Template downloader | Lightweight git repo cloning without history; fast, zero-config | goodvibes does active configuration (headroom install, CI generation); degit just copies files |
| **cookiecutter** | Template engine | Huge community template library, cross-platform | goodvibes is one-purpose (AI discipline), not a general template engine |
| **copier** | Template engine | Template update flow (copier update merges changes) | goodvibes is simpler — no template sync needed; files are owned by user after init |
| **ClaudeForge** | CLAUDE.md generator | Generates CLAUDE.md from existing codebase analysis | ClaudeForge requires Claude Code running; goodvibes works before first session; ClaudeForge analyzes your code, goodvibes ships a baseline |
| **caveman** (standalone) | Output compression skill | 65% output token reduction | goodvibes bundles caveman alongside the CLAUDE.md and CI that make it useful |
| **ponytail** (standalone) | Code minimalism skill | 54-94% less generated code | goodvibes bundles ponytail as part of a coherent, pre-wired system |
| **headroom** (standalone) | Input compression | 60-95% fewer input tokens | goodvibes runs the headroom install that users would otherwise need to figure out themselves |
| **vibe-engineering (ash1794)** | Skills collection | 38 engineering discipline skills for Claude Code | goodvibes is a complete init tool, not a skills library; narrower scope, lower cognitive overhead; targets complete beginners |
| **feiskyer/claude-code-settings** | Settings/skills repo | Provider configurations, specialized agents | goodvibes is beginner-first (single command), not a settings repo requiring manual configuration |
| **GitHub template repos (pattern)** | Click-to-use template | Zero-install, GitHub-native | goodvibes provides this as secondary path; primary path is smarter (runs installs, detects project) |
| **scaffdog** | Document-driven scaffolding | Markdown-defined templates, interactive file generation | scaffdog is for generating code/component files repeatedly; goodvibes is for one-time project-level bootstrap |

**Key gap goodvibes fills:** The intersection of (a) works in one command, (b) targets complete beginners, (c) is specifically AI-agent aware, and (d) bundles both compression tools + engineering rules does not exist as of June 2026. The closest competitors require multiple steps and assume baseline developer knowledge.

---

## Key Insight for v1 Scope

**The core insight from research: goodvibes is not a scaffolding tool that happens to add AI files — it is an AI cost and discipline optimization tool that happens to use scaffolding delivery.**

This matters for scoping v1:

**What v1 must be:** A bootstrap experience so fast and so clearly valuable that a complete beginner runs it, sees what it did, and opens their first Claude Code session with measurably better defaults. Time-to-value target: under 60 seconds from `npx goodvibes init` to Claude Code session with caveman + ponytail + headroom active.

**What v1 must NOT be:** A general scaffolding platform, a template engine, a CLAUDE.md generator (from analysis), or a skills marketplace.

**The MVP experience (evidence-based):**
1. One command (`npx goodvibes init` or `goodvibes init`)
2. One confirmation prompt (current directory check)
3. Zero questions beyond that
4. Files placed: CLAUDE.md + skill files + CI workflow + docs stub
5. headroom install attempted, status clearly reported
6. Post-install summary: what was installed, what to do next (3 items max)
7. Link to docs for everything else

**Features to explicitly defer from v1:**
- `goodvibes update` (re-sync with latest goodvibes templates) — valuable but not MVP
- Project-type detection that customizes CI workflow beyond Node/Python detection
- CLAUDE.md customization wizard
- Any telemetry or usage analytics
- Windows native (non-WSL) support — test and support WSL2 first; native Windows PowerShell is a separate workstream

**Ordering rationale:**
The first phase must deliver the file injection + caveman + CLAUDE.md core — this is the minimum meaningful artifact. Headroom installation comes second (it's slower, failure-prone, and Python-dependent). CI workflows and docs scaffold come third — they require project-type detection logic but add clear value once the core is stable.

---

## Sources

- [clig.dev — Command Line Interface Guidelines](https://clig.dev/)
- [UX patterns for CLI tools — Lucas Fernandes Costa](https://lucasfcosta.com/2022/06/01/ux-patterns-cli-tools.html)
- [GitHub — JuliusBrussee/caveman](https://github.com/juliusbrussee/caveman)
- [GitHub — DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)
- [GitHub — headroomlabs-ai/headroom](https://github.com/chopratejas/headroom)
- [GitHub — alirezarezvani/ClaudeForge](https://github.com/alirezarezvani/claudeforge)
- [GitHub — ash1794/vibe-engineering](https://github.com/ash1794/vibe-engineering)
- [GitHub — feiskyer/claude-code-settings](https://github.com/feiskyer/claude-code-settings)
- [structkit vs cookiecutter vs copier — DEV Community](https://dev.to/structkit/structkit-vs-cookiecutter-vs-copier-which-project-scaffolding-tool-is-right-for-you-5gag)
- [Copier comparisons — official docs](https://copier.readthedocs.io/en/stable/comparisons/)
- [Why is it so hard to write a scaffolding tool? — John Freeman](https://jfreeman.dev/blog/2019/05/02/why-is-it-so-hard-to-write-a-scaffolding-tool/)
- [CLI: create-next-app — Next.js official docs](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
- [Building with LLMs at Scale: The Pain Points — Laurent Charignon via DEV Community](https://dev.to/laurent_charignon/building-with-llms-at-scale-part-1-the-pain-points-3c0o)
- [Best practices for Claude Code — Anthropic](https://code.claude.com/docs/en/best-practices)
- [Headroom — Cut Claude Code costs ~50%](https://extraheadroom.com/)
- [GitHub — Rich-Harris/degit](https://github.com/Rich-Harris/degit)
- [Ponytail — Minimalism Plugin for AI Agents](https://www.everydev.ai/tools/ponytail)
- [Writing a good CLAUDE.md — HumanLayer Blog](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
