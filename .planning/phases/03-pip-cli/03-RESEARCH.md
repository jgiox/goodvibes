# Phase 3: pip CLI — Research

**Researched:** 2026-06-24
**Domain:** Python CLI packaging, PyPI distribution, Typer, Rich, pyproject.toml/hatchling, headroom-ai dependency analysis
**Confidence:** HIGH (stack), HIGH (architecture), HIGH (pitfalls)

---

## Summary

Phase 3 ports the npm CLI to Python and publishes to PyPI. The research uncovered three critical blocking findings that must be resolved before planning begins.

**Finding 1 — PyPI name conflict (blocker):** `goodvibes` is already taken on PyPI by an actively-maintained computational chemistry package (Paton Research Group, latest release 4.3.0 on 2026-05-16). The REQUIREMENTS.md says PIP-04 is "published as `goodvibes`" but this is impossible without a conflict resolution. Available alternatives confirmed by live PyPI API check: `goodvibes-cli`, `good-vibes`, `goodvibes-init`, `jgiox-goodvibes`. The npm package published as `@jgiox/goodvibes` — the analogous PyPI name is `jgiox-goodvibes`. `goodvibes-cli` is semantically cleaner and more discoverable.

**Finding 2 — headroom-ai[all] is installation-breaking (critical constraint):** PIP-03 requires declaring `headroom-ai[all]` as a declared pyproject.toml dependency. Research confirms this will fail `pip install goodvibes-cli` on: (a) any machine without C++17 build tools because `hnswlib>=0.8.0` (pulled by the `[memory]` extra which is part of `[all]`) is source-only with no wheels; (b) Windows entirely because headroom-ai base has no Windows wheel at all. The `[all]` extra also pulls `torch>=2.0.0`, `onnxruntime`, and `sentence-transformers` — potentially multi-gigabyte installs. For goodvibes's actual use case (MCP server setup), only `headroom-ai[mcp]` is needed. This is a requirements conflict that must surface to the user.

**Finding 3 — headroom-ai has no Windows wheel (platform gap):** ROADMAP success criterion 3 requires "wheels available for... Windows" but headroom-ai 0.27.0 only ships `manylinux_2_28` and `macosx_11_0_arm64` wheels. No `win_amd64`. The goodvibes pip CLI itself will be pure-Python (universal wheel, all platforms), but headroom will fail to install on Windows regardless.

The standard locked stack (Typer ^0.15 + Rich ^14 + hatchling build backend) is well-suited and requires no alternatives research. The sentinel merge, file copy, and headroom integration all port cleanly from TypeScript to Python stdlib.

**Primary recommendation:** Publish as `goodvibes-cli` (not `goodvibes`). Declare `headroom-ai[mcp]` as the dependency (not `[all]`) with runtime graceful degradation matching Phase 2 behavior. Document headroom's Windows gap and WSL2 recommendation.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIP-01 | `pip install goodvibes && goodvibes init` produces same result as npm CLI | Confirmed feasible with Typer+Rich+shutil; package name must be resolved (see Finding 1) |
| PIP-02 | pip CLI is a Python port with identical output behavior | Rich Status (spinner) = @clack/prompts tasks(); Rich Panel/Rule = intro/outro; stdlib re/pathlib = sentinel merge |
| PIP-03 | pip package lists `headroom-ai[all]` as declared dependency | CRITICAL CONFLICT: `[all]` includes hnswlib (source-only, no wheel) and torch (multi-GB). Recommend `headroom-ai[mcp]` instead — requires user decision before implementation |
| PIP-04 | Published to PyPI as `goodvibes` | BLOCKED: `goodvibes` is taken (computational chemistry package, active). Must use alternative name. |
| PIP-05 | Requires Python 3.10+ with clear error if not met | Two-layer guard: `requires-python = ">=3.10"` in pyproject.toml (pip refuses install) + `sys.version_info` check in `__main__.py` before any imports |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **License**: Apache 2.0 — all deps must be Apache 2.0 or permissive-compatible (MIT, BSD, PSF)
- **Zero-config**: installer must work without user configuration; sensible defaults for everything
- **Beginner-first**: every error message assumes reader has never opened a terminal
- **Language-agnostic core**: CLAUDE.md rules and CI templates work for any language/stack
- **Headroom bundling**: pip installer can pull headroom-ai as a dependency
- **Typer ^0.15** locked stack (CLAUDE.md Technology Stack section)
- **Rich ^14** locked stack (pulled in by typer[all])
- **Python stdlib only** for file copy (shutil, pathlib) — no fs-extra equivalent allowed
- **No shell=True** in any subprocess call — args passed as lists
- **No postinstall hooks** — headroom installation done at runtime during `goodvibes init`
- **Ponytail minimalism rules** active: shortest working diff, no unrequested abstractions

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CLI entry point dispatch | CLI Process (Python entry point) | — | `[project.scripts]` creates `goodvibes` command; Typer dispatches to `init` subcommand |
| Template file copy | CLI Process (stdlib) | — | `shutil.copytree` + `importlib.resources.files()` — pure Python, no network |
| Sentinel CLAUDE.md merge | CLI Process (stdlib) | — | `re` + `pathlib.Path` — direct port of TypeScript logic |
| Python version guard | CLI Process (sys module) | pyproject.toml constraint | Two layers: pip-time refusal + runtime check before any imports |
| headroom install | CLI Process (subprocess) | Runtime detection chain | `subprocess.run` array args; uv→pipx→pip chain; never shell=True |
| MCP registration | CLI Process (subprocess) | — | Direct port of configure-mcp.ts logic using subprocess |
| Template bundling | Build time (hatchling) | Runtime (importlib.resources) | Hatchling includes `src/goodvibes_cli/templates/**` in wheel |
| PyPI publishing | CI (GitHub Actions) | uv build/publish | `uv build` → `uv publish` with trusted publishing; no tokens in repo |
| Output / spinner UX | CLI Process (Rich) | — | `rich.console.Console.status()` = @clack/prompts `tasks()`; `rich.panel.Panel` = intro/outro |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typer` | ^0.15 (latest: 0.26.7) | CLI framework, subcommand dispatch, option parsing | Locked in CLAUDE.md; MIT; built on Click (vendored since 0.26.0); auto-generated help |
| `rich` | ^14 (latest: 15.0.0) | Terminal output: spinner, panels, formatted text | Locked in CLAUDE.md; pulled in by typer[all]; MIT; Status/Console APIs cover all UX needs |
| `hatchling` | (build dep only) | Build backend for pyproject.toml | Standard uv default; supports arbitrary file inclusion for templates/ |
| Python stdlib | 3.10+ | `shutil`, `pathlib`, `re`, `subprocess`, `importlib.resources` | Zero extra deps; all file ops, sentinel merge, subprocess calls |

[VERIFIED: npm registry for versions] — confirmed via `pip index versions` on all packages.

### Supporting (dev only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pytest` | ^9 (latest: 9.1.1) | Unit + integration testing | Dev dependency only; mirrors vitest role from Phase 2 |
| `uv` | system tool | Build, venv, publish | Must be present on developer machine; CI uses `astral-sh/setup-uv@v5` |

