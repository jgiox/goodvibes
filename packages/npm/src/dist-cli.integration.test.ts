import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, symlinkSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
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

  it('init --minimal --scope project writes context7 for Cursor and VS Code from the packaged templates', async () => {
    const result = await run('init', '--minimal', '--scope', 'project')
    expect(result.exitCode).toBe(0)
    expect(JSON.parse(readFileSync(join(projectDir, '.cursor', 'mcp.json'), 'utf-8')).mcpServers.context7.url).toBe('https://mcp.context7.com/mcp')
    expect(JSON.parse(readFileSync(join(projectDir, '.vscode', 'mcp.json'), 'utf-8')).servers.context7.type).toBe('http')
  })

  it('init --minimal --scope project installs the git commit check from the packaged hooks folder', async () => {
    await execa('git', ['init', '-q'], { cwd: projectDir, env, extendEnv: false })
    const result = await run('init', '--minimal', '--scope', 'project')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Git commit check installed: commits that leave out JOURNAL.md') // clack wraps the rest
    const hook = join(projectDir, '.git', 'hooks', 'pre-commit')
    expect(readFileSync(hook, 'utf-8')).toBe(readFileSync(fileURLToPath(new URL('../hooks/pre-commit', import.meta.url)), 'utf-8'))
    expect(statSync(hook).mode & 0o777).toBe(0o755)
    expect(JSON.parse(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8')).gitHook).toBe('installed')
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

  it('init inside the CLAUDE_CONFIG_DIR folder does the global part only and keeps the global manifest global', async () => {
    const cfg = join(configDir, 'cfg')
    mkdirSync(cfg)
    const inCfg = (...args: string[]) =>
      execa(join(binDir, 'node'), [distCli, ...args], { cwd: cfg, env: { ...env, CLAUDE_CONFIG_DIR: cfg }, extendEnv: false, input: '', reject: false })

    expect((await inCfg('init', '--minimal')).exitCode).toBe(0)
    const manifest = readFileSync(join(cfg, '.goodvibes.json'), 'utf-8')
    expect(JSON.parse(manifest).files['rules/goodvibes.md']).toBeDefined()

    const project = await inCfg('init', '--minimal', '--scope', 'project')
    expect(project.exitCode).toBe(1)
    await inCfg('init', '--minimal')

    expect(readFileSync(join(cfg, '.goodvibes.json'), 'utf-8')).toBe(manifest)
    expect(existsSync(join(cfg, 'CLAUDE.md'))).toBe(false)
    expect(existsSync(join(cfg, 'JOURNAL.md'))).toBe(false)
  })

  it('help texts say what --minimal skips and that update --force still keeps edited files', async () => {
    const flat = (s: string) => s.replace(/\s+/g, ' ')
    expect(flat((await run('init', '--help')).stdout)).toContain("--minimal Skip headroom, docs/ and the .github CI files (workflows, scripts, Dependabot, issue and PR templates); Copilot's rules and hooks in .github are still added")
    expect(flat((await run('update', '--help')).stdout)).toContain('--force Skip the confirmation prompt (files you edited are still kept)')
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

  it('init leaves an outside file unchanged when the project CLAUDE.md is a symlink to it', async () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'gv-dist-outside-'))
    try {
      const target = join(outsideDir, 'notes.md')
      writeFileSync(target, 'private\n')
      symlinkSync(target, join(projectDir, 'CLAUDE.md'))

      const result = await run('init', '--minimal', '--scope', 'project')

      expect(result.exitCode).toBe(0)
      expect(readFileSync(target, 'utf-8')).toBe('private\n')
      expect(result.stdout).toContain('CLAUDE.md: symlink, not written')
    } finally {
      rmSync(outsideDir, { recursive: true, force: true })
    }
  })

  it('a second init keeps every goodvibes file in the manifest and does not re-add a hook the user deleted', async () => {
    await run('init', '--minimal', '--scope', 'project')
    const manifestPath = join(projectDir, '.goodvibes.json')
    const first = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    expect(Object.keys(first.files)).toContain('AGENTS.md')

    const settingsPath = join(projectDir, '.claude', 'settings.json')
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    settings.hooks.PreToolUse = settings.hooks.PreToolUse.filter((g: any) => !JSON.stringify(g).includes('goodvibes-journal-gate'))
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2))

    await run('init', '--minimal', '--scope', 'project')
    const second = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    expect(Object.keys(second.files).sort()).toEqual(Object.keys(first.files).sort())

    const upd = await run('update', '--force')
    expect(upd.exitCode).toBe(0)
    expect(readFileSync(settingsPath, 'utf-8')).not.toContain('goodvibes-journal-gate')
  })

  it('the entry file loads no dependency before its Node version check, so old Node gets the friendly message', () => {
    const entry = readFileSync(distCli, 'utf-8')
    const staticImports = [...entry.matchAll(/^import\s.*?from\s+["']([^"']+)["']/gm)].map(m => m[1])
    expect(staticImports.filter(m => !m.startsWith('.') && !m.startsWith('node:'))).toEqual([])
    expect(entry.indexOf('nodeVersionError(')).toBeGreaterThan(-1)
    expect(entry.indexOf('await import(')).toBeGreaterThan(entry.indexOf('nodeVersionError('))
  })

  it('declares the Node version that execa and commander need', () => {
    const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf-8'))
    expect(pkg.engines.node).toBe('>=22.12.0')
  })

  it('a deleted AGENTS.md and rules file stay deleted over two updates, and init restores both', async () => {
    await run('init', '--minimal')
    const agents = join(projectDir, 'AGENTS.md')
    const rules = join(configDir, 'rules', 'goodvibes.md')
    const agentsContent = readFileSync(agents, 'utf-8')
    const rulesContent = readFileSync(rules, 'utf-8')
    rmSync(agents)
    rmSync(rules)

    for (let i = 0; i < 2; i++) {
      const upd = await run('update', '--force')
      expect(upd.exitCode).toBe(0)
      expect(existsSync(agents)).toBe(false)
      expect(existsSync(rules)).toBe(false)
    }
    expect(JSON.parse(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8')).files['AGENTS.md']).toBe('user-removed')
    expect(JSON.parse(readFileSync(join(configDir, '.goodvibes.json'), 'utf-8')).files['rules/goodvibes.md']).toBe('user-removed')

    await run('init', '--minimal')

    expect(readFileSync(agents, 'utf-8')).toBe(agentsContent)
    expect(readFileSync(rules, 'utf-8')).toBe(rulesContent)
    expect(JSON.parse(readFileSync(join(projectDir, '.goodvibes.json'), 'utf-8')).files['AGENTS.md']).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.parse(readFileSync(join(configDir, '.goodvibes.json'), 'utf-8')).files['rules/goodvibes.md']).toMatch(/^[0-9a-f]{64}$/)
  })

  it('usage is registered and exits 0 with a friendly message when there are no session logs', async () => {
    const result = await run('usage')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(`No Claude Code session logs found in ${join(configDir, 'projects')}.`)
    expect(result.stdout).toContain("Claude Code's log format is internal and can change; these numbers are best effort.")
  })
})
