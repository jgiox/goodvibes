import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'

// Source-mode tests resolve relative paths from src/, the shipped bundle from dist/; only running dist catches a mismatch.
const distCli = fileURLToPath(new URL('../dist/index.js', import.meta.url))
const pkgVersion = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8')).version

describe('built CLI (dist/index.js)', () => {
  let projectDir: string

  beforeEach(() => {
    if (!existsSync(distCli)) throw new Error(`${distCli} missing: run "npm run build" before the integration tests`)
    projectDir = mkdtempSync(join(tmpdir(), 'gv-dist-'))
  })

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true })
  })

  it('init --minimal exits 0 and writes .goodvibes.json with the package version', async () => {
    const result = await execa('node', [distCli, 'init', '--minimal'], {
      cwd: projectDir,
      env: { GOODVIBES_NO_TELEMETRY: '1', CI: '1' },
      input: '',
      reject: false,
    })
    expect(result.stderr).not.toContain('Cannot find module')
    expect(result.exitCode).toBe(0)
    const manifest = JSON.parse(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8'))
    expect(manifest.version).toBe(pkgVersion)
  })
})
