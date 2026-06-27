---
phase: "07-readme-demo"
plan: "02"
subsystem: "demo"
status: "complete"
tags: ["vhs", "demo", "gif", "tape"]
dependency_graph:
  requires: []
  provides: ["scripts/demo.tape", "docs/demo.gif (produced by CI via Plan 03)"]
  affects: ["README.md (Plan 01)", ".github/workflows/vhs.yml (Plan 03)"]
tech_stack:
  added: []
  patterns: ["VHS tape declarative recording", "Hide/Show noise suppression"]
key_files:
  created:
    - scripts/demo.tape
  modified: []
decisions:
  - "Wait+Screen /\\$/ 60s chosen (not 30s) per research Open Questions #2 — for cold npx CI"
  - "Set Framerate 24 to keep GIF under 2MB (Pitfall 5 mitigation)"
  - "Hide/Show wraps mkdir + npx cold-start to suppress download noise"
  - "docs/demo.gif deferred to CI (Option B) — vhs.yml (Plan 03) will produce and commit it on first push to main"
metrics:
  duration: "~2 minutes (Task 1 automated; Task 2 resolved via CI delegation)"
  completed_date: "2026-06-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 0
---

# Phase 07 Plan 02: Demo Tape and GIF Summary

**One-liner:** VHS tape at scripts/demo.tape recording npx goodvibes init --minimal --dry-run in an 800px Dracula terminal; docs/demo.gif will be auto-produced by CI (Plan 03 vhs.yml) on first push to main.

## Status: Complete

Task 1 complete and committed. Task 2 resolved via Option B — CI delegation. `scripts/demo.tape` is committed; `docs/demo.gif` will be produced and committed automatically by the vhs.yml workflow (Plan 03) the first time `scripts/demo.tape` is pushed to main.

## Tasks

| # | Name | Status | Commit |
|---|------|--------|--------|
| 1 | Create scripts/demo.tape | COMPLETE | 09adeda |
| 2 | Produce and validate docs/demo.gif | RESOLVED (CI delegation) | via Plan 03 |

## Task 1: scripts/demo.tape

Created `scripts/demo.tape` with all required VHS settings. Verified:
- First non-comment line: `Output docs/demo.gif`
- `Set Width 800` (DEMO-01 800px requirement)
- `Set Theme "Dracula"` (dark terminal per D-11)
- `Set Framerate 24` (GIF size control, Pitfall 5 mitigation)
- `Hide`/`Show` wrapping `mkdir myproject && cd myproject` and npx cold-start
- Main command: `npx goodvibes init --minimal --dry-run` (per D-10)
- `Wait+Screen /\$/ 60s` (60s for CI cold-start, per research resolution)
- `Sleep 2s` pause at end before loop

## Task 2: docs/demo.gif — CI Delegation

User chose Option B: VHS not installed locally. `scripts/demo.tape` is committed to main. Plan 03 (vhs.yml) will create the GitHub Actions workflow that auto-runs `vhs scripts/demo.tape` and commits `docs/demo.gif` on every push that changes the tape. First CI trigger will populate the GIF.

## Deviations from Plan

None for Task 1. Task 2 resolved via documented Option B rather than local VHS execution.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. `scripts/demo.tape` is a static declarative script. `docs/demo.gif` is a binary asset. Both within threat model (T-07-04, T-07-05, T-07-06).

## Self-Check

- [x] scripts/demo.tape exists at commit 09adeda
- [x] docs/demo.gif — deferred to CI (Plan 03); will appear after first vhs.yml trigger on main
