import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import { rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { copyTemplates, listTemplateFiles, resolveTemplatesDir } from './copy-templates.js'

describe('resolveTemplatesDir', () => {
  it('returns a path that exists and contains CLAUDE.md', () => {
    const dir = resolveTemplatesDir()
    expect(existsSync(dir)).toBe(true)
    expect(existsSync(join(dir, 'CLAUDE.md'))).toBe(true)
  })
})

describe('listTemplateFiles', () => {
  it('returns sorted array of relative paths including CLAUDE.md', async () => {
    const templateDir = resolveTemplatesDir()
    const files = await listTemplateFiles(templateDir)
    expect(files.length).toBeGreaterThan(0)
    expect(files).toContain('CLAUDE.md')
    // Should be sorted
    const sorted = [...files].sort()
    expect(files).toEqual(sorted)
  })

  it('returns paths relative to templateDir (no absolute paths)', async () => {
    const templateDir = resolveTemplatesDir()
    const files = await listTemplateFiles(templateDir)
    for (const f of files) {
      expect(f.startsWith('/')).toBe(false)
    }
  })
})

describe('copyTemplates', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-copy-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('copies all template files to empty destination', async () => {
    const templateDir = resolveTemplatesDir()
    const files = await copyTemplates(templateDir, tmpDir, false, false)
    expect(files.length).toBeGreaterThan(0)
    expect(files).toContain('CLAUDE.md')
    expect(existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(true)
  })

  it('CLAUDE.md is routed through sentinel merge (contains sentinel markers)', async () => {
    const templateDir = resolveTemplatesDir()
    await copyTemplates(templateDir, tmpDir, false, false)
    const content = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8')
    expect(content).toContain('<!-- goodvibes:start -->')
    expect(content).toContain('<!-- goodvibes:end -->')
  })

  it('copies non-CLAUDE.md template files to destination', async () => {
    const templateDir = resolveTemplatesDir()
    await copyTemplates(templateDir, tmpDir, false, false)
    expect(existsSync(join(tmpDir, 'JOURNAL.md'))).toBe(true)
  })

  it('dry-run returns file list without writing anything', async () => {
    const templateDir = resolveTemplatesDir()
    const files = await copyTemplates(templateDir, tmpDir, true, false)
    expect(files.length).toBeGreaterThan(0)
    expect(files).toContain('CLAUDE.md')
    // Nothing should be written
    expect(existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(false)
  })

  it('second call is idempotent — no error and CLAUDE.md not duplicated', async () => {
    const templateDir = resolveTemplatesDir()
    await copyTemplates(templateDir, tmpDir, false, false)
    // Modify a user-owned file outside the sentinel
    const claudePath = join(tmpDir, 'CLAUDE.md')
    const afterFirst = readFileSync(claudePath, 'utf-8')

    await copyTemplates(templateDir, tmpDir, false, false)
    const afterSecond = readFileSync(claudePath, 'utf-8')

    // CLAUDE.md should be unchanged (same version sentinel → Case D skip)
    expect(afterSecond).toBe(afterFirst)
    // Only one sentinel start marker
    const startCount = (afterSecond.match(/<!-- goodvibes:start -->/g) ?? []).length
    expect(startCount).toBe(1)
  })

  it('skips existing files without overwriting (overwrite protection)', async () => {
    const templateDir = resolveTemplatesDir()
    await copyTemplates(templateDir, tmpDir, false, false)

    // Modify JOURNAL.md (non-CLAUDE.md file)
    const journalPath = join(tmpDir, 'JOURNAL.md')
    const customContent = '# My custom journal\n'
    writeFileSync(journalPath, customContent)

    await copyTemplates(templateDir, tmpDir, false, false)

    // User's custom content should be preserved (overwrite:false)
    const content = readFileSync(journalPath, 'utf-8')
    expect(content).toBe(customContent)
  })
})

describe('copyTemplates — CI variant selection', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-ci-variant-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes ci.yml (not ci-node.yml) when projectType is node', async () => {
    const templateDir = resolveTemplatesDir()
    await copyTemplates(templateDir, tmpDir, false, false, 'node')
    expect(existsSync(join(tmpDir, '.github', 'workflows', 'ci.yml'))).toBe(true)
    expect(existsSync(join(tmpDir, '.github', 'workflows', 'ci-node.yml'))).toBe(false)
  })

  it('does not write ci-python.yml or ci-both.yml when projectType is node', async () => {
    const templateDir = resolveTemplatesDir()
    await copyTemplates(templateDir, tmpDir, false, false, 'node')
    expect(existsSync(join(tmpDir, '.github', 'workflows', 'ci-python.yml'))).toBe(false)
    expect(existsSync(join(tmpDir, '.github', 'workflows', 'ci-both.yml'))).toBe(false)
  })

  it('writes ci.yml when projectType is python', async () => {
    const templateDir = resolveTemplatesDir()
    await copyTemplates(templateDir, tmpDir, false, false, 'python')
    expect(existsSync(join(tmpDir, '.github', 'workflows', 'ci.yml'))).toBe(true)
    expect(existsSync(join(tmpDir, '.github', 'workflows', 'ci-python.yml'))).toBe(false)
  })
})
