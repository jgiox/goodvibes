import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { EDITED_CLAUDE, OLD_CLAUDE, oldProject } from './old-project.fixture.js'

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  select: vi.fn(),
  isCancel: vi.fn(() => false),
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
vi.mock('../utils/scope.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/scope.js')>()),
  interactive: vi.fn(() => false),
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

describe('init keeps an old rules block the user edited', () => {
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
    projectDir = mkdtempSync(join(tmpdir(), 'gv-init-edited-'))
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir)
    oldProject(projectDir, undefined, EDITED_CLAUDE)
  })

  afterEach(() => {
    cwdSpy.mockRestore()
    rmSync(projectDir, { recursive: true, force: true })
  })

  it('in global scope, keeps the block and says why', async () => {
    const out = await runInit()

    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8')).toBe(EDITED_CLAUDE)
    expect(existsSync(join(projectDir, '.claude', 'skills', 'caveman'))).toBe(false)
    expect(out).toContain('CLAUDE.md: kept the old goodvibes rules block because you edited it; Claude also reads the rules in your Claude Code settings folder, so remove the block by hand when you no longer need it')
    expect(out).not.toContain('CLAUDE.md: removed the old goodvibes rules block')
  })

  it('with --scope project, keeps the block and writes the new block beside it', async () => {
    const out = await runInit('--scope', 'project')

    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8')).toBe(EDITED_CLAUDE)
    expect(readFileSync(join(projectDir, 'CLAUDE.md.goodvibes-new'), 'utf-8')).toContain('# goodvibes: v')
    expect(out).toContain('CLAUDE.md: kept your edited goodvibes rules block; the new block is in CLAUDE.md.goodvibes-new, copy over what you want, then delete that file')
  })
})

describe("init leaves out ask rules the user's global allow rules cover", () => {
  let projectDir: string
  let cfg: string
  let cwdSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    projectDir = mkdtempSync(join(tmpdir(), 'gv-init-allow-'))
    cfg = mkdtempSync(join(tmpdir(), 'gv-init-allow-cfg-'))
    const { claudeConfigDir } = await import('../steps/global-setup.js')
    vi.mocked(claudeConfigDir).mockReturnValue(cfg)
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir)
  })

  afterEach(async () => {
    const { claudeConfigDir } = await import('../steps/global-setup.js')
    vi.mocked(claudeConfigDir).mockReturnValue('/fake/.claude')
    cwdSpy.mockRestore()
    rmSync(projectDir, { recursive: true, force: true })
    rmSync(cfg, { recursive: true, force: true })
  })

  it('writes project settings without the ask rules a global allow rule covers and says so', async () => {
    writeFileSync(join(cfg, 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(git push*)'] } }))
    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const { note } = await import('@clack/prompts')
    vi.mocked(note).mockClear()
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)
    await program.parseAsync(['node', 'goodvibes', 'init', '--minimal', '--scope', 'project'])
    const out = vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')

    const ask = JSON.parse(readFileSync(join(projectDir, '.claude', 'settings.json'), 'utf-8')).permissions.ask as string[]
    expect(ask.filter(r => r.startsWith('Bash(git push'))).toEqual([])
    expect(ask).toContain('Bash(git branch -D*)')
    expect(out).toContain('- permissions.ask: Bash(git push*) (your allow rule Bash(git push*) covers it)')
  })
})

describe('init picks the scope', () => {
  let projectDir: string
  let cwdSpy: ReturnType<typeof vi.spyOn>
  const scopeOf = () => JSON.parse(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8')).scope

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

  beforeEach(async () => {
    projectDir = mkdtempSync(join(tmpdir(), 'gv-init-scope-'))
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir)
    const { select } = await import('@clack/prompts')
    vi.mocked(select).mockReset()
  })

  afterEach(async () => {
    const { interactive } = await import('../utils/scope.js')
    vi.mocked(interactive).mockReturnValue(false)
    cwdSpy.mockRestore()
    rmSync(projectDir, { recursive: true, force: true })
  })

  it('keeps the project scope the manifest records when --scope is not given', async () => {
    oldProject(projectDir, 'project')
    const out = await runInit()
    expect(existsSync(join(projectDir, '.claude', 'skills', 'caveman', 'SKILL.md'))).toBe(true)
    expect(scopeOf()).toBe('project')
    expect(out).toContain("Keeping this project's recorded scope: project. To change it, run goodvibes init --scope global.")
  })

  it('switches a project away from its recorded scope when --scope is given', async () => {
    oldProject(projectDir, 'project')
    const out = await runInit('--scope', 'global')
    expect(scopeOf()).toBe('global')
    expect(out).not.toContain("Keeping this project's recorded scope")
  })

  it('asks for the scope in a terminal and uses the answer', async () => {
    const { interactive } = await import('../utils/scope.js')
    const { select } = await import('@clack/prompts')
    vi.mocked(interactive).mockReturnValue(true)
    vi.mocked(select).mockResolvedValue('project')
    await runInit()
    expect(vi.mocked(select).mock.calls[0][0].message).toBe('Set goodvibes up for all your projects, or only this one?')
    expect(scopeOf()).toBe('project')
  })

  it('offers the recorded scope as the default answer in a terminal', async () => {
    oldProject(projectDir, 'project')
    const { interactive } = await import('../utils/scope.js')
    const { select } = await import('@clack/prompts')
    vi.mocked(interactive).mockReturnValue(true)
    vi.mocked(select).mockImplementation(async (o: { initialValue?: unknown }) => o.initialValue as never)
    await runInit()
    expect(scopeOf()).toBe('project')
  })

  it('does not ask without a terminal and defaults to global', async () => {
    const { select } = await import('@clack/prompts')
    await runInit()
    expect(vi.mocked(select)).not.toHaveBeenCalled()
    expect(scopeOf()).toBe('global')
  })
})
