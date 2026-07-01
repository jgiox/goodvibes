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
    const { written } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(written.length).toBeGreaterThan(0)
    expect(written).toContain('CLAUDE.md')
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
    const { written } = await copyTemplates(templateDir, tmpDir, true, false)
    expect(written.length).toBeGreaterThan(0)
    expect(written).toContain('CLAUDE.md')
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

describe('copyTemplates — written/skipped tracking', () => {
  let tmpDir: string
  let templateDir: string

  beforeEach(() => {
    templateDir = resolveTemplatesDir()
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-tracking-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns object with written and skipped arrays (empty dest)', async () => {
    const result = await copyTemplates(templateDir, tmpDir, false, false)
    expect(typeof result === 'object' && result !== null).toBe(true)
    expect(Array.isArray(result.written)).toBe(true)
    expect(Array.isArray(result.skipped)).toBe(true)
    expect(result.written.length).toBeGreaterThan(0)
    expect(result.skipped.length).toBe(0)
    expect(result.written).toContain('CLAUDE.md')
  })

  it('skipped array contains pre-existing files on second run', async () => {
    await copyTemplates(templateDir, tmpDir, false, false)
    const result = await copyTemplates(templateDir, tmpDir, false, false)
    expect(result.skipped.length).toBeGreaterThan(0)
  })
})

describe('copyTemplates — ci.yml rename guard', () => {
  let tmpDir: string
  let templateDir: string

  beforeEach(() => {
    templateDir = resolveTemplatesDir()
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-ci-guard-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('does not overwrite existing ci.yml in destination (UX-04)', async () => {
    // First run: ci-node.yml is renamed to ci.yml
    await copyTemplates(templateDir, tmpDir, false, false, 'node')
    const ciPath = join(tmpDir, '.github', 'workflows', 'ci.yml')
    expect(existsSync(ciPath)).toBe(true)

    // User customises their ci.yml
    writeFileSync(ciPath, '# custom CI\n')

    // Second run: must not overwrite the user's ci.yml
    const result = await copyTemplates(templateDir, tmpDir, false, false, 'node')
    expect(readFileSync(ciPath, 'utf-8')).toBe('# custom CI\n')
    // ci.yml must appear in skipped and must NOT appear in written
    expect(result.skipped.some(f => f.includes('ci.yml'))).toBe(true)
    expect(result.written.some(f => f.includes('ci.yml'))).toBe(false)
  })
})

describe('copyTemplates — minimal filter scope', () => {
  let tmpDir: string
  let templateDir: string

  beforeEach(() => {
    templateDir = resolveTemplatesDir()
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-minimal-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('--minimal skips .github/ISSUE_TEMPLATE (MIN-01)', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, '.github', 'ISSUE_TEMPLATE'))).toBe(false)
  })

  it('--minimal skips docs/ (MIN-01)', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, 'docs'))).toBe(false)
  })

  it('--minimal keeps CLAUDE.md (MIN-01)', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, true)
    expect(written.includes('CLAUDE.md') || existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(true)
  })
})

