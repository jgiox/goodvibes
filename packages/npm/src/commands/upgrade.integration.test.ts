import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  tasks: vi.fn(async (ts: { task: () => Promise<unknown> }[]) => { for (const t of ts) await t.task() }),
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
}))

vi.mock('execa', () => ({ execa: vi.fn().mockResolvedValue({ stdout: '' }) }))

vi.mock('../steps/copy-templates.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../steps/copy-templates.js')>()
  return { ...actual, resolveTemplatesDir: vi.fn() }
})

// No test here may read or write the real ~/.claude or reach the npm registry.
process.env.CLAUDE_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'gv-upgrade-cfg-'))
process.env._GV_UPGRADING = '1'

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

describe('upgrade command in a real tmp dir', () => {
  let templateDir: string
  let projectDir: string
  let cwdSpy: ReturnType<typeof vi.spyOn>

  async function runUpgrade() {
    const { registerUpgradeCommand } = await import('./upgrade.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpgradeCommand(program)
    await program.parseAsync(['node', 'goodvibes', 'upgrade'])
  }

  beforeEach(async () => {
    templateDir = mkdtempSync(join(tmpdir(), 'gv-upgrade-tpl-'))
    projectDir = mkdtempSync(join(tmpdir(), 'gv-upgrade-proj-'))
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir)
    const { resolveTemplatesDir } = await import('../steps/copy-templates.js')
    vi.mocked(resolveTemplatesDir).mockReturnValue(templateDir)
    writeFileSync(join(templateDir, 'CLAUDE.md'), '# CLAUDE.md\n\n<!-- goodvibes:start -->\n# goodvibes: v9.9.9\nrules\n<!-- goodvibes:end -->\n')
    mkdirSync(join(templateDir, '.claude', 'skills', 'caveman'), { recursive: true })
    writeFileSync(join(templateDir, '.claude', 'skills', 'caveman', 'SKILL.md'), 'skill v2\n')
  })

  afterEach(() => {
    cwdSpy.mockRestore()
    rmSync(templateDir, { recursive: true, force: true })
    rmSync(projectDir, { recursive: true, force: true })
  })

  it('does not copy skills into a global-scope project or add the rules block to its CLAUDE.md', async () => {
    writeFileSync(join(projectDir, 'CLAUDE.md'), '# CLAUDE.md\n\n## Project\n')
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({ version: '1.8.0', files: { 'CLAUDE.md': 'x' }, scope: 'global' }))

    await runUpgrade()

    expect(existsSync(join(projectDir, '.claude', 'skills'))).toBe(false)
    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8')).toBe('# CLAUDE.md\n\n## Project\n')
  })

  it('does not overwrite a skill file the user edited', async () => {
    mkdirSync(join(projectDir, '.claude', 'skills', 'caveman'), { recursive: true })
    writeFileSync(join(projectDir, '.claude', 'skills', 'caveman', 'SKILL.md'), 'my own edits\n')
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({ version: '1.0.0', files: { '.claude/skills/caveman/SKILL.md': sha256('skill v1\n') } }))

    await runUpgrade()

    expect(readFileSync(join(projectDir, '.claude', 'skills', 'caveman', 'SKILL.md'), 'utf-8')).toBe('my own edits\n')
  })

  it('keeps manifest entries for project files it did not rewrite', async () => {
    writeFileSync(join(projectDir, 'JOURNAL.md'), '# Journal\n')
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({ version: '1.0.0', files: { 'JOURNAL.md': sha256('# Journal\n') } }))

    await runUpgrade()

    expect(JSON.parse(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8')).files).toHaveProperty('JOURNAL.md')
  })
})
