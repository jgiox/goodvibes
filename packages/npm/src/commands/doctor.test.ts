import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

vi.mock('@clack/prompts', () => ({
  note: vi.fn(),
  outro: vi.fn(),
}))

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(),
}))

vi.mock('./mcp-check.js', () => ({ checkMcpServers: vi.fn(() => []) }))

vi.mock('../utils/version.js', () => ({ packageVersion: () => '1.6.2' }))

// existsSync is true for every path in some tests, so .goodvibes.json must read as a real manifest there.
const withManifest = (claudeMd: string) => (p: unknown) =>
  String(p).endsWith('.goodvibes.json') ? '{"version":"1.0.0","files":{}}' : claudeMd

describe('doctor command', () => {
  beforeEach(async () => {
    vi.resetAllMocks()
    vi.resetModules()
    const { statSync } = await import('node:fs')
    vi.mocked(statSync).mockReturnValue({ size: 100 } as any)
    const { checkMcpServers } = await import('./mcp-check.js')
    vi.mocked(checkMcpServers).mockReturnValue([])
  })

  const JOURNAL_LABEL = 'JOURNAL.md is 13 KB; agents read it every session'
  const JOURNAL_REMEDY = 'Keep lasting decisions in its "Standing decisions" section and keep new entries short.'
  const bigJournal = async () => {
    const { statSync } = await import('node:fs')
    vi.mocked(statSync).mockImplementation(((p: unknown) => ({ size: String(p).endsWith('JOURNAL.md') ? 12_500 : 100 })) as any)
  }

  describe('registerDoctorCommand', () => {
    it('registers a command named doctor on the program', async () => {
      const { registerDoctorCommand } = await import('./doctor.js')
      const program = { command: vi.fn().mockReturnThis(), description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(), action: vi.fn().mockReturnThis() }
      registerDoctorCommand(program as any)
      expect(program.command).toHaveBeenCalledWith('doctor')
    })
  })

  describe('checkHeadroom (via doctor action)', () => {
    it('returns pass result when headroom is on PATH', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: '1.0.0' } as any)

      const { existsSync, readFileSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(false)

      // Capture process.exit to prevent actual exit
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

      const { note, outro } = await import('@clack/prompts')
      // git config calls will throw ENOENT — allow headroom pass
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: '' } as any) // headroom compress --help → exit 0
        .mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })) // git calls

      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = {
        command: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction()

      // verify probe used functional compress --help with timeout
      const execaCalls = vi.mocked(execa).mock.calls
      const headroomProbe = execaCalls[0] as unknown[]
      expect(headroomProbe[0]).toBe('headroom')
      expect(headroomProbe[1]).toEqual(['--version'])
      expect(headroomProbe[2]).toMatchObject({ timeout: 10_000 })

      // note is called with check results — headroom should appear as pass (checkmark)
      const noteArgs = vi.mocked(note).mock.calls
      expect(noteArgs.length).toBeGreaterThan(0)
      const firstNote = noteArgs[0][0] as string
      expect(firstNote).toMatch(/headroom installed and working/i)

      exitSpy.mockRestore()
    })

    it('reports headroom as a warning with its uv remedy, not a failure, when headroom is not found (ENOENT)', async () => {
      const { execa } = await import('execa')
      const enoentErr = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      vi.mocked(execa).mockRejectedValue(enoentErr) // all calls fail with ENOENT

      const { existsSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(false)

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const { note } = await import('@clack/prompts')

      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = {
        command: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction()

      const allNoteText = vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')
      expect(allNoteText).toMatch(/uv tool install/i)
      expect(allNoteText).toContain('! headroom not installed (optional: compresses what Claude reads)')
      expect(allNoteText).not.toMatch(/✗ headroom/)
      expect(exitSpy).toHaveBeenCalledWith(1)

      exitSpy.mockRestore()
    })
  })

  describe('checkGit (via doctor action)', () => {
    it('returns fail result with remedy when git user.name is not set', async () => {
      const { execa } = await import('execa')
      // headroom passes, git user.name fails
      vi.mocked(execa)
        .mockResolvedValueOnce({ stdout: '' } as any) // headroom compress --help → exit 0
        .mockRejectedValueOnce(Object.assign(new Error('exit 1'), { code: 1 })) // git user.name fail
        .mockRejectedValueOnce(Object.assign(new Error('exit 1'), { code: 1 })) // git user.email fail

      const { existsSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(false)

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const { note } = await import('@clack/prompts')

      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = {
        command: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction()

      const allNoteText = vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')
      expect(allNoteText).toMatch(/git config.*user\.name/i)
      expect(exitSpy).toHaveBeenCalledWith(1)

      exitSpy.mockRestore()
    })
  })

  describe('checkClaudeMd (via doctor action)', () => {
    it('returns fail when CLAUDE.md is absent', async () => {
      const { execa } = await import('execa')
      // all execa calls succeed (headroom + git)
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)

      const { existsSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(false) // CLAUDE.md absent

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const { note } = await import('@clack/prompts')

      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = {
        command: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction()

      const allNoteText = vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')
      expect(allNoteText).toMatch(/CLAUDE\.md/i)
      expect(exitSpy).toHaveBeenCalledWith(1)

      exitSpy.mockRestore()
    })
  })

  describe('checkSentinel (via doctor action)', () => {
    it('returns fail for sentinel check when CLAUDE.md exists but lacks sentinel strings', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)

      const { existsSync, readFileSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(true) // CLAUDE.md present
      vi.mocked(readFileSync).mockImplementation(withManifest('# Some content without sentinel')) // no sentinel

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const { note } = await import('@clack/prompts')

      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = {
        command: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction()

      const allNoteText = vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')
      expect(allNoteText).toMatch(/sentinel/i)
      expect(exitSpy).toHaveBeenCalledWith(1)

      exitSpy.mockRestore()
    })

    it('returns pass for sentinel check when CLAUDE.md contains both sentinel strings', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)

      const { existsSync, readFileSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockImplementation(withManifest('<!-- goodvibes:start -->\ncontent\n<!-- goodvibes:end -->'))

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const { outro } = await import('@clack/prompts')

      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = {
        command: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction()

      expect(exitSpy).not.toHaveBeenCalledWith(1)
      expect(vi.mocked(outro)).toHaveBeenCalledWith('Ready.')

      exitSpy.mockRestore()
    })
  })

  describe('collect-all behavior', () => {
    it('collects all results before exiting and calls process.exit(1) only after printing all failures', async () => {
      const { execa } = await import('execa')
      const enoentErr = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      vi.mocked(execa).mockRejectedValue(enoentErr) // headroom ENOENT + git ENOENT

      const { existsSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(false) // CLAUDE.md absent

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const { note } = await import('@clack/prompts')

      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = {
        command: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction()

      // note should be called at least twice — once for results, once for remediation
      expect(vi.mocked(note).mock.calls.length).toBeGreaterThanOrEqual(2)
      // exit(1) called after note() calls
      expect(exitSpy).toHaveBeenCalledWith(1)

      exitSpy.mockRestore()
    })
  })

  describe('broken manifest', () => {
    it('fails with the fix-it message and exits 1 when .goodvibes.json is not valid JSON', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)
      const { existsSync, readFileSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockImplementation(p => (String(p).endsWith('.goodvibes.json') ? '{ nope' : '<!-- goodvibes:start -->\n<!-- goodvibes:end -->'))
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const { note } = await import('@clack/prompts')

      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = {
        command: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction()

      const out = vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')
      expect(out).toMatch(/\.goodvibes\.json is not valid JSON \(.+\); fix it or delete it and run goodvibes init/)
      expect(exitSpy).toHaveBeenCalledWith(1)
      exitSpy.mockRestore()
    })
  })

  describe('version line', () => {
    it('doctor output includes goodvibes version as first line', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)

      const { existsSync, readFileSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockImplementation(withManifest('<!-- goodvibes:start -->\ncontent\n<!-- goodvibes:end -->'))

      const { note } = await import('@clack/prompts')

      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = {
        command: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction()

      const firstNoteArg = vi.mocked(note).mock.calls[0][0] as string
      expect(firstNoteArg.split('\n')[0]).toBe('goodvibes v1.6.2')
    })
  })

  describe('tri-state results', () => {
    async function runFull(): Promise<{ text: string; exitSpy: ReturnType<typeof vi.spyOn> }> {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const { note, outro } = await import('@clack/prompts')
      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = {
        command: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction()
      const text = [...vi.mocked(note).mock.calls.map(c => String(c[0])), ...vi.mocked(outro).mock.calls.map(c => String(c[0]))].join('\n')
      return { text, exitSpy }
    }

    const readyProject = async () => {
      const { existsSync, readFileSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockImplementation(withManifest('<!-- goodvibes:start -->\nx\n<!-- goodvibes:end -->'))
    }

    it('ends with Ready, with 1 warning(s). and exits 0 when only optional headroom is missing', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockImplementation((async (cmd: string) => {
        if (cmd === 'headroom') throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        return { stdout: 'value' }
      }) as any)
      await readyProject()

      const { text, exitSpy } = await runFull()

      expect(text).toContain('! headroom not installed (optional: compresses what Claude reads)')
      expect(text.split('\n').at(-1)).toBe('Ready, with 1 warning(s).')
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('reports headroom as not working, still a warning, when it is installed but fails or times out', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockImplementation((async (cmd: string) => {
        if (cmd === 'headroom') throw Object.assign(new Error('timed out'), { timedOut: true })
        return { stdout: 'value' }
      }) as any)
      await readyProject()

      const { text, exitSpy } = await runFull()

      expect(text).toContain('! headroom not working (optional: compresses what Claude reads)')
      expect(text).toContain('uv tool install "headroom-ai[all]"')
      expect(text.split('\n').at(-1)).toBe('Ready, with 1 warning(s).')
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('warns and still exits 0 when the goodvibes command is not on PATH', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)
      await readyProject()
      const { existsSync } = await import('node:fs')
      vi.mocked(existsSync).mockImplementation(p => !/goodvibes(\.[a-z]+)?$/i.test(String(p)) || String(p).endsWith('.goodvibes.json'))

      const { text, exitSpy } = await runFull()

      expect(text).toContain('! goodvibes command not on PATH')
      expect(text).toContain('npm install -g goodvibes-cli')
      expect(text.split('\n').at(-1)).toBe('Ready, with 1 warning(s).')
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('ends with Not ready: 2 problem(s). and exits 1 when git user.name and user.email are missing', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockImplementation((async (cmd: string) => {
        if (cmd === 'git') throw Object.assign(new Error('exit 1'), { exitCode: 1 })
        return { stdout: 'value' }
      }) as any)
      await readyProject()

      const { text, exitSpy } = await runFull()

      expect(text).toContain('✗ git user.name')
      expect(text).toContain('✗ git user.email')
      expect(text.split('\n').at(-1)).toBe('Not ready: 2 problem(s).')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('ends with Ready. and shows every check as ✓ when nothing is missing', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)
      await readyProject()

      const { text, exitSpy } = await runFull()

      expect(text).toContain('✓ headroom installed and working')
      expect(text).toContain('✓ goodvibes command on PATH')
      expect(text).not.toMatch(/^[!✗-] /m)
      expect(text.split('\n').at(-1)).toBe('Ready.')
      expect(exitSpy).not.toHaveBeenCalled()
    })
  })

  describe('checkJournal', () => {
    it('returns no result when JOURNAL.md does not exist', async () => {
      const { existsSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(false)
      const { checkJournal } = await import('./doctor.js')
      expect(checkJournal('/p')).toEqual([])
    })

    it('returns no result when JOURNAL.md is exactly 10 KB', async () => {
      const { existsSync, statSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(statSync).mockReturnValue({ size: 10 * 1024 } as any)
      const { checkJournal } = await import('./doctor.js')
      expect(checkJournal('/p')).toEqual([])
    })

    it('warns with the size rounded up to whole KB when JOURNAL.md is larger than 10 KB', async () => {
      const { existsSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(true)
      await bigJournal()
      const { checkJournal } = await import('./doctor.js')
      expect(checkJournal('/p')).toEqual([{ label: JOURNAL_LABEL, status: 'warn', remedy: JOURNAL_REMEDY }])
    })
  })

  describe('journal size in the full doctor', () => {
    it('shows the journal warning, counts it, and still exits 0', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)
      const { existsSync, readFileSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockImplementation(withManifest('<!-- goodvibes:start -->\nx\n<!-- goodvibes:end -->'))
      await bigJournal()
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const { note, outro } = await import('@clack/prompts')

      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = { command: vi.fn().mockReturnThis(), description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(), action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }) }
      registerDoctorCommand(program as any)
      await capturedAction()

      expect(String(vi.mocked(note).mock.calls[0][0])).toContain(`! ${JOURNAL_LABEL}`)
      expect(String(vi.mocked(note).mock.calls[1][0])).toContain(`${JOURNAL_LABEL}: ${JOURNAL_REMEDY}`)
      expect(vi.mocked(outro)).toHaveBeenCalledWith('Ready, with 1 warning(s).')
      expect(exitSpy).not.toHaveBeenCalled()
    })
  })

  describe('MCP servers in the full doctor', () => {
    it('lists the MCP check results and counts their warnings without failing', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)
      const { existsSync, readFileSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockImplementation(withManifest('<!-- goodvibes:start -->\nx\n<!-- goodvibes:end -->'))
      const { checkMcpServers } = await import('./mcp-check.js')
      vi.mocked(checkMcpServers).mockReturnValue([
        { label: 'MCP context7 (project)', status: 'ok' },
        { label: 'MCP remote (user): uses plain http to mcp.example.com', status: 'warn', remedy: 'Use an https:// URL.' },
      ])
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const { note, outro } = await import('@clack/prompts')

      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = { command: vi.fn().mockReturnThis(), description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(), action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }) }
      registerDoctorCommand(program as any)
      await capturedAction()

      expect(vi.mocked(checkMcpServers)).toHaveBeenCalledWith(process.cwd())
      const notes = vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')
      expect(notes).toContain('✓ MCP context7 (project)')
      expect(notes).toContain('! MCP remote (user): uses plain http to mcp.example.com')
      expect(notes).toContain('MCP remote (user): uses plain http to mcp.example.com: Use an https:// URL.')
      expect(vi.mocked(outro)).toHaveBeenCalledWith('Ready, with 1 warning(s).')
      expect(exitSpy).not.toHaveBeenCalled()
    })
  })

  describe('summaryLine', () => {
    it('returns Ready. when every check is ok or skip', async () => {
      const { summaryLine } = await import('./doctor.js')
      expect(summaryLine([{ label: 'a', status: 'ok' }, { label: 'b', status: 'skip' }])).toBe('Ready.')
    })

    it('counts warnings when there are warnings but no failures', async () => {
      const { summaryLine } = await import('./doctor.js')
      expect(summaryLine([{ label: 'a', status: 'warn' }, { label: 'b', status: 'ok' }, { label: 'c', status: 'warn' }])).toBe('Ready, with 2 warning(s).')
    })

    it('counts only failures once anything fails', async () => {
      const { summaryLine } = await import('./doctor.js')
      expect(summaryLine([{ label: 'a', status: 'warn' }, { label: 'b', status: 'fail' }])).toBe('Not ready: 1 problem(s).')
    })
  })

  describe('formatCheck', () => {
    it('renders ok, warn, fail and skip as ✓, !, ✗ and -', async () => {
      const { formatCheck } = await import('./doctor.js')
      expect(['ok', 'warn', 'fail', 'skip'].map(status => formatCheck({ label: 'x', status: status as any }))).toEqual(['✓ x', '! x', '✗ x', '- x'])
    })
  })

  describe('--quick', () => {
    async function runQuick(): Promise<{ logs: string[]; exitSpy: ReturnType<typeof vi.spyOn> }> {
      const logs: string[] = []
      vi.spyOn(console, 'log').mockImplementation((m: string) => { logs.push(m) })
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: (o: { quick?: boolean }) => Promise<void> = async () => {}
      const program = {
        command: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction({ quick: true })
      return { logs, exitSpy }
    }

    it('prints nothing, never probes headroom, and does not exit when every quick check passes', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)
      const { existsSync, readFileSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockImplementation(withManifest('<!-- goodvibes:start -->\nx\n<!-- goodvibes:end -->'))

      const { logs, exitSpy } = await runQuick()

      expect(logs).toEqual([])
      expect(vi.mocked(execa).mock.calls.some(c => c[0] === 'headroom')).toBe(false)
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('stays silent about CLAUDE.md outside a goodvibes project (no .goodvibes.json)', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)
      const { existsSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(false)

      const { logs, exitSpy } = await runQuick()

      expect(logs).toEqual([])
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('prints one line per failed check with its fix in a project-scope goodvibes project and does not exit non-zero', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)
      const { existsSync, readFileSync } = await import('node:fs')
      vi.mocked(existsSync).mockImplementation(p => String(p).endsWith('.goodvibes.json'))
      vi.mocked(readFileSync).mockReturnValue('{"version":"1.8.0","files":{},"scope":"project"}')

      const { logs, exitSpy } = await runQuick()

      expect(logs).toEqual([
        'goodvibes doctor: ✗ CLAUDE.md present. Run: goodvibes init',
        'goodvibes doctor: ✗ goodvibes sentinel block. Run: goodvibes init',
      ])
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('prints the broken-manifest message and still does not exit non-zero when .goodvibes.json is not valid JSON', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)
      const { existsSync, readFileSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockImplementation(p => (String(p).endsWith('.goodvibes.json') ? '<<<<<<< HEAD' : '<!-- goodvibes:start -->\n<!-- goodvibes:end -->'))

      const { logs, exitSpy } = await runQuick()

      expect(logs.join('\n')).toMatch(/\.goodvibes\.json is not valid JSON \(.+\); fix it or delete it and run goodvibes init/)
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('prints the journal size warning as one ! line and does not exit when JOURNAL.md is larger than 10 KB', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)
      const { existsSync, readFileSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockImplementation(withManifest('<!-- goodvibes:start -->\nx\n<!-- goodvibes:end -->'))
      await bigJournal()

      const { logs, exitSpy } = await runQuick()

      expect(logs).toEqual([`goodvibes doctor: ! ${JOURNAL_LABEL}. ${JOURNAL_REMEDY}`])
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('never runs the MCP server check', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)
      const { existsSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(false)
      const { checkMcpServers } = await import('./mcp-check.js')

      await runQuick()

      expect(vi.mocked(checkMcpServers)).not.toHaveBeenCalled()
    })

    it('checks the rules file in the Claude config, not the project CLAUDE.md, in a global-scope project', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)
      const { existsSync, readFileSync } = await import('node:fs')
      vi.mocked(existsSync).mockImplementation(p => String(p).endsWith('.goodvibes.json'))
      vi.mocked(readFileSync).mockReturnValue('{"version":"1.8.0","files":{},"scope":"global"}')

      const { logs } = await runQuick()

      expect(logs).toEqual(['goodvibes doctor: ✗ goodvibes rules in Claude config. Run: goodvibes init'])
    })
  })
})
