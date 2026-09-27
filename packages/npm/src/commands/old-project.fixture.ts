import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const START = '<!-- goodvibes:start -->'
const END = '<!-- goodvibes:end -->'
// The CLAUDE.md template goodvibes 1.7.0 shipped: its block is a real released block, so goodvibes treats it as unedited.
const SHIPPED_170 = readFileSync(fileURLToPath(new URL('../../../../tests/blocks/CLAUDE-1.7.0.md', import.meta.url)), 'utf-8')
export const SHIPPED_170_BLOCK = SHIPPED_170.slice(SHIPPED_170.indexOf(START), SHIPPED_170.indexOf(END) + END.length)
export const EDITED_170_BLOCK = SHIPPED_170_BLOCK.replace('## Engineering Rules', '## Engineering Rules\n\n- My own rule: pushing to my fork needs no confirmation.')
export const NEWER_TEMPLATE = `# CLAUDE.md\n\n${START}\n# goodvibes: v9.9.9\n\nnew rules\n${END}\n`

export const OLD_CLAUDE = `# CLAUDE.md\n\nmy notes\n\n${SHIPPED_170_BLOCK}\n\nmore mine\n`
export const EDITED_CLAUDE = `# CLAUDE.md\n\nmy notes\n\n${EDITED_170_BLOCK}\n\nmore mine\n`
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex')

// A project set up by goodvibes 1.7 (project scope): rules block in CLAUDE.md, skills copied into the project.
export function oldProject(proj: string, scope?: string, claude: string = OLD_CLAUDE): void {
  writeFileSync(join(proj, 'CLAUDE.md'), claude)
  const files: Record<string, string> = { 'CLAUDE.md': sha(claude) }
  for (const name of ['caveman', 'cavecrew', 'mine']) {
    mkdirSync(join(proj, '.claude', 'skills', name), { recursive: true })
    writeFileSync(join(proj, '.claude', 'skills', name, 'SKILL.md'), `${name} as shipped\n`)
    files[`.claude/skills/${name}/SKILL.md`] = sha(`${name} as shipped\n`)
  }
  writeFileSync(join(proj, '.claude', 'skills', 'mine', 'SKILL.md'), 'my edit\n')
  writeFileSync(join(proj, '.goodvibes.json'), JSON.stringify({ version: '1.7.1', files, ...(scope ? { scope } : {}) }))
}
