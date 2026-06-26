import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  tasks: vi.fn(),
  cancel: vi.fn(),
}))

// Mock copy-templates
vi.mock('../steps/copy-templates.js', () => ({
  copyTemplates: vi.fn(),
  listTemplateFiles: vi.fn(),
  resolveTemplatesDir: vi.fn(),
}))

// Mock install-headroom
vi.mock('../steps/install-headroom.js', () => ({
  installHeadroom: vi.fn(),
}))

// Mock configure-mcp
vi.mock('../steps/configure-mcp.js', () => ({
  configureMcp: vi.fn(),
}))

describe('init command', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('--dry-run: calls listTemplateFiles, prints files, does NOT call installHeadroom or configureMcp', async () => {
    const { intro, outro, note, tasks } = await import('@clack/prompts')
    const { copyTemplates, listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(listTemplateFiles).mockResolvedValue(['CLAUDE.md', '.github/workflows/ci.yml', 'README.md'])
    vi.mocked(tasks).mockResolvedValue(undefined)

    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride() // prevent process.exit in tests
    registerInitCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'init', '--dry-run'])

    // resolveTemplatesDir called to get template dir
    expect(vi.mocked(resolveTemplatesDir)).toHaveBeenCalled()
    // listTemplateFiles called (dry run path)
    expect(vi.mocked(listTemplateFiles)).toHaveBeenCalled()
    // copyTemplates should NOT be called with dryRun=false writes
    // installHeadroom must NOT be called
    expect(vi.mocked(installHeadroom)).not.toHaveBeenCalled()
    // configureMcp must NOT be called
    expect(vi.mocked(configureMcp)).not.toHaveBeenCalled()
    // tasks() must NOT be called (dry-run skips the tasks() flow)
    expect(vi.mocked(tasks)).not.toHaveBeenCalled()
    // note() must be called with dry-run file list
    expect(vi.mocked(note)).toHaveBeenCalledWith(
      expect.stringContaining('Would write'),
      expect.stringContaining('Dry run')
    )
    // outro called
    expect(vi.mocked(outro)).toHaveBeenCalled()
  })

  it('--minimal: calls tasks() but installHeadroom and configureMcp are NOT called', async () => {
    const { intro, outro, note, tasks } = await import('@clack/prompts')
    const { copyTemplates, listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md', 'README.md'], skipped: [] })
    vi.mocked(listTemplateFiles).mockResolvedValue(['CLAUDE.md', 'README.md'])

    // tasks() executes each task function synchronously for testing
    vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
      for (const t of taskList) {
        await t.task(vi.fn())
      }
    })

    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'init', '--minimal'])

    // tasks() called (minimal still runs copy step)
    expect(vi.mocked(tasks)).toHaveBeenCalled()
    // installHeadroom must NOT be called
    expect(vi.mocked(installHeadroom)).not.toHaveBeenCalled()
    // configureMcp must NOT be called
    expect(vi.mocked(configureMcp)).not.toHaveBeenCalled()
    // copyTemplates called with minimal=true and detected projectType
    expect(vi.mocked(copyTemplates)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      false,
      true,
      expect.any(String)
    )
  })

  it('normal run: calls all 3 tasks (copy, installHeadroom, configureMcp), shows file list note and next-steps note', async () => {
    const { intro, outro, note, tasks } = await import('@clack/prompts')
    const { copyTemplates, listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md', '.github/workflows/ci.yml', 'README.md'], skipped: [] })
    vi.mocked(installHeadroom).mockResolvedValue(undefined)
    vi.mocked(configureMcp).mockResolvedValue(undefined)

    // Execute all tasks
    vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
      for (const t of taskList) {
        await t.task(vi.fn())
      }
    })

    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'init'])

    // All 3 step functions called
    expect(vi.mocked(copyTemplates)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      false,
      false,
      expect.any(String)
    )
    expect(vi.mocked(installHeadroom)).toHaveBeenCalled()
    expect(vi.mocked(configureMcp)).toHaveBeenCalled()

    // note() called for file list
    const noteCalls = vi.mocked(note).mock.calls
    const fileListCall = noteCalls.find(c => String(c[1]).includes('Files'))
    expect(fileListCall).toBeDefined()
    expect(fileListCall![0]).toContain('CLAUDE.md')

    // note() called for next steps
    const nextStepsCall = noteCalls.find(c => String(c[1]).includes('Next steps'))
    expect(nextStepsCall).toBeDefined()
    expect(nextStepsCall![0]).toContain('Open this project in Claude Code')
    expect(nextStepsCall![0]).toContain('ponytail')
    expect(nextStepsCall![0]).toContain('Start coding')

    // outro called
    expect(vi.mocked(outro)).toHaveBeenCalledWith(expect.stringContaining("You're all set"))
  })

  it('prints file list completion note with "written" title', async () => {
    const { intro, outro, note, tasks } = await import('@clack/prompts')
    const { copyTemplates, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md', 'README.md'], skipped: [] })
    vi.mocked(installHeadroom).mockResolvedValue(undefined)
    vi.mocked(configureMcp).mockResolvedValue(undefined)

    vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
      for (const t of taskList) {
        await t.task(vi.fn())
      }
    })

    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'init'])

    const noteCalls = vi.mocked(note).mock.calls
    // Updated: title now contains 'written' not 'Files created'
    const fileListCall = noteCalls.find(c => String(c[1]).toLowerCase().includes('written'))
    expect(fileListCall).toBeDefined()
  })

  it('next-steps note contains exactly 3 numbered items', async () => {
    const { intro, outro, note, tasks } = await import('@clack/prompts')
    const { copyTemplates, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md'], skipped: [] })
    vi.mocked(installHeadroom).mockResolvedValue(undefined)
    vi.mocked(configureMcp).mockResolvedValue(undefined)

    vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
      for (const t of taskList) {
        await t.task(vi.fn())
      }
    })

    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'init'])

    const noteCalls = vi.mocked(note).mock.calls
    const nextStepsCall = noteCalls.find(c => String(c[1]).includes('Next steps'))
    expect(nextStepsCall).toBeDefined()
    // Exactly 3 numbered items
    const content = nextStepsCall![0] as string
    const matches = content.match(/^\d+\./gm)
    expect(matches).toHaveLength(3)
  })
})

