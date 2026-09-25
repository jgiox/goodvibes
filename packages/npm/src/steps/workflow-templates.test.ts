import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveTemplatesDir } from './copy-templates.js'

const read = (name: string) => readFileSync(join(resolveTemplatesDir(), '.github', 'workflows', name), 'utf-8')
const WORKFLOWS = ['ci-node.yml', 'ci-python.yml', 'ci-both.yml', 'security.yml', 'dependency-review.yml']

describe('template workflows', () => {
  it.each(['ci-python.yml', 'ci-both.yml'])('%s runs pytest without --extra dev, which fails for [dependency-groups] dev projects', f => {
    expect(read(f)).not.toContain('--extra dev')
    expect(read(f)).toMatch(/uv run (--all-extras )?pytest/)
  })

  it.each(['ci-node.yml', 'ci-both.yml'])('%s only enables the npm cache when a package-lock.json exists', f => {
    expect(read(f)).not.toMatch(/cache: 'npm'/)
    expect(read(f)).toContain("cache: ${{ hashFiles('**/package-lock.json') != '' && 'npm' || '' }}")
  })

  it('skips CodeQL and dependency review on private repos, which need GitHub Advanced Security', () => {
    const skip = 'if: github.event.repository.private != true'
    expect(read('security.yml').split('\n  secrets:')[0]).toContain(skip)
    expect(read('security.yml').split('\n  secrets:')[1]).not.toContain(skip)
    expect(read('dependency-review.yml')).toContain(skip)
  })

  it.each(WORKFLOWS)('%s sets a top-level read-only contents permission', f => {
    expect(read(f)).toMatch(/^permissions:\n {2}contents: read$/m)
  })

  it.each(WORKFLOWS)('%s checks out without persisting the job token in .git/config', f => {
    const text = read(f)
    const checkouts = text.match(/uses: actions\/checkout@/g) ?? []
    expect(checkouts.length).toBeGreaterThan(0)
    expect(text.match(/persist-credentials: false/g)?.length).toBe(checkouts.length)
  })

  it.each(WORKFLOWS)('%s pins every third-party action and container image to a full SHA or digest', f => {
    const text = read(f)
    for (const [, ref] of text.matchAll(/uses: ([^\s#]+)/g)) {
      if (/^(actions|github)\//.test(ref)) continue
      expect(ref).toMatch(/@[0-9a-f]{40}$/)
    }
    for (const [, image] of text.matchAll(/docker run [^\n]*?(ghcr\.io\/\S+|docker\.io\/\S+)/g)) {
      expect(image).toMatch(/@sha256:[0-9a-f]{64}$/)
    }
  })
})