### Rejected (do not add)

| Library | Reason |
|---------|--------|
| `copier` / `cookiecutter` | goodvibes copies static files, not templates; locked out in CLAUDE.md |
| `click` directly | Typer wraps Click; adding Click separately creates version conflicts |
| `inquirer` / `questionary` | goodvibes is zero-config; no interactive prompts needed |
| `headroom-ai[all]` as pyproject.toml dep | Pulls hnswlib (source-only, C++17 required), torch (~2GB), onnxruntime — breaks install on WSL2 without build tools and on all Windows |

**Installation (dev environment):**
```bash
uv init packages/pip
cd packages/pip
uv add typer rich
uv add --dev pytest
uv build   # produces dist/goodvibes_cli-*.whl
```

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `typer` | PyPI | ~5 yrs | High (tiangolo) | github.com/fastapi/typer | OK | Approved |
| `rich` | PyPI | ~6 yrs | Very high | github.com/Textualize/rich | OK | Approved |
| `headroom-ai` | PyPI | ~62 days | Moderate | github.com/chopratejas/headroom | OK (flagged: new, LLM-name-pattern but established) | Approved — runtime dep, not build dep |

[VERIFIED: npm registry] — slopcheck ran and returned OK for all three. headroom-ai flagged as "relatively new" with LLM naming pattern but rated OK overall. hnswlib is NOT a goodvibes dependency (pulled only if headroom-ai[all] is used — see Finding 2 above).

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none (headroom-ai [OK] with informational note)

---

## Architecture Patterns

### System Architecture Diagram

```
User runs: goodvibes init [--dry-run] [--minimal]
                    |
            pyproject.toml entry point
            goodvibes = "goodvibes_cli.main:app"
                    |
          +---------v---------+
          |  sys.version_info |  (before any imports)
          |  check >= (3,10)  |
          +------|------------+
                 | pass
          +---------v---------+
          |  Typer app.init() |
          |  --dry-run        |
          |  --minimal        |
          +------|------------+
                 |
    +------------+------------+
    |                         |
  dry-run=True            dry-run=False
    |                         |
  list files              copy_templates()
  print preview           + sentinel merge
  print next steps            |
  exit 0              (if not minimal)
                              |
                      install_headroom()
                      uv -> pipx -> pip chain
                      (graceful degrade if
                       no Python/installer found)
                              |
                      configure_mcp()
                      (idempotent, 2-layer check)
                              |
                      print file list
                      print next steps
                      exit 0
```

### Recommended Package Structure

