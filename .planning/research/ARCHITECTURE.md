# Architecture Research: goodvibes

**Researched:** 2026-06-23
**Confidence:** HIGH (core patterns); MEDIUM (headroom integration specifics)

---

## Component Overview

goodvibes has three distinct runtime contexts that must coexist in a single repo:

| Context | Who uses it | What it needs |
|---|---|---|
| GitHub template repo | User who clicks "Use this template" or forks | All deliverable files at repo root, no CLI machinery visible |
| npm CLI (`npx goodvibes init`) | JS/TS user in an existing or empty project | `bin/` entry point, `templates/` folder bundled in npm package |
| pip CLI (`goodvibes init`) | Python user in an existing or empty project | `goodvibes/` Python package, same `templates/` accessible via `importlib.resources` |

The critical insight from studying create-next-app, create-hono, and degit: **templates are static files that live inside the CLI package itself, co-located in a `templates/` directory.** The CLI locates them at runtime using `path.join(__dirname, '../templates')` (Node) or `importlib.resources.files('goodvibes').joinpath('templates')` (Python). No remote fetch is needed for the core scaffold files.

---

## Dual-Delivery Architecture

### The Fundamental Tension

A GitHub template repo copies everything from the repo root. A CLI copies files from its bundled `templates/` folder. These two surfaces are not naturally the same.

**The resolution:** Use a `template/` directory at repo root that holds the canonical deliverable files. The CLI copies from `template/`. The GitHub template repo IS the repo — but users who fork it get `template/` contents AND the CLI source code.

This is not a problem if you treat the GitHub template as a "fork then delete what you don't need" experience, which is exactly how create-next-app and degit handle it — the template repo is the authoritative source; the CLI is a convenience layer that copies from it.

**Recommended approach: single-repo, two surfaces**

```
goodvibes/                       <- GitHub template repo root
  template/                      <- canonical scaffold files (CLI copies FROM here)
    CLAUDE.md
    .claude/
      skills/caveman/
      skills/goodvibes-hygiene/
    .github/
      workflows/
      ISSUE_TEMPLATE/
      PULL_REQUEST_TEMPLATE.md
    docs/
    CONTRIBUTING.md
    SECURITY.md
    JOURNAL.md
    CHANGELOG.md
  bin/                           <- npm CLI entry point
    goodvibes.js
  goodvibes/                     <- Python package
    __init__.py
    cli.py
    templates -> symlink or copy of ../template/
  src/                           <- shared TypeScript CLI logic (compiled to bin/)
    init.ts
    copy.ts
    merge_claude_md.ts
    headroom.ts
  package.json
  pyproject.toml
  README.md
  LICENSE
```

When a user forks the GitHub template, they get `template/` (what they want), `bin/` and `src/` (they can delete or ignore), and `package.json`/`pyproject.toml` (also ignorable). This is acceptable — the README hero path is "fork and delete the CLI stuff" or "use the CLI, don't fork."

**Alternative: degit pattern (recommended for Path A simplicity)**

The GitHub template repo has NO CLI machinery at root. It is purely the deliverable files:

```
goodvibes-template/        <- separate GitHub repo, marked as template
  CLAUDE.md
  .claude/skills/...
  .github/workflows/...
  docs/
  ...

goodvibes-cli/             <- separate GitHub repo, npm + pip published
  templates/ -> fetched from goodvibes-template at publish time, or copied
  bin/
  src/
  pyproject.toml
  package.json
```

This separation is cleaner but adds repo maintenance overhead. The create-next-app model (templates bundled inside the CLI package, co-located in the same monorepo) is the better precedent for a small team.

**Decision: single repo, `template/` subdirectory.** The GitHub "Use This Template" button copies the whole repo root — so the repo root must be the deliverable. This conflicts with having `src/`, `bin/`, `pyproject.toml` at root. Resolve this pragmatically: the GitHub template experience is "fork and the junk is visible but harmless." The README must explain this. Alternatively, configure GitHub template to exclude certain files using `.github/template/exclude` — but GitHub does not support per-file exclusions in template repos as of 2026.

**Final recommendation: two repos.**

