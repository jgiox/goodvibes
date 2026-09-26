import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { OLD_CLAUDE, oldProject } from './old-project.fixture.js'

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  tasks: vi.fn(async (list: Array<{ task: (m: (s: string) => void) => Promise<string> }>) => { for (const t of list) await t.task(() => {}) }),
}))
vi.mock('../steps/telemetry.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../steps/telemetry.js')>()),
  sendTelemetry: vi.fn().mockResolvedValue(undefined),
}))
// No test here may touch the real ~/.claude, npm -g, the claude CLI or git.
vi.mock('../steps/global-setup.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../steps/global-setup.js')>()),
  applyGlobalConfig: vi.fn().mockResolvedValue({ configDir: '/fake/.claude', written: [], kept: [], removed: [], retired: [], settingsChanges: [] }),
  ensureGlobalCli: vi.fn().mockResolvedValue({ status: 'already-installed' }),
  registerContext7: vi.fn().mockResolvedValue({ status: 'already-registered' }),
  claudeConfigDir: vi.fn().mockReturnValue('/fake/.claude'),
}))
vi.mock('../steps/git-hook.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../steps/git-hook.js')>()),
  installGitHook: vi.fn().mockResolvedValue({ status: 'not-a-repo', path: '/p/.git/hooks/pre-commit' }),
}))

describe('init in global scope on a project set up in project scope by goodvibes 1.7', () => {
  let projectDir: string
  let cwdSpy: ReturnType<typeof vi.spyOn>

  async function runInit(...flags: string[]): Promise<string> {
    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const { note } = await import('@clack/prompts')
    vi.mocked(note).mockClear()
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)
    await program.parseAsync(['node', 'goodvibes', 'init', '--minimal', ...flags])
    return vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')
  }

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'gv-init-old-'))
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir)
    oldProject(projectDir)
  })

  afterEach(() => {
    cwdSpy.mockRestore()
    rmSync(projectDir, { recursive: true, force: true })
  })

  it('removes the old rules block and unedited skill copies and keeps edited ones', async () => {
    const out = await runInit()

    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8')).toBe('# CLAUDE.md\n\nmy notes\n\nmore mine\n')
    expect(existsSync(join(projectDir, '.claude', 'skills', 'caveman'))).toBe(false)
    expect(existsSync(join(projectDir, '.claude', 'skills', 'cavecrew'))).toBe(false)
    expect(readFileSync(join(projectDir, '.claude', 'skills', 'mine', 'SKILL.md'), 'utf-8')).toBe('my edit\n')
    const files = JSON.parse(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8')).files
    expect(files).not.toHaveProperty(['.claude/skills/caveman/SKILL.md'])
    expect(files).toHaveProperty(['.claude/skills/mine/SKILL.md'])
    expect(out).toContain('CLAUDE.md: removed the old goodvibes rules block; the rules now come from your Claude Code settings folder')
    expect(out).toContain('.claude/skills/caveman/SKILL.md: removed, now set up for all your projects')
    expect(out).toContain('Edited skill copies stay in this project; the same skills are now set up for all your projects, so Claude may load both. Delete a copy you no longer need: .claude/skills/mine/SKILL.md')
  })

  it('lists the old copies it would remove in a dry run and changes nothing', async () => {
    const out = await runInit('--dry-run')

    expect(out).toContain('Would remove the old goodvibes rules block from CLAUDE.md')
    expect(out).toContain('Would remove: .claude/skills/caveman/SKILL.md')
    expect(out).not.toContain('Would remove: .claude/skills/mine/SKILL.md')
    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8')).toBe(OLD_CLAUDE)
    expect(existsSync(join(projectDir, '.claude', 'skills', 'caveman', 'SKILL.md'))).toBe(true)
  })

  it('with --scope project keeps project skills and refreshes the block', async () => {
    await runInit('--scope', 'project')

    expect(existsSync(join(projectDir, '.claude', 'skills', 'caveman', 'SKILL.md'))).toBe(true)
    const claude = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8')
    expect(claude).not.toContain('# goodvibes: v1.7.1')
    expect(claude).toContain('<!-- goodvibes:start -->')
  })
})
