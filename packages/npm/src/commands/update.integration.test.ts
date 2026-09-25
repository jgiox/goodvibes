import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync, symlinkSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
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

  it('deletes an unchanged project skill file goodvibes no longer ships and keeps an edited one', async () => {
    mkdirSync(join(projectDir, '.claude', 'skills', 'gone'), { recursive: true })
    mkdirSync(join(projectDir, '.claude', 'skills', 'mine'), { recursive: true })
    writeFileSync(join(projectDir, '.claude', 'skills', 'gone', 'SKILL.md'), 'old\n')
    writeFileSync(join(projectDir, '.claude', 'skills', 'mine', 'SKILL.md'), 'edited\n')
    writeFileSync(join(projectDir, '.mcp.json'), tplMcp)
    writeManifestFile({
      '.claude/skills/gone/SKILL.md': sha256('old\n'),
      '.claude/skills/mine/SKILL.md': sha256('old\n'),
      '.mcp.json': sha256(tplMcp),
    })

    await runUpdate('--force')

    expect(existsSync(join(projectDir, '.claude', 'skills', 'gone'))).toBe(false)
    expect(readFileSync(join(projectDir, '.claude', 'skills', 'mine', 'SKILL.md'), 'utf-8')).toBe('edited\n')
    const files = JSON.parse(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8')).files
    expect(files).not.toHaveProperty('.claude/skills/gone/SKILL.md')
  })

  it('removes the allow rules older goodvibes versions shipped from a hand-edited project settings.json', async () => {
    const old = JSON.stringify({ permissions: { allow: ['Read(**)'] } }, null, 2)
    const userEdited = { permissions: { allow: ['Read(**)', 'Bash(node*)', 'Bash(uv*)', 'Bash(make*)'] } }
    writeFileSync(join(projectDir, '.claude', 'settings.json'), JSON.stringify(userEdited, null, 2))
    writeFileSync(join(projectDir, '.mcp.json'), tplMcp)
    writeManifestFile({ '.claude/settings.json': sha256(old), '.mcp.json': sha256(tplMcp) })

    await runUpdate('--force')

    expect(readJson('.claude/settings.json').permissions.allow).toEqual(['Read(**)', 'Bash(make*)'])
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

  it('merges the goodvibes hooks into existing Gemini CLI and Codex hook files and keeps the user settings and hooks', async () => {
    const userGroup = { matcher: 'write_file', hooks: [{ type: 'command', command: 'npx prettier --check .' }] }
    for (const rel of ['.gemini/settings.json', '.codex/hooks.json']) {
      mkdirSync(join(templateDir, rel, '..'), { recursive: true })
      writeFileSync(join(templateDir, rel), readFileSync(join(realTemplates, rel), 'utf-8'))
      mkdirSync(join(projectDir, rel, '..'), { recursive: true })
    }
    writeFileSync(join(projectDir, '.gemini', 'settings.json'), JSON.stringify({ theme: 'GitHub', hooks: { BeforeTool: [userGroup] } }))
    writeFileSync(join(projectDir, '.codex', 'hooks.json'), JSON.stringify({ hooks: { PreToolUse: [userGroup] } }))
    writeManifestFile({})

    await runUpdate('--force')

    const gemini = readJson('.gemini/settings.json')
    expect(gemini.theme).toBe('GitHub')
    expect(gemini.hooks.BeforeTool).toEqual([userGroup, ...JSON.parse(readFileSync(join(realTemplates, '.gemini', 'settings.json'), 'utf-8')).hooks.BeforeTool])
    expect(readJson('.codex/hooks.json').hooks.PreToolUse).toEqual([userGroup, ...JSON.parse(readFileSync(join(realTemplates, '.codex', 'hooks.json'), 'utf-8')).hooks.PreToolUse])
  })

  describe('context7 in the Cursor and VS Code MCP files', () => {
    const context7 = { type: 'http', url: 'https://mcp.context7.com/mcp' }
    const tpl = { '.cursor/mcp.json': { mcpServers: { context7: { url: context7.url } } }, '.vscode/mcp.json': { servers: { context7 } } }
    const put = (dir: string, rel: string, data: unknown) => {
      mkdirSync(join(dir, rel, '..'), { recursive: true })
      writeFileSync(join(dir, rel), JSON.stringify(data, null, 2))
    }
    beforeEach(() => {
      for (const [rel, data] of Object.entries(tpl)) put(templateDir, rel, data)
    })

    it('merges context7 into existing Cursor and VS Code MCP files and keeps the user servers', async () => {
      put(projectDir, '.cursor/mcp.json', { mcpServers: { postgres: { command: 'pg-mcp' } } })
      put(projectDir, '.vscode/mcp.json', { inputs: [], servers: { github: { type: 'http', url: 'https://api.githubcopilot.com/mcp' } } })
      writeManifestFile({})
      const { note } = await import('@clack/prompts')
      vi.mocked(note).mockClear()

      await runUpdate('--force')

      expect(readJson('.cursor/mcp.json').mcpServers).toEqual({ postgres: { command: 'pg-mcp' }, context7: { url: context7.url } })
      expect(readJson('.vscode/mcp.json')).toEqual({ inputs: [], servers: { github: { type: 'http', url: 'https://api.githubcopilot.com/mcp' }, context7 } })
      const out = vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')
      expect(out).toContain('Merged 1 goodvibes key(s) into .vscode/mcp.json.')
    })

    it('does not re-add context7 to a VS Code MCP file after the user deleted the entry', async () => {
      put(projectDir, '.vscode/mcp.json', { servers: { github: { type: 'http', url: 'https://api.githubcopilot.com/mcp' } } })
      writeManifestFile({})
      await runUpdate('--force')
      const afterFirst = readJson('.vscode/mcp.json')
      expect(afterFirst.servers.context7).toEqual(context7)
      delete afterFirst.servers.context7
      put(projectDir, '.vscode/mcp.json', afterFirst)

      await runUpdate('--force')

      expect(readJson('.vscode/mcp.json').servers).toEqual({ github: { type: 'http', url: 'https://api.githubcopilot.com/mcp' } })
    })

    it('does not recreate a Cursor MCP file the user deleted', async () => {
      writeManifestFile({ '.cursor/mcp.json': sha256(JSON.stringify(tpl['.cursor/mcp.json'], null, 2)) })

      await runUpdate('--force')

      expect(existsSync(join(projectDir, '.cursor', 'mcp.json'))).toBe(false)
    })
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

  it('leaves a settings.json or .mcp.json that is JSON but not an object unchanged and reports it', async () => {
    writeFileSync(join(projectDir, '.claude', 'settings.json'), '[]')
    writeFileSync(join(projectDir, '.mcp.json'), 'null')
    writeManifestFile({ '.claude/settings.json': 'old-hash', '.mcp.json': 'old-hash' })
    const { note } = await import('@clack/prompts')
    vi.mocked(note).mockClear()

    await runUpdate('--force')

    expect(readFileSync(join(projectDir, '.claude', 'settings.json'), 'utf-8')).toBe('[]')
    expect(readFileSync(join(projectDir, '.mcp.json'), 'utf-8')).toBe('null')
    const out = vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')
    expect(out).toContain('.claude/settings.json: not a JSON object; left unchanged')
    expect(out).toContain('.mcp.json: not a JSON object; left unchanged')
  })

  it('leaves an MCP file or settings.json whose nested maps have the wrong type unchanged and reports each one', async () => {
    for (const d of ['.cursor', '.vscode']) {
      mkdirSync(join(templateDir, d), { recursive: true })
      writeFileSync(join(templateDir, d, 'mcp.json'), readFileSync(join(realTemplates, d, 'mcp.json'), 'utf-8'))
      mkdirSync(join(projectDir, d), { recursive: true })
    }
    writeFileSync(join(projectDir, '.cursor', 'mcp.json'), '{"mcpServers":[]}')
    writeFileSync(join(projectDir, '.vscode', 'mcp.json'), '{"servers":"oops"}')
    writeFileSync(join(projectDir, '.claude', 'settings.json'), '{"hooks":[]}')
    writeManifestFile({ '.cursor/mcp.json': 'old-hash', '.vscode/mcp.json': 'old-hash', '.claude/settings.json': 'old-hash' })
    const { note } = await import('@clack/prompts')
    vi.mocked(note).mockClear()

    await runUpdate('--force')

    expect(readFileSync(join(projectDir, '.cursor', 'mcp.json'), 'utf-8')).toBe('{"mcpServers":[]}')
    expect(readFileSync(join(projectDir, '.vscode', 'mcp.json'), 'utf-8')).toBe('{"servers":"oops"}')
    expect(readFileSync(join(projectDir, '.claude', 'settings.json'), 'utf-8')).toBe('{"hooks":[]}')
    const out = vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')
    expect(out).toContain('.cursor/mcp.json: "mcpServers" is not a JSON object; left unchanged, fix it and re-run update')
    expect(out).toContain('.vscode/mcp.json: "servers" is not a JSON object; left unchanged, fix it and re-run update')
    expect(out).toContain('.claude/settings.json: "hooks" is not a JSON object; left unchanged, fix it and re-run update')
  })

  it('leaves no temp files next to the JSON files it writes', async () => {
    writeFileSync(join(projectDir, '.claude', 'settings.json'), JSON.stringify({ model: 'x' }))
    writeManifestFile({ '.claude/settings.json': 'old-hash' })

    await runUpdate('--force')

    const { readdirSync } = await import('node:fs')
    expect(readdirSync(join(projectDir, '.claude'))).toEqual(['settings.json'])
    expect(readdirSync(projectDir).filter(f => f.includes('tmp'))).toEqual([])
    expect(readJson('.claude/settings.json').model).toBe('x')
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

describe('update command — broken manifests and Windows keys', () => {
  let templateDir: string
  let projectDir: string
  let cwdSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

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

  const said = async () => {
    const { note, cancel, outro } = await import('@clack/prompts')
    return [note, cancel, outro].flatMap(f => vi.mocked(f).mock.calls.map(c => String(c[0]))).join('\n')
  }

  beforeEach(async () => {
    templateDir = mkdtempSync(join(tmpdir(), 'gv-bm-tpl-'))
    projectDir = mkdtempSync(join(tmpdir(), 'gv-bm-proj-'))
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir)
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error(`exit ${code}`) }) as never)
    const { note, cancel, outro } = await import('@clack/prompts')
    for (const f of [note, cancel, outro]) vi.mocked(f).mockClear()
  })

  afterEach(() => {
    cwdSpy.mockRestore()
    exitSpy.mockRestore()
    rmSync(templateDir, { recursive: true, force: true })
    rmSync(projectDir, { recursive: true, force: true })
  })

  it('exits 1 with a fix-it message when .goodvibes.json has merge conflict markers', async () => {
    writeFileSync(join(templateDir, 'AGENTS.md'), 'tpl\n')
    const broken = '<<<<<<< HEAD\n{"version":"1.0.0","files":{}}\n=======\n{}\n>>>>>>> main\n'
    writeFileSync(join(projectDir, '.goodvibes.json'), broken)

    await expect(runUpdate('--force')).rejects.toThrow('exit 1')

    const out = await said()
    expect(out).toContain(`${join(projectDir, '.goodvibes.json')} is not valid JSON (`)
    expect(out).toContain('fix it or delete it and run goodvibes init')
    expect(out).not.toContain('not set up')
    expect(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8')).toBe(broken)
    expect(existsSync(join(projectDir, 'AGENTS.md'))).toBe(false)
  })

  it('exits 1 when the global manifest in the Claude config is not valid JSON', async () => {
    const cfg = process.env.CLAUDE_CONFIG_DIR!
    writeFileSync(join(cfg, '.goodvibes.json'), '{ broken')
    try {
      await expect(runUpdate('--force')).rejects.toThrow('exit 1')
      expect(await said()).toContain(`${join(cfg, '.goodvibes.json')} is not valid JSON (`)
    } finally {
      rmSync(join(cfg, '.goodvibes.json'))
    }
  })

  it('treats backslash manifest keys as the same files: refreshes untouched ones and keeps edited ones protected', async () => {
    mkdirSync(join(templateDir, 'docs'), { recursive: true })
    mkdirSync(join(projectDir, 'docs'), { recursive: true })
    writeFileSync(join(templateDir, 'docs', 'a.md'), 'a v2\n')
    writeFileSync(join(templateDir, 'docs', 'b.md'), 'b v2\n')
    writeFileSync(join(projectDir, 'docs', 'a.md'), 'a v1\n')
    writeFileSync(join(projectDir, 'docs', 'b.md'), 'b edited by me\n')
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({
      version: '1.0.0',
      files: { 'docs\\a.md': sha256('a v1\n'), 'docs\\b.md': sha256('b v1\n') },
    }))

    await runUpdate('--force')

    expect(readFileSync(join(projectDir, 'docs', 'a.md'), 'utf-8')).toBe('a v2\n')
    expect(readFileSync(join(projectDir, 'docs', 'b.md'), 'utf-8')).toBe('b edited by me\n')
    const files = JSON.parse(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8')).files
    expect(files).toEqual({ 'docs/a.md': sha256('a v2\n'), 'docs/b.md': sha256('b v1\n') })
  })
})

describe('update command — symlinks and broken CLAUDE.md markers', () => {
  let templateDir: string
  let projectDir: string
  let outside: string
  let cwdSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

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

  const said = async () => {
    const { note, cancel, outro } = await import('@clack/prompts')
    return [note, cancel, outro].flatMap(f => vi.mocked(f).mock.calls.map(c => String(c[0]))).join('\n')
  }

  beforeEach(async () => {
    templateDir = mkdtempSync(join(tmpdir(), 'gv-sl-tpl-'))
    projectDir = mkdtempSync(join(tmpdir(), 'gv-sl-proj-'))
    outside = mkdtempSync(join(tmpdir(), 'gv-sl-outside-'))
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir)
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error(`exit ${code}`) }) as never)
    const { note, cancel, outro } = await import('@clack/prompts')
    for (const f of [note, cancel, outro]) vi.mocked(f).mockClear()
    mkdirSync(join(templateDir, '.claude'))
    writeFileSync(join(templateDir, '.claude', 'settings.json'), JSON.stringify({ permissions: { ask: ['Bash(git push*)'] } }))
  })

  afterEach(() => {
    cwdSpy.mockRestore()
    exitSpy.mockRestore()
    for (const d of [templateDir, projectDir, outside]) rmSync(d, { recursive: true, force: true })
  })

  it('update --force writes nothing outside the project when .claude is a symlink to an outside folder', async () => {
    const original = JSON.stringify({ model: 'outside' })
    writeFileSync(join(outside, 'settings.json'), original)
    symlinkSync(outside, join(projectDir, '.claude'))
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({ version: '1.0.0', files: { '.claude/settings.json': sha256(original) } }))

    await runUpdate('--force')

    expect(readdirSync(outside)).toEqual(['settings.json'])
    expect(readFileSync(join(outside, 'settings.json'), 'utf-8')).toBe(original)
    expect(await said()).toContain('.claude/settings.json: symlink, not written')
    const files = JSON.parse(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8')).files
    expect(files['.claude/settings.json']).toBe(sha256(original))
  })

  it('update --force does not merge keys into a user-edited settings.json behind a symlinked .claude', async () => {
    const original = JSON.stringify({ model: 'outside' })
    writeFileSync(join(outside, 'settings.json'), original)
    symlinkSync(outside, join(projectDir, '.claude'))
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({ version: '1.0.0', files: { '.claude/settings.json': 'old-hash' } }))

    await runUpdate('--force')

    expect(readFileSync(join(outside, 'settings.json'), 'utf-8')).toBe(original)
  })

  it('does not write the manifest through a symlinked .goodvibes.json', async () => {
    const target = join(outside, 'manifest.json')
    writeFileSync(target, JSON.stringify({ version: '1.0.0', files: {} }))
    symlinkSync(target, join(projectDir, '.goodvibes.json'))
    writeFileSync(join(templateDir, 'AGENTS.md'), 'tpl\n')

    await runUpdate('--force')

    expect(JSON.parse(readFileSync(target, 'utf-8'))).toEqual({ version: '1.0.0', files: {} })
    expect(await said()).toContain('.goodvibes.json: symlink, not written')
  })

  it('reports broken CLAUDE.md markers, still updates the other files, and exits 1 at the end', async () => {
    writeFileSync(join(templateDir, 'CLAUDE.md'), '<!-- goodvibes:start -->\n# goodvibes: v2.0.0\n<!-- goodvibes:end -->\n')
    writeFileSync(join(templateDir, 'AGENTS.md'), 'tpl v2\n')
    const broken = '# Mine\n<!-- goodvibes:end -->\ntext\n<!-- goodvibes:start -->\n'
    writeFileSync(join(projectDir, 'CLAUDE.md'), broken)
    writeFileSync(join(projectDir, 'AGENTS.md'), 'tpl v1\n')
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({
      version: '1.0.0',
      files: { 'CLAUDE.md': 'x', 'AGENTS.md': sha256('tpl v1\n') },
    }))

    await expect(runUpdate('--force')).rejects.toThrow('exit 1')

    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8')).toBe(broken)
    expect(readFileSync(join(projectDir, 'AGENTS.md'), 'utf-8')).toBe('tpl v2\n')
    expect(await said()).toMatch(/end line comes before the start line.*fix CLAUDE\.md by hand/)
    expect(existsSync(join(projectDir, '.goodvibes.json'))).toBe(true)
  })
})

