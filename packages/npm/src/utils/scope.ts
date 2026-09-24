const SENTINEL_START = '<!-- goodvibes:start -->'
const SENTINEL_END = '<!-- goodvibes:end -->'

export type Scope = 'global' | 'project'

// Rules, skills and context7 live in the user config in global scope, so a project must not get its own copy (it would load twice).
export const GLOBAL_OWNED = (rel: string): boolean => {
  const p = rel.split('\\').join('/')
  return p === '.mcp.json' || p === '.claude/skills' || p.startsWith('.claude/skills/')
}

export function goodvibesBlock(claudeTemplate: string): string {
  const start = claudeTemplate.indexOf(SENTINEL_START)
  const end = claudeTemplate.indexOf(SENTINEL_END)
  if (start === -1 || end === -1) throw new Error('templates/CLAUDE.md has no goodvibes block')
  return claudeTemplate.slice(start, end + SENTINEL_END.length) + '\n'
}

export function projectStub(claudeTemplate: string): string {
  return claudeTemplate.slice(0, claudeTemplate.indexOf(SENTINEL_START)).trimEnd() + '\n'
}
