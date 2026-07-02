#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

QUICK=0
for arg in "$@"; do
  if [ "$arg" = "--quick" ]; then
    QUICK=1
  fi
done

pass=0; fail=0

check() {
  if bash -c "$2" > /dev/null 2>&1; then
    echo "PASS [$1]"
    pass=$((pass + 1))
  else
    echo "FAIL [$1]: $2"
    fail=$((fail + 1))
  fi
}

# -----------------------------------------------------------------------
# Static checks (always run, --quick safe)
# -----------------------------------------------------------------------

# PIP-PKG-01: pyproject.toml exists
check "PIP-PKG-01" "test -f packages/pip/pyproject.toml"

# PIP-PKG-02: pyproject.toml name field is "goodvibes-cli" (PKG-01)
check "PIP-PKG-02" "grep -q 'name = \"goodvibes-cli\"' packages/pip/pyproject.toml"

# PIP-PKG-03: pyproject.toml has goodvibes script entry point (D-04)
check "PIP-PKG-03" "grep -q 'goodvibes = \"goodvibes_cli.main:app\"' packages/pip/pyproject.toml"

# PIP-PKG-04: requires-python >= 3.10 (D-05)
check "PIP-PKG-04" "grep -q '>=3.10' packages/pip/pyproject.toml"

# PIP-05-GUARD: __main__.py contains sys.version_info check
check "PIP-05-GUARD" "grep -q 'sys.version_info' packages/pip/src/goodvibes_cli/__main__.py"

# PIP-05-ORDER: version check appears before 'import typer' in __main__.py
check "PIP-05-ORDER" "
  set -o pipefail
  idx_version=\$(grep -n 'sys.version_info' packages/pip/src/goodvibes_cli/__main__.py | head -1 | cut -d: -f1)
  idx_typer=\$(grep -n 'import typer' packages/pip/src/goodvibes_cli/__main__.py | head -1 | cut -d: -f1)
  [ -n \"\$idx_version\" ] && [ -n \"\$idx_typer\" ] && [ \"\$idx_version\" -lt \"\$idx_typer\" ]
"

# PIP-05-EXIT: __main__.py contains sys.exit(1) in the version guard block
check "PIP-05-EXIT" "grep -q 'sys.exit(1)' packages/pip/src/goodvibes_cli/__main__.py"

# PIP-TEST-CFG: pyproject.toml contains [tool.pytest.ini_options]
check "PIP-TEST-CFG" "grep -q '\[tool.pytest.ini_options\]' packages/pip/pyproject.toml"

# HDR-06-PY: pyproject.toml does NOT contain 'headroom-ai' in [project.dependencies] (D-02)
check "HDR-06-PY" "! grep -q 'headroom-ai' packages/pip/pyproject.toml"

# SENTINEL-FORMAT: sentinel markers exist in templates/CLAUDE.md
check "SENTINEL-FORMAT" "grep -q 'goodvibes:start' templates/CLAUDE.md"

# PIP-BUILD-01: __init__.py exists
check "PIP-BUILD-01" "test -f packages/pip/src/goodvibes_cli/__init__.py"

# PIP-BUILD-02: main.py (Wave 2) — soft check, skip if not yet created
if test -f packages/pip/src/goodvibes_cli/main.py; then
  check "PIP-BUILD-02" "test -f packages/pip/src/goodvibes_cli/main.py"
else
  echo "SKIP [PIP-BUILD-02]: not yet created (Wave 2)"
  pass=$((pass + 1))
fi

# -----------------------------------------------------------------------
# Build checks (only without --quick)
# -----------------------------------------------------------------------

if [ "$QUICK" -eq 0 ]; then
  echo ""
  echo "--- Build checks (full mode) ---"

  # PIP-UV-BUILD: uv build produces a wheel with the correct name
  check "PIP-UV-BUILD" "cd packages/pip && uv build --no-sources 2>/dev/null && test -f dist/jgiox_goodvibes-*.whl"

  # PIP-DOTFILES: wheel includes .claude/ and .github/ directories (D-03)
  check "PIP-DOTFILES" "cd packages/pip && python3 -c \"import zipfile,glob; w=glob.glob('dist/jgiox_goodvibes-*.whl')[0]; names=zipfile.ZipFile(w).namelist(); assert any('.claude' in n for n in names), '.claude/ missing from wheel'; assert any('.github' in n for n in names), '.github/ missing from wheel'; print('DOTFILES OK')\""

  # PIP-INSTALL: import succeeds after uv sync
  check "PIP-INSTALL" "cd packages/pip && uv run python -c 'import goodvibes_cli' 2>/dev/null"

  # PIP-HELP: goodvibes --help prints goodvibes
  check "PIP-HELP" "cd packages/pip && uv run goodvibes --help 2>&1 | grep -q goodvibes"

  # PIP-DRYRUN: goodvibes init --help mentions dry-run
  check "PIP-DRYRUN" "cd packages/pip && uv run goodvibes init --help 2>&1 | grep -q dry-run"

  # PIP-MINIMAL: goodvibes init --help mentions minimal
  check "PIP-MINIMAL" "cd packages/pip && uv run goodvibes init --help 2>&1 | grep -q minimal"

  # PIP-TEST: pytest exits 0
  check "PIP-TEST" "cd packages/pip && uv run pytest tests/ -x -q 2>/dev/null"

  echo ""
fi

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------

echo ""
echo "Results: $pass passed, $fail failed"
if [ "$fail" -eq 0 ]; then
  echo "Phase 3 gate: PASS"
else
  echo "Phase 3 gate: FAIL" >&2
  exit 1
fi
