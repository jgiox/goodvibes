import { describe, it, expect, vi, beforeEach } from 'vitest'

// ponytail: ESM namespace is sealed — vi.spyOn(node:fs) fails; partial mock via importOriginal
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, readdirSync: vi.fn().mockReturnValue([]) }
})

// Restore default readdirSync return after each vi.clearAllMocks() call in nested beforeEach blocks
beforeEach(async () => {
  const { readdirSync } = await import('node:fs')
  vi.mocked(readdirSync).mockReturnValue([] as any)
})

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

// Mock telemetry — prevents real HTTP in all tests
vi.mock('../steps/telemetry.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../steps/telemetry.js')>()),
  sendTelemetry: vi.fn().mockResolvedValue(undefined),
}))

// Mock global-setup — unit tests must never touch the real ~/.claude, npm -g, or claude CLI
vi.mock('../steps/global-setup.js', () => ({
  applyGlobalConfig: vi.fn().mockResolvedValue({ configDir: '/fake/.claude', written: [], kept: [], removed: [], retired: [], settingsChanges: [] }),
  ensureGlobalCli: vi.fn().mockResolvedValue({ status: 'already-installed' }),
  registerContext7: vi.fn().mockResolvedValue({ status: 'already-registered' }),
  claudeConfigDir: vi.fn().mockReturnValue('/fake/.claude'),
  formatGlobal: vi.fn().mockReturnValue('already up to date'),
}))

// Mock write-manifest — prevents real file I/O in command-level unit tests
vi.mock('../steps/write-manifest.js', () => ({
  writeManifest: vi.fn().mockResolvedValue(undefined),
  readManifest: vi.fn().mockResolvedValue(null),
}))

// Unit tests must never run real git: cwd here is the goodvibes checkout itself.
vi.mock('../steps/git-hook.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../steps/git-hook.js')>()),
  installGitHook: vi.fn().mockResolvedValue({ status: 'not-a-repo', path: '/p/.git/hooks/pre-commit' }),
}))

