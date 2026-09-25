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
  posixKey: (rel: string) => rel.replace(/\\/g, '/'),
  USER_OWNED: 'user-owned',
  USER_REMOVED: 'user-removed',
}))

vi.mock('../utils/sentinel-merge.js', () => ({
  mergeClaude: vi.fn().mockResolvedValue(undefined),
  MarkerError: class MarkerError extends Error {},
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

// Mock global-setup — unit tests must never touch the real ~/.claude, npm -g, or claude CLI
vi.mock('../steps/global-setup.js', () => ({
  applyGlobalConfig: vi.fn().mockResolvedValue({ configDir: '/fake/.claude', written: [], kept: [], removed: [], retired: [], settingsChanges: [] }),
  ensureGlobalCli: vi.fn().mockResolvedValue({ status: 'already-installed' }),
  registerContext7: vi.fn().mockResolvedValue({ status: 'already-registered' }),
  claudeConfigDir: vi.fn().mockReturnValue('/fake/.claude'),
  formatGlobal: vi.fn().mockReturnValue('already up to date'),
}))

vi.mock('../utils/version.js', () => ({ packageVersion: () => '1.2.0' }))

// Symlink and real-path checks need a real filesystem; update.integration.test.ts covers them.
vi.mock('../utils/fs-safe.js', () => ({
  writeBlocked: vi.fn().mockResolvedValue(null),
  assertSafe: vi.fn().mockResolvedValue(undefined),
  writeFileAtomic: vi.fn().mockResolvedValue(undefined),
  printable: (s: string) => s,
}))

vi.mock('fs-extra', () => ({
  copy: vi.fn().mockResolvedValue(undefined),
}))

// Unit tests must never run real git: cwd here is the goodvibes checkout itself.
vi.mock('../steps/git-hook.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../steps/git-hook.js')>()),
  installGitHook: vi.fn().mockResolvedValue({ status: 'not-a-repo', path: '/p/.git/hooks/pre-commit' }),
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
    const text = vi.mocked(note).mock.calls.flat().join(' ')
    expect(text).not.toContain('v1.2.0')
    expect(text).toContain('goodvibes init')
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
      expect.any(Object),
      expect.any(Object),
      'project',
      undefined,
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
      expect.any(Object),
      expect.any(Object),
      'project',
      undefined,
    )
  })

  it('user-modified files (skip category) are not overwritten', async () => {
    const { readManifest, writeManifest } = await import('../steps/write-manifest.js')
    const { listTemplateFiles, resolveTemplatesDir } = await import('../steps/copy-templates.js')
    const { createHash } = await import('node:crypto')
    const { existsSync } = await import('node:fs')
    // Reset existsSync to true — previous test may have set it to false (clearAllMocks preserves implementations)
    vi.mocked(existsSync).mockReturnValue(true)

    // docs/onboarding.md has a different hash in manifest — user-modified → skip
    // .claude/skills/skills.md hash matches — unmodified → overwrite
    // (CLAUDE.md is excluded from this scenario — it's always routed to overwrite
    // via mergeClaude regardless of whole-file hash; see update.integration.test.ts)
    vi.mocked(readManifest).mockResolvedValue({
      version: '1.0.0',
      files: { 'docs/onboarding.md': 'different-hash', '.claude/skills/skills.md': 'abc123' },
    })
    vi.mocked(listTemplateFiles).mockResolvedValue(['docs/onboarding.md', '.claude/skills/skills.md'])
    vi.mocked(resolveTemplatesDir).mockReturnValue('/mock/templates')
    // createHash returns 'abc123' — matches .claude/skills/skills.md but not docs/onboarding.md
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
    expect(writtenFiles).not.toContain('docs/onboarding.md')
    expect(writtenFiles).toContain('.claude/skills/skills.md')
  })
})

