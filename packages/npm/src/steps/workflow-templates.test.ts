import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveTemplatesDir } from './copy-templates.js'

const read = (name: string) => readFileSync(join(resolveTemplatesDir(), '.github', 'workflows', name), 'utf-8')
const WORKFLOWS = ['ci-node.yml', 'ci-python.yml', 'ci-both.yml', 'security.yml', 'dependency-review.yml', 'file-size.yml']
const NODE_IF = "if: hashFiles('package.json') != ''"
const PY_IF = "if: hashFiles('pyproject.toml', 'requirements.txt') != ''"
const job = (f: string, lang: 'node' | 'python') => {
  const text = read(f)
  if (f !== 'ci-both.yml') return text
  const [node, python] = text.split('\n  test-python:')
  return lang === 'node' ? node : python
}
const stepsAfterCheckout = (text: string) => text.split('\n      - ').slice(1).filter(s => !s.includes('actions/checkout@'))

describe('template CI on a project without a manifest', () => {
  it.each(['ci-node.yml', 'ci-both.yml'])('%s skips every Node.js step instead of failing when the project has no package.json', f => {
    const steps = stepsAfterCheckout(job(f, 'node'))
    expect(steps.length).toBeGreaterThan(1)
    for (const step of steps) expect(step).toMatch(/if: hashFiles\('package\.json'\) (!=|==) ''/)
    expect(steps.filter(s => s.includes(NODE_IF)).length).toBe(steps.length - 1)
  })

  it.each(['ci-python.yml', 'ci-both.yml'])('%s skips every Python step instead of failing when the project has no pyproject.toml or requirements.txt', f => {
    const steps = stepsAfterCheckout(job(f, 'python'))
    expect(steps.length).toBeGreaterThan(1)
    for (const step of steps) expect(step).toMatch(/if: hashFiles\('pyproject\.toml', 'requirements\.txt'\) (!=|==) ''/)
    expect(steps.filter(s => s.includes(PY_IF)).length).toBe(steps.length - 1)
  })

  it.each(['ci-python.yml', 'ci-both.yml'])('%s creates a virtual environment, because uv pip install -r requirements.txt fails without one', f => {
    expect(job(f, 'python')).toContain('activate-environment: true')
  })

  it.each(['ci-python.yml', 'ci-both.yml'])('%s installs pytest for a requirements.txt project so its tests can run', f => {
    const install = job(f, 'python').split('elif [ -f "requirements.txt" ]; then')[1].split('fi')[0]
    expect(install).toContain('uv pip install -r requirements.txt')
    expect(install).toContain('uv pip install pytest')
  })

  it('gives each CI variant its own concurrency group, because the template repo ships all three and they would cancel each other', () => {
    const groups = ['ci-node.yml', 'ci-python.yml', 'ci-both.yml'].map(f => read(f).match(/\n {2}group: (.+)\n/)?.[1])
    expect(new Set(groups).size).toBe(3)
  })

  it.each(['ci-node.yml', 'ci-both.yml'])('%s tests on Node 22 and 24, not Node 20 which is end of life', f => {
    expect(read(f)).toContain("node: ['22', '24']")
  })
})

describe('template CodeQL', () => {
  const detect = () => read('security.yml').split('- name: Detect languages')[1].split('- name: Initialize CodeQL')[0]

  it('detects JavaScript and TypeScript in .mjs, .cjs, .jsx and .tsx files too', () => {
    for (const ext of ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx']) expect(detect()).toContain(`-name '*.${ext}'`)
  })

  it('skips the CodeQL steps instead of analysing Python when the project has no supported source files', () => {
    expect(detect()).not.toMatch(/\[ -z "\$langs" \] && langs=/)
    const codeql = read('security.yml').split('\n      - ').filter(s => s.includes('github/codeql-action/'))
    expect(codeql.length).toBe(3)
    for (const step of codeql) expect(step).toContain("if: steps.langs.outputs.value != ''")
  })

  it('skips CodeQL on private repos in the weekly scheduled run too, where github.event carries no repository', () => {
    expect(read('security.yml')).toContain("- cron: '0 8 * * 1'")
    expect(detect()).toContain('gh api "repos/$GITHUB_REPOSITORY" --jq .private')
    expect(detect()).toContain('GH_TOKEN: ${{ github.token }}')
  })
})

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
    const variant = f.match(/^ci-(\w+)\.yml$/)?.[1]
    const group = variant ? `\${{ github.workflow }}-${variant}-\${{ github.ref }}` : '${{ github.workflow }}-${{ github.ref }}'
    expect(read(f)).toContain(
      `\nconcurrency:\n  group: ${group}\n  cancel-in-progress: \${{ github.event_name == 'pull_request' }}\n`,
    )
  })

  it('pins dependency review to the v5.0.0 commit, not the movable v5 branch', () => {
    expect(read('dependency-review.yml')).toContain(
      'uses: actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294 # v5.0.0',
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
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) expect(entry).toContain('\n    cooldown:\n      default-days: 7\n')
  })

  it('Dependabot updates only GitHub Actions by default, because an npm or pip entry fails every week in a project without that manifest', () => {
    const text = readFileSync(join(resolveTemplatesDir(), '.github', 'dependabot.yml'), 'utf-8')
    expect([...text.matchAll(/^ {2}- package-ecosystem: "(\S+)"/gm)].map(m => m[1])).toEqual(['github-actions'])
    expect(text).toContain('docs/getting-started.md')
  })
})