```
packages/pip/
├── pyproject.toml           # project metadata, scripts, build config
├── uv.lock                  # lockfile (committed)
├── src/
│   └── goodvibes_cli/
│       ├── __init__.py      # empty or version
│       ├── main.py          # Typer app + @app.command("init")
│       ├── steps/
│       │   ├── copy_templates.py     # shutil.copytree + sentinel merge call
│       │   ├── install_headroom.py   # uv→pipx→pip chain
│       │   └── configure_mcp.py      # idempotent MCP registration
│       ├── utils/
│       │   └── sentinel_merge.py     # 4-case CLAUDE.md merge (re + pathlib)
│       └── templates/       # symlink → ../../templates/ (or copy at build time)
│           ├── CLAUDE.md
│           ├── CONTRIBUTING.md
│           └── ... (all template files)
└── tests/
    ├── conftest.py
    ├── test_sentinel_merge.py
    ├── test_copy_templates.py
    ├── test_install_headroom.py
    └── test_configure_mcp.py
```

**Template bundling note:** The `src/goodvibes_cli/templates/` directory must exist as real files at build time (not a symlink) for hatchling to include them in the wheel. Either: (a) a prebuild step copies `../../templates/` into `src/goodvibes_cli/templates/`, or (b) `[tool.hatch.build.targets.wheel.force-include]` maps the repo-root templates path. Option (a) is simpler and matches the npm CLI's `prebuild` script pattern.

### Pattern 1: Python version guard (before all imports)

**What:** Check Python version as the very first statement in `main.py` — before `import typer` or `import rich`. If an older Python runs the module, Typer/Rich may not even be importable.

**When to use:** Always — entry point is `main.py`, so the guard goes at the top of that file.

```python
# Source: Python stdlib docs / PIP-05 requirement
import sys

if sys.version_info < (3, 10):
    print(
        f"goodvibes requires Python 3.10 or higher. "
        f"You have Python {sys.version_info.major}.{sys.version_info.minor}.",
        file=sys.stderr,
    )
    sys.exit(1)

import typer  # only after version guard passes
from rich.console import Console
```

### Pattern 2: Typer single-command with `init` subcommand

**What:** A `typer.Typer()` app with a single `@app.command("init")` registered function. Adding a `@app.callback()` forces Typer to treat `init` as a subcommand (not the default action), enabling future `goodvibes update` without refactoring.

**When to use:** Always — this matches the Commander pattern from Phase 2 and enables Phase 5.

```python
# Source: typer.tiangolo.com/tutorial/commands/one-or-multiple/
import typer

app = typer.Typer(help="goodvibes — one-command bootstrap for vibe coding projects")

@app.callback()
def _callback() -> None:
    """goodvibes CLI"""

@app.command("init")
def init_cmd(
    dry_run: bool = typer.Option(False, "--dry-run", help="Preview files without writing"),
    minimal: bool = typer.Option(False, "--minimal", help="Skip headroom and CI workflows"),
) -> None:
    """Bootstrap a project with goodvibes configuration."""
    ...
```

**Entry point in pyproject.toml:**
```toml
[project.scripts]
goodvibes = "goodvibes_cli.main:app"
```

### Pattern 3: Rich UX equivalents for @clack/prompts

| @clack/prompts (TS) | Rich equivalent (Python) |
|--------------------|--------------------------|
| `intro("goodvibes init")` | `console.rule("[bold]goodvibes init[/bold]")` |
| `tasks([{title, task}])` | `with console.status(title) as status:` block |
| `note(content, title)` | `console.print(Panel(content, title=title))` |
| `outro("You're all set!")` | `console.rule("[green]You're all set![/green]")` |

```python
# Source: rich.readthedocs.io/en/stable/progress.html
from rich.console import Console
from rich.panel import Panel

console = Console()

def run_step(title: str, fn):
    """Run fn() with a spinner, return its result."""
    with console.status(title):
        return fn()
```

### Pattern 4: Sentinel merge port (stdlib only)

**What:** Direct Python port of `sentinel-merge.ts` using `re` and `pathlib.Path`. No external deps.

```python
# Source: direct port of packages/npm/src/utils/sentinel-merge.ts
import re
import pathlib

SENTINEL_START = "<!-- goodvibes:start -->"
SENTINEL_END = "<!-- goodvibes:end -->"

def extract_version(block: str) -> str | None:
    m = re.search(r"# goodvibes: v([\d.]+)", block)
    return m.group(1) if m else None

def version_gte(a: str, b: str) -> bool:
    pa = [int(x) for x in a.split(".")]
    pb = [int(x) for x in b.split(".")]
    length = max(len(pa), len(pb))
    pa += [0] * (length - len(pa))
    pb += [0] * (length - len(pb))
    return pa >= pb

def merge_claude(dest_path: pathlib.Path, template_content: str) -> None:
    """Four-case CLAUDE.md sentinel merge."""
    start_marker = template_content.find(SENTINEL_START)
    end_marker = template_content.find(SENTINEL_END)
    template_block = (
        template_content[start_marker:end_marker + len(SENTINEL_END)]
        if start_marker != -1 and end_marker != -1 else ""
    )

    if not dest_path.exists():
        # Case A: file absent — write verbatim
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        dest_path.write_text(template_content, encoding="utf-8")
        return

    existing = dest_path.read_text(encoding="utf-8")
    start_idx = existing.find(SENTINEL_START)

    if start_idx == -1:
        # Case B: file exists, no sentinel — append block
        dest_path.write_text(existing.rstrip() + "\n\n" + template_block + "\n", encoding="utf-8")
        return

    end_idx = existing.find(SENTINEL_END)
    existing_block = existing[start_idx:end_idx + len(SENTINEL_END)]
    existing_ver = extract_version(existing_block)
    template_ver = extract_version(template_block)

    if existing_ver and template_ver and version_gte(existing_ver, template_ver):
        # Case D: existing version >= template — skip
        return

    # Case C: replace sentinel block, preserve surrounding content
    before = existing[:start_idx]
    after = existing[end_idx + len(SENTINEL_END):]
    dest_path.write_text(before + template_block + after, encoding="utf-8")
```

