import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  tasks: vi.fn(),
}))

// Mock copy-templates
vi.mock('../steps/copy-templates.js', () => ({
  copyTemplates: vi.fn(),
  listTemplateFiles: vi.fn(),
  resolveTemplatesDir: vi.fn(),
}))

// Mock sentinel-merge
vi.mock('../utils/sentinel-merge.js', () => ({
  extractVersion: vi.fn(),
  versionGte: vi.fn(),
  mergeClaude: vi.fn(),
}))

// Mock fs-extra — both pathExists and copy must be mocked to prevent real I/O
vi.mock('fs-extra', () => ({
  pathExists: vi.fn().mockResolvedValue(true),
  copy: vi.fn().mockResolvedValue(undefined),
}))

// Mock node:fs/promises — readFile returns a stub CLAUDE.md with sentinel block; rename is no-op
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(
    '# goodvibes: v0.9.0\n<!-- goodvibes:start -->\ncontent\n<!-- goodvibes:end -->'
  ),
  rename: vi.fn().mockResolvedValue(undefined),
}))

// Mock detect-project-type — synchronous function, use mockReturnValue not mockResolvedValue
vi.mock('../utils/detect-project-type.js', () => ({
  detectProjectType: vi.fn().mockReturnValue('both'),
}))

// Mock execa — prevents real npm view/install calls and re-exec subprocess
vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({ stdout: '' }),
}))

// Mock node:module — prevents real require() for package.json in getInstalledVersion
vi.mock('node:module', () => ({
  createRequire: () => () => ({ version: '1.0.0' }),
}))

