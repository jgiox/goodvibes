import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
}))

vi.mock('../steps/copy-templates.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../steps/copy-templates.js')>()
  return { ...actual, resolveTemplatesDir: vi.fn() }
})

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

describe('update command — real tmp-dir regression coverage (D1)', () => {
  let templateDir: string
  let projectDir: string
  let cwdSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    templateDir = mkdtempSync(join(tmpdir(), 'gv-update-tpl-'))
    projectDir = mkdtempSync(join(tmpdir(), 'gv-update-proj-'))
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir)
  })

  afterEach(() => {
    cwdSpy.mockRestore()
    rmSync(templateDir, { recursive: true, force: true })
    rmSync(projectDir, { recursive: true, force: true })
  })

  it('keeps a user-modified file intact across two consecutive update runs', async () => {
    const { resolveTemplatesDir } = await import('../steps/copy-templates.js')
    vi.mocked(resolveTemplatesDir).mockReturnValue(templateDir)

    const originalContent = 'template content v1\n'
    writeFileSync(join(templateDir, 'tracked.md'), originalContent)

    const userContent = 'user edited this file\n'
    writeFileSync(join(projectDir, 'tracked.md'), userContent)
    writeFileSync(
      join(projectDir, '.goodvibes.json'),
      JSON.stringify({ version: '1.0.0', files: { 'tracked.md': sha256(originalContent) } }, null, 2),
    )

    const { registerUpdateCommand } = await import('./update.js')
    const { Command } = await import('commander')

    const program1 = new Command()
    program1.exitOverride()
    registerUpdateCommand(program1)
    await program1.parseAsync(['node', 'goodvibes', 'update', '--force'])

    expect(readFileSync(join(projectDir, 'tracked.md'), 'utf-8')).toBe(userContent)

    const program2 = new Command()
    program2.exitOverride()
    registerUpdateCommand(program2)
    await program2.parseAsync(['node', 'goodvibes', 'update', '--force'])

    // Second run must not reclassify the still-skipped file as net-new and overwrite it
    expect(readFileSync(join(projectDir, 'tracked.md'), 'utf-8')).toBe(userContent)
  })

  it('refreshes the goodvibes block in CLAUDE.md while preserving content outside it', async () => {
    const { resolveTemplatesDir } = await import('../steps/copy-templates.js')
    vi.mocked(resolveTemplatesDir).mockReturnValue(templateDir)

    const templateClaudeMd =
      '<!-- goodvibes:start -->\n# goodvibes: v2.0.0\n\nnew rules\n<!-- goodvibes:end -->\n'
    writeFileSync(join(templateDir, 'CLAUDE.md'), templateClaudeMd)

    // Manifest records the hash as written by init (block only, no custom prose yet).
    const initialClaudeMd =
      '<!-- goodvibes:start -->\n# goodvibes: v1.0.0\n\nold rules\n<!-- goodvibes:end -->\n'
    // The user then appended custom prose outside the block — the whole-file hash no
    // longer matches the manifest even though the sentinel block itself is untouched.
    const existingClaudeMd = '# My Project\n\nCustom prose that must survive.\n\n' + initialClaudeMd
    writeFileSync(join(projectDir, 'CLAUDE.md'), existingClaudeMd)
    writeFileSync(
      join(projectDir, '.goodvibes.json'),
      JSON.stringify(
        { version: '1.0.0', files: { 'CLAUDE.md': sha256(initialClaudeMd) } },
        null,
        2,
      ),
    )

    const { registerUpdateCommand } = await import('./update.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpdateCommand(program)
    await program.parseAsync(['node', 'goodvibes', 'update', '--force'])

    const result = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8')
    expect(result).toContain('Custom prose that must survive.')
    expect(result).toContain('new rules')
    expect(result).not.toContain('old rules')
  })
})