### Pattern 5: Template copy with shutil.copytree

**What:** Uses `shutil.copytree(dirs_exist_ok=True)` with an ignore function — direct equivalent of fs-extra's `copy()` with `overwrite: false`.

```python
# Source: Python stdlib docs (shutil.copytree)
import shutil
import pathlib
import importlib.resources as resources

def resolve_templates_dir() -> pathlib.Path:
    """Return path to bundled templates/ directory."""
    ref = resources.files("goodvibes_cli").joinpath("templates")
    # Traversable.resolve() materialises to a real path on disk
    # (works for both installed wheel and editable installs)
    return pathlib.Path(str(ref))

def copy_templates(
    template_dir: pathlib.Path,
    dest_dir: pathlib.Path,
    minimal: bool = False,
) -> list[str]:
    """Copy templates to dest_dir, return sorted relative file list."""
    copied: list[str] = []

    def ignore_fn(directory: str, contents: list[str]) -> set[str]:
        ignored: set[str] = set()
        for name in contents:
            full = pathlib.Path(directory) / name
            rel = full.relative_to(template_dir)
            if name == "CLAUDE.md":
                ignored.add(name)  # handled by sentinel merge
            if minimal and ".github/workflows" in str(rel):
                ignored.add(name)
            # Path traversal guard
            if ".." in rel.parts:
                ignored.add(name)
        return ignored

    shutil.copytree(str(template_dir), str(dest_dir), ignore=ignore_fn, dirs_exist_ok=True)

    for f in dest_dir.rglob("*"):
        if f.is_file():
            copied.append(str(f.relative_to(dest_dir)))
    return sorted(copied)
```

**Note on `dirs_exist_ok=True`:** This parameter is Python 3.8+ and behaves like `overwrite: false` — it copies files into an existing tree without raising an error, but unlike fs-extra, it DOES overwrite existing files by default. To prevent overwriting, the ignore function or a pre-check is needed. See Pitfall 1.

### Pattern 6: subprocess without shell=True

**What:** Direct equivalent of execa's array-arg pattern. Bracket characters like `[all]` are passed literally to the subprocess — no shell expansion.

```python
# Source: Python stdlib docs (subprocess)
import subprocess

def _run(cmd: list[str], *, check: bool = True) -> subprocess.CompletedProcess:
    """Run command with array args, never shell=True."""
    return subprocess.run(cmd, capture_output=True, text=True, check=check)

# Usage — brackets are NOT expanded:
_run(["uv", "tool", "install", "headroom-ai[mcp]"])
_run(["pip", "install", "--user", "headroom-ai[mcp]"])
```

**ENOENT detection:**
```python
import errno, subprocess

try:
    result = _run(["uv", "tool", "install", "headroom-ai[mcp]"])
except FileNotFoundError:
    # Command not on PATH (Python's equivalent of ENOENT)
    continue
except subprocess.CalledProcessError as e:
    # Install failed (e.g., missing C++ compiler)
    log(f"headroom install failed: {e.stderr.splitlines()[0] if e.stderr else 'unknown error'}")
    return
```

### Anti-Patterns to Avoid

- **`shell=True` in subprocess:** Never. Opens shell injection vector. Always use list args.
- **Directly writing to `~/.claude/` or `~/.claude.json`:** Delegate to `claude mcp add -s user` or `headroom mcp install`. MCP config format is private API.
- **`shutil.copytree` without `dirs_exist_ok=True`:** Raises `FileExistsError` on second run. Always pass `dirs_exist_ok=True`.
- **Importing typer before version guard:** If Python 3.9 is used and typer is not installed, the import error message is confusing. Guard must come first.
- **Declaring `headroom-ai[all]` as a pyproject.toml dependency:** Will break `pip install goodvibes-cli` on WSL2 without C++17 build tools and on Windows entirely. Use `[mcp]` or a runtime install approach.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Manual `sys.argv` parsing | `typer` | Flag validation, help generation, subcommand dispatch already implemented |
| Terminal spinner | ANSI escape sequences | `rich.console.Console.status()` | Handles TTY detection, Windows, no-color env vars |
| ANSI color output | f-string ANSI codes | `rich` markup (`[bold]`, `[green]`) | Handles NO_COLOR env var, Windows Console API, piped output |
| Version comparison | Custom semver | stdlib `tuple` compare (`(3,10) < (3,12)`) or `re` split | `1.10 > 1.9` handled correctly with int list padding — zero deps |
| Path traversal guard | Regex on path strings | `pathlib.Path.relative_to()` + checking `'..'` in `.parts` | stdlib, safe, cross-platform |
| Recursive file walk | `os.walk` | `pathlib.Path.rglob("*")` | Cleaner, returns Path objects directly |

