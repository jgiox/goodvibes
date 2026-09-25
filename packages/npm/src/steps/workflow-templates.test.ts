import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveTemplatesDir } from './copy-templates.js'

const read = (name: string) => readFileSync(join(resolveTemplatesDir(), '.github', 'workflows', name), 'utf-8')
const WORKFLOWS = ['ci-node.yml', 'ci-python.yml', 'ci-both.yml', 'security.yml', 'dependency-review.yml', 'file-size.yml']

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

describe('template workflow limits', () => {
  it.each(WORKFLOWS)('%s cancels superseded pull request runs but never runs on main', f => {
    expect(read(f)).toContain(
      "\nconcurrency:\n  group: ${{ github.workflow }}-${{ github.ref }}\n  cancel-in-progress: ${{ github.event_name == 'pull_request' }}\n",
    )
  })

  it.each([
    ['ci-node.yml', [15]],
    ['ci-python.yml', [15]],
    ['ci-both.yml', [15, 15]],
    ['security.yml', [20, 10]],
    ['dependency-review.yml', [10]],
  ] as const)('%s gives every job a timeout', (f, minutes) => {
    const text = read(f)
    expect([...text.matchAll(/timeout-minutes: (\d+)/g)].map(m => Number(m[1]))).toEqual(minutes)
    expect(text.match(/runs-on:/g)?.length).toBe(minutes.length)
  })

  it('dependency review allows only permissive licences', () => {
    expect(read('dependency-review.yml')).toContain(
      'allow-licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, Unlicense, CC0-1.0, Python-2.0, BlueOak-1.0.0, MPL-2.0',
    )
  })

  it('dependency review allows the permissive licences of common packages (caniuse-lite, spdx-exceptions, typing_extensions, pako)', () => {
    const line = read('dependency-review.yml').split('\n').find(l => l.includes('allow-licenses:')) ?? ''
    for (const id of ['CC-BY-4.0', 'CC-BY-3.0', 'PSF-2.0', 'Zlib']) expect(line.split(/,\s*|:\s*/)).toContain(id)
  })

  it('Dependabot waits seven days, longer than GitHub\'s 3-day default, before proposing a new release', () => {
    const text = readFileSync(join(resolveTemplatesDir(), '.github', 'dependabot.yml'), 'utf-8')
    const entries = text.split('  - package-ecosystem:').slice(1)
    expect(entries.length).toBe(3)
    for (const entry of entries) expect(entry).toContain('\n    cooldown:\n      default-days: 7\n')
  })
})