describe('update command — one plan, one prompt, nothing written before it', () => {
  const realTemplates = fileURLToPath(new URL('../../../../templates', import.meta.url))
  let projectDir: string
  let cfg: string
  let savedCfg: string | undefined
  let cwdSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

  const snapshot = (dir: string): Record<string, string> => {
    const out: Record<string, string> = {}
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name)
        if (e.isDirectory()) walk(p)
        else out[relative(dir, p)] = readFileSync(p, 'utf-8')
      }
    }
    walk(dir)
    return out
  }

  async function runUpdate(...flags: string[]): Promise<void> {
    const { resolveTemplatesDir } = await import('../steps/copy-templates.js')
    vi.mocked(resolveTemplatesDir).mockReturnValue(realTemplates)
    const { registerUpdateCommand } = await import('./update.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpdateCommand(program)
    await program.parseAsync(['node', 'goodvibes', 'update', ...flags])
  }

  beforeEach(async () => {
    projectDir = mkdtempSync(join(tmpdir(), 'gv-plan-proj-'))
    cfg = mkdtempSync(join(tmpdir(), 'gv-plan-cfg-'))
    savedCfg = process.env.CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = cfg
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir)
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error(`exit ${code}`) }) as never)
    writeFileSync(join(cfg, '.goodvibes.json'), JSON.stringify({ version: '1.0.0', scope: 'global', files: {} }))
    writeFileSync(join(cfg, 'settings.json'), JSON.stringify({ model: 'mine' }))
    writeFileSync(join(projectDir, 'AGENTS.md'), 'old agents\n')
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({ version: '1.0.0', scope: 'global', files: { 'AGENTS.md': sha256('old agents\n') } }))
    const { note, confirm, cancel } = await import('@clack/prompts')
    for (const f of [note, confirm, cancel]) vi.mocked(f).mockClear()
  })

  afterEach(async () => {
    process.env.CLAUDE_CONFIG_DIR = savedCfg
    cwdSpy.mockRestore()
    exitSpy.mockRestore()
    const { confirm } = await import('@clack/prompts')
    vi.mocked(confirm).mockResolvedValue(true)
    for (const d of [projectDir, cfg]) rmSync(d, { recursive: true, force: true })
  })

  it('cancelling the prompt leaves both the project and the Claude config untouched', async () => {
    const { confirm } = await import('@clack/prompts')
    vi.mocked(confirm).mockResolvedValue(false)
    const beforeCfg = snapshot(cfg)
    const beforeProject = snapshot(projectDir)

    await expect(runUpdate()).rejects.toThrow('exit 0')

    expect(vi.mocked(confirm)).toHaveBeenCalledTimes(1)
    expect(snapshot(cfg)).toEqual(beforeCfg)
    expect(snapshot(projectDir)).toEqual(beforeProject)
  })

  it('shows the global and project plan before the single prompt, then applies both', async () => {
    const { confirm, note } = await import('@clack/prompts')
    vi.mocked(confirm).mockResolvedValue(true)

    await runUpdate()

    expect(vi.mocked(confirm)).toHaveBeenCalledTimes(1)
    const promptAt = vi.mocked(confirm).mock.invocationCallOrder[0]
    const planned = vi.mocked(note).mock.calls
      .filter((_, i) => vi.mocked(note).mock.invocationCallOrder[i] < promptAt)
      .map(c => String(c[0])).join('\n')
    expect(planned).toContain('rules/goodvibes.md')
    expect(planned).toContain('AGENTS.md')
    expect(existsSync(join(cfg, 'rules', 'goodvibes.md'))).toBe(true)
    expect(readFileSync(join(projectDir, 'AGENTS.md'), 'utf-8')).not.toBe('old agents\n')
  })
})