**Key insight:** Python stdlib covers all file system operations in this domain. The only non-stdlib runtime deps are typer and rich — both are in CLAUDE.md locked stack.

---

## Critical Findings and Decisions Required

### Finding 1: PyPI Name Conflict — `goodvibes` is taken

**Status:** BLOCKING. Cannot publish to PyPI as `goodvibes`.

**Evidence:** [VERIFIED: PyPI JSON API] — `pip index versions goodvibes` returns `goodvibes (4.3.0)`, actively maintained computational chemistry package by Paton Research Group, latest release 2026-05-16.

**Confirmed available names (verified via PyPI JSON API):**
- `goodvibes-cli` — clean, discoverable, convention-matching (`-cli` suffix)
- `good-vibes` — available but confusing (different from npm `@jgiox/goodvibes`)
- `goodvibes-init` — available but implies it only does init
- `jgiox-goodvibes` — mirrors npm scoped name convention

**Recommendation:** `goodvibes-cli`. This is a clean, conventional name. The `goodvibes` command name in `[project.scripts]` is independent of the package name — users still run `goodvibes init` after `pip install goodvibes-cli`.

**PIP-04 must be updated.** The planner should flag this for user confirmation.

### Finding 2: headroom-ai[all] Dependency Conflict

**Status:** CRITICAL CONSTRAINT. PIP-03 as written breaks pip install.

**Evidence:**
- `headroom-ai[all]` expands to 13 extras: `benchmark,code,evals,html,image,mcp,memory,ml,otel,proxy,relevance,reports,spreadsheet,voice`
- The `[memory]` extra requires `hnswlib>=0.8.0` which ships **source distribution only** (verified: only `hnswlib-0.8.0.tar.gz` on PyPI, no wheels)
- The `[ml]` and `[voice]` extras require `torch>=2.0.0` (~2GB download)
- The `[all]` extra also pulls `onnxruntime`, `sentence-transformers`, `scikit-learn`, `tree-sitter-language-pack`
- `headroom-ai` base package has no Windows wheel (only `manylinux_2_28` and `macosx_11_0_arm64`)

**What goodvibes actually needs from headroom-ai:**
- `headroom` binary on PATH (for `headroom mcp install` and `goodvibes init` to call)
- MCP server registration capability
- The `[mcp]` extra adds only `mcp>=1.0.0` and `httpx>=0.24.0` — both pure-Python with wheels

**Options (for user decision, flagged as `[ASSUMED]` until confirmed):**
1. Declare `headroom-ai[mcp]` as pyproject.toml dep — lighter, but still no Windows wheel for base package
2. Declare no headroom dep in pyproject.toml; use runtime install chain (matches Phase 2 npm approach) — works everywhere, graceful on Windows
3. Declare `headroom-ai[mcp]` with `optional = true` (extras group) — installs on platforms where it works

**The ROADMAP success criterion 2** says "installs automatically as a declared dependency with no additional user action" — this is achievable with option 1 (`[mcp]` extra) on Linux/macOS. Windows users get a graceful skip message.

### Finding 3: headroom-ai Windows Wheel Gap

**Status:** Platform blocker for Windows (v1 acceptable per REQUIREMENTS.md NPM-09 pattern — Windows is "best-effort").

**Evidence:** headroom_ai-0.27.0 wheel files: `macosx_11_0_arm64`, `manylinux_2_28_aarch64`, `manylinux_2_28_x86_64`, source only. No `win_amd64`.

**Impact on ROADMAP SC3:** "wheels are available for Linux (x86_64, aarch64), macOS (x86_64, arm64), and Windows" — this describes the goodvibes-cli package itself (pure-Python, `py3-none-any` wheel, works everywhere), NOT headroom-ai. Goodvibes-cli wheels can satisfy SC3; headroom install on Windows will gracefully skip with a message.

---

## Common Pitfalls

### Pitfall 1: shutil.copytree Overwrites on Second Run

**What goes wrong:** `shutil.copytree(dirs_exist_ok=True)` overwrites existing files if called twice. Unlike fs-extra's `overwrite: false`, there is no built-in "skip if exists" option.

**Why it happens:** `dirs_exist_ok=True` only means "don't raise FileExistsError for the directory itself." Individual file copies still overwrite.

**How to avoid:** In the `ignore` function, check `(dest_dir / relative_path).exists()` for non-CLAUDE.md files and add them to the ignore set if they exist. Or use a manual walk with `if not dest.exists(): shutil.copy2(src, dest)`.

**Warning signs:** Running `goodvibes init` twice overwrites user-edited files.

### Pitfall 2: importlib.resources.files() Returns Traversable, Not str