describe('UX-01: non-empty directory notice', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('note() is called with non-empty notice when cwd has files', async () => {
    const fs = await import('node:fs')
    const readdirSpy = vi.spyOn(fs, 'readdirSync').mockReturnValue(['some-file.txt'] as any)

    const { note, tasks } = await import('@clack/prompts')
    const { copyTemplates, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md'], skipped: [] })
    vi.mocked(installHeadroom).mockResolvedValue(undefined)
    vi.mocked(configureMcp).mockResolvedValue(undefined)

    vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
      for (const t of taskList) {
        await t.task(vi.fn())
      }
    })

    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'init', '--minimal'])

    readdirSpy.mockRestore()

    const noteCalls = vi.mocked(note).mock.calls
    const nonEmptyCall = noteCalls.find(c =>
      String(c[0]).toLowerCase().includes('non-empty') ||
      String(c[0]).toLowerCase().includes('existing files') ||
      String(c[1]).toLowerCase().includes('non-empty') ||
      String(c[1]).toLowerCase().includes('existing files')
    )
    expect(nonEmptyCall).toBeDefined()
  })
})

describe('UX-02: written/skipped split in completion', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("note() called with 'written' title and written file list", async () => {
    const { note, tasks } = await import('@clack/prompts')
    const { copyTemplates, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md', 'README.md'], skipped: [] })
    vi.mocked(installHeadroom).mockResolvedValue(undefined)
    vi.mocked(configureMcp).mockResolvedValue(undefined)

    vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
      for (const t of taskList) {
        await t.task(vi.fn())
      }
    })

    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'init'])

    const noteCalls = vi.mocked(note).mock.calls
    const writtenCall = noteCalls.find(c =>
      String(c[1]).toLowerCase().includes('written') && String(c[0]).includes('CLAUDE.md')
    )
    expect(writtenCall).toBeDefined()
  })

  it("note() called with 'skipped' title when skipped non-empty", async () => {
    const { note, tasks } = await import('@clack/prompts')
    const { copyTemplates, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md'], skipped: ['JOURNAL.md'] })
    vi.mocked(installHeadroom).mockResolvedValue(undefined)
    vi.mocked(configureMcp).mockResolvedValue(undefined)

    vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
      for (const t of taskList) {
        await t.task(vi.fn())
      }
    })

    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'init'])

    const noteCalls = vi.mocked(note).mock.calls
    const skippedCall = noteCalls.find(c =>
      String(c[1]).toLowerCase().includes('skipped') && String(c[0]).includes('JOURNAL.md')
    )
    expect(skippedCall).toBeDefined()
  })
})

describe('UX-03: error surfacing', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('EACCES from tasks() calls cancel() and exits 1', async () => {
    const { tasks, cancel } = await import('@clack/prompts')
    const { copyTemplates, resolveTemplatesDir } = await import('../steps/copy-templates.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: [], skipped: [] })

    // tasks() throws EACCES
    vi.mocked(tasks).mockRejectedValue(Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }))

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((...args) => {
      throw new Error('exit ' + args[0])
    })

    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await expect(program.parseAsync(['node', 'goodvibes', 'init'])).rejects.toThrow()

    expect(vi.mocked(cancel)).toHaveBeenCalled()
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
  })
})

describe('MIN-02: dry-run + minimal', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('--dry-run --minimal excludes .github and docs from preview', async () => {
    const { note } = await import('@clack/prompts')
    const { listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(listTemplateFiles).mockResolvedValue([
      'CLAUDE.md',
      '.github/workflows/ci.yml',
      'docs/onboarding.md',
      '.claude/skills/caveman/SKILL.md',
    ])

    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'init', '--dry-run', '--minimal'])

    const noteCalls = vi.mocked(note).mock.calls
    const dryRunCall = noteCalls.find(c => String(c[1]).toLowerCase().includes('dry run'))
    expect(dryRunCall).toBeDefined()
    const content = String(dryRunCall![0])
    expect(content).not.toContain('.github')
    expect(content).not.toContain('docs/onboarding.md')
    expect(content).toContain('CLAUDE.md')
  })
})