describe('init command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    // writeManifest must NOT be called during dry-run
    const { writeManifest } = await import('../steps/write-manifest.js')
    expect(vi.mocked(writeManifest)).not.toHaveBeenCalled()
  })

  it('--minimal: calls tasks() but installHeadroom and configureMcp are NOT called', async () => {
    const { intro, outro, note, tasks } = await import('@clack/prompts')
    const { copyTemplates, listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md', 'README.md'], skipped: [], problems: [] })
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
      expect.any(String),
      'global',
    )
  })

  it('normal run: calls all 3 tasks (copy, installHeadroom, configureMcp), shows file list note and next-steps note', async () => {
    const { intro, outro, note, tasks } = await import('@clack/prompts')
    const { copyTemplates, listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')
    const { sendTelemetry } = await import('../steps/telemetry.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md', '.github/workflows/ci.yml', 'README.md'], skipped: [], problems: [] })
    vi.mocked(installHeadroom).mockResolvedValue({ status: 'installed' })
    vi.mocked(configureMcp).mockResolvedValue({ status: 'registered' })

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
      expect.any(String),
      'global',
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
    expect(nextStepsCall![0]).toContain('Open this project in your AI coding tool')
    expect(nextStepsCall![0]).toContain('ponytail')
    expect(nextStepsCall![0]).toContain('rules already active')
    expect(nextStepsCall![0]).toContain('Start coding')

    // outro called
    expect(vi.mocked(outro)).toHaveBeenCalledWith(expect.stringContaining("You're all set"))

    // note() called for headroom status
    const headroomNoteCall = noteCalls.find(c => String(c[1]).toLowerCase().includes('headroom'))
    expect(headroomNoteCall).toBeDefined()
    expect(String(headroomNoteCall![0])).toMatch(/headroom.*installed|MCP.*registered/i)

    // sendTelemetry must be called exactly once in the normal (non-dry-run) flow
    expect(vi.mocked(sendTelemetry)).toHaveBeenCalledTimes(1)

    // writeManifest must be called once after tasks() complete
    const { writeManifest } = await import('../steps/write-manifest.js')
    expect(vi.mocked(writeManifest)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(writeManifest)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.any(String),
      undefined,
      expect.any(Object),
      'global',
      undefined,
    )
  })

  it('prints file list completion note with "written" title', async () => {
    const { intro, outro, note, tasks } = await import('@clack/prompts')
    const { copyTemplates, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md', 'README.md'], skipped: [], problems: [] })
    vi.mocked(installHeadroom).mockResolvedValue({ status: 'installed' })
    vi.mocked(configureMcp).mockResolvedValue({ status: 'registered' })

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
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md'], skipped: [], problems: [] })
    vi.mocked(installHeadroom).mockResolvedValue({ status: 'installed' })
    vi.mocked(configureMcp).mockResolvedValue({ status: 'registered' })

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

  it('shows disclosure note with Privacy title before file operations', async () => {
    vi.stubEnv('DO_NOT_TRACK', '')
    vi.stubEnv('GOODVIBES_NO_TELEMETRY', '')
    vi.stubEnv('CI', '')
    try {
      const { note, tasks } = await import('@clack/prompts')
      const { copyTemplates, resolveTemplatesDir } = await import('../steps/copy-templates.js')
      const { installHeadroom } = await import('../steps/install-headroom.js')
      const { configureMcp } = await import('../steps/configure-mcp.js')
      const { sendTelemetry } = await import('../steps/telemetry.js')

      vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
      vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md'], skipped: [], problems: [] })
      vi.mocked(installHeadroom).mockResolvedValue({ status: 'installed' })
      vi.mocked(configureMcp).mockResolvedValue({ status: 'registered' })
      vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
        for (const t of taskList) { await t.task(vi.fn()) }
      })

      const { registerInitCommand } = await import('./init.js')
      const { Command } = await import('commander')
      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await program.parseAsync(['node', 'goodvibes', 'init'])

      expect(vi.mocked(note)).toHaveBeenCalledWith(
        'Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out.',
        'Privacy'
      )
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('does not call sendTelemetry during --dry-run', async () => {
    const { listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { sendTelemetry } = await import('../steps/telemetry.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(listTemplateFiles).mockResolvedValue(['CLAUDE.md'])

    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'init', '--dry-run'])

    expect(vi.mocked(sendTelemetry)).not.toHaveBeenCalled()
  })

  it('does not show disclosure note when DO_NOT_TRACK is set to 1', async () => {
    vi.stubEnv('DO_NOT_TRACK', '1')
    try {
      const { note, tasks } = await import('@clack/prompts')
      const { copyTemplates, resolveTemplatesDir } = await import('../steps/copy-templates.js')
      const { installHeadroom } = await import('../steps/install-headroom.js')
      const { configureMcp } = await import('../steps/configure-mcp.js')

      vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
      vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md'], skipped: [], problems: [] })
      vi.mocked(installHeadroom).mockResolvedValue({ status: 'installed' })
      vi.mocked(configureMcp).mockResolvedValue({ status: 'registered' })
      vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
        for (const t of taskList) { await t.task(vi.fn()) }
      })

      const { registerInitCommand } = await import('./init.js')
      const { Command } = await import('commander')
      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await program.parseAsync(['node', 'goodvibes', 'init'])

      expect(vi.mocked(note)).not.toHaveBeenCalledWith(
        'Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out.',
        'Privacy'
      )
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('does not show disclosure note when DO_NOT_TRACK is set to yes', async () => {
    vi.stubEnv('DO_NOT_TRACK', 'yes')
    try {
      const { note, tasks } = await import('@clack/prompts')
      const { copyTemplates, resolveTemplatesDir } = await import('../steps/copy-templates.js')
      const { installHeadroom } = await import('../steps/install-headroom.js')
      const { configureMcp } = await import('../steps/configure-mcp.js')

      vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
      vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md'], skipped: [], problems: [] })
      vi.mocked(installHeadroom).mockResolvedValue({ status: 'installed' })
      vi.mocked(configureMcp).mockResolvedValue({ status: 'registered' })
      vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
        for (const t of taskList) { await t.task(vi.fn()) }
      })

      const { registerInitCommand } = await import('./init.js')
      const { Command } = await import('commander')
      const program = new Command()
      program.exitOverride()
      registerInitCommand(program)

      await program.parseAsync(['node', 'goodvibes', 'init'])

      expect(vi.mocked(note)).not.toHaveBeenCalledWith(
        'Anonymous usage stats are collected. Set DO_NOT_TRACK=1 to opt out.',
        'Privacy'
      )
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('UX-01: non-empty directory notice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('note() is called with non-empty notice when cwd has files', async () => {
    // ponytail: vi.spyOn(node:fs) fails in ESM; use vi.mocked on the module-level mock instead
    const { readdirSync } = await import('node:fs')
    vi.mocked(readdirSync).mockReturnValue(['some-file.txt'] as any)

    const { note, tasks } = await import('@clack/prompts')
    const { copyTemplates, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md'], skipped: [], problems: [] })
    vi.mocked(installHeadroom).mockResolvedValue({ status: 'installed' })
    vi.mocked(configureMcp).mockResolvedValue({ status: 'registered' })

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
    vi.clearAllMocks()
  })

  it("note() called with 'written' title and written file list", async () => {
    const { note, tasks } = await import('@clack/prompts')
    const { copyTemplates, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md', 'README.md'], skipped: [], problems: [] })
    vi.mocked(installHeadroom).mockResolvedValue({ status: 'installed' })
    vi.mocked(configureMcp).mockResolvedValue({ status: 'registered' })

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
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md'], skipped: ['JOURNAL.md'], problems: [] })
    vi.mocked(installHeadroom).mockResolvedValue({ status: 'installed' })
    vi.mocked(configureMcp).mockResolvedValue({ status: 'registered' })

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
    vi.clearAllMocks()
  })

  it('EACCES from tasks() calls cancel() and exits 1', async () => {
    const { tasks, cancel } = await import('@clack/prompts')
    const { copyTemplates, resolveTemplatesDir } = await import('../steps/copy-templates.js')

    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: [], skipped: [], problems: [] })

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

    expect(vi.mocked(cancel)).toHaveBeenCalledWith(expect.stringContaining('project directory'))
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
  })
})

describe('MIN-02: dry-run + minimal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    const dryRunCall = noteCalls.find(c => String(c[1]).toLowerCase().includes('no files written'))
    expect(dryRunCall).toBeDefined()
    const content = String(dryRunCall![0])
    expect(content).not.toContain('.github')
    expect(content).not.toContain('docs/onboarding.md')
    expect(content).toContain('CLAUDE.md')
  })
})

