import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveTemplatesDir } from './copy-templates.js'

const read = (rel: string) => readFileSync(join(resolveTemplatesDir(), rel), 'utf-8')

const AGENTS_COPIES = [
  '.windsurfrules',
  'GEMINI.md',
  '.clinerules/goodvibes.md',
  '.amazonq/rules/goodvibes.md',
  '.continue/rules/goodvibes.md',
  '.devin/rules/goodvibes.md',
]
const RULE_FILES = [
  'CLAUDE.md',
  'AGENTS.md',
  ...AGENTS_COPIES,
  '.github/copilot-instructions.md',
  '.cursor/rules/goodvibes.mdc',
  '.kiro/steering/goodvibes.md',
  'replit.md',
  '.bolt/prompt',
]

describe('agent rule files (AGENT-01..04)', () => {
  it.each(RULE_FILES)('%s uses directive language with no should / consider / try to hedges', rel => {
    expect(read(rel)).not.toMatch(/\b(should|consider|try to)\b/i)
  })

  it.each([...RULE_FILES, 'JOURNAL.md'])('%s tells every agent to read JOURNAL.md before acting and treat it as binding', rel => {
    const text = read(rel)
    expect(text).toMatch(/read (JOURNAL\.md|it) before acting/i)
    expect(text).toMatch(/binding/i)
  })

  it('CLAUDE.md forbids re-asking for information and names every source', () => {
    expect(read('CLAUDE.md')).toContain(
      'Never ask the user for information already answered in README.md, CLAUDE.md, AGENTS.md, JOURNAL.md, or the codebase.',
    )
  })

  it('copilot-instructions.md claims authority for Copilot and AGENTS.md calls itself only a fallback', () => {
    expect(read('.github/copilot-instructions.md')).toContain('authoritative rule file for GitHub Copilot')
    expect(read('AGENTS.md')).toMatch(/cross-tool fallback.*not guaranteed/)
  })

  it.each(AGENTS_COPIES)('%s stays byte-identical to AGENTS.md', rel => {
    expect(read(rel)).toBe(read('AGENTS.md'))
  })

  it('CLAUDE.md ships a project section outside the goodvibes block for the user to fill in', () => {
    const text = read('CLAUDE.md')
    const outside = text.slice(0, text.indexOf('<!-- goodvibes:start -->'))
    expect(outside).toContain('**What this is:**')
    expect(outside).toContain('**Constraints:**')
  })
})

describe('caveman default (CAVE-01)', () => {
  it('defaults to ultra and still documents the switch command', () => {
    const skill = read('.claude/skills/caveman/SKILL.md')
    expect(skill).toContain('Default: **ultra**')
    expect(skill).toContain('/caveman lite|full|ultra')
  })
})
