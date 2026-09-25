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
    expect(settings.hooks.PreToolUse).toHaveLength(2)
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

  it('reports a global settings.json whose permissions lists have the wrong type and leaves it unchanged', async () => {
    mkdirSync(cfg, { recursive: true })
    writeFileSync(join(cfg, 'settings.json'), '{"permissions":{"deny":"Read(./.env)"}}')
    const r = await applyGlobalConfig(templateDir, '1.8.0', false)
    expect(readFileSync(join(cfg, 'settings.json'), 'utf-8')).toBe('{"permissions":{"deny":"Read(./.env)"}}')
    expect(r.settingsError).toBe(`${join(cfg, 'settings.json')}: "permissions.deny" is not a JSON array; left unchanged, fix it and re-run`)
  })

  it('reports a global settings.json that is JSON but not an object and leaves it unchanged', async () => {
    mkdirSync(cfg, { recursive: true })
    writeFileSync(join(cfg, 'settings.json'), '[]')
    const r = await applyGlobalConfig(templateDir, '1.8.0', false)
    expect(readFileSync(join(cfg, 'settings.json'), 'utf-8')).toBe('[]')
    expect(r.settingsError).toContain('not a JSON object; left unchanged')
  })

  it('keeps a deleted rules file absent over two runs, reports it once and records it as user-removed', async () => {
    await applyGlobalConfig(templateDir, '1.8.0', false)
    rmSync(join(cfg, 'rules', 'goodvibes.md'))
    const { formatGlobal } = await import('./global-setup.js')

    const first = await applyGlobalConfig(templateDir, '1.8.0', false)
    expect(first.removed).toEqual(['rules/goodvibes.md'])
    expect(first.written).not.toContain('rules/goodvibes.md')
    expect(formatGlobal(first, undefined, undefined)).toContain('rules/goodvibes.md: removed by you, not re-added (run goodvibes init to restore)')
    expect(readJson('.goodvibes.json').files['rules/goodvibes.md']).toBe('user-removed')

    const second = await applyGlobalConfig(templateDir, '1.8.0', false)
    expect(existsSync(join(cfg, 'rules', 'goodvibes.md'))).toBe(false)
    expect(second.removed).toEqual([])
    expect(formatGlobal(second, undefined, undefined)).not.toContain('rules/goodvibes.md')
    expect(readJson('.goodvibes.json').files['rules/goodvibes.md']).toBe('user-removed')
  })

  it('restores a user-removed rules file when asked to (init) and records its real hash', async () => {
    await applyGlobalConfig(templateDir, '1.8.0', false)
    const content = readFileSync(join(cfg, 'rules', 'goodvibes.md'), 'utf-8')
    rmSync(join(cfg, 'rules', 'goodvibes.md'))
    await applyGlobalConfig(templateDir, '1.8.0', false)

    await applyGlobalConfig(templateDir, '1.8.0', false, true)

    expect(readFileSync(join(cfg, 'rules', 'goodvibes.md'), 'utf-8')).toBe(content)
    expect(readJson('.goodvibes.json').files['rules/goodvibes.md']).toBe(createHash('sha256').update(content, 'utf8').digest('hex'))
  })

  it('never overwrites a user-removed rules file the user created again, even when restoring', async () => {
    mkdirSync(join(cfg, 'rules'), { recursive: true })
    writeFileSync(join(cfg, 'rules', 'goodvibes.md'), 'my own rules\n')
    writeFileSync(join(cfg, '.goodvibes.json'), JSON.stringify({ version: '1.8.0', scope: 'global', files: { 'rules/goodvibes.md': 'user-removed' } }))

    await applyGlobalConfig(templateDir, '1.8.0', false)
    await applyGlobalConfig(templateDir, '1.8.0', false, true)

    expect(readFileSync(join(cfg, 'rules', 'goodvibes.md'), 'utf-8')).toBe('my own rules\n')
  })

  const plantRetiredSkill = (content: string, recorded: string) => {
    mkdirSync(join(cfg, 'skills', 'cavecrew'), { recursive: true })
    writeFileSync(join(cfg, 'skills', 'cavecrew', 'SKILL.md'), content)
    const m = readJson('.goodvibes.json')
    m.files['skills/cavecrew/SKILL.md'] = createHash('sha256').update(recorded, 'utf8').digest('hex')
    writeFileSync(join(cfg, '.goodvibes.json'), JSON.stringify(m))
  }

  it('deletes an unchanged skill file goodvibes no longer ships and reports it', async () => {
    await applyGlobalConfig(templateDir, '1.8.0', false)
    plantRetiredSkill('old skill\n', 'old skill\n')
    const { formatGlobal } = await import('./global-setup.js')

    const r = await applyGlobalConfig(templateDir, '1.8.0', false)

    expect(existsSync(join(cfg, 'skills', 'cavecrew'))).toBe(false)
    expect(r.retired).toEqual(['skills/cavecrew/SKILL.md'])
    expect(formatGlobal(r, undefined, undefined)).toContain('skills/cavecrew/SKILL.md: removed, no longer shipped by goodvibes')
    expect(readJson('.goodvibes.json').files).not.toHaveProperty('skills/cavecrew/SKILL.md')
  })

  it('keeps a skill file goodvibes no longer ships when the user edited it', async () => {
    await applyGlobalConfig(templateDir, '1.8.0', false)
    plantRetiredSkill('my edits\n', 'old skill\n')

    const r = await applyGlobalConfig(templateDir, '1.8.0', false)

    expect(readFileSync(join(cfg, 'skills', 'cavecrew', 'SKILL.md'), 'utf-8')).toBe('my edits\n')
    expect(r.retired).toEqual([])
    expect(readJson('.goodvibes.json').files).not.toHaveProperty('skills/cavecrew/SKILL.md')
  })

  it('only reports a retired skill file in dry-run mode', async () => {
    await applyGlobalConfig(templateDir, '1.8.0', false)
    plantRetiredSkill('old skill\n', 'old skill\n')

    const r = await applyGlobalConfig(templateDir, '1.8.0', true)

    expect(r.retired).toEqual(['skills/cavecrew/SKILL.md'])
    expect(existsSync(join(cfg, 'skills', 'cavecrew', 'SKILL.md'))).toBe(true)
  })
})
