import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { note, outro, cancel, confirm } from '@clack/prompts'
import { backup, runReset } from './reset.js'
import { resolveTemplatesDir } from '../steps/copy-templates.js'
import { applyGlobalConfig } from '../steps/global-setup.js'

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  confirm: vi.fn().mockResolvedValue(true),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
}))

const TPL = resolveTemplatesDir()
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')
const read = (p: string) => readFileSync(p, 'utf-8')
const tplText = (rel: string) => read(join(TPL, rel))
const manifestOf = (root: string) => JSON.parse(read(join(root, '.goodvibes.json')))
const said = () => [note, outro, cancel].flatMap(f => vi.mocked(f).mock.calls.map(c => String(c[0]))).join('\n').split(/\s+/).join(' ')
const editGate = (s: Record<string, any>) => {
  const gate = s.hooks.PreToolUse[0].hooks[0]
  gate.command = gate.command.replace('goodvibes-journal-gate;', 'goodvibes-journal-gate; true;')
}

describe('goodvibes reset', () => {
  let root: string
  let project: string
  let cwdSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>
  let savedCfg: string | undefined

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'gv-reset-'))
    savedCfg = process.env.CLAUDE_CONFIG_DIR
    process.env.CLAUDE_CONFIG_DIR = join(root, 'claude-config')
    // A project set up in project scope with AGENTS.md, a docs file, CLAUDE.md and .claude/settings.json, all as goodvibes wrote them.
    project = join(root, 'project')
    const files: Record<string, string> = {}
    for (const rel of ['AGENTS.md', 'docs/onboarding.md', 'CLAUDE.md', '.claude/settings.json']) {
      mkdirSync(dirname(join(project, rel)), { recursive: true })
      writeFileSync(join(project, rel), tplText(rel))
      files[rel] = sha(tplText(rel))
    }
    const tpl = JSON.parse(tplText('.claude/settings.json'))
    const managed = { '.claude/settings.json': [...tpl.permissions.ask.map((p: string) => `ask:${p}`), ...tpl.permissions.deny.map((p: string) => `deny:${p}`)] }
    writeFileSync(join(project, '.goodvibes.json'), JSON.stringify({ version: '1.11.1', scope: 'project', files, managed }))
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(project)
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error(`exit ${code}`) }) as never)
    for (const f of [note, outro, cancel, confirm]) vi.mocked(f).mockClear()
    vi.mocked(confirm).mockResolvedValue(true)
  })

  afterEach(() => {
    process.env.CLAUDE_CONFIG_DIR = savedCfg
    cwdSpy.mockRestore()
    exitSpy.mockRestore()
    rmSync(root, { recursive: true, force: true })
  })

  it('backup uses a new name when an earlier backup exists', async () => {
    writeFileSync(join(project, 'AGENTS.md'), 'second\n')
    writeFileSync(join(project, 'AGENTS.md.goodvibes-backup'), 'first\n')
    const made = await backup(join(project, 'AGENTS.md'))
    expect(made).toBe(join(project, 'AGENTS.md.goodvibes-backup-2'))
    expect(read(made)).toBe('second\n')
    expect(read(join(project, 'AGENTS.md.goodvibes-backup'))).toBe('first\n')
  })

  it("puts back goodvibes' version of an edited file and keeps a backup", async () => {
    writeFileSync(join(project, 'AGENTS.md'), 'mine\n')
    await runReset([], false, false, true)
    expect(read(join(project, 'AGENTS.md'))).toBe(tplText('AGENTS.md'))
    expect(read(join(project, 'AGENTS.md.goodvibes-backup'))).toBe('mine\n')
    expect(said()).toContain("AGENTS.md: reset to goodvibes' version; your copy is in AGENTS.md.goodvibes-backup")
    expect(manifestOf(project).files['AGENTS.md']).toBe(sha(tplText('AGENTS.md')))
  })

  it('restores a file the user deleted', async () => {
    unlinkSync(join(project, 'docs', 'onboarding.md'))
    const m = manifestOf(project)
    m.files['docs/onboarding.md'] = 'user-removed'
    writeFileSync(join(project, '.goodvibes.json'), JSON.stringify(m))
    await runReset([], false, false, true)
    expect(read(join(project, 'docs', 'onboarding.md'))).toBe(tplText('docs/onboarding.md'))
    expect(said()).toContain("docs/onboarding.md: restored goodvibes' version")
    expect(manifestOf(project).files['docs/onboarding.md']).toBe(sha(tplText('docs/onboarding.md')))
  })

  it('dry run lists the plan and writes nothing', async () => {
    writeFileSync(join(project, 'AGENTS.md'), 'mine\n')
    unlinkSync(join(project, 'docs', 'onboarding.md'))
    const before = read(join(project, '.goodvibes.json'))
    await runReset([], false, true, false)
    const out = said()
    expect(out).toContain("Will replace with goodvibes' version (1): AGENTS.md")
    expect(out).toContain('Will restore, deleted (1): docs/onboarding.md')
    expect(out).toContain('Each changed file is copied to <file>.goodvibes-backup first.')
    expect(out).toContain('Run without --dry-run to reset these files.')
    expect(read(join(project, 'AGENTS.md'))).toBe('mine\n')
    expect(existsSync(join(project, 'docs', 'onboarding.md'))).toBe(false)
    expect(existsSync(join(project, 'AGENTS.md.goodvibes-backup'))).toBe(false)
    expect(read(join(project, '.goodvibes.json'))).toBe(before)
  })

  it('only touches the files named', async () => {
    writeFileSync(join(project, 'AGENTS.md'), 'mine\n')
    writeFileSync(join(project, 'docs', 'onboarding.md'), 'my notes\n')
    await runReset(['docs/onboarding.md'], false, false, true)
    expect(read(join(project, 'docs', 'onboarding.md'))).toBe(tplText('docs/onboarding.md'))
    expect(read(join(project, 'AGENTS.md'))).toBe('mine\n')
    expect(manifestOf(project).files['AGENTS.md']).toBe(sha(tplText('AGENTS.md')))
  })

  it('leaves a file goodvibes never wrote alone unless it is named', async () => {
    writeFileSync(join(project, 'AGENTS.md'), 'my own agents file\n')
    const m = manifestOf(project)
    m.files['AGENTS.md'] = 'user-owned'
    writeFileSync(join(project, '.goodvibes.json'), JSON.stringify(m))
    await runReset([], false, false, true)
    expect(read(join(project, 'AGENTS.md'))).toBe('my own agents file\n')
    expect(said()).toContain("Nothing to reset: everything goodvibes manages here already matches goodvibes' version.")
    await runReset(['AGENTS.md'], false, false, true)
    expect(read(join(project, 'AGENTS.md'))).toBe(tplText('AGENTS.md'))
    expect(read(join(project, 'AGENTS.md.goodvibes-backup'))).toBe('my own agents file\n')
  })

  it('refuses a file goodvibes does not manage and changes nothing', async () => {
    writeFileSync(join(project, 'AGENTS.md'), 'mine\n')
    await expect(runReset(['AGENTS.md', 'src/app.py'], false, false, true)).rejects.toThrow('exit 1')
    expect(said()).toContain('src/app.py: goodvibes does not manage this file here, so reset cannot restore it. Nothing was changed.')
    expect(read(join(project, 'AGENTS.md'))).toBe('mine\n')
  })

  it('asks first and changes nothing when the answer is no', async () => {
    writeFileSync(join(project, 'AGENTS.md'), 'mine\n')
    vi.mocked(confirm).mockResolvedValue(false)
    await expect(runReset([], false, false, false)).rejects.toThrow('exit 0')
    expect(String(vi.mocked(confirm).mock.calls[0][0].message)).toBe("Reset 1 file(s) to goodvibes' version? Your copies are backed up first.")
    expect(said()).toContain('Reset cancelled. Nothing was changed.')
    expect(read(join(project, 'AGENTS.md'))).toBe('mine\n')
    expect(existsSync(join(project, 'AGENTS.md.goodvibes-backup'))).toBe(false)
  })

  it('says so when there is nothing to reset', async () => {
    await runReset([], false, false, true)
    expect(said()).toContain("Nothing to reset: everything goodvibes manages here already matches goodvibes' version.")
    expect(existsSync(join(project, 'AGENTS.md.goodvibes-backup'))).toBe(false)
  })

  it('without a manifest says so and exits 1', async () => {
    cwdSpy.mockReturnValue(root)
    await expect(runReset([], false, false, true)).rejects.toThrow('exit 1')
    expect(said()).toContain("No .goodvibes.json in this folder, so goodvibes manages no files here. To reset goodvibes' files in your Claude Code settings folder, run goodvibes reset --global.")
  })

  it('puts back an edited rules block and keeps the text around it', async () => {
    const edited = read(join(project, 'CLAUDE.md')).replace('Every rule below is an order, not a suggestion.', 'Rules are suggestions.') + '\n## My notes\nkeep me\n'
    writeFileSync(join(project, 'CLAUDE.md'), edited)
    await runReset([], false, false, true)
    const now = read(join(project, 'CLAUDE.md'))
    expect(now).toContain('Every rule below is an order, not a suggestion.')
    expect(now).not.toContain('Rules are suggestions.')
    expect(now.endsWith('## My notes\nkeep me\n')).toBe(true)
    expect(read(join(project, 'CLAUDE.md.goodvibes-backup'))).toBe(edited)
    expect(existsSync(join(project, 'CLAUDE.md.goodvibes-new'))).toBe(false)
  })

  it("puts back goodvibes' settings entries and keeps the user's own", async () => {
    const path = join(project, '.claude', 'settings.json')
    const s = JSON.parse(read(path))
    editGate(s)
    s.permissions.ask = s.permissions.ask.filter((p: string) => p !== 'Bash(git branch -D*)')
    s.permissions.allow.push('Bash(ls*)')
    writeFileSync(path, JSON.stringify(s))
    await runReset([], false, false, true)
    const tpl = JSON.parse(tplText('.claude/settings.json'))
    const now = JSON.parse(read(path))
    expect(now.hooks.PreToolUse[0]).toEqual(tpl.hooks.PreToolUse[0])
    expect(now.permissions.ask).toContain('Bash(git branch -D*)')
    expect(now.permissions.allow).toContain('Bash(ls*)')
    expect(JSON.parse(read(`${path}.goodvibes-backup`))).toEqual(s)
    expect(manifestOf(project).managed['.claude/settings.json']).toContain('ask:Bash(git branch -D*)')
    expect(said()).toContain('~ hooks.PreToolUse: goodvibes-journal-gate')
    expect(said()).toContain('+ permissions.ask: Bash(git branch -D*)')
  })

  it("does not put back an ask rule the user's allow rule covers", async () => {
    const path = join(project, '.claude', 'settings.json')
    const s = JSON.parse(read(path))
    s.permissions.ask = s.permissions.ask.filter((p: string) => p !== 'Bash(git push*)')
    writeFileSync(path, JSON.stringify(s))
    writeFileSync(join(project, '.claude', 'settings.local.json'), JSON.stringify({ permissions: { allow: ['Bash(git push:*)'] } }))
    await runReset([], false, false, true)
    expect(JSON.parse(read(path)).permissions.ask).not.toContain('Bash(git push*)')
    expect(said()).toContain(
      ".claude/settings.json: goodvibes' ask rule Bash(git push*) stays out because your allow rule Bash(git push:*) covers it; " +
        'delete Bash(git push:*), then run goodvibes reset again to have Claude Code ask first',
    )
  })

  it('--global puts back the rules file and an edited settings hook', async () => {
    cwdSpy.mockReturnValue(root)
    const cfg = process.env.CLAUDE_CONFIG_DIR as string
    await applyGlobalConfig(TPL, '1.11.1', false)
    writeFileSync(join(cfg, 'rules', 'goodvibes.md'), 'my rules\n')
    const s = JSON.parse(read(join(cfg, 'settings.json')))
    editGate(s)
    s.model = 'mine'
    writeFileSync(join(cfg, 'settings.json'), JSON.stringify(s))

    await runReset([], true, false, true)

    const fresh = join(root, 'fresh')
    process.env.CLAUDE_CONFIG_DIR = fresh
    await applyGlobalConfig(TPL, '1.11.1', false)
    expect(read(join(cfg, 'rules', 'goodvibes.md'))).toBe(read(join(fresh, 'rules', 'goodvibes.md')))
    expect(read(join(cfg, 'rules', 'goodvibes.md.goodvibes-backup'))).toBe('my rules\n')
    const now = JSON.parse(read(join(cfg, 'settings.json')))
    expect(now.hooks).toEqual(JSON.parse(read(join(fresh, 'settings.json'))).hooks)
    expect(now.model).toBe('mine')
    expect(JSON.parse(read(join(cfg, 'settings.json.goodvibes-backup')))).toEqual(s)
    expect(manifestOf(cfg).files['rules/goodvibes.md']).toBe(sha(read(join(fresh, 'rules', 'goodvibes.md'))))
    expect(said()).toContain("rules/goodvibes.md: reset to goodvibes' version; your copy is in rules/goodvibes.md.goodvibes-backup")
  })

  it('--global without a global setup says so and exits 1', async () => {
    cwdSpy.mockReturnValue(root)
    await expect(runReset([], true, false, true)).rejects.toThrow('exit 1')
    expect(said()).toContain('goodvibes is not set up in your Claude Code settings folder')
  })
})
