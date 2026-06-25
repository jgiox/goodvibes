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

// Mock detect-project-type
vi.mock('../utils/detect-project-type.js', () => ({
  detectProjectType: vi.fn().mockResolvedValue('both'),
}))

describe('upgrade command', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('skips upgrade when already up to date', async () => {
    const { outro } = await import('@clack/prompts')
    const { pathExists } = await import('fs-extra')
    const { extractVersion, versionGte } = await import('../utils/sentinel-merge.js')

    vi.mocked(pathExists).mockResolvedValue(true)
    vi.mocked(extractVersion).mockReturnValue('1.0.0')
    vi.mocked(versionGte).mockReturnValue(true)

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

  it('preserves user content outside sentinel blocks after upgrade', async () => {
    const { tasks } = await import('@clack/prompts')
    const { pathExists } = await import('fs-extra')
    const { versionGte, mergeClaude } = await import('../utils/sentinel-merge.js')
    const { readFile } = await import('node:fs/promises')

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
