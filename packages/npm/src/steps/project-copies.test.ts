import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { oldSkillCopies } from './project-copies.js'

const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex')
const skill = (root: string, name: string, text: string) => {
  mkdirSync(join(root, '.claude', 'skills', name), { recursive: true })
  writeFileSync(join(root, '.claude', 'skills', name, 'SKILL.md'), text)
}

describe('oldSkillCopies', () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'gv-copies-')) })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('splits tracked skill files into unedited and edited', async () => {
    skill(dir, 'caveman', 'shipped\n')
    skill(dir, 'mine', 'edited\n')
    const files = {
      '.claude/skills/caveman/SKILL.md': sha('shipped\n'),
      '.claude/skills/mine/SKILL.md': sha('shipped\n'),
      '.claude/skills/gone/SKILL.md': sha('shipped\n'),
      '.claude/skills/owned/SKILL.md': 'user-owned',
      'JOURNAL.md': sha('x\n'),
    }
    expect(await oldSkillCopies(dir, files)).toEqual({ unedited: ['.claude/skills/caveman/SKILL.md'], edited: ['.claude/skills/mine/SKILL.md'] })
  })

  it('never reads through a symlinked skills folder', async () => {
    const outside = join(dir, 'external')
    skill(outside, 'caveman', 'shipped\n')
    const proj = join(dir, 'proj')
    mkdirSync(join(proj, '.claude'), { recursive: true })
    symlinkSync(join(outside, '.claude', 'skills'), join(proj, '.claude', 'skills'))
    expect(await oldSkillCopies(proj, { '.claude/skills/caveman/SKILL.md': sha('shipped\n') })).toEqual({ unedited: [], edited: [] })
  })
})