- `jgiox/goodvibes` — the CLI source (npm + pip), references `jgiox/goodvibes-template` 
- `jgiox/goodvibes-template` — the GitHub template repo, purely deliverable files, also the `templates/` source of truth for the CLI

The CLI `npx goodvibes init` copies from its bundled `templates/` folder (which mirrors `jgiox/goodvibes-template` at publish time). This mirrors exactly how create-hono works: templates are a separate concern from CLI logic.

---

## Component Diagram

```
User runs: npx goodvibes init
                 |
                 v
         [ goodvibes npm package ]
         |-- bin/goodvibes.js (entry)
         |-- src/init.ts
         |     |-- detect existing CLAUDE.md
         |     |-- copy templates/
         |     |-- merge_claude_md()
         |     |-- setup_headroom()
         |
         |-- templates/          <-- bundled static files
               |-- CLAUDE.md
               |-- .claude/skills/caveman/
               |-- .claude/skills/goodvibes-hygiene/
               |-- .github/workflows/
               |-- docs/
               |-- ...
                 |
                 v
           [target project dir]
           (files written here)
                 |
                 v
           headroom setup
           (subprocess: pip install headroom-ai[mcp])
           (subprocess: headroom mcp install)


User forks: github.com/jgiox/goodvibes-template
                 |
                 v
         GitHub copies all files to new repo
         (no CLI involved — pure static copy)
         |-- CLAUDE.md
         |-- .claude/skills/
         |-- .github/
         |-- docs/
         |-- ...


User runs: pip install goodvibes && goodvibes init
                 |
                 v
         [ goodvibes pip package ]
         |-- goodvibes/cli.py (entry via [scripts] in pyproject.toml)
         |-- goodvibes/init.py
         |     |-- detect existing CLAUDE.md
         |     |-- copy templates/ via importlib.resources
         |     |-- merge_claude_md()
         |     |-- setup_headroom()
         |
         |-- goodvibes/templates/   <-- bundled via package_data
               |-- (same files as npm templates/)
```

---

## Template File Strategy

### Where templates live

**Canonical location:** `goodvibes-template` repo (or `template/` directory if single-repo).

**Bundled locations at publish time:**
- npm package: `templates/` directory (included via `files` field in package.json)
- pip package: `goodvibes/templates/` directory (included via `[tool.setuptools.package-data]` in pyproject.toml)

Both CLIs operate identically: locate bundled templates, copy to cwd, then post-process.

### npm bundling

```json
// package.json
{
  "files": ["bin/", "templates/", "dist/"]
}
```

Runtime access in Node:
```js
const templateDir = path.join(__dirname, '../templates');
fs.cpSync(templateDir, targetDir, { recursive: true });
```

This is the exact pattern used by create-next-app (confirmed via GitHub), create-hono, and all major scaffold CLIs. It is the established industry standard. HIGH confidence.

### pip bundling

```toml
# pyproject.toml
[tool.setuptools.package-data]
goodvibes = ["templates/**/*"]
```

