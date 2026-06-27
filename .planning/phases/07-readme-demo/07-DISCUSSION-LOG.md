# Phase 7: README & Demo - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 7-readme-demo
**Areas discussed:** README hero layout, Demo tape content, VHS CI commit strategy, Badge style & order

---

## README Hero Layout

### Hero structure question

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal reorder | Keep existing structure, move prereqs further down, embed GIF under hero command | |
| Hero redesign | Add tagline, badges under title, GIF prominently in center, command in Quick start section | ✓ |
| Keep structure, just add GIF + badges | Minimal change — insert GIF and badges without reordering sections | |

**User's choice:** Hero redesign

### GIF position

| Option | Description | Selected |
|--------|-------------|----------|
| After tagline, before Quick start | title → tagline → badges → GIF → command | ✓ |
| After Quick start command | title → tagline → badges → command → GIF | |

**User's choice:** After the tagline, before Quick start (Recommended)

### Tagline

| Option | Description | Selected |
|--------|-------------|----------|
| Clean code, token efficiency, and CI — automatic. | Benefit-led, concise | |
| One command. Production-grade project. No config. | Outcome-led, emphasizes zero-config | ✓ |
| You decide (Claude picks) | Claude selects best fit | |

**User's choice:** "One command. Production-grade project. No config."

---

## Demo Tape Content

### Context before goodvibes command

| Option | Description | Selected |
|--------|-------------|----------|
| Show mkdir + cd first | Opens with mkdir myproject && cd myproject, then the npx command | ✓ |
| Start directly with goodvibes command | Tape opens cold with the npx command | |

**User's choice:** Show mkdir + cd first (Recommended)

### Terminal theme

| Option | Description | Selected |
|--------|-------------|----------|
| Dark theme | VHS default dark terminal | ✓ |
| Light theme | Better for light mode readers | |
| You decide | Claude picks best rendering | |

**User's choice:** Dark theme (Recommended)

---

## VHS CI Commit Strategy

### Commit-back method

| Option | Description | Selected |
|--------|-------------|----------|
| git-auto-commit-action | stefanzweifel/git-auto-commit-action@v5, GITHUB_TOKEN | ✓ |
| Raw git commands | git config + add + commit + push in run: block | |

**User's choice:** git-auto-commit-action (Recommended)

### Workflow trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Push to main when demo.tape changes | paths: ['scripts/demo.tape'] on push to main | ✓ |
| Push to main + manual trigger | Same plus workflow_dispatch | |

**User's choice:** Push to main when demo.tape changes (Recommended)

---

## Badge Style & Order

### Badge order

| Option | Description | Selected |
|--------|-------------|----------|
| npm → PyPI → CI → License | Installation methods first, then quality signals | ✓ |
| CI → License → npm → PyPI | Quality/trust signals first | |
| License → CI → npm → PyPI | Apache 2.0 prominent first | |

**User's choice:** npm → PyPI → CI → License (Recommended)

### Badge style

| Option | Description | Selected |
|--------|-------------|----------|
| flat-square | Clean, modern, no rounded corners | ✓ |
| flat | Rounded corners, traditional Shields.io default | |
| for-the-badge | Uppercase, rectangular, bold | |

**User's choice:** flat-square (Recommended)

---

## Claude's Discretion

None — user made explicit choices for all presented options.

## Deferred Ideas

None — discussion stayed within phase scope.
