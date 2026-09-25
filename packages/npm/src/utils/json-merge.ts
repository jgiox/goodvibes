import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// MCP files and the key each tool keeps its servers under.
const MCP_KEY: Record<string, string> = { '.mcp.json': 'mcpServers', '.cursor/mcp.json': 'mcpServers', '.vscode/mcp.json': 'servers' }

// Gemini CLI and Codex keep hooks in Claude Code's shape, so their files merge like settings.json.
export const MANAGED_JSON = ['.claude/settings.json', '.gemini/settings.json', '.codex/hooks.json', ...Object.keys(MCP_KEY)]

type Json = Record<string, any>

const MARKER = /^: (goodvibes-[a-z0-9-]+);/

const markerOf = (h: Json): string | null => (typeof h?.command === 'string' ? h.command.match(MARKER)?.[1] ?? null : null)

function hookId(group: Json): string | null {
  for (const h of group?.hooks ?? []) {
    const id = markerOf(h)
    if (id) return id
  }
  return null
}

export const isJsonObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

// The merge reads and extends these containers, so a wrong type would crash it or corrupt the file.
export function shapeError(rel: string, content: Json): string | null {
  const obj = (v: unknown, path: string) => (v == null || isJsonObject(v) ? null : `"${path}" is not a JSON object`)
  const arr = (v: unknown, path: string) => (v == null || Array.isArray(v) ? null : `"${path}" is not a JSON array`)
  const key = MCP_KEY[rel]
  if (key) {
    const servers = content[key]
    return obj(servers, key) ?? Object.entries<unknown>(servers ?? {}).map(([n, v]) => obj(v, `${key}.${n}`)).find(Boolean) ?? null
  }
  const problems = [obj(content.permissions, 'permissions'), obj(content.hooks, 'hooks')]
  for (const list of ['allow', 'ask', 'deny']) problems.push(arr(content.permissions?.[list], `permissions.${list}`))
  for (const [event, groups] of Object.entries<unknown>(isJsonObject(content.hooks) ? content.hooks : {})) {
    problems.push(arr(groups, `hooks.${event}`))
    if (Array.isArray(groups)) groups.forEach((g, i) => problems.push(obj(g, `hooks.${event}[${i}]`) ?? arr(g?.hooks, `hooks.${event}[${i}].hooks`)))
  }
  return problems.find(Boolean) ?? null
}

// Ids of every goodvibes-managed key the template defines for this file.
export function managedIds(rel: string, tpl: Json): string[] {
  const ids: string[] = []
  const key = MCP_KEY[rel]
  if (key) {
    for (const name of Object.keys(tpl[key] ?? {})) ids.push(`mcp:${name}`)
    return ids
  }
  for (const list of ['ask', 'deny']) {
    for (const p of tpl.permissions?.[list] ?? []) ids.push(`${list}:${p}`)
  }
  for (const [event, groups] of Object.entries<Json[]>(tpl.hooks ?? {})) {
    for (const g of groups) {
      const id = hookId(g)
      if (id) ids.push(`hook:${event}:${id}`)
    }
  }
  return ids
}

// Managed ids currently present in a file's content.
export function presentIds(rel: string, tpl: Json, content: Json): string[] {
  const splitFirst = (s: string): [string, string] => {
    const i = s.indexOf(':')
    return [s.slice(0, i), s.slice(i + 1)]
  }
  return managedIds(rel, tpl).filter(id => {
    const [kind, rest] = splitFirst(id)
    if (kind === 'mcp') return rest in (content[MCP_KEY[rel]] ?? {})
    if (kind === 'hook') {
      const [event, hid] = splitFirst(rest)
      return (content.hooks?.[event] ?? []).some((g: Json) => hookId(g) === hid)
    }
    return (content.permissions?.[kind] ?? []).includes(rest)
  })
}

// An id in `installed` but absent from `user` was removed by the user and stays removed.
// Allow rules goodvibes shipped earlier: up to 1.9.1 they auto-approved running arbitrary code; Write(**) did nothing and made Claude Code warn.
// Deny rules goodvibes shipped up to 1.10.0: they prefix-match --force-with-lease, so its ask rule never applied.
export const RETIRED_DENY = ['Bash(git push --force*)', 'Bash(git push * --force*)']

export const RETIRED_ALLOW = ['Bash(npm install*)', 'Bash(npm run*)', 'Bash(npx*)', 'Bash(pip install*)', 'Bash(uv*)', 'Bash(python*)', 'Bash(node*)', 'Bash(git restore *)', 'Write(**)']

