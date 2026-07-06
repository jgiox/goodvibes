import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('execa', () => ({
  execa: vi.fn(),
  ExecaError: class ExecaError extends Error {
    code: string
    constructor(message: string, code: string) {
      super(message)
      this.code = code
    }
  },
}))

describe('configureMcp', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('skips registration when headroom mcp status exits 0 (already registered — idempotent)', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    // headroom mcp status → exit 0 (already registered)
    mockedExeca.mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)

    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    // Should only call headroom mcp status — no further execa calls
    expect(mockedExeca).toHaveBeenCalledTimes(1)
    expect(mockedExeca).toHaveBeenCalledWith('headroom', ['mcp', 'status'], expect.objectContaining({ timeout: 10_000 }))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('already'))
    expect(result).toEqual({ status: 'already-registered' })
  })

  it('uses claude mcp add -s user with absolute headroom path when claude is on PATH and headroom not yet registered', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    const nonZeroError = new Error('non-zero exit')
    ;(nonZeroError as any).exitCode = 1
    ;(nonZeroError as any).code = undefined

    mockedExeca
      // headroom mcp status → non-zero (not registered)
      .mockRejectedValueOnce(nonZeroError)
      // claude mcp list → headroom NOT in output
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'some-other-server\n', stderr: '' } as any)
      // which headroom → absolute path
      .mockResolvedValueOnce({ exitCode: 0, stdout: '/home/user/.local/bin/headroom\n', stderr: '' } as any)
      // claude mcp add → success
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)

    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    expect(mockedExeca).toHaveBeenCalledWith('claude', ['mcp', 'list'], expect.objectContaining({ timeout: 10_000 }))
    expect(mockedExeca).toHaveBeenCalledWith(
      'claude',
      ['mcp', 'add', '-s', 'user', 'headroom', '/home/user/.local/bin/headroom'],
      expect.objectContaining({ timeout: 10_000 })
    )
    expect(log).toHaveBeenCalledWith(expect.stringContaining('registered'))
    expect(result).toEqual({ status: 'registered' })
  })

  it('skips when headroom already appears in claude mcp list output (idempotent via list check)', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    const nonZeroError = new Error('non-zero exit')
    ;(nonZeroError as any).exitCode = 1
    ;(nonZeroError as any).code = undefined

    mockedExeca
      // headroom mcp status → non-zero (not registered by status command)
      .mockRejectedValueOnce(nonZeroError)
      // claude mcp list → headroom IS in output
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'headroom\n/home/user/.local/bin/headroom\n', stderr: '' } as any)

    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    // Should not call which or claude mcp add
    expect(mockedExeca).toHaveBeenCalledTimes(2)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('already'))
    expect(result).toEqual({ status: 'already-registered' })
  })

  it('falls back to headroom mcp install when claude CLI is ENOENT and logs CLAUDE_CONFIG_DIR warning', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    const nonZeroError = new Error('non-zero exit')
    ;(nonZeroError as any).exitCode = 1
    ;(nonZeroError as any).code = undefined

    mockedExeca
      // headroom mcp status → non-zero (not registered)
      .mockRejectedValueOnce(nonZeroError)
      // claude mcp list → ENOENT (claude CLI not found)
      .mockRejectedValueOnce(enoentError)
      // headroom mcp install → success
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)

    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    expect(mockedExeca).toHaveBeenCalledWith('headroom', ['mcp', 'install'], expect.objectContaining({ timeout: 10_000 }))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('CLAUDE_CONFIG_DIR'))
    expect(result).toEqual({ status: 'registered' })
  })

  it('passes absolute path from which headroom as the 6th argument to claude mcp add', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    const nonZeroError = new Error('non-zero exit')
    ;(nonZeroError as any).exitCode = 1
    ;(nonZeroError as any).code = undefined

    mockedExeca
      // headroom mcp status → non-zero
      .mockRejectedValueOnce(nonZeroError)
      // claude mcp list → headroom NOT in output
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)
      // which headroom → specific path with trailing newline
      .mockResolvedValueOnce({ exitCode: 0, stdout: '/usr/local/bin/headroom\n', stderr: '' } as any)
      // claude mcp add
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)

    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    // The 4th call should be claude mcp add with absolute path trimmed
    const addCall = mockedExeca.mock.calls.find(
      call => call[0] === 'claude' && Array.isArray(call[1]) && call[1].includes('add')
    )
    expect(addCall).toBeDefined()
    expect(addCall![1]).toEqual(['mcp', 'add', '-s', 'user', 'headroom', '/usr/local/bin/headroom'])
    expect(result).toEqual({ status: 'registered' })
  })

  it('skips MCP registration when headroom binary is not on PATH', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    const nonZeroError = new Error('non-zero exit')
    ;(nonZeroError as any).exitCode = 1
    ;(nonZeroError as any).code = undefined

    mockedExeca
      .mockRejectedValueOnce(nonZeroError)  // headroom mcp status → not registered
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)  // claude mcp list → empty
      .mockRejectedValueOnce(enoentError)   // which headroom → ENOENT

    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    expect(result).toEqual({ status: 'skipped', reason: expect.stringContaining('headroom') })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('headroom binary not found on PATH'))
  })

  it('skips when headroom binary not found during fallback mcp install', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    const nonZeroError = new Error('non-zero exit')
    ;(nonZeroError as any).exitCode = 1
    ;(nonZeroError as any).code = undefined

    mockedExeca
      .mockRejectedValueOnce(nonZeroError)  // headroom mcp status → not registered
      .mockRejectedValueOnce(enoentError)   // claude mcp list → ENOENT (claude not found)
      .mockRejectedValueOnce(enoentError)   // headroom mcp install → ENOENT

    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    expect(result).toEqual({ status: 'skipped', reason: expect.any(String) })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('headroom binary not found'))
  })

  it('returns failed when headroom mcp install fails with non-ENOENT error', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    const installError = new Error('headroom mcp install: authentication failed')
    ;(installError as any).exitCode = 1
    ;(installError as any).code = undefined
    const nonZeroError = new Error('non-zero exit')
    ;(nonZeroError as any).exitCode = 1
    ;(nonZeroError as any).code = undefined

    mockedExeca
      .mockRejectedValueOnce(nonZeroError)   // headroom mcp status → not registered
      .mockRejectedValueOnce(enoentError)    // claude mcp list → ENOENT (claude not found)
      .mockRejectedValueOnce(installError)   // headroom mcp install → fails

    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    expect(result.status).toBe('failed')
    expect(result).toHaveProperty('reason')
  })

  it('returns failed when claude mcp add fails with non-ENOENT error', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    const addError = new Error('claude mcp add: permission denied')
    ;(addError as any).exitCode = 1
    ;(addError as any).code = undefined
    const nonZeroError = new Error('non-zero exit')
    ;(nonZeroError as any).exitCode = 1
    ;(nonZeroError as any).code = undefined

    mockedExeca
      .mockRejectedValueOnce(nonZeroError)  // headroom mcp status → not registered
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' } as any)  // claude mcp list → empty
      .mockResolvedValueOnce({ exitCode: 0, stdout: '/usr/local/bin/headroom\n', stderr: '' } as any)  // which headroom
      .mockRejectedValueOnce(addError)      // claude mcp add → fails

    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    expect(result.status).toBe('failed')
    expect(result).toHaveProperty('reason')
  })
})
