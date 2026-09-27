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

const RULE = /^([A-Za-z]+)(?:\((.*)\))?$/s

function parseRule(rule: unknown): [string, string | null] | null {
  const m = typeof rule === 'string' ? rule.trim().match(RULE) : null
  return m ? [m[1], m[2] ?? null] : null
}

// A Bash rule's literal text before its first wildcard, and whether it is exact, a prefix (one trailing wildcard) or a glob.
function head(spec: string): [string, 'exact' | 'prefix' | 'glob'] {
  const legacy = spec.endsWith(':*') // the older prefix syntax, `git push:*`
  const body = legacy ? spec.slice(0, -2) : spec
  const i = body.indexOf('*')
  if (legacy && i === -1) return [body.trimEnd(), 'prefix']
  if (i === -1) return [body, 'exact']
  // The space in `git push *` only marks a word boundary; it does not narrow what the rule means here.
  return [body.slice(0, i).trimEnd(), i === body.length - 1 ? 'prefix' : 'glob']
}

function matches(spec: string, command: string): boolean {
  if (spec.endsWith(':*')) return command.startsWith(spec.slice(0, -2))
  return new RegExp(`^${spec.split('*').map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 's').test(command)
}

function ruleParts(allow: string, rule: string): [string, string | null, string | null] | null {
  const a = parseRule(allow)
  const r = parseRule(rule)
  return a && r && a[0] === r[0] ? [a[0], a[1], r[1]] : null
}

// True when every command `rule` matches is also matched by `allow`.
export function covers(allow: string, rule: string): boolean {
  const parts = ruleParts(allow, rule)
  if (!parts) return false
  const [tool, a, r] = parts
  if (a === null || a === '*' || a === '**') return true
  if (r === null || tool !== 'Bash') return a === r
  const [ah, ak] = head(a)
  const [rh, rk] = head(r)
  if (rk === 'exact') return matches(a, r)
  if (ak === 'prefix') return rh.startsWith(ah)
  return a === r
}

// True when at least one command could match both rules (an approximation for wildcards after the first).
export function overlaps(allow: string, rule: string): boolean {
  const parts = ruleParts(allow, rule)
  if (!parts) return false
  const [tool, a, r] = parts
  if (a === null || r === null || a === '*' || a === '**') return true
  if (tool !== 'Bash') return a === r
  const [ah, ak] = head(a)
  const [rh, rk] = head(r)
  if (ak === 'exact') return matches(r, a)
  if (rk === 'exact') return matches(a, r)
  return ah.startsWith(rh) || rh.startsWith(ah)
}

// Allow rules in a settings file that the user wrote: goodvibes' own, current or retired, never count.
export function userAllowRules(content: unknown, tpl: Json): string[] {
  const allow = isJsonObject(content) && isJsonObject(content.permissions) ? content.permissions.allow : undefined
  const ours = new Set([...(tpl.permissions?.allow ?? []), ...RETIRED_ALLOW])
  return (Array.isArray(allow) ? allow : []).filter((r): r is string => typeof r === 'string' && !ours.has(r))
}

export async function fileAllowRules(path: string, tpl: Json): Promise<string[]> {
  try {
    return userAllowRules(JSON.parse(await readFile(path, 'utf-8')), tpl)
  } catch {
    return [] // Claude Code cannot apply rules from a missing or broken file either
  }
}

// One line per user allow rule that a goodvibes deny or ask rule in `content` still beats.
export function overriddenLines(label: string, allows: string[], content: unknown, tpl: Json): string[] {
  const perms = isJsonObject(content) && isJsonObject(content.permissions) ? content.permissions : {}
  const lines: string[] = []
  for (const a of new Set(allows)) {
    for (const [kind, verb] of [['deny', 'refuses'], ['ask', 'asks before']]) {
      const have: unknown[] = Array.isArray(perms[kind]) ? perms[kind] : []
      // A deny rule is only news when the user allowed something inside it, not when their broad rule merely includes it.
      const broader = (r: string) => kind === 'deny' && covers(a, r) && !covers(r, a)
      const r = have.find((r): r is string => typeof r === 'string' && (tpl.permissions?.[kind] ?? []).includes(r) && overlaps(a, r) && !broader(r))
      if (r) {
        lines.push(
          `${label}: Claude Code still ${verb} commands your allow rule ${a} matches, because goodvibes' ${kind} rule ${r} ` +
            `is checked first. To change that, delete ${r} from ${label}; goodvibes will not add it back.`,
        )
        break
      }
    }
  }
  return lines
}

// A goodvibes ask rule that a user allow rule (in `user` or `extraAllow`) covers is not added, and removed if goodvibes installed it:
// Claude Code checks ask before allow, so it would silently override the user's choice.
export function mergeManagedJson(
  rel: string,
  tpl: Json,
  user: Json,
  installed: string[] = [],
  retireAllow = false,
  extraAllow: string[] = [],
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

  const allows = [...userAllowRules(merged, tpl), ...extraAllow]
  const covered = new Map<string, string>()
  for (const p of tpl.permissions?.ask ?? []) {
    const by = allows.find(a => covers(a, p))
    if (by) covered.set(p, by)
  }
  if (Array.isArray(merged.permissions?.ask)) {
    // Only rules goodvibes installed are dropped; an ask rule the user wrote stays.
    const drop = (p: string) => covered.has(p) && wasInstalled(`ask:${p}`)
    for (const p of merged.permissions.ask) if (drop(p)) changes.push(`- permissions.ask: ${p} (your allow rule ${covered.get(p)} covers it)`)
    merged.permissions.ask = merged.permissions.ask.filter((p: string) => !drop(p))
  }

  for (const list of ['ask', 'deny']) {
    for (const p of tpl.permissions?.[list] ?? []) {
      const have: string[] = merged.permissions?.[list] ?? []
      if (have.includes(p) || wasInstalled(`${list}:${p}`) || (list === 'ask' && covered.has(p))) continue
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
