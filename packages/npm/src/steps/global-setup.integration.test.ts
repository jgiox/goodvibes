import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { applyGlobalConfig } from './global-setup.js'
import { resolveTemplatesDir } from './copy-templates.js'
import { createHash } from 'node:crypto'

const templateDir = resolveTemplatesDir()

describe('applyGlobalConfig (real temp CLAUDE_CONFIG_DIR)', () => {
  let cfg: string
  const saved = process.env.CLAUDE_CONFIG_DIR

  beforeEach(() => {
    cfg = mkdtempSync(join(tmpdir(), 'gv-cfg-'))
    process.env.CLAUDE_CONFIG_DIR = cfg
  })

  afterEach(() => {
    if (saved === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = saved
    rmSync(cfg, { recursive: true, force: true })
  })

  const readJson = (rel: string) => JSON.parse(readFileSync(join(cfg, rel), 'utf-8'))

  it('writes the rules file, skills, managed settings and a global manifest', async () => {
    const r = await applyGlobalConfig(templateDir, '1.8.0', false)
    expect(r.configDir).toBe(cfg)
    expect(readFileSync(join(cfg, 'rules', 'goodvibes.md'), 'utf-8')).toMatch(/^<!-- goodvibes:start -->/)
    expect(existsSync(join(cfg, 'skills', 'model-regression', 'SKILL.md'))).toBe(true)
    const settings = readJson('settings.json')
    expect(settings.hooks.SessionStart[0].hooks[0].command).toMatch(/^: goodvibes-doctor;/)
    expect(settings.permissions.ask).toContain('Bash(git push*)')
    expect(settings.permissions.allow).toBeUndefined()
    const manifest = readJson('.goodvibes.json')
    expect(manifest.scope).toBe('global')
    expect(Object.keys(manifest.files)).toContain('rules/goodvibes.md')
  })

  it('keeps the user settings keys and never adds allow rules', async () => {
    writeFileSync(join(cfg, 'settings.json'), JSON.stringify({ model: 'opus', permissions: { allow: ['Bash(make*)'] } }))
    await applyGlobalConfig(templateDir, '1.8.0', false)
    const settings = readJson('settings.json')
    expect(settings.model).toBe('opus')
    expect(settings.permissions.allow).toEqual(['Bash(make*)'])
    expect(settings.hooks.PreToolUse).toHaveLength(1)
  })

  it('refreshes an untouched rules file and keeps one the user edited', async () => {
    await applyGlobalConfig(templateDir, '1.8.0', false)
    const skill = join(cfg, 'skills', 'caveman', 'SKILL.md')
    writeFileSync(skill, 'my own caveman\n')
    writeFileSync(join(cfg, 'rules', 'goodvibes.md'), 'stale\n')
    const manifest = readJson('.goodvibes.json')
    manifest.files['rules/goodvibes.md'] = createHash('sha256').update('stale\n', 'utf8').digest('hex')
    writeFileSync(join(cfg, '.goodvibes.json'), JSON.stringify(manifest))

    const r = await applyGlobalConfig(templateDir, '1.8.1', false)

    expect(readFileSync(join(cfg, 'rules', 'goodvibes.md'), 'utf-8')).toMatch(/^<!-- goodvibes:start -->/)
    expect(readFileSync(skill, 'utf-8')).toBe('my own caveman\n')
    expect(r.kept).toContain('skills/caveman/SKILL.md')
  })

  it('does not re-add the journal-gate hook after the user removed it from global settings', async () => {
    await applyGlobalConfig(templateDir, '1.8.0', false)
    const settings = readJson('settings.json')
    delete settings.hooks.PreToolUse
    writeFileSync(join(cfg, 'settings.json'), JSON.stringify(settings))

    await applyGlobalConfig(templateDir, '1.8.0', false)

    expect(readJson('settings.json').hooks.PreToolUse).toBeUndefined()
  })

  it('writes nothing in dry-run mode but still reports what it would do', async () => {
    const r = await applyGlobalConfig(templateDir, '1.8.0', true)
    expect(r.written).toContain('rules/goodvibes.md')
    expect(r.settingsChanges.length).toBeGreaterThan(0)
    expect(existsSync(join(cfg, 'rules'))).toBe(false)
    expect(existsSync(join(cfg, '.goodvibes.json'))).toBe(false)
  })

  it('leaves an invalid global settings.json unchanged and reports it', async () => {
    mkdirSync(cfg, { recursive: true })
    writeFileSync(join(cfg, 'settings.json'), '{ nope')
    const r = await applyGlobalConfig(templateDir, '1.8.0', false)
    expect(readFileSync(join(cfg, 'settings.json'), 'utf-8')).toBe('{ nope')
    expect(r.settingsError).toContain('not valid JSON')
  })
})
