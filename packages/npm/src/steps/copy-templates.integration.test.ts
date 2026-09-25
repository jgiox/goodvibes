import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, existsSync, readFileSync, mkdirSync, symlinkSync, readdirSync, chmodSync } from 'fs'
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

  it('reports only goodvibes files as written or skipped, never the project\'s own files such as .git or node_modules', async () => {
    mkdirSync(join(tmpDir, '.git', 'hooks'), { recursive: true })
    writeFileSync(join(tmpDir, '.git', 'hooks', 'pre-commit.sample'), '#!/bin/sh\n')
    mkdirSync(join(tmpDir, 'node_modules', 'left-pad'), { recursive: true })
    writeFileSync(join(tmpDir, 'node_modules', 'left-pad', 'index.js'), '')
    writeFileSync(join(tmpDir, 'JOURNAL.md'), '# mine\n')

    const { written, skipped } = await copyTemplates(resolveTemplatesDir(), tmpDir, false, false)

    const foreign = (f: string) => f.startsWith('.git/') || f.startsWith('node_modules/')
    expect([...written, ...skipped].filter(foreign)).toEqual([])
    expect(skipped).toContain('JOURNAL.md')
  })

  // root reads any folder, so the unreadable folder only exists for a normal user (as on CI).
  it.skipIf(process.getuid?.() === 0)('finishes and reports its files when a project folder it does not own cannot be read', async () => {
    mkdirSync(join(tmpDir, 'private'))
    chmodSync(join(tmpDir, 'private'), 0o000)
    writeFileSync(join(tmpDir, 'AGENTS.md'), '# mine\n')
    try {
      const { written, skipped } = await copyTemplates(resolveTemplatesDir(), tmpDir, false, false)
      expect(written).toContain('JOURNAL.md')
      expect(skipped).toContain('AGENTS.md')
    } finally {
      chmodSync(join(tmpDir, 'private'), 0o755)
    }
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

  it('--minimal writes Copilot\'s rules and hooks but no other .github file', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, true)
    expect(written.filter(f => f.startsWith('.github')).sort()).toEqual(['.github/copilot-instructions.md', '.github/hooks/goodvibes.json'])
    expect(readdirSync(join(tmpDir, '.github')).sort()).toEqual(['copilot-instructions.md', 'hooks'])
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

  it('--minimal writes .github/copilot-instructions.md, which Copilot reads as its rules (IDE-04)', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, '.github', 'copilot-instructions.md'))).toBe(true)
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

  it('writes .mcp.json and the hooked .claude/settings.json on fresh init (CTX7-01, HOOK-01)', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(written).toContain('.mcp.json')
    expect(readFileSync(join(tmpDir, '.claude', 'settings.json'), 'utf-8')).toContain('PreToolUse')
  })

  it('writes the on-demand model-regression skill on fresh init', async () => {
    await copyTemplates(templateDir, tmpDir, false, false)
    const skill = readFileSync(join(tmpDir, '.claude', 'skills', 'model-regression', 'SKILL.md'), 'utf-8')
    expect(skill).toMatch(/^---\nname: model-regression\n/)
  })

  it('--minimal still writes .mcp.json (CTX7-01)', async () => {
    await copyTemplates(templateDir, tmpDir, false, true)
    expect(existsSync(join(tmpDir, '.mcp.json'))).toBe(true)
  })

  it('writes the context7 MCP files for Cursor and VS Code on fresh init', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, false)
    expect(written).toEqual(expect.arrayContaining(['.cursor/mcp.json', '.vscode/mcp.json']))
    expect(JSON.parse(readFileSync(join(tmpDir, '.cursor', 'mcp.json'), 'utf-8')).mcpServers.context7.url).toBe('https://mcp.context7.com/mcp')
    expect(JSON.parse(readFileSync(join(tmpDir, '.vscode', 'mcp.json'), 'utf-8')).servers.context7.url).toBe('https://mcp.context7.com/mcp')
  })

  it('--minimal and global scope still write the Cursor and VS Code MCP files, which those tools read only from the project', async () => {
    await copyTemplates(templateDir, tmpDir, false, true, 'both', 'global')
    expect(existsSync(join(tmpDir, '.cursor', 'mcp.json'))).toBe(true)
    expect(existsSync(join(tmpDir, '.vscode', 'mcp.json'))).toBe(true)
  })

  it('global scope writes project files but not skills, .mcp.json or the rules block', async () => {
    const { written } = await copyTemplates(templateDir, tmpDir, false, false, 'both', 'global')
    expect(existsSync(join(tmpDir, '.claude', 'skills'))).toBe(false)
    expect(existsSync(join(tmpDir, '.mcp.json'))).toBe(false)
    expect(existsSync(join(tmpDir, 'JOURNAL.md'))).toBe(true)
    expect(existsSync(join(tmpDir, '.claude', 'settings.json'))).toBe(true)
    const claude = readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8')
    expect(claude).toContain('**What this is:**')
    expect(claude).not.toContain('goodvibes:start')
    expect(written).toContain('CLAUDE.md')
  })

  it('global scope leaves an existing project CLAUDE.md untouched', async () => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), '# mine\n')
    await copyTemplates(templateDir, tmpDir, false, false, 'both', 'global')
    expect(readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8')).toBe('# mine\n')
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

  it('adds file-size.yml but not ci.yml when the project already has its own workflow', async () => {
    const workflowsDir = join(tmpDir, '.github', 'workflows')
    mkdirSync(workflowsDir, { recursive: true })
    writeFileSync(join(workflowsDir, 'codeql.yml'), '# existing CodeQL\n')

    const { written } = await copyTemplates(templateDir, tmpDir, false, false)

    expect(readFileSync(join(workflowsDir, 'file-size.yml'), 'utf-8')).toBe(readFileSync(join(templateDir, '.github', 'workflows', 'file-size.yml'), 'utf-8'))
    expect(written).toContain('.github/workflows/file-size.yml')
    expect(existsSync(join(tmpDir, '.github', 'scripts', 'check-file-sizes.mjs'))).toBe(true)
    expect(existsSync(join(workflowsDir, 'ci.yml'))).toBe(false)
    expect(existsSync(join(workflowsDir, 'security.yml'))).toBe(false)
  })

  it('adds neither file-size.yml nor ci.yml under --minimal when the project has its own workflow', async () => {
    const workflowsDir = join(tmpDir, '.github', 'workflows')
    mkdirSync(workflowsDir, { recursive: true })
    writeFileSync(join(workflowsDir, 'codeql.yml'), '# existing CodeQL\n')

    await copyTemplates(templateDir, tmpDir, false, true)

    expect(existsSync(join(workflowsDir, 'file-size.yml'))).toBe(false)
    expect(existsSync(join(workflowsDir, 'ci.yml'))).toBe(false)
    expect(existsSync(join(tmpDir, '.github', 'scripts'))).toBe(false)
  })

  it('counts a workflow written as .yaml as the project\'s own CI, so ci.yml and security.yml are not added next to it', async () => {
    const workflowsDir = join(tmpDir, '.github', 'workflows')
    mkdirSync(workflowsDir, { recursive: true })
    writeFileSync(join(workflowsDir, 'build.yaml'), '# my own CI\n')

    await copyTemplates(templateDir, tmpDir, false, false)

    expect(existsSync(join(workflowsDir, 'ci.yml'))).toBe(false)
    expect(existsSync(join(workflowsDir, 'security.yml'))).toBe(false)
    expect(existsSync(join(workflowsDir, 'file-size.yml'))).toBe(true)
  })

  it('keeps the user\'s own file-size.yml and reports it as skipped when the project has its own workflows', async () => {
    const workflowsDir = join(tmpDir, '.github', 'workflows')
    mkdirSync(workflowsDir, { recursive: true })
    writeFileSync(join(workflowsDir, 'file-size.yml'), '# my own size check\n')

    const { written, skipped } = await copyTemplates(templateDir, tmpDir, false, false)

    expect(readFileSync(join(workflowsDir, 'file-size.yml'), 'utf-8')).toBe('# my own size check\n')
    expect(written).not.toContain('.github/workflows/file-size.yml')
    expect(skipped).toContain('.github/workflows/file-size.yml')
  })
})

