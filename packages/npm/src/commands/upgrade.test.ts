import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@clack/prompts', () => ({ intro: vi.fn(), note: vi.fn() }))
vi.mock('execa', () => ({ execa: vi.fn() }))
vi.mock('./update.js', () => ({ runUpdate: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../utils/version.js', () => ({ packageVersion: () => '1.0.0' }))

async function runUpgrade(...args: string[]) {
  const { registerUpgradeCommand } = await import('./upgrade.js')
  const { Command } = await import('commander')
  const program = new Command()
  program.exitOverride()
  registerUpgradeCommand(program)
  await program.parseAsync(['node', 'goodvibes', 'upgrade', ...args])
}

describe('upgrade command', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>
  const prevEnv = process.env._GV_UPGRADING

  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env._GV_UPGRADING
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('process.exit') }) as never)
  })

  afterEach(() => {
    exitSpy.mockRestore()
    if (prevEnv === undefined) delete process.env._GV_UPGRADING
    else process.env._GV_UPGRADING = prevEnv
  })

  it('installs the newer version from npm and re-runs itself on it', async () => {
    const { execa } = await import('execa')
    vi.mocked(execa).mockResolvedValue({ stdout: '1.0.1' } as never)

    await runUpgrade().catch(() => {})

    expect(vi.mocked(execa)).toHaveBeenCalledWith('npm', ['install', '-g', 'goodvibes-cli@1.0.1'], expect.objectContaining({ stdio: 'inherit' }))
    expect(vi.mocked(execa)).toHaveBeenCalledWith(process.argv[1], expect.any(Array), expect.objectContaining({ env: expect.objectContaining({ _GV_UPGRADING: '1' }) }))
  })

  it('does not install anything during --dry-run and previews the update instead', async () => {
    const { execa } = await import('execa')
    const { runUpdate } = await import('./update.js')
    vi.mocked(execa).mockResolvedValue({ stdout: '1.0.1' } as never)

    await runUpgrade('--dry-run')

    expect(vi.mocked(execa)).not.toHaveBeenCalledWith('npm', expect.arrayContaining(['install']), expect.anything())
    expect(vi.mocked(runUpdate)).toHaveBeenCalledWith(true, false)
  })

  it('hands the project files to update when already on the newest version', async () => {
    const { execa } = await import('execa')
    const { runUpdate } = await import('./update.js')
    vi.mocked(execa).mockResolvedValue({ stdout: '1.0.0' } as never)

    await runUpgrade()

    expect(vi.mocked(runUpdate)).toHaveBeenCalledWith(false, false)
  })

  it('still updates the project when the npm registry cannot be reached', async () => {
    const { execa } = await import('execa')
    const { runUpdate } = await import('./update.js')
    vi.mocked(execa).mockRejectedValue(new Error('offline'))

    await runUpgrade()

    expect(vi.mocked(runUpdate)).toHaveBeenCalledWith(false, false)
  })

  it('skips the version check when _GV_UPGRADING is set', async () => {
    const { execa } = await import('execa')
    process.env._GV_UPGRADING = '1'

    await runUpgrade()

    expect(vi.mocked(execa)).not.toHaveBeenCalled()
  })

  it('registers upgrade without an update alias', async () => {
    const { registerUpgradeCommand } = await import('./upgrade.js')
    const { Command } = await import('commander')
    const program = new Command()
    registerUpgradeCommand(program)
    expect(program.commands.find(c => c.name() === 'upgrade')!.aliases()).not.toContain('update')
  })
})
