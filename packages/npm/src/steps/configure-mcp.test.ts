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
    await configureMcp(log)

    // Should only call headroom mcp status — no further execa calls
    expect(mockedExeca).toHaveBeenCalledTimes(1)
    expect(mockedExeca).toHaveBeenCalledWith('headroom', ['mcp', 'status'])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('already'))
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
    await configureMcp(log)

    expect(mockedExeca).toHaveBeenCalledWith('claude', ['mcp', 'list'])
    expect(mockedExeca).toHaveBeenCalledWith(
      'claude',
      ['mcp', 'add', '-s', 'user', 'headroom', '/home/user/.local/bin/headroom']
    )
    expect(log).toHaveBeenCalledWith(expect.stringContaining('registered'))
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
    await configureMcp(log)

    // Should not call which or claude mcp add
    expect(mockedExeca).toHaveBeenCalledTimes(2)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('already'))
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
    await configureMcp(log)

    expect(mockedExeca).toHaveBeenCalledWith('headroom', ['mcp', 'install'])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('CLAUDE_CONFIG_DIR'))
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
    await configureMcp(log)

    // The 4th call should be claude mcp add with absolute path trimmed
    const addCall = mockedExeca.mock.calls.find(
      call => call[0] === 'claude' && Array.isArray(call[1]) && call[1].includes('add')
    )
    expect(addCall).toBeDefined()
    expect(addCall![1]).toEqual(['mcp', 'add', '-s', 'user', 'headroom', '/usr/local/bin/headroom'])
  })
})