describe('upgrade command', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // After resetAllMocks, execa returns undefined — checkLatestNpmVersion catches the
    // resulting TypeError and returns null, so self-update never fires in baseline tests.
  })

  it('skips upgrade when already up to date', async () => {
    const { outro } = await import('@clack/prompts')
    const { pathExists } = await import('fs-extra')
    const { extractVersion, versionGte } = await import('../utils/sentinel-merge.js')
    const { resolveTemplatesDir } = await import('../steps/copy-templates.js')

    vi.mocked(pathExists).mockResolvedValue(true)
    vi.mocked(extractVersion).mockReturnValue('1.0.0')
    vi.mocked(versionGte).mockReturnValue(true)
    vi.mocked(resolveTemplatesDir).mockReturnValue('/mock/templates')

    const { registerUpgradeCommand } = await import('./upgrade.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpgradeCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'upgrade'])

    expect(vi.mocked(outro)).toHaveBeenCalledWith(
      expect.stringMatching(/up to date/i)
    )
  })

  it('--dry-run: prints change summary without writing files', async () => {
    const { outro, tasks } = await import('@clack/prompts')
    const { pathExists } = await import('fs-extra')
    const { versionGte } = await import('../utils/sentinel-merge.js')

    vi.mocked(pathExists).mockResolvedValue(false)
    vi.mocked(versionGte).mockReturnValue(false)
    // tasks is NOT given a mockImplementation — it stays as vi.fn() and is never called

    const { registerUpgradeCommand } = await import('./upgrade.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpgradeCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'upgrade', '--dry-run'])

    expect(vi.mocked(outro)).toHaveBeenCalledWith(
      expect.stringMatching(/dry.run|apply/i)
    )
    expect(vi.mocked(tasks)).not.toHaveBeenCalled()
  })

  it('runs full upgrade when CLAUDE.md is absent', async () => {
    const { tasks } = await import('@clack/prompts')
    const { pathExists } = await import('fs-extra')
    const { versionGte } = await import('../utils/sentinel-merge.js')
    const { resolveTemplatesDir } = await import('../steps/copy-templates.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(pathExists).mockResolvedValue(false)
    vi.mocked(versionGte).mockReturnValue(false)

    vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
      for (const t of taskList) {
        await t.task(vi.fn())
      }
    })

    const { registerUpgradeCommand } = await import('./upgrade.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpgradeCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'upgrade'])

    expect(vi.mocked(tasks)).toHaveBeenCalled()
  })

  it('prints diff summary before applying changes', async () => {
    const { note, tasks } = await import('@clack/prompts')
    const { pathExists } = await import('fs-extra')
    const { versionGte } = await import('../utils/sentinel-merge.js')
    const { resolveTemplatesDir } = await import('../steps/copy-templates.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(pathExists).mockResolvedValue(true)
    vi.mocked(versionGte).mockReturnValue(false)

    vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
      for (const t of taskList) {
        await t.task(vi.fn())
      }
    })

    const { registerUpgradeCommand } = await import('./upgrade.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpgradeCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'upgrade'])

    expect(vi.mocked(note)).toHaveBeenCalled()
  })

  it('self-update: triggers npm install when newer version available', async () => {
    const { execa } = await import('execa')
    const { versionGte } = await import('../utils/sentinel-merge.js')

    // npm view returns a newer version; versionGte(current, latest) must be false to trigger update
    vi.mocked(execa).mockResolvedValue({ stdout: '1.0.1' } as any)
    vi.mocked(versionGte).mockReturnValue(false)

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit')
    }) as never)

    const { registerUpgradeCommand } = await import('./upgrade.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpgradeCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'upgrade']).catch(() => {})

    // npm install -g must have been called with the new version
    expect(vi.mocked(execa)).toHaveBeenCalledWith(
      'npm', ['install', '-g', '@jgiox/goodvibes@1.0.1'], expect.objectContaining({ stdio: 'inherit' })
    )

    exitSpy.mockRestore()
  })

  it('self-update: skipped when _GV_UPGRADING env is set', async () => {
    const { execa } = await import('execa')
    const { versionGte } = await import('../utils/sentinel-merge.js')
    const { pathExists } = await import('fs-extra')
    const { resolveTemplatesDir } = await import('../steps/copy-templates.js')

    // Even though a newer version exists, _GV_UPGRADING prevents the check
    vi.mocked(versionGte).mockReturnValue(false)
    vi.mocked(pathExists).mockResolvedValue(false)
    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')

    const prevEnv = process.env['_GV_UPGRADING']
    process.env['_GV_UPGRADING'] = '1'

    const { registerUpgradeCommand } = await import('./upgrade.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpgradeCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'upgrade'])

    // execa should NOT have been called for npm view (self-update skipped)
    expect(vi.mocked(execa)).not.toHaveBeenCalledWith(
      'npm', ['view', '@jgiox/goodvibes', 'version'], expect.anything()
    )

    if (prevEnv === undefined) delete process.env['_GV_UPGRADING']
    else process.env['_GV_UPGRADING'] = prevEnv
  })

  it('registers update as an alias for upgrade', async () => {
    const { registerUpgradeCommand } = await import('./upgrade.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpgradeCommand(program)

    // Commander stores registered aliases; .alias() is retrieved via .aliases()
    const upgradeCmd = program.commands.find(c => c.name() === 'upgrade')
    expect(upgradeCmd).toBeDefined()
    expect(upgradeCmd!.aliases()).toContain('update')
  })

  it('preserves user content outside sentinel blocks after upgrade', async () => {
    const { tasks } = await import('@clack/prompts')
    const { pathExists } = await import('fs-extra')
    const { versionGte, mergeClaude } = await import('../utils/sentinel-merge.js')
    const { readFile } = await import('node:fs/promises')
    const { resolveTemplatesDir } = await import('../steps/copy-templates.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(pathExists).mockResolvedValue(true)
    vi.mocked(versionGte).mockReturnValue(false)

    // Installed CLAUDE.md has user content before and after the sentinel block
    vi.mocked(readFile).mockResolvedValue(
      '## My Custom Section\n<!-- goodvibes:start -->\n# goodvibes: v0.9.0\n<!-- goodvibes:end -->\n## Also Mine'
    )

    vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
      for (const t of taskList) {
        await t.task(vi.fn())
      }
    })

    const { registerUpgradeCommand } = await import('./upgrade.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpgradeCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'upgrade'])

    // CLAUDE.md must go through mergeClaude, not a direct write
    expect(vi.mocked(mergeClaude)).toHaveBeenCalled()
    expect(vi.mocked(mergeClaude).mock.calls[0][0]).toMatch(/CLAUDE\.md/)
  })
})
