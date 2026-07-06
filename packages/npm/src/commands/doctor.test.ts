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
}))

vi.mock('node:module', () => ({ createRequire: () => () => ({ version: '1.6.2' }) }))

describe('doctor command', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.resetModules()
  })

  describe('registerDoctorCommand', () => {
    it('registers a command named doctor on the program', async () => {
      const { registerDoctorCommand } = await import('./doctor.js')
      const program = { command: vi.fn().mockReturnThis(), description: vi.fn().mockReturnThis(), action: vi.fn().mockReturnThis() }
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
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction()

      // verify probe used functional compress --help with timeout
      const execaCalls = vi.mocked(execa).mock.calls
      const headroomProbe = execaCalls[0]
      expect(headroomProbe[0]).toBe('headroom')
      expect(headroomProbe[1]).toEqual(['compress', '--help'])
      expect(headroomProbe[2]).toMatchObject({ timeout: 10_000 })

      // note is called with check results — headroom should appear as pass (checkmark)
      const noteArgs = vi.mocked(note).mock.calls
      expect(noteArgs.length).toBeGreaterThan(0)
      const firstNote = noteArgs[0][0] as string
      expect(firstNote).toMatch(/headroom installed and working/i)

      exitSpy.mockRestore()
    })

    it('returns fail result with uv remedy when headroom is not found (ENOENT)', async () => {
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
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction()

      const allNoteText = vi.mocked(note).mock.calls.map(c => String(c[0])).join('\n')
      expect(allNoteText).toMatch(/uv tool install/i)
      expect(allNoteText).not.toMatch(/headroom on PATH/i)
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
      vi.mocked(readFileSync).mockReturnValue('# Some content without sentinel') // no sentinel

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const { note } = await import('@clack/prompts')

      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = {
        command: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
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
      vi.mocked(readFileSync).mockReturnValue(
        '<!-- goodvibes:start -->\ncontent\n<!-- goodvibes:end -->'
      )

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      const { outro } = await import('@clack/prompts')

      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = {
        command: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction()

      expect(exitSpy).not.toHaveBeenCalledWith(1)
      expect(vi.mocked(outro)).toHaveBeenCalledWith(expect.stringContaining('All checks passed'))

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

  describe('version line', () => {
    it('doctor output includes goodvibes version as first line', async () => {
      const { execa } = await import('execa')
      vi.mocked(execa).mockResolvedValue({ stdout: 'value' } as any)

      const { existsSync, readFileSync } = await import('node:fs')
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue(
        '<!-- goodvibes:start -->\ncontent\n<!-- goodvibes:end -->'
      )

      const { note } = await import('@clack/prompts')

      const { registerDoctorCommand } = await import('./doctor.js')
      let capturedAction: () => Promise<void> = async () => {}
      const program = {
        command: vi.fn().mockReturnThis(),
        description: vi.fn().mockReturnThis(),
        action: vi.fn((fn) => { capturedAction = fn; return { command: vi.fn() } }),
      }
      registerDoctorCommand(program as any)
      await capturedAction()

      const firstNoteArg = vi.mocked(note).mock.calls[0][0] as string
      expect(firstNoteArg.split('\n')[0]).toBe('goodvibes v1.6.2')
    })
  })
})