describe('init re-run keeps the previous manifest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function runInit(...args: string[]) {
    const { tasks } = await import('@clack/prompts')
    const { copyTemplates, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md'], skipped: ['AGENTS.md'], problems: [] })
    vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
      for (const t of taskList) await t.task(vi.fn())
    })
    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)
    await program.parseAsync(['node', 'goodvibes', 'init', '--minimal', ...args])
  }

  it('passes every previous entry for files this run did not write, and the previous managed record', async () => {
    const { readManifest, writeManifest } = await import('../steps/write-manifest.js')
    const hook = 'hook:PreToolUse:goodvibes-journal-gate'
    vi.mocked(readManifest).mockResolvedValue({
      version: '1.8.0',
      files: { 'AGENTS.md': 'hash-a', 'docs/x.md': 'user-owned', 'CLAUDE.md': 'old' },
      managed: { '.claude/settings.json': [hook] },
    })

    await runInit('--scope', 'project')

    const call = vi.mocked(writeManifest).mock.calls[0]
    expect(call[1]).toEqual(['CLAUDE.md'])
    expect(call[3]).toEqual({ 'AGENTS.md': 'hash-a', 'docs/x.md': 'user-owned', 'CLAUDE.md': 'old' })
    expect(call[4]!['.claude/settings.json']).toContain(hook)
  })

  it('stops with the fix-it message and exit 1 when the existing .goodvibes.json is not valid JSON', async () => {
    const { readManifest, writeManifest } = await import('../steps/write-manifest.js')
    const { cancel } = await import('@clack/prompts')
    const { copyTemplates } = await import('../steps/copy-templates.js')
    vi.mocked(readManifest).mockRejectedValue(new Error('/p/.goodvibes.json is not valid JSON (x); fix it or delete it and run goodvibes init'))
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error(`exit ${code}`) }) as never)
    try {
      await expect(runInit('--scope', 'project')).rejects.toThrow('exit 1')
      expect(vi.mocked(cancel)).toHaveBeenCalledWith(expect.stringContaining('is not valid JSON'))
      expect(vi.mocked(copyTemplates)).not.toHaveBeenCalled()
      expect(vi.mocked(writeManifest)).not.toHaveBeenCalled()
    } finally {
      exitSpy.mockRestore()
      vi.mocked(readManifest).mockResolvedValue(null)
    }
  })
})

