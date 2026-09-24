import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
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

// No test here may read or write the real ~/.claude.
process.env.CLAUDE_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'gv-update-cfg-'))

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

  it('does not overwrite a pre-existing file that init skipped and the manifest never recorded', async () => {
    const { resolveTemplatesDir } = await import('../steps/copy-templates.js')
    vi.mocked(resolveTemplatesDir).mockReturnValue(templateDir)

    writeFileSync(join(templateDir, 'AGENTS.md'), 'goodvibes template\n')
    const userAgents = 'my own agent rules, written before goodvibes init\n'
    writeFileSync(join(projectDir, 'AGENTS.md'), userAgents)
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({ version: '1.0.0', files: {} }, null, 2))

    const { registerUpdateCommand } = await import('./update.js')
    const { Command } = await import('commander')
    for (let run = 0; run < 2; run++) {
      const program = new Command()
      program.exitOverride()
      registerUpdateCommand(program)
      await program.parseAsync(['node', 'goodvibes', 'update', '--force'])
      expect(readFileSync(join(projectDir, 'AGENTS.md'), 'utf-8')).toBe(userAgents)
    }
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

describe('update command — JSON-aware merge of settings.json and .mcp.json (UPD-07)', () => {
  const realTemplates = fileURLToPath(new URL('../../../../templates', import.meta.url))
  const tplSettings = readFileSync(join(realTemplates, '.claude', 'settings.json'), 'utf-8')
  const tplMcp = readFileSync(join(realTemplates, '.mcp.json'), 'utf-8')
  let templateDir: string
  let projectDir: string
  let cwdSpy: ReturnType<typeof vi.spyOn>

  async function runUpdate(...flags: string[]): Promise<void> {
    const { resolveTemplatesDir } = await import('../steps/copy-templates.js')
    vi.mocked(resolveTemplatesDir).mockReturnValue(templateDir)
    const { registerUpdateCommand } = await import('./update.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpdateCommand(program)
    await program.parseAsync(['node', 'goodvibes', 'update', ...flags])
  }

  const readJson = (rel: string) => JSON.parse(readFileSync(join(projectDir, rel), 'utf-8'))
  const writeManifestFile = (files: Record<string, string>, managed?: Record<string, string[]>) =>
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({ version: '1.7.1', files, ...(managed ? { managed } : {}) }))

  beforeEach(() => {
    templateDir = mkdtempSync(join(tmpdir(), 'gv-merge-tpl-'))
    projectDir = mkdtempSync(join(tmpdir(), 'gv-merge-proj-'))
    mkdirSync(join(templateDir, '.claude'), { recursive: true })
    mkdirSync(join(projectDir, '.claude'), { recursive: true })
    writeFileSync(join(templateDir, '.claude', 'settings.json'), tplSettings)
    writeFileSync(join(templateDir, '.mcp.json'), tplMcp)
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir)
  })

  afterEach(() => {
    cwdSpy.mockRestore()
    rmSync(templateDir, { recursive: true, force: true })
    rmSync(projectDir, { recursive: true, force: true })
  })

  it('adds the journal-gate hook and ask rules to a hand-edited settings.json and keeps the user keys', async () => {
    const v171 = JSON.stringify({ permissions: { allow: ['Read(**)'], deny: ['Bash(git reset --hard*)'] } }, null, 2)
    const userEdited = {
      permissions: { allow: ['Read(**)', 'Bash(make*)'], deny: ['Bash(git reset --hard*)'] },
      hooks: { PostToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'npx prettier --write .' }] }] },
    }
    writeFileSync(join(projectDir, '.claude', 'settings.json'), JSON.stringify(userEdited, null, 2))
    writeFileSync(join(projectDir, '.mcp.json'), tplMcp)
    writeManifestFile({ '.claude/settings.json': sha256(v171), '.mcp.json': sha256(tplMcp) })

    await runUpdate('--force')

    const s = readJson('.claude/settings.json')
    expect(s.permissions.allow).toEqual(['Read(**)', 'Bash(make*)'])
    expect(s.hooks.PostToolUse).toEqual(userEdited.hooks.PostToolUse)
    expect(s.hooks.PreToolUse[0].hooks[0].command).toMatch(/^: goodvibes-journal-gate;/)
    expect(s.permissions.ask).toEqual(JSON.parse(tplSettings).permissions.ask)
  })

  it('adds context7 to a user .mcp.json that init never recorded and keeps the other servers', async () => {
    writeFileSync(join(projectDir, '.mcp.json'), JSON.stringify({ mcpServers: { postgres: { command: 'pg-mcp' } } }))
    writeManifestFile({})

    await runUpdate('--force')

    const m = readJson('.mcp.json')
    expect(m.mcpServers.postgres).toEqual({ command: 'pg-mcp' })
    expect(m.mcpServers.context7).toEqual(JSON.parse(tplMcp).mcpServers.context7)
  })

  it('--dry-run lists the JSON keys it would add without writing anything', async () => {
    const userFile = JSON.stringify({ permissions: { allow: ['Bash(make*)'] } })
    writeFileSync(join(projectDir, '.claude', 'settings.json'), userFile)
    writeManifestFile({ '.claude/settings.json': 'old-hash' })
    const { note } = await import('@clack/prompts')
    vi.mocked(note).mockClear()

    await runUpdate('--dry-run')

    const preview = vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')
    expect(preview).toContain('Will merge goodvibes keys into .claude/settings.json')
    expect(preview).toContain('+ hooks.PreToolUse: goodvibes-journal-gate')
    expect(preview).toContain('+ permissions.ask: Bash(git push*)')
    expect(readFileSync(join(projectDir, '.claude', 'settings.json'), 'utf-8')).toBe(userFile)
  })

  it('still overwrites an untouched settings.json whole-file, as before', async () => {
    const v171 = JSON.stringify({ permissions: { allow: ['Read(**)'] } }, null, 2)
    writeFileSync(join(projectDir, '.claude', 'settings.json'), v171)
    writeManifestFile({ '.claude/settings.json': sha256(v171) })

    await runUpdate('--force')

    expect(readFileSync(join(projectDir, '.claude', 'settings.json'), 'utf-8')).toBe(tplSettings)
  })

  it('does not re-add the journal-gate hook after the user deleted it to opt out', async () => {
    writeFileSync(join(projectDir, '.claude', 'settings.json'), JSON.stringify({ permissions: { allow: ['Bash(make*)'] } }))
    writeManifestFile({ '.claude/settings.json': 'old-hash' })
    await runUpdate('--force')
    const afterFirst = readJson('.claude/settings.json')
    delete afterFirst.hooks
    writeFileSync(join(projectDir, '.claude', 'settings.json'), JSON.stringify(afterFirst, null, 2))

    await runUpdate('--force')

    expect(readJson('.claude/settings.json').hooks).toBeUndefined()
  })

  it('in a global-scope project, refreshes the Claude config and never adds the rules block, skills or .mcp.json to the project', async () => {
    const cfg = mkdtempSync(join(tmpdir(), 'gv-update-gcfg-'))
    const savedCfg = process.env.CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = cfg
    try {
      writeFileSync(join(templateDir, 'CLAUDE.md'), '# CLAUDE.md\n\n<!-- goodvibes:start -->\n# goodvibes: v9.9.9\nrules\n<!-- goodvibes:end -->\n')
      mkdirSync(join(templateDir, '.claude', 'skills', 'caveman'), { recursive: true })
      writeFileSync(join(templateDir, '.claude', 'skills', 'caveman', 'SKILL.md'), 'skill\n')
      writeFileSync(join(projectDir, 'CLAUDE.md'), '# CLAUDE.md\n\n## Project\n')
      writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({ version: '1.8.0', files: { 'CLAUDE.md': 'x' }, scope: 'global' }))

      await runUpdate('--force')

      expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8')).toBe('# CLAUDE.md\n\n## Project\n')
      expect(existsSync(join(projectDir, '.claude', 'skills'))).toBe(false)
      expect(existsSync(join(projectDir, '.mcp.json'))).toBe(false)
      expect(readFileSync(join(cfg, 'rules', 'goodvibes.md'), 'utf-8')).toContain('v9.9.9')
      expect(JSON.parse(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8')).scope).toBe('global')
    } finally {
      process.env.CLAUDE_CONFIG_DIR = savedCfg
      rmSync(cfg, { recursive: true, force: true })
    }
  })

  it('leaves an invalid settings.json unchanged and reports it instead of crashing', async () => {
    writeFileSync(join(projectDir, '.claude', 'settings.json'), '{ not json')
    writeManifestFile({ '.claude/settings.json': 'old-hash' })
    const { note } = await import('@clack/prompts')
    vi.mocked(note).mockClear()

    await runUpdate('--force')

    expect(readFileSync(join(projectDir, '.claude', 'settings.json'), 'utf-8')).toBe('{ not json')
    const out = vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')
    expect(out).toContain('.claude/settings.json: not valid JSON')
  })
})
