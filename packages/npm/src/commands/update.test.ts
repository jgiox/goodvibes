import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
}))

vi.mock('../steps/copy-templates.js', () => ({
  listTemplateFiles: vi.fn().mockResolvedValue([]),
  resolveTemplatesDir: vi.fn().mockReturnValue('/mock/templates'),
}))

vi.mock('../steps/write-manifest.js', () => ({
  writeManifest: vi.fn().mockResolvedValue(undefined),
  readManifest: vi.fn().mockResolvedValue(null),
}))

vi.mock('../utils/sentinel-merge.js', () => ({
  mergeClaude: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../utils/detect-project-type.js', () => ({
  detectProjectType: vi.fn().mockReturnValue('both'),
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: vi.fn().mockReturnValue(true) }
})

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('content'),
}))

vi.mock('node:crypto', () => ({
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('abc123'),
  }),
}))

vi.mock('node:module', () => ({
  createRequire: () => () => ({ version: '1.2.0' }),
}))

vi.mock('fs-extra', () => ({
  copy: vi.fn().mockResolvedValue(undefined),
}))

describe('update command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows no-manifest note and exits 0 when .goodvibes.json is absent', async () => {
    const { outro, note } = await import('@clack/prompts')
    const { readManifest } = await import('../steps/write-manifest.js')
    vi.mocked(readManifest).mockResolvedValue(null)

    const { registerUpdateCommand } = await import('../commands/update.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpdateCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'update'])

    expect(vi.mocked(note)).toHaveBeenCalledWith(
      expect.stringContaining('goodvibes.json'),
      'No manifest',
    )
    expect(vi.mocked(outro)).toHaveBeenCalledWith('Nothing updated.')
  })

  it('--dry-run prints three categories without writing any files', async () => {
    const { confirm, note } = await import('@clack/prompts')
    const { readManifest, writeManifest } = await import('../steps/write-manifest.js')
    const { listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')

    vi.mocked(readManifest).mockResolvedValue({ version: '1.0.0', files: { 'CLAUDE.md': 'abc123' } })
    vi.mocked(listTemplateFiles).mockResolvedValue(['CLAUDE.md'])
    vi.mocked(resolveTemplatesDir).mockReturnValue('/mock/templates')

    const { registerUpdateCommand } = await import('../commands/update.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpdateCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'update', '--dry-run'])

    expect(vi.mocked(note)).toHaveBeenCalledWith(
      expect.any(String),
      'Dry run — no files written',
    )
    expect(vi.mocked(confirm)).not.toHaveBeenCalled()
    expect(vi.mocked(writeManifest)).not.toHaveBeenCalled()
  })

  it('--force skips confirm prompt and applies overwrites', async () => {
    const { confirm } = await import('@clack/prompts')
    const { readManifest, writeManifest } = await import('../steps/write-manifest.js')
    const { listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')

    vi.mocked(readManifest).mockResolvedValue({ version: '1.0.0', files: { 'CLAUDE.md': 'abc123' } })
    vi.mocked(listTemplateFiles).mockResolvedValue(['CLAUDE.md'])
    vi.mocked(resolveTemplatesDir).mockReturnValue('/mock/templates')

    const { registerUpdateCommand } = await import('../commands/update.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpdateCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'update', '--force'])

    expect(vi.mocked(confirm)).not.toHaveBeenCalled()
    expect(vi.mocked(writeManifest)).toHaveBeenCalled()
  })

  it('prompts confirmation before overwriting when --force is not set', async () => {
    const { confirm } = await import('@clack/prompts')
    const { readManifest, writeManifest } = await import('../steps/write-manifest.js')
    const { listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')

    vi.mocked(readManifest).mockResolvedValue({ version: '1.0.0', files: { 'CLAUDE.md': 'abc123' } })
    vi.mocked(listTemplateFiles).mockResolvedValue(['CLAUDE.md'])
    vi.mocked(resolveTemplatesDir).mockReturnValue('/mock/templates')
    vi.mocked(confirm).mockResolvedValue(true)

    const { registerUpdateCommand } = await import('../commands/update.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpdateCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'update'])

    expect(vi.mocked(confirm)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(writeManifest)).toHaveBeenCalled()
  })

  it('calls writeManifest after applying changes', async () => {
    const { readManifest, writeManifest } = await import('../steps/write-manifest.js')
    const { listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')

    vi.mocked(readManifest).mockResolvedValue({ version: '1.0.0', files: { 'CLAUDE.md': 'abc123' } })
    vi.mocked(listTemplateFiles).mockResolvedValue(['CLAUDE.md'])
    vi.mocked(resolveTemplatesDir).mockReturnValue('/mock/templates')

    const { registerUpdateCommand } = await import('../commands/update.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpdateCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'update', '--force'])

    expect(vi.mocked(writeManifest)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.any(String),
    )
  })

  it('skips template file missing from templateDir during apply', async () => {
    const { readManifest, writeManifest } = await import('../steps/write-manifest.js')
    const { listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { existsSync } = await import('node:fs')

    vi.mocked(readManifest).mockResolvedValue({ version: '1.0.0', files: { 'CLAUDE.md': 'abc123' } })
    vi.mocked(listTemplateFiles).mockResolvedValue(['CLAUDE.md'])
    vi.mocked(resolveTemplatesDir).mockReturnValue('/mock/templates')
    // All existsSync calls return false — template file missing, dest file gone, filter removes all
    vi.mocked(existsSync).mockReturnValue(false)

    const { registerUpdateCommand } = await import('../commands/update.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpdateCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'update', '--force'])

    expect(vi.mocked(writeManifest)).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.any(String),
    )
  })

  it('user-modified files (skip category) are not overwritten', async () => {
    const { readManifest, writeManifest } = await import('../steps/write-manifest.js')
    const { listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { createHash } = await import('node:crypto')
    const { existsSync } = await import('node:fs')
    // Reset existsSync to true — previous test may have set it to false (clearAllMocks preserves implementations)
    vi.mocked(existsSync).mockReturnValue(true)

    // CLAUDE.md has a different hash in manifest — user-modified → skip
    // .claude/skills/skills.md hash matches — unmodified → overwrite
    vi.mocked(readManifest).mockResolvedValue({
      version: '1.0.0',
      files: { 'CLAUDE.md': 'different-hash', '.claude/skills/skills.md': 'abc123' },
    })
    vi.mocked(listTemplateFiles).mockResolvedValue(['CLAUDE.md', '.claude/skills/skills.md'])
    vi.mocked(resolveTemplatesDir).mockReturnValue('/mock/templates')
    // createHash returns 'abc123' — matches .claude/skills/skills.md but not CLAUDE.md
    vi.mocked(createHash).mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('abc123'),
    } as any)

    const { registerUpdateCommand } = await import('../commands/update.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpdateCommand(program)

    await program.parseAsync(['node', 'goodvibes', 'update', '--force'])

    expect(vi.mocked(writeManifest)).toHaveBeenCalled()
    const writtenFiles = vi.mocked(writeManifest).mock.calls[0][1] as string[]
    expect(writtenFiles).not.toContain('CLAUDE.md')
    expect(writtenFiles).toContain('.claude/skills/skills.md')
  })
})