describe('init installs the git commit check', () => {
  const INSTALLED = 'Git commit check installed: commits that leave out JOURNAL.md are blocked in every tool (.git/hooks/pre-commit)'
  const hookAt = '/p/.git/hooks/pre-commit'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function runInit(...args: string[]) {
    const { tasks } = await import('@clack/prompts')
    const { copyTemplates, listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(listTemplateFiles).mockResolvedValue(['CLAUDE.md'])
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md'], skipped: [], problems: [] })
    vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
      for (const t of taskList) await t.task(vi.fn())
    })
    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)
    await program.parseAsync(['node', 'goodvibes', 'init', '--minimal', ...args])
  }

  const notes = async () => (await import('@clack/prompts')).note
  const noteText = async () => vi.mocked(await notes()).mock.calls.map(c => String(c[0])).join('\n')
  const manifestGitHook = async () => {
    const { writeManifest } = await import('../steps/write-manifest.js')
    return vi.mocked(writeManifest).mock.calls[0][6]
  }

  it('installs the hook, prints the installed line and records gitHook installed', async () => {
    const { installGitHook } = await import('../steps/git-hook.js')
    vi.mocked(installGitHook).mockResolvedValue({ status: 'installed', path: hookAt })

    await runInit('--scope', 'project')

    expect(vi.mocked(installGitHook)).toHaveBeenCalledWith(process.cwd(), false)
    expect(await noteText()).toContain(INSTALLED)
    expect(await manifestGitHook()).toBe('installed')
  })

  it('restores a hook the user removed and records gitHook installed again', async () => {
    const { installGitHook } = await import('../steps/git-hook.js')
    const { readManifest } = await import('../steps/write-manifest.js')
    vi.mocked(installGitHook).mockResolvedValue({ status: 'installed', path: hookAt })
    vi.mocked(readManifest).mockResolvedValue({ version: '1.9.0', files: {}, gitHook: 'user-removed' })
    try {
      await runInit('--scope', 'project')
      expect(await manifestGitHook()).toBe('installed')
    } finally {
      vi.mocked(readManifest).mockResolvedValue(null)
    }
  })

  it('records gitHook installed and prints nothing about the hook when it is already current', async () => {
    const { installGitHook } = await import('../steps/git-hook.js')
    vi.mocked(installGitHook).mockResolvedValue({ status: 'current', path: hookAt })

    await runInit('--scope', 'project')

    expect(await noteText()).not.toContain('Git commit check')
    expect(await manifestGitHook()).toBe('installed')
  })

  it('records gitHook installed and prints the updated line when an older goodvibes hook is rewritten', async () => {
    const { installGitHook } = await import('../steps/git-hook.js')
    vi.mocked(installGitHook).mockResolvedValue({ status: 'updated', path: hookAt })

    await runInit('--scope', 'project')

    expect(await noteText()).toContain('Git commit check updated (.git/hooks/pre-commit)')
    expect(await manifestGitHook()).toBe('installed')
  })

  it('keeps the previous gitHook and prints the skip line when core.hooksPath is set', async () => {
    const { installGitHook } = await import('../steps/git-hook.js')
    const { readManifest } = await import('../steps/write-manifest.js')
    vi.mocked(installGitHook).mockResolvedValue({ status: 'custom-path', path: hookAt, detail: '.husky' })
    vi.mocked(readManifest).mockResolvedValue({ version: '1.9.0', files: {}, gitHook: 'user-removed' })
    try {
      await runInit('--scope', 'project')
      expect(await noteText()).toContain('Git commit check skipped: git uses its own hooks folder here (core.hooksPath = .husky), so goodvibes left your hooks alone.')
      expect(await manifestGitHook()).toBe('user-removed')
    } finally {
      vi.mocked(readManifest).mockResolvedValue(null)
    }
  })

  it('leaves gitHook out and prints the skip line in a folder that is not a git repository', async () => {
    const { installGitHook } = await import('../steps/git-hook.js')
    vi.mocked(installGitHook).mockResolvedValue({ status: 'not-a-repo', path: hookAt })

    await runInit('--scope', 'project')

    expect(await noteText()).toContain('Git commit check skipped: this folder is not a git repository yet. Run git init, then goodvibes update.')
    expect(await manifestGitHook()).toBeUndefined()
  })

  it('leaves gitHook unchanged and prints the skip line when the user has their own pre-commit hook', async () => {
    const { installGitHook } = await import('../steps/git-hook.js')
    vi.mocked(installGitHook).mockResolvedValue({ status: 'existing-hook', path: hookAt })

    await runInit('--scope', 'project')

    expect(await noteText()).toContain('Git commit check skipped: .git/hooks/pre-commit already exists and is not from goodvibes, so it was left alone.')
    expect(await manifestGitHook()).toBeUndefined()
  })

  it('--dry-run asks the installer for a dry run, prints the Would line and writes no manifest', async () => {
    const { installGitHook } = await import('../steps/git-hook.js')
    const { writeManifest } = await import('../steps/write-manifest.js')
    vi.mocked(installGitHook).mockResolvedValue({ status: 'installed', path: hookAt })

    await runInit('--scope', 'project', '--dry-run')

    expect(vi.mocked(installGitHook)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(installGitHook)).toHaveBeenCalledWith(process.cwd(), true)
    expect(await noteText()).toContain(`Would: ${INSTALLED}`)
    expect(vi.mocked(writeManifest)).not.toHaveBeenCalled()
  })

  it('never calls the installer when init runs in global scope from the home folder', async () => {
    const { installGitHook } = await import('../steps/git-hook.js')
    const { homedir } = await import('node:os')
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(homedir())
    try {
      await runInit()
      await runInit('--dry-run')
    } finally {
      cwdSpy.mockRestore()
    }
    expect(vi.mocked(installGitHook)).not.toHaveBeenCalled()
  })
})