Runtime access in Python (requires Python 3.9+, which aligns with headroom's Python 3.10+ requirement):
```python
from importlib.resources import files
template_path = files('goodvibes').joinpath('templates')
shutil.copytree(template_path, target_dir, dirs_exist_ok=True)
```

### Keeping npm and pip templates in sync

Both CLIs ship the same static files. At publish time, a build step copies `templates/` into `goodvibes/templates/` before publishing the pip wheel. A Makefile target or GitHub Actions publish workflow handles this. There is no runtime sync needed — both CLIs are published snapshots.

```
templates/          <- source of truth (npm)
goodvibes/templates/ <- auto-copied at pip publish time (gitignored or committed)
```

---

## CLAUDE.md Generation Approach

### Three scenarios the CLI must handle

| Scenario | What to do |
|---|---|
| Empty project (no CLAUDE.md) | Copy bundled CLAUDE.md as-is |
| Existing CLAUDE.md (user or other tool created it) | Merge: prepend goodvibes header block, append goodvibes footer block, leave user content in middle |
| Existing CLAUDE.md from a prior goodvibes run | Detect goodvibes sentinel markers, replace only the goodvibes sections, leave user content untouched |

### Recommended approach: sentinel-based merge

The bundled CLAUDE.md contains sections delimited by machine-readable markers:

```markdown
<!-- goodvibes:start -->
[karpathy rules + Code Directions content]
<!-- goodvibes:end -->
```

The merge logic:
1. If no CLAUDE.md exists: copy bundled file directly.
2. If CLAUDE.md exists without sentinels: prepend the goodvibes block (between sentinels) and keep the existing content below it.
3. If CLAUDE.md exists with sentinels: replace the sentinel-delimited block with fresh content; preserve everything outside.

This is the same pattern used by tools like `husky`, `lint-staged` config injectors, and `.npmrc` mergers. It is simple, deterministic, and reversible. HIGH confidence this is the right approach.

### Static file, not a template with variables

The CLAUDE.md content itself should be static text, not a Jinja/Handlebars template with variable substitution. The rules from karpathy and Code Directions.md are universal; there is nothing project-specific to inject. Keep it simple.

The `goodvibes-hygiene` skill and `caveman` skill are separate files dropped into `.claude/skills/` — they do not need to merge with anything.

---

## Headroom Integration Pattern

### What headroom is

headroom-ai is a Python/Rust package (`pip install "headroom-ai[mcp]"`) that compresses LLM context 60–95%. It installs as a CLI tool and registers itself with Claude Code via `headroom mcp install`, which writes an MCP server entry to Claude Code's config. It requires Python 3.10+.

### Integration options

| Option | UX | Risk | Recommendation |
|---|---|---|---|
| Require user to run pip separately | User must know pip exists | Breaks zero-config promise | No |
| npm CLI shells out to `pip install headroom-ai[mcp]` | One step, but requires Python 3.10+ on PATH | Fails silently if Python not available | Yes, with fallback |
| pip CLI takes headroom as a dependency | Automatic for pip users | No risk; pip resolves it | Yes, always |
| Async/background install | Complex error handling | Poor debuggability | No |

### Recommended pattern

**For pip CLI:** Add `headroom-ai[mcp]` to `[project.dependencies]` in pyproject.toml. It installs automatically. After file copy, run `headroom mcp install` via subprocess.

**For npm CLI:** After copying files, attempt:
```js
const { execSync } = require('child_process');
try {
  execSync('pip install "headroom-ai[mcp]" --quiet', { stdio: 'pipe' });
  execSync('headroom mcp install', { stdio: 'pipe' });
  console.log('headroom configured');
} catch (e) {
  console.log('headroom skipped (Python 3.10+ not found — install manually: pip install headroom-ai[mcp])');
}
```

This is a soft dependency: the CLI does not fail if Python is absent; it prints a one-line manual step. The CLAUDE.md injected into the project also documents this step in its Setup section.

**`headroom mcp install` behavior:** This command modifies Claude Code's MCP configuration to register headroom as an MCP server (writes to `~/.claude/` config or `.claude/` project config). This is a one-time user-level operation, not a per-project file copy. goodvibes should run it once during init and not re-run on subsequent calls.

### Headroom in the GitHub template fork

The template repo cannot auto-install headroom — there is no init script that runs on fork. The `CLAUDE.md` injected by the template must include a "Getting Started" section that says: "Run `pip install headroom-ai[mcp] && headroom mcp install` to enable input token compression."

This is a deliberate tradeoff: template fork path requires one manual pip step; CLI path does it automatically.

---

## Recommended File Layout (the goodvibes repo itself)

This layout assumes the two-repo model: `goodvibes` (CLI) and `goodvibes-template` (GitHub template).

### `jgiox/goodvibes` (CLI repo, published to npm + pip)

```
goodvibes/                    <- repo root
  bin/
    goodvibes.js              <- npm bin entry (#!/usr/bin/env node)
  src/
    index.ts                  <- CLI entrypoint (commander/yargs parsing)
    init.ts                   <- orchestrates the init flow
    copy.ts                   <- copies template files to cwd
    merge_claude_md.ts        <- sentinel-based CLAUDE.md merge
    headroom.ts               <- pip subprocess + headroom mcp install
    detect.ts                 <- detects existing files, prior goodvibes runs
  templates/                  <- bundled scaffold files (npm package_data)
    CLAUDE.md                 <- combined karpathy + Code Directions rules
    .claude/
      skills/
        caveman/              <- forked from juliusbrussee/caveman
          CLAUDE.md
          (skill files)
        goodvibes-hygiene/    <- ponytail wrapper + hygiene shortcuts
          CLAUDE.md
    .github/
      workflows/
        ci.yml
        security.yml
        dependency-review.yml
      ISSUE_TEMPLATE/
        bug_report.md
        feature_request.md
      PULL_REQUEST_TEMPLATE.md
      dependabot.yml
    docs/
      getting-started.md
      git-basics.md
      ci-explained.md
      releases.md
    CONTRIBUTING.md
    SECURITY.md
    JOURNAL.md
    CHANGELOG.md
  goodvibes/                  <- Python package
    __init__.py
    cli.py                    <- click/typer entry point
    init.py                   <- mirrors init.ts logic
    copy.py
    merge_claude_md.py
    headroom.py
    templates/                <- copy of ../templates/ (auto-synced at publish)
  tests/
    test_copy.py
    test_merge_claude_md.py
    test_headroom.py
    init.test.ts
  package.json                <- bin: { goodvibes: bin/goodvibes.js }
  pyproject.toml              <- [project.scripts] goodvibes = "goodvibes.cli:main"
  tsconfig.json
  .github/
    workflows/
      publish-npm.yml
      publish-pip.yml
      sync-templates.yml      <- copies templates/ -> goodvibes/templates/
  README.md
  LICENSE                     <- Apache 2.0
```

### `jgiox/goodvibes-template` (GitHub template repo)

```
goodvibes-template/           <- repo root (THIS is what users get when they fork)
  CLAUDE.md
  .claude/
    skills/
      caveman/
      goodvibes-hygiene/
  .github/
    workflows/
    ISSUE_TEMPLATE/
    PULL_REQUEST_TEMPLATE.md
    dependabot.yml
  docs/
  CONTRIBUTING.md
  SECURITY.md
  JOURNAL.md
  CHANGELOG.md
  README.md                   <- "You forked goodvibes. Here's what to do next."
  LICENSE
```

This repo is kept in sync with `goodvibes/templates/` via the `sync-templates.yml` workflow or manual promotion. It has zero CLI machinery — pure deliverable files.

---

## Build Order Implications (what to build first)

### Phase 1: Template content (no CLI needed)

Build the actual files that get delivered. These are the product. The CLI is just a delivery vehicle.

Order:
1. `CLAUDE.md` — combine karpathy rules + Code Directions.md source material. This is the highest-value deliverable. Build it first so it can be tested immediately.
2. `.claude/skills/caveman/` — fork juliusbrussee/caveman, verify Apache 2.0 compatibility, copy into template.
3. `.claude/skills/goodvibes-hygiene/` — write the ponytail wrapper skill.
4. `.github/workflows/` — ci.yml, security.yml, dependency-review.yml. These are self-contained YAML; no code dependency.
5. `docs/` scaffold files — CONTRIBUTING.md, SECURITY.md, JOURNAL.md, CHANGELOG.md, and the onboarding docs.
6. `.github/ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`, `dependabot.yml`.

**Gate:** Template files exist in `templates/` and are manually testable (copy to a fresh project, open with Claude Code, verify it works).

### Phase 2: npm CLI (`npx goodvibes init`)

npm CLI is the highest-reach delivery path for a vibe coder audience. Build it before pip.

Order:
1. `bin/goodvibes.js` — minimal shebang entry that delegates to `src/index.ts`.
2. `src/copy.ts` — `fs.cpSync` from `templates/` to cwd. Test this in isolation.
3. `src/merge_claude_md.ts` — sentinel-based merge. This is the riskiest logic; needs unit tests covering all three scenarios.
4. `src/headroom.ts` — subprocess wrapper with graceful fallback on no-Python.
5. `src/init.ts` — orchestration: detect → copy → merge → headroom.
6. `package.json` `files` field — ensure `templates/` is included in the published package.
7. Publish to npm as `goodvibes`.
8. Test: `npx goodvibes init` in a fresh directory; verify all files land correctly.

**Gate:** `npx goodvibes init` in an empty directory produces a working project. `npx goodvibes init` in a project with an existing CLAUDE.md merges without destroying content.

### Phase 3: pip CLI (`goodvibes init`)

Mirrors Phase 2 in Python. Builds on the same `templates/` source.

Order:
1. `goodvibes/cli.py` — click/typer entry, `goodvibes init` command.
2. `goodvibes/copy.py` — `importlib.resources` + `shutil.copytree`.
3. `goodvibes/merge_claude_md.py` — port of the sentinel logic from TypeScript.
4. `goodvibes/headroom.py` — `subprocess.run(['headroom', 'mcp', 'install'])` after headroom-ai is installed as a dependency.
5. `pyproject.toml` — `[tool.setuptools.package-data]` for templates, `headroom-ai[mcp]` in dependencies.
6. `sync-templates.yml` GitHub Actions — auto-copies `templates/` to `goodvibes/templates/` on push.
7. Publish to PyPI as `goodvibes`.
8. Test: `pip install goodvibes && goodvibes init` in a fresh directory.

**Gate:** pip CLI produces identical result to npm CLI.

### Phase 4: GitHub template repo

Set up `jgiox/goodvibes-template` with the contents of `templates/`. Enable "Template repository" in GitHub settings. Write the README with the "Use This Template" button as hero action.

Maintain sync: when `templates/` changes in the CLI repo, a workflow (or manual step) updates the template repo.

**Dependency:** Phases 1–3 must be complete before the template repo has validated content.

### Phase ordering summary

```
Phase 1: Template content (files)
    |
    v
Phase 2: npm CLI  ----+
    |                 |
    v                 |
Phase 3: pip CLI  ----+
    |
    v
Phase 4: GitHub template repo
```

Phases 2 and 3 can be parallelized after Phase 1 if two people are working. Phase 4 is always last — it promotes validated content.

### What must exist before what

| "Before" | "After" |
|---|---|
| CLAUDE.md content finalized | Any CLI that copies it |
| `templates/` directory complete | npm package.json `files` field |
| npm CLI tested and working | pip CLI (to validate the copy logic pattern before porting) |
| Both CLIs tested | GitHub template repo published |
| headroom subprocess pattern confirmed working | pip CLI headroom.py dependency |
| Apache 2.0 license compatibility verified for caveman | Bundling caveman into templates/ |

---

## Sources

- create-next-app templates structure: [Next.js GitHub — create-next-app/templates](https://github.com/vercel/next.js/tree/canary/packages/create-next-app/templates) (MEDIUM confidence — structure confirmed via GitHub directory listing)
- degit architecture: [Rich-Harris/degit](https://github.com/Rich-Harris/degit) (HIGH confidence — official repo)
- npm CLI template bundling pattern: [How to build an npx starter template — Peter Mekhaeil](https://www.petermekhaeil.com/how-to-build-an-npx-starter-template/) (HIGH confidence — verified against multiple sources)
- Node.js CLI scaffold tools: [Building a Node.js Project Starter Template CLI Tool — Mastering Backend](https://blog.masteringbackend.com/building-a-node-js-project-starter-template-cli-tool) (MEDIUM confidence)
- Python package_data for templates: [Setuptools data files documentation](https://setuptools.pypa.io/en/latest/userguide/datafiles.html) (HIGH confidence — official docs)
- importlib.resources runtime access: [setuptools datafiles — official](https://setuptools.pypa.io/en/latest/userguide/datafiles.html) (HIGH confidence)
- headroom install modes and MCP setup: [headroom README](https://github.com/chopratejas/headroom/blob/main/README.md) and [headroom MCP docs](https://headroom-docs.vercel.app/docs/mcp) (HIGH confidence — official docs)
- copier "one template = one repo" recommendation: [copier FAQ](https://copier.readthedocs.io/en/stable/faq/) (HIGH confidence — official docs; used to inform the two-repo recommendation)
- create-hono CLI structure: [create-hono Context7 docs](https://context7.com/honojs/create-hono/llms.txt) (HIGH confidence — official source)
- GitHub template repository behavior: [GitHub Docs — Creating a template repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository) (HIGH confidence — official docs)
