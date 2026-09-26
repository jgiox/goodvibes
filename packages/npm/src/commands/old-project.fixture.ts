import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

export const OLD_CLAUDE = '# CLAUDE.md\n\nmy notes\n\n<!-- goodvibes:start -->\n# goodvibes: v1.7.1\n\nold rules\n<!-- goodvibes:end -->\n\nmore mine\n'
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex')

// A project set up by goodvibes 1.7 (project scope): rules block in CLAUDE.md, skills copied into the project.
export function oldProject(proj: string, scope?: string): void {
  writeFileSync(join(proj, 'CLAUDE.md'), OLD_CLAUDE)
  const files: Record<string, string> = { 'CLAUDE.md': sha(OLD_CLAUDE) }
  for (const name of ['caveman', 'cavecrew', 'mine']) {
    mkdirSync(join(proj, '.claude', 'skills', name), { recursive: true })
    writeFileSync(join(proj, '.claude', 'skills', name, 'SKILL.md'), `${name} as shipped\n`)
    files[`.claude/skills/${name}/SKILL.md`] = sha(`${name} as shipped\n`)
  }
  writeFileSync(join(proj, '.claude', 'skills', 'mine', 'SKILL.md'), 'my edit\n')
  writeFileSync(join(proj, '.goodvibes.json'), JSON.stringify({ version: '1.7.1', files, ...(scope ? { scope } : {}) }))
}
