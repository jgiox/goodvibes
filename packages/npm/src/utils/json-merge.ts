import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const MANAGED_JSON = ['.claude/settings.json', '.mcp.json']

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

// Ids of every goodvibes-managed key the template defines for this file.
export function managedIds(rel: string, tpl: Json): string[] {
  const ids: string[] = []
  if (rel === '.mcp.json') {
    for (const name of Object.keys(tpl.mcpServers ?? {})) ids.push(`mcp:${name}`)
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
    if (kind === 'mcp') return rest in (content.mcpServers ?? {})
    if (kind === 'hook') {
      const [event, hid] = splitFirst(rest)
      return (content.hooks?.[event] ?? []).some((g: Json) => hookId(g) === hid)
    }
    return (content.permissions?.[kind] ?? []).includes(rest)
  })
}

// An id in `installed` but absent from `user` was removed by the user and stays removed.
export function mergeManagedJson(
  rel: string,
  tpl: Json,
  user: Json,
  installed: string[] = [],
): { merged: Json; changes: string[] } {
  const merged: Json = structuredClone(user)
  const changes: string[] = []
  const wasInstalled = (id: string) => installed.includes(id)

  if (rel === '.mcp.json') {
    for (const [name, server] of Object.entries<Json>(tpl.mcpServers ?? {})) {
      const current = merged.mcpServers?.[name]
      if (current) {
        const next = { ...current, ...server }
        if (!same(current, next)) {
          merged.mcpServers[name] = next
          changes.push(`~ mcpServers.${name}`)
        }
      } else if (!wasInstalled(`mcp:${name}`)) {
        merged.mcpServers = { ...(merged.mcpServers ?? {}), [name]: server }
        changes.push(`+ mcpServers.${name}`)
      }
    }
    return { merged, changes }
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
        const next = { ...ug, hooks: ug.hooks.map((h: Json) => (markerOf(h) === id ? tplHook : h)) }
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
    if (!isJsonObject(content)) continue
    const tpl = JSON.parse(await readFile(tplPath, 'utf-8'))
    record[rel] = [...new Set([...(prev[rel] ?? []), ...presentIds(rel, tpl, content)])]
  }
  return record
}
