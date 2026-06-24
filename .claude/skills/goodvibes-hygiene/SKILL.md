---
name: goodvibes-hygiene
description: >
  On-demand code minimalism audit using ponytail commands. Wraps /ponytail-review
  (diff audit) and /ponytail-audit (whole-repo scan) with goodvibes context.
  Ponytail's always-on rules are already active via CLAUDE.md. Use these commands
  for explicit on-demand audits.
  Use when user says "review for over-engineering", "audit for complexity",
  "check for bloat", "is this over-engineered", or invokes /ponytail-review or
  /ponytail-audit directly.
---

# goodvibes hygiene

Ponytail rules are already always-on in your CLAUDE.md. These commands add
explicit on-demand audits.

## Setup

Ponytail commands require the ponytail plugin. Install it in Claude Code:

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

(Desktop app: Customize → + by personal plugins → Create plugin → Add from repository →
enter `https://github.com/DietrichGebert/ponytail`)

## Commands

- `/ponytail-review` — Review the current diff for over-engineering. One line per
  finding: location, what to cut, what replaces it.
- `/ponytail-audit` — Scan the entire repo for unnecessary complexity. Ranked list,
  biggest cut first.

## What the always-on rules already do

Every response already applies the ponytail decision ladder (from your CLAUDE.md):
simplest solution that works, stdlib before custom code, deletion before addition.
The commands above are for explicit audit reports — use them when you want a
structured review, not just session behavior.