describe('init in the Claude Code settings folder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function runInit(...args: string[]) {
    const { tasks } = await import('@clack/prompts')
    const { copyTemplates, listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(listTemplateFiles).mockResolvedValue(['CLAUDE.md', 'JOURNAL.md'])
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md', 'JOURNAL.md'], skipped: [], problems: [] })
    vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
      for (const t of taskList) await t.task(vi.fn())
    })
    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/fake/.claude')
    try {
      await program.parseAsync(['node', 'goodvibes', 'init', '--minimal', ...args])
    } finally {
      cwdSpy.mockRestore()
    }
  }

  const noteText = async () => vi.mocked((await import('@clack/prompts')).note).mock.calls.map(c => String(c[0])).join('\n')

  it('does the global part only and never writes project files or a project manifest over the global one', async () => {
    const { applyGlobalConfig } = await import('../steps/global-setup.js')
    const { copyTemplates } = await import('../steps/copy-templates.js')
    const { writeManifest } = await import('../steps/write-manifest.js')
    const { installGitHook } = await import('../steps/git-hook.js')

    await runInit()

    expect(vi.mocked(applyGlobalConfig)).toHaveBeenCalled()
    expect(vi.mocked(copyTemplates)).not.toHaveBeenCalled()
    expect(vi.mocked(writeManifest)).not.toHaveBeenCalled()
    expect(vi.mocked(installGitHook)).not.toHaveBeenCalled()
    expect(await noteText()).toContain('No project files written: /fake/.claude is your Claude Code settings folder.')
  })

  it('--dry-run lists no project files there', async () => {
    const { installGitHook } = await import('../steps/git-hook.js')

    await runInit('--dry-run')

    expect(await noteText()).not.toContain('Would write: JOURNAL.md')
    expect(vi.mocked(installGitHook)).not.toHaveBeenCalled()
  })

  it('--scope project stops with exit 1 and a clear message before writing anything', async () => {
    const { cancel } = await import('@clack/prompts')
    const { copyTemplates } = await import('../steps/copy-templates.js')
    const { writeManifest } = await import('../steps/write-manifest.js')
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error(`exit ${code}`) }) as never)
    try {
      await expect(runInit('--scope', 'project')).rejects.toThrow('exit 1')
    } finally {
      exitSpy.mockRestore()
    }
    expect(vi.mocked(cancel)).toHaveBeenCalledWith('/fake/.claude is your Claude Code settings folder, not a project.\nRun goodvibes init --scope project inside your project folder.')
    expect(vi.mocked(copyTemplates)).not.toHaveBeenCalled()
    expect(vi.mocked(writeManifest)).not.toHaveBeenCalled()
  })
})

