import { describe, it, expect, vi } from 'vitest'

// git-hook.test.ts runs real git; this file mocks execa to see the options every git call gets.
vi.mock('execa', () => ({ execa: vi.fn(async () => ({ exitCode: 128, stdout: '', stderr: 'not a git repository' })) }))

describe('installGitHook program lookup', () => {
  it('runs git without searching the project folder for it', async () => {
    const { execa } = await import('execa')
    const { installGitHook } = await import('./git-hook.js')

    expect((await installGitHook('/p', true)).status).toBe('not-a-repo')

    expect(vi.mocked(execa).mock.calls).toHaveLength(1)
    expect(vi.mocked(execa).mock.calls[0][2]).toEqual(expect.objectContaining({ env: expect.objectContaining({ NoDefaultCurrentDirectoryInExePath: '1' }) }))
  })
})
