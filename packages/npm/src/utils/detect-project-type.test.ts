import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { detectProjectType } from './detect-project-type.js'

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
