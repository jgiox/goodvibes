import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'

const SENTINEL_START = '<!-- goodvibes:start -->'
const SENTINEL_END = '<!-- goodvibes:end -->'

export type Scope = 'global' | 'project'

// Rules, skills and context7 live in the user config in global scope, so a project must not get its own copy (it would load twice).
export const GLOBAL_OWNED = (rel: string): boolean => {
  const p = rel.split('\\').join('/')
  return p === '.mcp.json' || p === '.claude/skills' || p.startsWith('.claude/skills/')
}

// --minimal skips docs and the CI side of .github, but Copilot reads its rules and hooks only from .github.
export const MINIMAL_SKIPPED = (rel: string): boolean => {
  const p = rel.split('\\').join('/')
  if (p === 'docs' || p.startsWith('docs/')) return true
  return p.startsWith('.github/') && p !== '.github/copilot-instructions.md' && p !== '.github/hooks' && !p.startsWith('.github/hooks/')
}

// cwd is already a real path, so the other side is compared by its real path too (it may be a symlink).
const realPath = (p: string): string => {
  try {
    return realpathSync(p)
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    return resolve(p)
  }
}
export const samePath = (a: string, b: string): boolean => realPath(a) === realPath(b)

export function goodvibesBlock(claudeTemplate: string): string {
  const start = claudeTemplate.indexOf(SENTINEL_START)
  const end = claudeTemplate.indexOf(SENTINEL_END)
  if (start === -1 || end === -1) throw new Error('templates/CLAUDE.md has no goodvibes block')
  return claudeTemplate.slice(start, end + SENTINEL_END.length) + '\n'
}

export function projectStub(claudeTemplate: string): string {
  return claudeTemplate.slice(0, claudeTemplate.indexOf(SENTINEL_START)).trimEnd() + '\n'
}
