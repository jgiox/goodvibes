---
plan: "11-04"
phase: "11"
status: complete
---

# Plan 11-04: PyPI OIDC + Tombstone Stubs

## Objective

Human checkpoint for PyPI OIDC trusted publisher configuration plus tombstone stubs for old package names.

## Tasks Completed

### Task 1: Human Checkpoint — PyPI OIDC + npm deprecate
- PyPI trusted publisher configured for `goodvibes-cli` on pypi.org (GitHub Actions / jgiox/goodvibes / publish-pip.yml / release environment)
- `npm deprecate "@jgiox/goodvibes@*"` run successfully — verified via `npm view @jgiox/goodvibes deprecated`

### Task 2: Tombstone Stubs
- `packages/pip-tombstone/pyproject.toml`: stub wheel `jgiox-goodvibes v2.0.0` with `dependencies = ["goodvibes-cli"]` — pip auto-installs the renamed package for users on the old name
- `packages/npm-tombstone/package.json`: documents the npm deprecate command; no npm publish needed (deprecation is registry-level)
- JOURNAL.md updated with Phase 11 completion entry

## Key Files Created

- `packages/pip-tombstone/pyproject.toml`
- `packages/npm-tombstone/package.json`

## Self-Check: PASSED

- [x] PyPI OIDC trusted publisher confirmed (human-verified)
- [x] npm @jgiox/goodvibes deprecated with redirect message (verified via npm view)
- [x] packages/pip-tombstone/pyproject.toml exists, contains goodvibes-cli in dependencies
- [x] packages/npm-tombstone/package.json exists with deprecation documentation
- [x] JOURNAL.md updated with Phase 11 completion entry
