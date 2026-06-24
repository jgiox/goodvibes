# Phase 3 Validation

**Phase:** 03-pip-cli
**Package:** jgiox-goodvibes (PyPI name per D-01)

## Gate Status

| Gate | Status |
|------|--------|
| nyquist_compliant | true |
| wave_0_complete | true |
| wave_1_complete | true |
| wave_2_complete | true |
| pypi_published | false — awaiting human checkpoint (trusted publishing setup + git tag) |

## Quick Run

Tests only (no build):

```bash
bash scripts/verify-phase3.sh --quick
```

## Full Run

All static checks + build + install + test:

```bash
bash scripts/verify-phase3.sh
```

## Per-Plan Commands

| Plan | Command | Expected |
|------|---------|----------|
| 03-01 (Wave 0) | `bash scripts/verify-phase3.sh --quick` | Phase 3 gate: PASS |
| 03-01 (Wave 0) | `cd packages/pip && uv run pytest tests/ -x -q` | all skip, 0 fail |
| 03-02 (Wave 1a) | `cd packages/pip && uv run pytest tests/test_sentinel_merge.py tests/test_copy_templates.py -v` | 22 passed |
| 03-03 (Wave 1b) | `cd packages/pip && uv run pytest tests/test_install_headroom.py tests/test_configure_mcp.py -v` | 14 passed |
| 03-04 (Wave 2) | `cd packages/pip && uv run pytest tests/ -v` | all passed |
| 03-04 (Wave 2) | `bash scripts/verify-phase3.sh` | Phase 3 gate: PASS |

## Phase Gate

Phase 3 is DONE when:
1. `bash scripts/verify-phase3.sh` exits 0 with "Phase 3 gate: PASS"
2. `cd packages/pip && uv run pytest tests/ -v` exits 0, 0 failed
3. Human checkpoint in 03-04 approved (type "published" or "defer-publish")
4. PyPI: `pip index versions jgiox-goodvibes` returns 1.0.0 (or defer-publish decision recorded)