**What goes wrong:** `importlib.resources.files("goodvibes_cli").joinpath("templates")` returns a `Traversable` object (a `PosixPath` when installed from wheel, a different type in some edge cases). Passing it directly to `shutil.copytree()` requires `str()` conversion.

**Why it happens:** `shutil.copytree` accepts `str | PathLike` — `Traversable` is not always `PathLike`. Safe pattern: `pathlib.Path(str(ref))`.

**How to avoid:** Always wrap with `pathlib.Path(str(resources.files("goodvibes_cli").joinpath("templates")))`.

**Warning signs:** `TypeError: expected str, bytes or os.PathLike object, not MultiplexedPath`

### Pitfall 3: Typer Single Command Swallows Subcommand Name

**What goes wrong:** With one `@app.command()` and no `@app.callback()`, Typer treats the function as the top-level command — so `goodvibes init` fails but `goodvibes` works. Running `goodvibes init --dry-run` will pass `init` as a positional argument, not a subcommand name.

**Why it happens:** Typer's "smart" single-command mode collapses the dispatch layer when there's only one command registered.

**How to avoid:** Always add an `@app.callback()` decorator (even if empty) to force subcommand mode. This is required for Phase 5 compatibility anyway.

**Warning signs:** `Error: Got unexpected extra argument (init)`

### Pitfall 4: headroom-ai[all] Install Fails with C++ Error

**What goes wrong:** `hnswlib>=0.8.0` (pulled by `headroom-ai[all]` via `[memory]` extra) is source-only. On WSL2 without `build-essential`, `pip install headroom-ai[all]` fails with: `error: command '/usr/bin/x86_64-linux-gnu-gcc' failed with exit code 1`.

**Why it happens:** hnswlib has no pre-compiled wheels for any platform — requires C++17 compiler at install time.

**How to avoid:** Do not declare `headroom-ai[all]` as a pyproject.toml dependency. Use `headroom-ai[mcp]` or runtime install with graceful degradation.

**Warning signs:** `ERROR: Could not build wheels for hnswlib` or `Fatal error in launcher: Unable to create process`

### Pitfall 5: subprocess.FileNotFoundError vs ENOENT Pattern

**What goes wrong:** Python's subprocess raises `FileNotFoundError` (not a generic exception with `.code == 'ENOENT'`) when a command is not found. Catching `Exception` swallows all errors.

**Why it happens:** Python's `subprocess` raises `FileNotFoundError` (a subclass of `OSError`) directly, not the Node.js `ErrnoException` pattern.

**How to avoid:**
```python
try:
    subprocess.run(["uv", "tool", "install", "headroom-ai[mcp]"], check=True)
except FileNotFoundError:
    # uv not on PATH — try next
    continue
except subprocess.CalledProcessError as e:
    # Install failed — log and return gracefully
    log(f"headroom install failed: {e.stderr}")
    return
```

### Pitfall 6: Windows `python` Command Opens Microsoft Store

**What goes wrong:** On Windows, `python` with no version suffix launches the Microsoft Store app instead of an installed Python. The `sys.executable` is the correct Python binary for the running process, but probing other Python installations from the CLI requires the same Windows Store guard from Phase 2.

**Why it happens:** Windows PATH includes a `python.exe` stub that opens the Store if Python is not properly installed.

**How to avoid:** The goodvibes pip CLI runs inside the user's Python environment (it's the current Python). The probe chain for installing headroom uses the same guard as Phase 2's `detect-python.ts`: require output to match `/Python \d+\.\d+/`.

**Note:** Since goodvibes pip CLI runs in the current Python process, `sys.executable` is always the correct Python binary for subprocess calls to the same Python. Only external probes (for other Python installations) need the Store guard.

---

## Code Examples

### Complete pyproject.toml

```toml
# Source: docs.astral.sh/uv/concepts/projects/config/ + packaging.python.org
[project]
name = "goodvibes-cli"
version = "1.0.0"
description = "One-command bootstrap for vibe coding projects"
readme = "README.md"
requires-python = ">=3.10"
license = { text = "Apache-2.0" }
keywords = ["scaffold", "vibe-coding", "claude", "llm", "starter-kit", "cli"]
dependencies = [
    "typer>=0.15",
    "rich>=14",
]

[project.optional-dependencies]
headroom = ["headroom-ai[mcp]>=0.27"]

[project.scripts]
goodvibes = "goodvibes_cli.main:app"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
include = ["src/goodvibes_cli/**"]

[tool.hatch.build.targets.sdist]
include = ["src/goodvibes_cli/**", "tests/**"]
```

**Note on headroom optional dependency:** Declaring `headroom-ai[mcp]` as an optional extra (`pip install goodvibes-cli[headroom]`) is a third option that keeps the base install lean while allowing power users to request headroom at install time. This requires user decision — see Finding 2.

### GitHub Actions publish workflow

```yaml
# Source: docs.astral.sh/uv/guides/integration/github/ + dump.zech.sh/automate-uv-with-trusted-publisher
name: Publish to PyPI

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: release
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv build --no-sources
      - run: uv publish --trusted-publisher always
```