describe('copyTemplates — never writes through a symlink', () => {
  let tmpDir: string
  let outside: string
  const templateDir = resolveTemplatesDir()

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-link-proj-'))
    outside = mkdtempSync(join(tmpdir(), 'gv-link-outside-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  })

  it('leaves the outside file unchanged when CLAUDE.md is a symlink to it and reports it as skipped', async () => {
    const target = join(outside, 'notes.md')
    writeFileSync(target, 'my private notes\n')
    symlinkSync(target, join(tmpDir, 'CLAUDE.md'))

    const { written, skipped } = await copyTemplates(templateDir, tmpDir, false, false, 'node', 'project')

    expect(readFileSync(target, 'utf-8')).toBe('my private notes\n')
    expect(skipped).toContain('CLAUDE.md: symlink, not written')
    expect(written).not.toContain('CLAUDE.md')
    expect(existsSync(join(tmpDir, 'AGENTS.md'))).toBe(true)
  })

  it('does not create the target of a dangling CLAUDE.md symlink in global scope', async () => {
    symlinkSync(join(outside, 'missing.md'), join(tmpDir, 'CLAUDE.md'))

    const { skipped } = await copyTemplates(templateDir, tmpDir, false, false, 'node', 'global')

    expect(existsSync(join(outside, 'missing.md'))).toBe(false)
    expect(skipped).toContain('CLAUDE.md: symlink, not written')
  })

  it('writes nothing into an outside folder that .claude or .github points to', async () => {
    symlinkSync(outside, join(tmpDir, '.claude'))
    const outsideGithub = join(outside, 'gh')
    mkdirSync(outsideGithub)
    symlinkSync(outsideGithub, join(tmpDir, '.github'))

    const { skipped } = await copyTemplates(templateDir, tmpDir, false, false, 'node', 'project')

    expect(readdirSync(outside)).toEqual(['gh'])
    expect(readdirSync(outsideGithub)).toEqual([])
    expect(skipped).toContain('.claude: symlink, not written')
    expect(skipped).toContain('.github: symlink, not written')
    expect(existsSync(join(tmpDir, 'AGENTS.md'))).toBe(true)
  })

  it('does not create the target of a dangling symlink for a template file', async () => {
    symlinkSync(join(outside, 'agents.md'), join(tmpDir, 'AGENTS.md'))

    const { skipped } = await copyTemplates(templateDir, tmpDir, false, false, 'node', 'project')

    expect(existsSync(join(outside, 'agents.md'))).toBe(false)
    expect(skipped).toContain('AGENTS.md: symlink, not written')
  })
})

describe('copyTemplates — CLAUDE.md with broken markers', () => {
  let tmpDir: string
  const templateDir = resolveTemplatesDir()

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-marker-proj-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('leaves CLAUDE.md alone, reports the problem and still copies the other files', async () => {
    const broken = '# Mine\n<!-- goodvibes:start -->\nno end marker, and my text below\nkeep me\n'
    writeFileSync(join(tmpDir, 'CLAUDE.md'), broken)

    const { written, problems } = await copyTemplates(templateDir, tmpDir, false, false, 'node', 'project')

    expect(readFileSync(join(tmpDir, 'CLAUDE.md'), 'utf-8')).toBe(broken)
    expect(problems.join('\n')).toMatch(/no <!-- goodvibes:end --> line.*fix CLAUDE\.md by hand/)
    expect(written).not.toContain('CLAUDE.md')
    expect(existsSync(join(tmpDir, 'AGENTS.md'))).toBe(true)
  })
})