describe('copyTemplates — IDE rule files', () => {
  let tmpDir: string
  let templateDir: string

  beforeEach(() => {
    templateDir = resolveTemplatesDir()
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-ide-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes .cursor/rules/goodvibes.mdc on fresh init (IDE-01)', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(existsSync(join(tmpDir, '.cursor', 'rules', 'goodvibes.mdc'))).toBe(true)
    expect(written).toContain('.cursor/rules/goodvibes.mdc')
  })

  it('writes .windsurfrules on fresh init (IDE-01)', async () => {
    await copyTemplates(templateDir, tmpDir, false, false)
    expect(existsSync(join(tmpDir, '.windsurfrules'))).toBe(true)
  })

  it('writes .kiro/steering/goodvibes.md on fresh init (IDE-01)', async () => {
    await copyTemplates(templateDir, tmpDir, false, false)
    expect(existsSync(join(tmpDir, '.kiro', 'steering', 'goodvibes.md'))).toBe(true)
  })

  it('writes .github/copilot-instructions.md on fresh init (IDE-01)', async () => {
    await copyTemplates(templateDir, tmpDir, false, false)
    expect(existsSync(join(tmpDir, '.github', 'copilot-instructions.md'))).toBe(true)
  })

  it('existing .cursor/rules/goodvibes.mdc is counted as skipped not overwritten (IDE-03)', async () => {
    mkdirSync(join(tmpDir, '.cursor', 'rules'), { recursive: true })
    writeFileSync(join(tmpDir, '.cursor', 'rules', 'goodvibes.mdc'), '# custom cursor rules\n')
    const { skipped } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(readFileSync(join(tmpDir, '.cursor', 'rules', 'goodvibes.mdc'), 'utf-8')).toBe('# custom cursor rules\n')
    expect(skipped.some(f => f.includes('goodvibes.mdc'))).toBe(true)
  })

  it('--minimal skips .github/copilot-instructions.md (IDE-04)', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, '.github', 'copilot-instructions.md'))).toBe(false)
  })

  it('--minimal writes .cursor/rules/goodvibes.mdc (IDE-04)', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, '.cursor', 'rules', 'goodvibes.mdc'))).toBe(true)
  })

  it('--minimal writes .windsurfrules (IDE-04)', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, '.windsurfrules'))).toBe(true)
  })

  it('--minimal writes .kiro/steering/goodvibes.md (IDE-04)', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, '.kiro', 'steering', 'goodvibes.md'))).toBe(true)
  })

  it('writes GEMINI.md on fresh init', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(existsSync(join(tmpDir, 'GEMINI.md'))).toBe(true)
    expect(written.some((f: string) => f.includes('GEMINI.md'))).toBe(true)
  })

  it('skips existing GEMINI.md and counts it as skipped', async () => {
    writeFileSync(join(tmpDir, 'GEMINI.md'), '# custom\n')
    const { skipped } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(readFileSync(join(tmpDir, 'GEMINI.md'), 'utf8')).toBe('# custom\n')
    expect(skipped.some((f: string) => f.includes('GEMINI.md'))).toBe(true)
  })

  it('writes GEMINI.md under --minimal', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, 'GEMINI.md'))).toBe(true)
  })

  it('writes AGENTS.md on fresh init', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(existsSync(join(tmpDir, 'AGENTS.md'))).toBe(true)
    expect(written.some((f: string) => f.includes('AGENTS.md'))).toBe(true)
  })

  it('skips existing AGENTS.md and counts it as skipped', async () => {
    writeFileSync(join(tmpDir, 'AGENTS.md'), '# custom\n')
    const { skipped } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(readFileSync(join(tmpDir, 'AGENTS.md'), 'utf8')).toBe('# custom\n')
    expect(skipped.some((f: string) => f.includes('AGENTS.md'))).toBe(true)
  })

  it('writes AGENTS.md under --minimal', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, 'AGENTS.md'))).toBe(true)
  })

  it('writes .clinerules/goodvibes.md on fresh init', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(existsSync(join(tmpDir, '.clinerules', 'goodvibes.md'))).toBe(true)
    expect(written.some((f: string) => f.includes('clinerules'))).toBe(true)
  })

  it('skips existing .clinerules/goodvibes.md and counts it as skipped', async () => {
    mkdirSync(join(tmpDir, '.clinerules'), { recursive: true })
    writeFileSync(join(tmpDir, '.clinerules', 'goodvibes.md'), '# custom\n')
    const { skipped } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(readFileSync(join(tmpDir, '.clinerules', 'goodvibes.md'), 'utf8')).toBe('# custom\n')
    expect(skipped.some((f: string) => f.includes('clinerules'))).toBe(true)
  })

  it('writes .clinerules/goodvibes.md under --minimal', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, '.clinerules', 'goodvibes.md'))).toBe(true)
  })

  it('writes .amazonq/rules/goodvibes.md on fresh init', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(existsSync(join(tmpDir, '.amazonq', 'rules', 'goodvibes.md'))).toBe(true)
    expect(written.some((f: string) => f.includes('amazonq'))).toBe(true)
  })

  it('skips existing .amazonq/rules/goodvibes.md and counts it as skipped', async () => {
    mkdirSync(join(tmpDir, '.amazonq', 'rules'), { recursive: true })
    writeFileSync(join(tmpDir, '.amazonq', 'rules', 'goodvibes.md'), '# custom\n')
    const { skipped } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(readFileSync(join(tmpDir, '.amazonq', 'rules', 'goodvibes.md'), 'utf8')).toBe('# custom\n')
    expect(skipped.some((f: string) => f.includes('amazonq'))).toBe(true)
  })

  it('writes .amazonq/rules/goodvibes.md under --minimal', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, '.amazonq', 'rules', 'goodvibes.md'))).toBe(true)
  })

  it('writes .continue/rules/goodvibes.md on fresh init', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(existsSync(join(tmpDir, '.continue', 'rules', 'goodvibes.md'))).toBe(true)
    expect(written.some((f: string) => f.includes('continue'))).toBe(true)
  })

  it('skips existing .continue/rules/goodvibes.md and counts it as skipped', async () => {
    mkdirSync(join(tmpDir, '.continue', 'rules'), { recursive: true })
    writeFileSync(join(tmpDir, '.continue', 'rules', 'goodvibes.md'), '# custom\n')
    const { skipped } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(readFileSync(join(tmpDir, '.continue', 'rules', 'goodvibes.md'), 'utf8')).toBe('# custom\n')
    expect(skipped.some((f: string) => f.includes('continue'))).toBe(true)
  })

  it('writes .continue/rules/goodvibes.md under --minimal', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, '.continue', 'rules', 'goodvibes.md'))).toBe(true)
  })

  it('writes .devin/rules/goodvibes.md on fresh init', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(existsSync(join(tmpDir, '.devin', 'rules', 'goodvibes.md'))).toBe(true)
    expect(written.some((f: string) => f.includes('devin'))).toBe(true)
  })

  it('skips existing .devin/rules/goodvibes.md and counts it as skipped', async () => {
    mkdirSync(join(tmpDir, '.devin', 'rules'), { recursive: true })
    writeFileSync(join(tmpDir, '.devin', 'rules', 'goodvibes.md'), '# custom\n')
    const { skipped } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(readFileSync(join(tmpDir, '.devin', 'rules', 'goodvibes.md'), 'utf8')).toBe('# custom\n')
    expect(skipped.some((f: string) => f.includes('devin'))).toBe(true)
  })

  it('writes .devin/rules/goodvibes.md under --minimal', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, '.devin', 'rules', 'goodvibes.md'))).toBe(true)
  })

  it('writes replit.md on fresh init (VPE-01)', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(existsSync(join(tmpDir, 'replit.md'))).toBe(true)
    expect(written.some((f: string) => f.includes('replit.md'))).toBe(true)
  })

  it('skips existing replit.md and counts it as skipped (VPE-02)', async () => {
    writeFileSync(join(tmpDir, 'replit.md'), '# custom\n')
    const { skipped } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(readFileSync(join(tmpDir, 'replit.md'), 'utf8')).toBe('# custom\n')
    expect(skipped.some((f: string) => f.includes('replit.md'))).toBe(true)
  })

  it('writes replit.md under --minimal (VPE-03)', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, 'replit.md'))).toBe(true)
  })

  it('writes .bolt/prompt on fresh init (VPE-04)', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(existsSync(join(tmpDir, '.bolt', 'prompt'))).toBe(true)
    expect(written.some((f: string) => f.includes('.bolt'))).toBe(true)
  })

  it('skips existing .bolt/prompt and counts it as skipped (VPE-05)', async () => {
    mkdirSync(join(tmpDir, '.bolt'), { recursive: true })
    writeFileSync(join(tmpDir, '.bolt', 'prompt'), 'custom\n')
    const { skipped } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(readFileSync(join(tmpDir, '.bolt', 'prompt'), 'utf8')).toBe('custom\n')
    expect(skipped.some((f: string) => f.includes('.bolt'))).toBe(true)
  })

  it('writes .bolt/prompt under --minimal (VPE-06)', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, '.bolt', 'prompt'))).toBe(true)
  })
})

