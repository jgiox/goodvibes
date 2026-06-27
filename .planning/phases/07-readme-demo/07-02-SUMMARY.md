---
phase: "07-readme-demo"
plan: "02"
subsystem: "demo"
status: "partial-checkpoint"
tags: ["vhs", "demo", "gif", "tape"]
dependency_graph:
  requires: []
  provides: ["scripts/demo.tape", "docs/demo.gif (pending checkpoint)"]
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
metrics:
  duration: "~2 minutes (Task 1 only; checkpoint at Task 2)"
  completed_date: "2026-06-27"
  tasks_completed: 1
  tasks_total: 2
  files_created: 1
  files_modified: 0
---

# Phase 07 Plan 02: Demo Tape and GIF Summary

**One-liner:** VHS tape at scripts/demo.tape recording npx goodvibes init --minimal --dry-run in an 800px Dracula terminal; docs/demo.gif pending human checkpoint.

## Status: Partial — Checkpoint at Task 2

Task 1 is complete and committed. Task 2 (produce docs/demo.gif) requires human action — either running `vhs scripts/demo.tape` locally or waiting for Plan 3 (vhs.yml CI) to produce the GIF automatically.

## Tasks

| # | Name | Status | Commit |
|---|------|--------|--------|
| 1 | Create scripts/demo.tape | COMPLETE | 09adeda |
| 2 | Produce and validate docs/demo.gif | PENDING CHECKPOINT | — |

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

## Task 2: Produce docs/demo.gif (PENDING)

Checkpoint: `human-verify`. The tape is committed; docs/demo.gif must be produced by running VHS locally or via CI (Plan 3 vhs.yml).

## Deviations from Plan

None - Task 1 executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. `scripts/demo.tape` is a static declarative script. `docs/demo.gif` is a binary asset. Both are within the threat model documented in the plan (T-07-04, T-07-05, T-07-06).

## Self-Check

- [x] scripts/demo.tape exists at commit 09adeda
- [ ] docs/demo.gif — pending Task 2 checkpoint
