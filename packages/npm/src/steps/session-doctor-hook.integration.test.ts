import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execa } from 'execa'
import { resolveTemplatesDir } from './copy-templates.js'

const settings = JSON.parse(readFileSync(join(resolveTemplatesDir(), '.claude', 'settings.json'), 'utf-8'))
const group = settings.hooks.SessionStart[0]
const hook = group.hooks[0]

describe('session-start doctor hook', () => {
  let binDir: string

  beforeEach(() => {
    binDir = mkdtempSync(join(tmpdir(), 'gv-bin-'))
  })

  afterEach(() => {
    rmSync(binDir, { recursive: true, force: true })
  })

  it('runs only on fresh startup with a short timeout and a goodvibes marker', () => {
    expect(group.matcher).toBe('startup')
    expect(hook.timeout).toBe(10)
    expect(hook.command).toMatch(/^: goodvibes-doctor;/)
  })

  it('exits 0 with no output when goodvibes is not installed', async () => {
    const r = await execa('sh', ['-c', hook.command], { env: { PATH: `${binDir}:/usr/bin:/bin` }, extendEnv: false, reject: false })
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toBe('')
  })

  it('passes goodvibes doctor --quick output through when goodvibes is on PATH', async () => {
    const fake = join(binDir, 'goodvibes')
    writeFileSync(fake, '#!/bin/sh\necho "args: $*"\n')
    chmodSync(fake, 0o755)
    const r = await execa('sh', ['-c', hook.command], { env: { PATH: `${binDir}:/usr/bin:/bin` }, extendEnv: false, reject: false })
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toBe('args: doctor --quick')
  })
})