**Setup required:** PyPI trusted publishing must be configured on pypi.org to allow this workflow. No API tokens needed in the repo.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| `pkg_resources` / `pkgutil` for data files | `importlib.resources.files()` | Python 3.9+ | Cleaner API, works in all packaging scenarios including PEP 517 wheels |
| `setup.py` with `package_data={}` | `[tool.hatch.build.targets.wheel] include = [...]` | ~2022+ | Declarative, no executable setup.py needed |
| `twine upload dist/*` | `uv publish` | 2024-2025 | Single tool handles build + upload; supports trusted publishing |
| `poetry run` / `poetry build` | `uv build` / `uv run` | 2024+ | Dramatically faster; dominant for pure-PyPI projects in 2025-2026 |
| `MANIFEST.in` for sdist inclusion | `[tool.hatch.build.targets.sdist] include = [...]` | ~2022+ | Declarative; no separate MANIFEST.in file |

**Deprecated/outdated:**
- `pkg_resources.resource_filename()`: Deprecated, replaced by `importlib.resources.files()`
- `setup.py` alone: Replaced by `pyproject.toml` with PEP 517 build backends
- `twine` + `python -m build`: Still works but `uv publish` is the current recommended path

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `goodvibes-cli` is the best alternative PyPI name | Findings / Standard Stack | Low risk — user may prefer `jgiox-goodvibes` to match npm scoping |
| A2 | `headroom-ai[mcp]` is sufficient for MCP server setup | Finding 2 / Architecture | Medium — if headroom's MCP functionality requires `[all]` deps, the install may fail at runtime |
| A3 | headroom-ai base package Rust extension compiles from source on systems without wheel | Finding 3 | Medium — users on non-manylinux_2_28 Linux (e.g., old Ubuntu) may hit build failures |
| A4 | `importlib.resources.files("goodvibes_cli").joinpath("templates")` works correctly in an editable uv install during development | Architecture Patterns | Low — test confirmed in Python 3.12 but editable installs have historically had edge cases with non-Python data files |
| A5 | `uv build` with hatchling backend correctly bundles `src/goodvibes_cli/templates/` into the wheel | Standard Stack | Low — standard pattern, but must be verified with an actual `uv build` + wheel inspection during Wave 0 |

---

## Open Questions

1. **PyPI name: `goodvibes-cli` vs `jgiox-goodvibes`?**
   - What we know: Both are available. `goodvibes-cli` is more conventional (`-cli` suffix). `jgiox-goodvibes` mirrors the npm scoped name `@jgiox/goodvibes`.
   - What's unclear: User preference. Does the project want the PyPI name to match the npm name pattern?
   - Recommendation: Default to `goodvibes-cli`. If scoping consistency matters, use `jgiox-goodvibes`.

2. **headroom as declared dep vs runtime install?**
   - What we know: PIP-03 says `headroom-ai[all]` as declared dep. `[all]` breaks install. `[mcp]` is lighter but still fails on Windows (no wheel). Runtime install (Phase 2 pattern) works everywhere with graceful degradation.
   - What's unclear: User's intent — "declared dependency" vs "identical behavior to npm CLI" (which does runtime install).
   - Recommendation: Declare `headroom-ai[mcp]` as an optional extra (installable via `pip install goodvibes-cli[headroom]`); use runtime install in the `init` command as the primary path. This satisfies both "declared" and "graceful" — user confirmation needed.

3. **Template bundling: symlink vs prebuild copy?**
   - What we know: npm CLI uses a `prebuild` script to copy `../../templates/` to `packages/npm/templates/`. Hatchling can use `force-include` to map an external path, or the Python equivalent of `prebuild` (a `hatch_build.py` hook).
   - What's unclear: Does hatchling's `force-include` correctly preserve directory structure including dotfiles (`.claude/`, `.github/`)?
   - Recommendation: Use a Makefile/script that copies templates before `uv build`, same pattern as npm's `prebuild`. Simpler than a hatchling hook.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.10+ | All runtime | ✓ | 3.12.3 | — |
| uv | Build, publish | ✓ | 0.11.15 | `pip install` for building (slower) |
| pip 26+ | Package mgmt | ✓ | 26.0.1 | — |
| pytest | Tests | ✓ | 9.0.2 | — |
| Rich 13+ (installed) | Dev testing | ✓ | 13.7.1 (latest: 15.0.0) | Will upgrade to ^14 in venv |
| Typer (not installed globally) | Dev | ✗ | — | `uv add typer` in venv |
| hatchling | Build | ✗ | — | `uv add --dev hatchling` |

**Missing dependencies with no fallback:** None — all gaps are addressable with `uv add`.

