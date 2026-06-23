# Phase 1: Template Content & Repo Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 1-Template Content & Repo Foundation
**Areas discussed:** CLAUDE.md source material, Ponytail auto-activation, Templates directory structure, Docs completeness & tone

---

## CLAUDE.md Source Material

| Option | Description | Selected |
|--------|-------------|----------|
| multica-ai/andrej-karpathy-skills | Fetch CLAUDE.md from that repo and curate down | |
| Specific file locally | User has their own source file to provide | ✓ |
| Write from scratch | Author directly from known karpathy principles | |

**User's choice:** User provided their Code Directions.md (`C:\Users\YiannisGiokas\Downloads\Code Directions.md`)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Code Directions.md is the full source | No separate karpathy fetch — Code Directions.md covers all 6 required topics | ✓ |
| Karpathy adds a few specific rules | 1-3 specific karpathy rules to fold in | |
| Fetch karpathy CLAUDE.md and merge | Pull multica-ai/andrej-karpathy-skills and combine explicitly | |

**User's choice:** Code Directions.md is the full source.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Rules only — strip examples | Keep rule + required behavior, drop Good/Bad, enforcement, questions | ✓ |
| Rules + one example each | Keep rule + one Good/Bad example per section | |
| Only the 6 one-liners | Distill to 6 bullet points, one per topic | |

**User's choice:** Rules only — strip examples (recommended).

---

## Ponytail Auto-Activation

| Option | Description | Selected |
|--------|-------------|----------|
| Embed rules inline | Ponytail minimalism rules embedded in CLAUDE.md, activate every session | ✓ |
| Instruct Claude to activate plugin | CLAUDE.md tells Claude to use ponytail plugin (requires plugin installed) | |
| goodvibes-hygiene skill handles it | CLAUDE.md silent; hygiene skill enforces minimalism | |

**User's choice:** Embed rules inline.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Core YAGNI rules only | 3-5 lines covering no unused code, no speculative abstractions | |
| Full ponytail ruleset | All ponytail minimalism checks embedded | ✓ |
| Reference plugin + inline essentials | Hybrid approach | |

**User's choice:** Full ponytail ruleset.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch from DietrichGebert/ponytail | Researcher pulls exact ruleset from GitHub | ✓ |
| User describes the rules | From memory | |
| Claude derives from known purpose | Based on ponytail's known focus | |

**User's choice:** Fetch from DietrichGebert/ponytail (recommended).

---

## Templates Directory Structure

| Option | Description | Selected |
|--------|-------------|----------|
| templates/ at repo root | One top-level directory, both CLIs reference it | ✓ |
| packages/shared/templates/ | Templates inside a shared monorepo package | |

**User's choice:** templates/ at repo root.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Both CLIs read at runtime (bundled) | No symlinks; templates/ included at build time | ✓ |
| Actual filesystem symlinks | packages/npm/templates → ../../templates | |
| Copy-on-build script | Makefile/script syncs at build time | |

**User's choice:** Both CLIs read from templates/ at runtime (recommended).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror the target project layout | Straight copy, no path translation | ✓ |
| Separate by category | templates/skills/, templates/workflows/, etc. | |

**User's choice:** Mirror target project layout.

---

| Option | Description | Selected |
|--------|-------------|----------|
| packages/npm/ and packages/pip/ | Under top-level packages/ directory | ✓ |
| npm/ and pip/ at root | Flat structure | |

**User's choice:** packages/npm/ and packages/pip/ (recommended).

---

## Docs Completeness & Tone

| Option | Description | Selected |
|--------|-------------|----------|
| Fully written for generic project | Real prose, no placeholders, usable as-is | ✓ |
| Well-structured stubs with conventions | Headers + 1-2 sentences per section | |
| Detailed and project-aware | References 'goodvibes' specifically — not template-ready | |

**User's choice:** Fully written for a generic project.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Git basics + PR workflow only | ~400-600 words, exactly what DOCS-07 specifies | ✓ |
| Full end-to-end: git + CI explained | Also explains CI, ~800-1200 words | |
| Minimal: link to external resource | Short doc linking to GitHub's own guides | |

**User's choice:** Git basics + PR workflow only (recommended).

---

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub YAML format | Structured form fields, renders as form UI | ✓ |
| Markdown (.md) | Plain text templates | |

**User's choice:** GitHub YAML format (recommended).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Hero + what it does + four layers | npx command prominent + brief description + four layers | ✓ |
| Hero only | Minimal README, everything deferred to Phase 2 | |
| Full README with feature list | Complete documentation premature for Phase 1 | |

**User's choice:** Hero + what it does + four layers (recommended).

---

## Claude's Discretion

None — all areas had explicit user decisions.

## Deferred Ideas

None — discussion stayed within phase scope.