describe('update and the git commit check', () => {
  const INSTALLED = 'Git commit check installed: commits that leave out JOURNAL.md are blocked in every tool (.git/hooks/pre-commit)'
  const REMOVED = '.git/hooks/pre-commit: removed by you, not re-added (run goodvibes init to restore)'
  const hookAt = '/p/.git/hooks/pre-commit'

  beforeEach(async () => {
    vi.clearAllMocks()
    const { existsSync } = await import('node:fs')
    vi.mocked(existsSync).mockReturnValue(true)
    const { listTemplateFiles } = await import('../steps/copy-templates.js')
    vi.mocked(listTemplateFiles).mockResolvedValue([])
    const { confirm } = await import('@clack/prompts')
    vi.mocked(confirm).mockResolvedValue(true)
  })

  async function runUpdate(gitHook: 'installed' | 'user-removed' | undefined, statuses: Array<{ status: string; detail?: string }>, ...args: string[]) {
    const { readManifest } = await import('../steps/write-manifest.js')
    const { installGitHook } = await import('../steps/git-hook.js')
    vi.mocked(readManifest).mockImplementation(async (dir: string) =>
      dir === '/fake/.claude' ? null : { version: '1.9.0', files: {}, ...(gitHook ? { gitHook } : {}) })
    for (const r of statuses) vi.mocked(installGitHook).mockResolvedValueOnce({ path: hookAt, ...r } as any)
    const { registerUpdateCommand } = await import('../commands/update.js')
    const { Command } = await import('commander')
    const program = new Command()
    program.exitOverride()
    registerUpdateCommand(program)
    await program.parseAsync(['node', 'goodvibes', 'update', ...args])
  }

  const noteText = async () => vi.mocked((await import('@clack/prompts')).note).mock.calls.map(c => String(c[0])).join('\n')
  const manifestGitHook = async () => vi.mocked((await import('../steps/write-manifest.js')).writeManifest).mock.calls[0][6]
  const hookCalls = async () => vi.mocked((await import('../steps/git-hook.js')).installGitHook).mock.calls

  it('installs the hook for an older manifest without gitHook and records installed', async () => {
    await runUpdate(undefined, [{ status: 'installed' }, { status: 'installed' }])

    expect(await hookCalls()).toEqual([[process.cwd(), true], [process.cwd(), false]])
    expect(await noteText()).toContain(INSTALLED)
    expect(await manifestGitHook()).toBe('installed')
  })

  it('does not re-add a hook the user deleted: records user-removed and prints the removed line in the plan and once after applying', async () => {
    const { note } = await import('@clack/prompts')
    await runUpdate('installed', [{ status: 'installed' }])

    expect(await hookCalls()).toEqual([[process.cwd(), true]])
    const byTitle = (t: string) => vi.mocked(note).mock.calls.filter(c => c[1] === t).map(c => String(c[0])).join('\n')
    expect(byTitle('Plan').split(REMOVED).length - 1).toBe(1)
    expect(byTitle('Update complete').split(REMOVED).length - 1).toBe(1)
    expect(await noteText()).not.toContain('Git commit check installed')
    expect(await manifestGitHook()).toBe('user-removed')
  })

  it('does nothing and prints nothing about the hook when gitHook is user-removed', async () => {
    await runUpdate('user-removed', [])

    expect(await hookCalls()).toEqual([])
    const text = await noteText()
    expect(text).not.toContain('Git commit check')
    expect(text).not.toContain('pre-commit')
    expect(await manifestGitHook()).toBe('user-removed')
  })

  it('rewrites an older goodvibes hook, prints the updated line and keeps gitHook installed', async () => {
    await runUpdate('installed', [{ status: 'updated' }, { status: 'updated' }])

    expect(await noteText()).toContain('Git commit check updated (.git/hooks/pre-commit)')
    expect(await manifestGitHook()).toBe('installed')
  })

  it('records installed and prints nothing about the hook when it is already current', async () => {
    await runUpdate(undefined, [{ status: 'current' }, { status: 'current' }])

    expect(await noteText()).not.toContain('Git commit check')
    expect(await manifestGitHook()).toBe('installed')
  })

  it('leaves gitHook unchanged and prints the skip line with the value when core.hooksPath is set', async () => {
    await runUpdate('installed', [{ status: 'custom-path', detail: '.husky' }, { status: 'custom-path', detail: '.husky' }])

    expect(await noteText()).toContain('Git commit check skipped: git uses its own hooks folder here (core.hooksPath = .husky), so goodvibes left your hooks alone.')
    expect(await manifestGitHook()).toBe('installed')
  })

  it('leaves gitHook out and prints the skip line in a folder that is not a git repository', async () => {
    await runUpdate(undefined, [{ status: 'not-a-repo' }, { status: 'not-a-repo' }])

    expect(await noteText()).toContain('Git commit check skipped: this folder is not a git repository yet. Run git init, then goodvibes update.')
    expect(await manifestGitHook()).toBeUndefined()
  })

  it('leaves gitHook unchanged and prints the skip line when the user has their own pre-commit hook', async () => {
    await runUpdate(undefined, [{ status: 'existing-hook' }, { status: 'existing-hook' }])

    expect(await noteText()).toContain('Git commit check skipped: .git/hooks/pre-commit already exists and is not from goodvibes, so it was left alone.')
    expect(await manifestGitHook()).toBeUndefined()
  })

  it('--dry-run prints the Would line, only asks the installer for a dry run and writes no manifest', async () => {
    const { writeManifest } = await import('../steps/write-manifest.js')
    await runUpdate(undefined, [{ status: 'installed' }], '--dry-run')

    expect(await hookCalls()).toEqual([[process.cwd(), true]])
    expect(await noteText()).toContain(`Would: ${INSTALLED}`)
    expect(vi.mocked(writeManifest)).not.toHaveBeenCalled()
  })

  it('shows the hook line in the plan and asks the single question when only the hook would change', async () => {
    const { confirm, note } = await import('@clack/prompts')
    await runUpdate(undefined, [{ status: 'installed' }, { status: 'installed' }])

    expect(vi.mocked(confirm)).toHaveBeenCalledTimes(1)
    const plan = vi.mocked(note).mock.calls.findIndex(c => c[1] === 'Plan')
    expect(String(vi.mocked(note).mock.calls[plan][0])).toContain(`Would: ${INSTALLED}`)
    expect(vi.mocked(note).mock.invocationCallOrder[plan]).toBeLessThan(vi.mocked(confirm).mock.invocationCallOrder[0])
  })

  it('installs nothing and writes no manifest when the question is answered no', async () => {
    const { confirm } = await import('@clack/prompts')
    const { writeManifest } = await import('../steps/write-manifest.js')
    vi.mocked(confirm).mockResolvedValue(false)
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error(`exit ${code}`) }) as never)
    try {
      await expect(runUpdate(undefined, [{ status: 'installed' }])).rejects.toThrow('exit 0')
    } finally {
      exitSpy.mockRestore()
    }
    expect(await hookCalls()).toEqual([[process.cwd(), true]])
    expect(vi.mocked(writeManifest)).not.toHaveBeenCalled()
  })
})