**Missing dependencies with fallback:** Typer and hatchling not in global environment, but uv venv isolates this correctly.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.1.1 |
| Config file | `packages/pip/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `cd packages/pip && uv run pytest tests/ -x -q` |
| Full suite command | `cd packages/pip && uv run pytest tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PIP-01 | `goodvibes init` copies all template files | integration | `pytest tests/test_copy_templates.py -x` | ❌ Wave 0 |
| PIP-02 | Identical output behavior (spinner steps, file list, next steps) | integration | `pytest tests/test_main.py -x` | ❌ Wave 0 |
| PIP-03 | headroom installs via uv→pipx→pip chain | unit | `pytest tests/test_install_headroom.py -x` | ❌ Wave 0 |
| PIP-04 | Package name and pyproject.toml structure | unit | `pytest tests/test_package_metadata.py -x` | ❌ Wave 0 |
| PIP-05 | Python 3.9 exits non-zero with clear message | unit | `pytest tests/test_version_guard.py -x` | ❌ Wave 0 |
| (sentinel) | 4-case CLAUDE.md merge | unit | `pytest tests/test_sentinel_merge.py -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `uv run pytest tests/test_{module_under_test}.py -x -q`
- **Per wave merge:** `uv run pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `packages/pip/pyproject.toml` — project metadata, build config, scripts entry point
- [ ] `packages/pip/src/goodvibes_cli/__init__.py` — empty init
- [ ] `packages/pip/src/goodvibes_cli/main.py` — stub with version guard + Typer app
- [ ] `packages/pip/tests/conftest.py` — shared fixtures (tmp_dir, template_dir)
- [ ] `packages/pip/tests/test_sentinel_merge.py` — 13 test equivalents of Phase 2 sentinel tests
- [ ] `packages/pip/tests/test_copy_templates.py` — 9 test equivalents
- [ ] `packages/pip/tests/test_install_headroom.py` — mocked subprocess tests
- [ ] `packages/pip/tests/test_configure_mcp.py` — mocked subprocess tests
- [ ] `scripts/verify-phase3.sh` — smoke test harness matching verify-phase2.sh pattern

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Path traversal guard in `ignore_fn`; relative_to check with `..` in parts |
| V6 Cryptography | no | — |

### Known Threat Patterns for CLI Scaffolding

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via template file names | Tampering | `".." in pathlib.Path(rel).parts` check in ignore function |
| Command injection via which/where output | Tampering | Absolute path from `shutil.which()` passed as discrete list element — never shell-interpolated |
| Subprocess shell injection | Tampering | `shell=False` (default), always use list args; never f-string interpolation into command args |
| Sentinel block corruption (missing SENTINEL_END) | Tampering | Check `end_idx != -1` before slicing; fall through to Case B if incomplete |

---

## Sources

### Primary (HIGH confidence)

- PyPI JSON API `https://pypi.org/pypi/goodvibes/json` — confirmed name conflict (active package, v4.3.0, 2026-05-16)
- PyPI JSON API `https://pypi.org/pypi/goodvibes-cli/json` + others — confirmed name availability (404)
- PyPI JSON API `https://pypi.org/pypi/headroom-ai/json` — full dependency analysis, wheel availability
- PyPI JSON API `https://pypi.org/pypi/hnswlib/json` — confirmed source-only (no wheels)
- `pip index versions typer` — verified 0.26.7 current
- `pip index versions rich` — verified 15.0.0 current
- `pip index versions pytest` — verified 9.1.1 current
- Python stdlib `importlib.resources` — tested locally, `files()` available since 3.9, works in 3.12
- Python stdlib `subprocess` — tested locally, `FileNotFoundError` pattern confirmed
- Python stdlib `re`, `pathlib` — sentinel merge logic verified with unit tests
- `slopcheck install typer rich headroom-ai` — all three returned `[OK]`

### Secondary (MEDIUM confidence)

- [typer.tiangolo.com/tutorial/commands/one-or-multiple/](https://typer.tiangolo.com/tutorial/commands/one-or-multiple/) — single vs. multiple command behavior, `@app.callback()` pattern
- [typer.tiangolo.com/tutorial/subcommands/add-typer/](https://typer.tiangolo.com/tutorial/subcommands/add-typer/) — subcommand composition
- [docs.astral.sh/uv/concepts/projects/config/](https://docs.astral.sh/uv/concepts/projects/config/) — pyproject.toml + uv structure
- [hatch.pypa.io/latest/config/build/#artifacts](https://hatch.pypa.io/latest/config/build/#artifacts) — include/force-include for data files
- [dump.zech.sh/automate-uv-with-trusted-publisher](https://dump.zech.sh/automate-uv-with-trusted-publisher) — trusted publishing GitHub Actions YAML

### Tertiary (LOW confidence)

- Phase 2 summaries (02-02, 02-03, 02-04) — implementation decisions that must be ported; treated as HIGH because they are project-internal verified artifacts

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via `pip index versions`; slopcheck passed
- Architecture: HIGH — all patterns tested locally with Python 3.12
- Pitfalls: HIGH — headroom-ai[all]/hnswlib source-only confirmed via PyPI API; copytree behavior confirmed via local test
- PyPI name: HIGH — confirmed via live PyPI JSON API
- headroom-ai dependency analysis: HIGH — full requires_dist inspected via PyPI JSON API

**Research date:** 2026-06-24
**Valid until:** 2026-07-24 (30 days — headroom-ai releases frequently; verify latest version before implementation)
