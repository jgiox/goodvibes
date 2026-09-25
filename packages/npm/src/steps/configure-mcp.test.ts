import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('execa', () => ({ execa: vi.fn() }))

const enoent = () => Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })
const exit1 = (msg = 'non-zero exit') => Object.assign(new Error(msg), { exitCode: 1 })
const ok = (stdout = '') => ({ exitCode: 0, stdout, stderr: '' })

// Answers each execa call by its command line, so a test states what every tool does, not the call order.
async function route(answers: Record<string, unknown>) {
  const { execa } = await import('execa')
  vi.mocked(execa).mockImplementation((async (cmd: string, args: string[]) => {
    const key = [cmd, ...args].join(' ')
    if (!(key in answers)) throw new Error(`unexpected call: ${key}`)
    const a = answers[key]
    if (a instanceof Error) throw a
    return a
  }) as any)
  return vi.mocked(execa)
}

const ADD = 'claude mcp add -s user headroom -- /usr/local/bin/headroom mcp serve'
const GOOD_GET = ok('headroom:\n  Scope: User config\n  Command: /usr/local/bin/headroom\n  Args: mcp serve\n')
const BROKEN_GET = ok('headroom:\n  Scope: User config\n  Command: /usr/local/bin/headroom\n  Args: \n')

describe('configureMcp', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('registers headroom with the mcp serve arguments after -- when it is not registered yet', async () => {
    const execa = await route({
      'claude mcp get headroom': exit1('No MCP server found with name: headroom'),
      'which headroom': ok('/usr/local/bin/headroom\n'),
      [ADD]: ok(),
    })
    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    expect(execa).toHaveBeenCalledWith(
      'claude',
      ['mcp', 'add', '-s', 'user', 'headroom', '--', '/usr/local/bin/headroom', 'mcp', 'serve'],
      expect.objectContaining({ timeout: 10_000 }),
    )
    expect(log).toHaveBeenCalledWith(expect.stringContaining('registered'))
    expect(result).toEqual({ status: 'registered' })
  })

  it('leaves a correct registration alone', async () => {
    const execa = await route({ 'claude mcp get headroom': GOOD_GET })
    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    expect(execa).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('already'))
    expect(result).toEqual({ status: 'already-registered' })
  })

  it('repairs a registration that lacks mcp serve by removing it and adding it again', async () => {
    const execa = await route({
      'claude mcp get headroom': BROKEN_GET,
      'which headroom': ok('/usr/local/bin/headroom\n'),
      'claude mcp remove headroom -s user': ok(),
      [ADD]: ok(),
    })
    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    const calls = execa.mock.calls.map(c => [c[0], ...(c[1] as string[])].join(' '))
    expect(calls.indexOf('claude mcp remove headroom -s user')).toBeLessThan(calls.indexOf(ADD))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('repaired'))
    expect(result).toEqual({ status: 'repaired' })
  })

  it('uses the first non-empty line when where prints several paths on Windows', async () => {
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    try {
      const execa = await route({
        'claude mcp get headroom': exit1(),
        'where headroom': ok('\r\nC:\\Users\\me\\.local\\bin\\headroom.exe\r\nC:\\Other\\headroom.exe\r\n'),
        'claude mcp add -s user headroom -- C:\\Users\\me\\.local\\bin\\headroom.exe mcp serve': ok(),
      })
      const { configureMcp } = await import('./configure-mcp.js')
      const result = await configureMcp(vi.fn())
      expect(execa).toHaveBeenCalledWith(
        'claude',
        ['mcp', 'add', '-s', 'user', 'headroom', '--', 'C:\\Users\\me\\.local\\bin\\headroom.exe', 'mcp', 'serve'],
        expect.anything(),
      )
      expect(result).toEqual({ status: 'registered' })
    } finally {
      platform.mockRestore()
    }
  })

  it('runs every command without searching the project folder for the program', async () => {
    const execa = await route({
      'claude mcp get headroom': exit1(),
      'which headroom': ok('/usr/local/bin/headroom\n'),
      [ADD]: ok(),
    })
    const { configureMcp } = await import('./configure-mcp.js')
    expect(await configureMcp(vi.fn())).toEqual({ status: 'registered' })
    expect(execa.mock.calls).toHaveLength(3)
    for (const c of execa.mock.calls as unknown[][]) expect(c[2]).toEqual(expect.objectContaining({ env: expect.objectContaining({ NoDefaultCurrentDirectoryInExePath: '1' }) }))
  })

  it('does not register a headroom found inside the project folder', async () => {
    const execa = await route({
      'claude mcp get headroom': exit1(),
      'which headroom': ok(`${process.cwd()}/.venv/bin/headroom\n`),
    })
    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    expect(await configureMcp(log)).toEqual({ status: 'skipped', reason: 'headroom found only inside the project folder' })
    expect(log).toHaveBeenCalledWith('headroom was found only inside this project folder, where a cloned repo could plant it, so it was not registered as an MCP server. Run `uv tool install "headroom-ai[all]"` then re-run `goodvibes init`.')
    expect((execa.mock.calls as [string, string[]][]).some(([cmd, args]) => cmd === 'claude' && args[1] === 'add')).toBe(false)
  })

  it('skips a headroom inside the project folder and registers the next one on PATH', async () => {
    await route({
      'claude mcp get headroom': exit1(),
      'which headroom': ok(`${process.cwd()}/headroom\n/usr/local/bin/headroom\n`),
      [ADD]: ok(),
    })
    const { configureMcp } = await import('./configure-mcp.js')
    expect(await configureMcp(vi.fn())).toEqual({ status: 'registered' })
  })

  it('skips MCP registration when headroom binary is not on PATH', async () => {
    await route({ 'claude mcp get headroom': exit1(), 'which headroom': exit1() })
    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    expect(result).toEqual({ status: 'skipped', reason: expect.stringContaining('headroom') })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('headroom binary not found on PATH'))
  })

  it('returns failed when claude mcp add fails with non-ENOENT error', async () => {
    await route({
      'claude mcp get headroom': exit1(),
      'which headroom': ok('/usr/local/bin/headroom\n'),
      [ADD]: exit1('claude mcp add: permission denied'),
    })
    const { configureMcp } = await import('./configure-mcp.js')
    const result = await configureMcp(vi.fn())
    expect(result).toEqual({ status: 'failed', reason: 'claude mcp add: permission denied' })
  })

  it('falls back to headroom mcp install when claude CLI is ENOENT and logs CLAUDE_CONFIG_DIR warning', async () => {
    const execa = await route({
      'claude mcp get headroom': enoent(),
      'headroom mcp status': exit1(),
      'headroom mcp install': ok(),
    })
    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    expect(execa).toHaveBeenCalledWith('headroom', ['mcp', 'install'], expect.objectContaining({ timeout: 10_000 }))
    expect(log).toHaveBeenCalledWith(expect.stringContaining('CLAUDE_CONFIG_DIR'))
    expect(result).toEqual({ status: 'registered' })
  })

  it('reports already registered in the fallback when headroom mcp status exits 0', async () => {
    await route({ 'claude mcp get headroom': enoent(), 'headroom mcp status': ok() })
    const { configureMcp } = await import('./configure-mcp.js')
    expect(await configureMcp(vi.fn())).toEqual({ status: 'already-registered' })
  })

  it('skips when headroom binary not found during fallback mcp install', async () => {
    await route({ 'claude mcp get headroom': enoent(), 'headroom mcp status': enoent(), 'headroom mcp install': enoent() })
    const { configureMcp } = await import('./configure-mcp.js')
    const log = vi.fn()
    const result = await configureMcp(log)

    expect(result).toEqual({ status: 'skipped', reason: expect.any(String) })
    expect(log).toHaveBeenCalledWith(expect.stringContaining('headroom binary not found'))
  })

  it('returns failed when headroom mcp install fails with non-ENOENT error', async () => {
    await route({
      'claude mcp get headroom': enoent(),
      'headroom mcp status': exit1(),
      'headroom mcp install': exit1('headroom mcp install: authentication failed'),
    })
    const { configureMcp } = await import('./configure-mcp.js')
    const result = await configureMcp(vi.fn())
    expect(result).toEqual({ status: 'failed', reason: 'headroom mcp install: authentication failed' })
  })
})