export function mergeManagedJson(
  rel: string,
  tpl: Json,
  user: Json,
  installed: string[] = [],
  retireAllow = false,
): { merged: Json; changes: string[] } {
  const merged: Json = structuredClone(user)
  const changes: string[] = []
  const wasInstalled = (id: string) => installed.includes(id)

  const key = MCP_KEY[rel]
  if (key) {
    for (const [name, server] of Object.entries<Json>(tpl[key] ?? {})) {
      const current = merged[key]?.[name]
      if (current) {
        const next = { ...current, ...server }
        if (!same(current, next)) {
          merged[key][name] = next
          changes.push(`~ ${key}.${name}`)
        }
      } else if (!wasInstalled(`mcp:${name}`)) {
        merged[key] = { ...(merged[key] ?? {}), [name]: server }
        changes.push(`+ ${key}.${name}`)
      }
    }
    return { merged, changes }
  }

  if (retireAllow && Array.isArray(merged.permissions?.allow)) {
    const keep = merged.permissions.allow.filter((p: string) => !RETIRED_ALLOW.includes(p))
    for (const p of merged.permissions.allow) if (RETIRED_ALLOW.includes(p)) changes.push(`- permissions.allow: ${p}`)
    merged.permissions.allow = keep
  }

  if (Array.isArray(merged.permissions?.deny)) {
    // Only rules goodvibes installed are retired; a copy the user wrote stays.
    const drop = (p: string) => RETIRED_DENY.includes(p) && wasInstalled(`deny:${p}`)
    for (const p of merged.permissions.deny) if (drop(p)) changes.push(`- permissions.deny: ${p}`)
    merged.permissions.deny = merged.permissions.deny.filter((p: string) => !drop(p))
  }

  for (const list of ['ask', 'deny']) {
    for (const p of tpl.permissions?.[list] ?? []) {
      const have: string[] = merged.permissions?.[list] ?? []
      if (have.includes(p) || wasInstalled(`${list}:${p}`)) continue
      merged.permissions = { ...(merged.permissions ?? {}), [list]: [...have, p] }
      changes.push(`+ permissions.${list}: ${p}`)
    }
  }

  for (const [event, groups] of Object.entries<Json[]>(tpl.hooks ?? {})) {
    for (const g of groups) {
      const id = hookId(g)
      if (!id) continue
      const userGroups: Json[] = merged.hooks?.[event] ?? []
      const idx = userGroups.findIndex(ug => hookId(ug) === id)
      if (idx >= 0) {
        // Only the marked hook is ours; the user's other hooks and fields in that group stay.
        const ug = userGroups[idx]
        const tplHook = g.hooks.find((h: Json) => markerOf(h) === id)
        // The matcher is refreshed only in a group holding nothing but our hook; the user's own hooks keep their routing.
        const ours = 'matcher' in g && ug.hooks.every((h: Json) => markerOf(h) === id)
        const next = { ...ug, ...(ours ? { matcher: g.matcher } : {}), hooks: ug.hooks.map((h: Json) => (markerOf(h) === id ? tplHook : h)) }
        if (!same(ug, next)) {
          userGroups[idx] = next
          changes.push(`~ hooks.${event}: ${id}`)
        }
      } else if (!wasInstalled(`hook:${event}:${id}`)) {
        merged.hooks = { ...(merged.hooks ?? {}), [event]: [...userGroups, g] }
        changes.push(`+ hooks.${event}: ${id}`)
      }
    }
  }
  return { merged, changes }
}

// Keeps previously installed ids so a user's deliberate removal survives later updates.
export async function managedRecord(
  cwd: string,
  templateDir: string,
  prev: Record<string, string[]> = {},
): Promise<Record<string, string[]>> {
  const record: Record<string, string[]> = { ...prev }
  for (const rel of MANAGED_JSON) {
    const tplPath = join(templateDir, rel)
    const destPath = join(cwd, rel)
    if (!existsSync(tplPath) || !existsSync(destPath)) continue
    let content: unknown
    try {
      content = JSON.parse(await readFile(destPath, 'utf-8'))
    } catch {
      continue // unparseable user file: keep the previous record rather than guess
    }
    if (!isJsonObject(content) || shapeError(rel, content)) continue
    const tpl = JSON.parse(await readFile(tplPath, 'utf-8'))
    record[rel] = [...new Set([...(prev[rel] ?? []), ...presentIds(rel, tpl, content)])]
  }
  return record
}
