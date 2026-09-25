import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MINIMAL_SKIPPED, samePath } from './scope.js'

describe('MINIMAL_SKIPPED', () => {
  it('skips docs/ and the CI side of .github', () => {
    for (const rel of ['docs', 'docs/onboarding.md', '.github/workflows/ci.yml', '.github/dependabot.yml', '.github/ISSUE_TEMPLATE/bug_report.yml', '.github/scripts/check-file-sizes.mjs']) {
      expect(MINIMAL_SKIPPED(rel)).toBe(true)
    }
  })

  it("keeps Copilot's rules and hooks in .github and every file outside docs/ and .github", () => {
    for (const rel of ['.github/copilot-instructions.md', '.github/hooks', '.github/hooks/goodvibes.json', 'AGENTS.md', '.claude/settings.json', 'documents/x.md']) {
      expect(MINIMAL_SKIPPED(rel)).toBe(false)
    }
  })

  it('treats Windows backslash paths the same as forward slashes', () => {
    expect(MINIMAL_SKIPPED('.github\\workflows\\ci.yml')).toBe(true)
    expect(MINIMAL_SKIPPED('.github\\hooks\\goodvibes.json')).toBe(false)
  })
})

describe('samePath', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'gv-samepath-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('is true for a folder and a symlink to it', () => {
    mkdirSync(join(dir, 'real'))
    symlinkSync(join(dir, 'real'), join(dir, 'link'))
    expect(samePath(join(dir, 'link'), join(dir, 'real'))).toBe(true)
  })

  it('compares folders that do not exist by their plain path', () => {
    expect(samePath(join(dir, 'missing', '..', 'missing'), join(dir, 'missing'))).toBe(true)
    expect(samePath(join(dir, 'missing'), join(dir, 'other'))).toBe(false)
  })
})
