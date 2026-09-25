import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { detectProjectType, dependabotYml } from './detect-project-type.js'

describe('detectProjectType', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'gv-detect-type-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns node when only package.json present', () => {
    writeFileSync(join(tmpDir, 'package.json'), '{}')
    expect(detectProjectType(tmpDir)).toBe('node')
  })

  it('returns python when only pyproject.toml present', () => {
    writeFileSync(join(tmpDir, 'pyproject.toml'), '[project]')
    expect(detectProjectType(tmpDir)).toBe('python')
  })

  it('returns python when only requirements.txt present', () => {
    writeFileSync(join(tmpDir, 'requirements.txt'), 'pytest')
    expect(detectProjectType(tmpDir)).toBe('python')
  })

  it('returns both when package.json and pyproject.toml both present', () => {
    writeFileSync(join(tmpDir, 'package.json'), '{}')
    writeFileSync(join(tmpDir, 'pyproject.toml'), '[project]')
    expect(detectProjectType(tmpDir)).toBe('both')
  })

  it('returns both when neither marker file exists', () => {
    // Empty dir — safe default
    expect(detectProjectType(tmpDir)).toBe('both')
  })
})

describe('dependabotYml', () => {
  let tmpDir: string
  const TPL = 'version: 2\nupdates:\n  - package-ecosystem: "github-actions"\n    directory: "/"\n'
  const block = (eco: string) =>
    `  - package-ecosystem: "${eco}"\n    directory: "/"\n    schedule:\n      interval: "weekly"\n    open-pull-requests-limit: 5\n    cooldown:\n      default-days: 7\n`

  beforeEach(() => { tmpDir = mkdtempSync(join(tmpdir(), 'gv-dependabot-')) })
  afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }) })

  it('keeps only github-actions in a folder with no package files', () => {
    expect(dependabotYml(TPL, tmpDir)).toBe(TPL)
  })

  it('adds npm when package.json exists', () => {
    writeFileSync(join(tmpDir, 'package.json'), '{}')
    expect(dependabotYml(TPL, tmpDir)).toBe(TPL + block('npm'))
  })

  it('adds uv and not pip when uv.lock exists next to pyproject.toml', () => {
    writeFileSync(join(tmpDir, 'pyproject.toml'), '[project]')
    writeFileSync(join(tmpDir, 'uv.lock'), '')
    expect(dependabotYml(TPL, tmpDir)).toBe(TPL + block('uv'))
  })

  it('adds pip when requirements.txt or pyproject.toml exists without uv.lock', () => {
    writeFileSync(join(tmpDir, 'requirements.txt'), 'pytest')
    expect(dependabotYml(TPL, tmpDir)).toBe(TPL + block('pip'))
    rmSync(join(tmpDir, 'requirements.txt'))
    writeFileSync(join(tmpDir, 'pyproject.toml'), '[project]')
    expect(dependabotYml(TPL, tmpDir)).toBe(TPL + block('pip'))
  })

  it('adds npm then pip for a project with package.json and requirements.txt', () => {
    writeFileSync(join(tmpDir, 'package.json'), '{}')
    writeFileSync(join(tmpDir, 'requirements.txt'), 'pytest')
    expect(dependabotYml(TPL, tmpDir)).toBe(TPL + block('npm') + block('pip'))
  })
})
