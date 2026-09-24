import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, symlinkSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'

// Source-mode tests resolve relative paths from src/, the shipped bundle from dist/; only running dist catches a mismatch.
const distCli = fileURLToPath(new URL('../dist/index.js', import.meta.url))
const pkgVersion = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8')).version

describe('built CLI (dist/index.js)', () => {
  let projectDir: string
  let configDir: string
  let binDir: string
  let env: Record<string, string>

  beforeEach(() => {
    if (!existsSync(distCli)) throw new Error(`${distCli} missing: run "npm run build" before the integration tests`)
    projectDir = mkdtempSync(join(tmpdir(), 'gv-dist-'))
    configDir = mkdtempSync(join(tmpdir(), 'gv-claude-'))
    // Only node on PATH: npm and claude are unreachable, so global setup can never touch this machine.
    binDir = mkdtempSync(join(tmpdir(), 'gv-bin-'))
    symlinkSync(process.execPath, join(binDir, 'node'))
    env = { GOODVIBES_NO_TELEMETRY: '1', CI: '1', CLAUDE_CONFIG_DIR: configDir, PATH: `${binDir}:/usr/bin:/bin`, HOME: configDir }
  })

  afterEach(() => {
    for (const d of [projectDir, configDir, binDir]) rmSync(d, { recursive: true, force: true })
  })

  const run = (...args: string[]) =>
    execa(join(binDir, 'node'), [distCli, ...args], { cwd: projectDir, env, extendEnv: false, input: '', reject: false })

  it('init --minimal --scope project exits 0 and writes .goodvibes.json with the package version', async () => {
    const result = await run('init', '--minimal', '--scope', 'project')
    expect(result.stderr).not.toContain('Cannot find module')
    expect(result.exitCode).toBe(0)
    const manifest = JSON.parse(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8'))
    expect(manifest.version).toBe(pkgVersion)
    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8')).toContain('<!-- goodvibes:start -->')
    expect(existsSync(join(configDir, 'rules', 'goodvibes.md'))).toBe(false)
  })

  it('init --minimal defaults to global scope: rules, skills and hooks go to the Claude config, not the project', async () => {
    mkdirSync(join(projectDir, 'src'))
    const result = await run('init', '--minimal')
    expect(result.exitCode).toBe(0)

    expect(readFileSync(join(configDir, 'rules', 'goodvibes.md'), 'utf-8')).toContain('<!-- goodvibes:start -->')
    expect(existsSync(join(configDir, 'skills', 'caveman', 'SKILL.md'))).toBe(true)
    const settings = JSON.parse(readFileSync(join(configDir, 'settings.json'), 'utf-8'))
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toMatch(/^: goodvibes-journal-gate;/)
    expect(settings.permissions.allow).toBeUndefined()
    expect(JSON.parse(readFileSync(join(configDir, '.goodvibes.json'), 'utf-8')).scope).toBe('global')

    expect(readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8')).not.toContain('goodvibes:start')
    expect(existsSync(join(projectDir, '.claude', 'skills'))).toBe(false)
    expect(existsSync(join(projectDir, '.mcp.json'))).toBe(false)
    expect(existsSync(join(projectDir, 'JOURNAL.md'))).toBe(true)
    expect(JSON.parse(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8')).scope).toBe('global')
    expect(result.stdout).toMatch(/goodvibes CLI: failed/)
    expect(result.stdout).toMatch(/context7 MCP: skipped/)
  })

  it('a second global init leaves a rules file the user edited alone', async () => {
    await run('init', '--minimal')
    const rules = join(configDir, 'rules', 'goodvibes.md')
    const edited = readFileSync(rules, 'utf-8') + '\nmy own addition\n'
    const { writeFileSync } = await import('node:fs')
    writeFileSync(rules, edited)

    await run('init', '--minimal')

    expect(readFileSync(rules, 'utf-8')).toBe(edited)
  })
})