describe('copyTemplates — workflow conflict guard', () => {
  let tmpDir: string
  let templateDir: string

  beforeEach(() => {
    templateDir = resolveTemplatesDir()
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-workflow-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('skips all template workflow files when destination already has a CI workflow', async () => {
    // Simulate a project that already has its own CI (e.g. codeql.yml)
    const workflowsDir = join(tmpDir, '.github', 'workflows')
    mkdirSync(workflowsDir, { recursive: true })
    writeFileSync(join(workflowsDir, 'codeql.yml'), '# existing CodeQL\n')

    await copyTemplates(templateDir, tmpDir, false, false)

    // Template adds security.yml and dependency-review.yml — neither should be written
    expect(existsSync(join(workflowsDir, 'security.yml'))).toBe(false)
    expect(existsSync(join(workflowsDir, 'dependency-review.yml'))).toBe(false)
    // ci.yml from template should also not appear
    expect(existsSync(join(workflowsDir, 'ci.yml'))).toBe(false)
    // Original file must be untouched
    expect(readFileSync(join(workflowsDir, 'codeql.yml'), 'utf-8')).toBe('# existing CodeQL\n')
  })

  it('writes template workflow files when destination has no existing workflows', async () => {
    await copyTemplates(templateDir, tmpDir, false, false)
    expect(existsSync(join(tmpDir, '.github', 'workflows', 'ci.yml'))).toBe(true)
  })
})
