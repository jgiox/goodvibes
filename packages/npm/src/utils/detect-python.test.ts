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

describe('detectPython', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns python3 command when Python 3.12.3 found via python3', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    mockedExeca.mockResolvedValueOnce({ stdout: 'Python 3.12.3', stderr: '' } as any)

    const { detectPython } = await import('./detect-python.js')
    const result = await detectPython()
    expect(result).toBe('python3')
    expect(mockedExeca).toHaveBeenCalledWith('python3', ['--version'])
  })

  it('falls back to python command when python3 is ENOENT and python returns 3.11.0', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    mockedExeca
      .mockRejectedValueOnce(enoentError)
      .mockResolvedValueOnce({ stdout: 'Python 3.11.0', stderr: '' } as any)

    const { detectPython } = await import('./detect-python.js')
    const result = await detectPython()
    expect(result).toBe('python')
    expect(mockedExeca).toHaveBeenNthCalledWith(1, 'python3', ['--version'])
    expect(mockedExeca).toHaveBeenNthCalledWith(2, 'python', ['--version'])
  })

  it('returns null when python3 ENOENT and python returns Python 2.7.18 (version too old)', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    mockedExeca
      .mockRejectedValueOnce(enoentError)
      .mockResolvedValueOnce({ stdout: 'Python 2.7.18', stderr: '' } as any)
      .mockRejectedValueOnce(enoentError)

    const { detectPython } = await import('./detect-python.js')
    const result = await detectPython()
    expect(result).toBeNull()
  })

  it('returns null when python3 ENOENT and python output does not match version regex (Windows Store guard)', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    mockedExeca
      .mockRejectedValueOnce(enoentError)
      .mockResolvedValueOnce({ stdout: '', stderr: '' } as any)
      .mockRejectedValueOnce(enoentError)

    const { detectPython } = await import('./detect-python.js')
    const result = await detectPython()
    expect(result).toBeNull()
  })

  it('returns null when all of python3, python, py are ENOENT', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    mockedExeca
      .mockRejectedValueOnce(enoentError)
      .mockRejectedValueOnce(enoentError)
      .mockRejectedValueOnce(enoentError)

    const { detectPython } = await import('./detect-python.js')
    const result = await detectPython()
    expect(result).toBeNull()
  })

  it('returns null when python3 returns Python 3.9.7 (minor < 10)', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    mockedExeca
      .mockResolvedValueOnce({ stdout: 'Python 3.9.7', stderr: '' } as any)
      .mockRejectedValueOnce(enoentError)
      .mockRejectedValueOnce(enoentError)

    const { detectPython } = await import('./detect-python.js')
    const result = await detectPython()
    expect(result).toBeNull()
  })

  it('checks stderr as well as stdout for version string (Python 2 compatibility)', async () => {
    const { execa } = await import('execa')
    const mockedExeca = vi.mocked(execa)
    const enoentError = new Error('ENOENT')
    ;(enoentError as any).code = 'ENOENT'
    // python3 returns version in stderr only (Python < 3.4 style)
    mockedExeca
      .mockRejectedValueOnce(enoentError)
      .mockResolvedValueOnce({ stdout: '', stderr: 'Python 3.10.0' } as any)

    const { detectPython } = await import('./detect-python.js')
    const result = await detectPython()
    expect(result).toBe('python')
  })
})
