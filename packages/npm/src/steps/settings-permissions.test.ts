import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveTemplatesDir } from './copy-templates.js'

const ASK_PATTERNS = [
  'Bash(git push*)',
  'Bash(npm publish*)',
  'Bash(npx npm publish*)',
  'Bash(uv publish*)',
  'Bash(twine upload*)',
  'Bash(python -m twine upload*)',
  'Bash(npx wrangler deploy*)',
  'Bash(npx wrangler pages deploy*)',
  'Bash(npx vercel*)',
  'Bash(npx netlify deploy*)',
  'Bash(npx firebase deploy*)',
]

describe('templates/.claude/settings.json permissions', () => {
  it('requires explicit ask approval for push, publish, and deploy commands', async () => {
    const templateDir = resolveTemplatesDir()
    const raw = await readFile(join(templateDir, '.claude', 'settings.json'), 'utf-8')
    const settings = JSON.parse(raw)

    expect(Array.isArray(settings.permissions.ask)).toBe(true)
    for (const pattern of ASK_PATTERNS) {
      expect(settings.permissions.ask).toContain(pattern)
    }
  })

  it('leaves permissions.allow, permissions.deny, and hooks.PreToolUse in place', async () => {
    const templateDir = resolveTemplatesDir()
    const raw = await readFile(join(templateDir, '.claude', 'settings.json'), 'utf-8')
    const settings = JSON.parse(raw)

    expect(Array.isArray(settings.permissions.allow)).toBe(true)
    expect(settings.permissions.allow.length).toBeGreaterThan(0)
    expect(Array.isArray(settings.permissions.deny)).toBe(true)
    expect(settings.permissions.deny.length).toBeGreaterThan(0)
    expect(Array.isArray(settings.hooks.PreToolUse)).toBe(true)
    expect(settings.hooks.PreToolUse.length).toBeGreaterThan(0)
  })
})