describe('update command — respects files the user removed and layers init skipped', () => {
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

  const put = (dir: string, rel: string, content: string) => {
    mkdirSync(join(dir, rel, '..'), { recursive: true })
    writeFileSync(join(dir, rel), content)
  }
  const manifestFiles = () => JSON.parse(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8')).files

  beforeEach(async () => {
    templateDir = mkdtempSync(join(tmpdir(), 'gv-rm-tpl-'))
    projectDir = mkdtempSync(join(tmpdir(), 'gv-rm-proj-'))
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir)
    const { note } = await import('@clack/prompts')
    vi.mocked(note).mockClear()
  })

  afterEach(() => {
    cwdSpy.mockRestore()
    rmSync(templateDir, { recursive: true, force: true })
    rmSync(projectDir, { recursive: true, force: true })
  })

  it('keeps a deleted AGENTS.md absent over two update runs, reports it once and records it as user-removed', async () => {
    put(templateDir, 'AGENTS.md', 'agents v2\n')
    put(templateDir, 'GEMINI.md', 'gemini v2\n')
    put(projectDir, 'GEMINI.md', 'gemini v1\n')
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({
      version: '1.0.0',
      files: { 'AGENTS.md': sha256('agents v1\n'), 'GEMINI.md': sha256('gemini v1\n') },
    }))
    const { note } = await import('@clack/prompts')
    const notes = () => vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')

    await runUpdate('--force')

    expect(existsSync(join(projectDir, 'AGENTS.md'))).toBe(false)
    expect(readFileSync(join(projectDir, 'GEMINI.md'), 'utf-8')).toBe('gemini v2\n')
    expect(notes()).toContain('AGENTS.md: removed by you, not re-added (run goodvibes init to restore)')
    expect(manifestFiles()['AGENTS.md']).toBe('user-removed')

    vi.mocked(note).mockClear()
    await runUpdate('--force')

    expect(existsSync(join(projectDir, 'AGENTS.md'))).toBe(false)
    expect(notes()).not.toContain('AGENTS.md')
    expect(manifestFiles()['AGENTS.md']).toBe('user-removed')
  })

  it('never overwrites a user-removed file the user created again', async () => {
    put(templateDir, 'AGENTS.md', 'agents v2\n')
    put(projectDir, 'AGENTS.md', 'my own agents\n')
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({ version: '1.0.0', files: { 'AGENTS.md': 'user-removed' } }))

    await runUpdate('--force')
    await runUpdate('--force')

    expect(readFileSync(join(projectDir, 'AGENTS.md'), 'utf-8')).toBe('my own agents\n')
  })

  it('does not count user-removed entries as tracking a layer, so no new docs arrive after the user deleted them all', async () => {
    put(templateDir, 'docs/a.md', 'a\n')
    put(templateDir, 'docs/new.md', 'new\n')
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({ version: '1.0.0', files: { 'docs/a.md': 'user-removed' } }))

    await runUpdate('--force')

    expect(existsSync(join(projectDir, 'docs'))).toBe(false)
  })

  it('adds no workflows, other .github files or docs when the manifest tracks none from that group', async () => {
    put(templateDir, 'AGENTS.md', 'agents\n')
    put(templateDir, '.github/workflows/security.yml', 'sec\n')
    put(templateDir, '.github/ISSUE_TEMPLATE/bug.md', 'bug\n')
    put(templateDir, 'docs/guide.md', 'guide\n')
    put(projectDir, '.github/workflows/mine.yml', 'my own ci\n')
    put(projectDir, 'AGENTS.md', 'agents\n')
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({ version: '1.0.0', files: { 'AGENTS.md': sha256('agents\n') } }))

    await runUpdate('--force')

    expect(existsSync(join(projectDir, '.github', 'workflows', 'security.yml'))).toBe(false)
    expect(existsSync(join(projectDir, '.github', 'ISSUE_TEMPLATE', 'bug.md'))).toBe(false)
    expect(existsSync(join(projectDir, 'docs'))).toBe(false)
    expect(Object.keys(manifestFiles())).toEqual(['AGENTS.md'])
  })

  it('adds a new workflow and a new doc when the manifest already tracks a file in that group, but not other .github files', async () => {
    put(templateDir, '.github/workflows/security.yml', 'sec\n')
    put(templateDir, '.github/workflows/ci-node.yml', 'ci\n')
    put(templateDir, '.github/ISSUE_TEMPLATE/bug.md', 'bug\n')
    put(templateDir, 'docs/a.md', 'a\n')
    put(templateDir, 'docs/new.md', 'new\n')
    put(projectDir, 'package.json', '{}')
    put(projectDir, '.github/workflows/ci.yml', 'ci\n')
    put(projectDir, 'docs/a.md', 'a\n')
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({
      version: '1.0.0',
      files: { '.github/workflows/ci.yml': sha256('ci\n'), 'docs/a.md': sha256('a\n') },
    }))

    await runUpdate('--force')

    expect(readFileSync(join(projectDir, '.github', 'workflows', 'security.yml'), 'utf-8')).toBe('sec\n')
    expect(readFileSync(join(projectDir, 'docs', 'new.md'), 'utf-8')).toBe('new\n')
    expect(existsSync(join(projectDir, '.github', 'ISSUE_TEMPLATE', 'bug.md'))).toBe(false)
  })

  it('adds file-size.yml but no other workflow when the manifest tracks the file-size script and the project has its own workflows', async () => {
    put(templateDir, '.github/scripts/check-file-sizes.mjs', 'script\n')
    put(templateDir, '.github/workflows/file-size.yml', 'size\n')
    put(templateDir, '.github/workflows/security.yml', 'sec\n')
    put(projectDir, '.github/scripts/check-file-sizes.mjs', 'script\n')
    put(projectDir, '.github/workflows/mine.yml', 'my own ci\n')
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({
      version: '1.0.0',
      files: { '.github/scripts/check-file-sizes.mjs': sha256('script\n') },
    }))

    await runUpdate('--force')

    expect(readFileSync(join(projectDir, '.github', 'workflows', 'file-size.yml'), 'utf-8')).toBe('size\n')
    expect(manifestFiles()['.github/workflows/file-size.yml']).toBe(sha256('size\n'))
    expect(existsSync(join(projectDir, '.github', 'workflows', 'security.yml'))).toBe(false)
  })

  it('keeps the user\'s own file-size.yml when the manifest tracks the file-size script', async () => {
    put(templateDir, '.github/scripts/check-file-sizes.mjs', 'script\n')
    put(templateDir, '.github/workflows/file-size.yml', 'size\n')
    put(projectDir, '.github/scripts/check-file-sizes.mjs', 'script\n')
    put(projectDir, '.github/workflows/file-size.yml', 'my own size check\n')
    writeFileSync(join(projectDir, '.goodvibes.json'), JSON.stringify({
      version: '1.0.0',
      files: { '.github/scripts/check-file-sizes.mjs': sha256('script\n') },
    }))

    await runUpdate('--force')

    expect(readFileSync(join(projectDir, '.github', 'workflows', 'file-size.yml'), 'utf-8')).toBe('my own size check\n')
    expect(manifestFiles()['.github/workflows/file-size.yml']).toBe('user-owned')
  })
})