describe('init --dry-run file list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function dryRun(files: string[], ...args: string[]): Promise<string[]> {
    const { note } = await import('@clack/prompts')
    const { listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(listTemplateFiles).mockResolvedValue(files)
    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)
    await program.parseAsync(['node', 'goodvibes', 'init', '--dry-run', '--scope', 'project', ...args])
    const list = vi.mocked(note).mock.calls.find(c => String(c[1]).includes('no files written'))
    return String(list![0]).split('\n').map(l => l.trim())
  }

  it('lists .github/workflows/ci.yml, not the ci-<type>.yml template it is made from', async () => {
    const lines = await dryRun(['.github/workflows/ci-both.yml', '.github/workflows/ci-node.yml', '.github/workflows/ci-python.yml', 'CLAUDE.md'])
    expect(lines).toEqual(['Would write: .github/workflows/ci.yml', 'Would write: CLAUDE.md'])
  })

  it('--minimal still lists Copilot\'s rules and hooks under .github, but no other .github file or docs', async () => {
    const lines = await dryRun([
      '.github/ISSUE_TEMPLATE/bug_report.yml', '.github/PULL_REQUEST_TEMPLATE.md', '.github/copilot-instructions.md',
      '.github/dependabot.yml', '.github/hooks/goodvibes.json', '.github/scripts/check-file-sizes.mjs',
      '.github/workflows/ci-both.yml', '.github/workflows/file-size.yml', 'AGENTS.md', 'docs/onboarding.md',
    ], '--minimal')
    expect(lines).toEqual(['Would write: .github/copilot-instructions.md', 'Would write: .github/hooks/goodvibes.json', 'Would write: AGENTS.md'])
  })
})

describe('init next steps', () => {
  const NEXT_STEPS = [
    '1. Open this project in your AI coding tool',
    '2. Optional, in the Claude Code terminal, for /ponytail-review and /ponytail-audit:',
    '   /plugin marketplace add DietrichGebert/ponytail',
    '   /plugin install ponytail@ponytail',
    '   Other IDEs (Cursor, Windsurf, Kiro, Antigravity, etc.): rules already active',
    '3. Start coding — CLAUDE.md rules are already active',
  ].join('\n')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([[[] as string[]], [['--dry-run']]])('give both ponytail plugin commands, marked optional and for the Claude Code terminal (%j)', async (extra: string[]) => {
    const { note, tasks } = await import('@clack/prompts')
    const { copyTemplates, listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { installHeadroom } = await import('../steps/install-headroom.js')
    const { configureMcp } = await import('../steps/configure-mcp.js')
    vi.mocked(resolveTemplatesDir).mockReturnValue('/fake/templates')
    vi.mocked(listTemplateFiles).mockResolvedValue(['CLAUDE.md'])
    vi.mocked(copyTemplates).mockResolvedValue({ written: ['CLAUDE.md'], skipped: [], problems: [] })
    vi.mocked(installHeadroom).mockResolvedValue({ status: 'installed' })
    vi.mocked(configureMcp).mockResolvedValue({ status: 'registered' })
    vi.mocked(tasks).mockImplementation(async (taskList: any[]) => {
      for (const t of taskList) await t.task(vi.fn())
    })
    const { registerInitCommand } = await import('./init.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerInitCommand(program)
    await program.parseAsync(['node', 'goodvibes', 'init', '--scope', 'project', ...extra])
    expect(vi.mocked(note).mock.calls.find(c => c[1] === 'Next steps')?.[0]).toBe(NEXT_STEPS)
  })
})
