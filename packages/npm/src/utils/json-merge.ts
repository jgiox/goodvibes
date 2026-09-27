import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

// MCP files and the key each tool keeps its servers under.
const MCP_KEY: Record<string, string> = { '.mcp.json': 'mcpServers', '.cursor/mcp.json': 'mcpServers', '.vscode/mcp.json': 'servers' }

// Gemini CLI and Codex keep hooks in Claude Code's shape, so their files merge like settings.json.
export const MANAGED_JSON = ['.claude/settings.json', '.gemini/settings.json', '.codex/hooks.json', ...Object.keys(MCP_KEY)]

type Json = Record<string, any>

const MARKER = /^: (goodvibes-[a-z0-9-]+);/

const markerOf = (h: Json): string | null => (typeof h?.command === 'string' ? h.command.match(MARKER)?.[1] ?? null : null)

// Digests of every hook, hook-group matcher and MCP server entry goodvibes has shipped; any other value was edited by the user.
export const SHIPPED_ENTRIES: ReadonlySet<string> = new Set([
  '07ab8d4151c71094a0713819d20c474c17d69a1be69f86bd930c3b020c55a129',
  '15ca4680e3633f97be4b79b1d1f9f03dbb8ce23e7f157d7234f28d27d5a28973',
  '29e142751f67aabb111d16c54933f5de593a3da5dd8cccb8528b080d13bfa675',
  '355685ca1c5ecbef258a972af10bd7f62d0bc82f7b7f20a0fb6bf49e12df129a',
  '38499f51ea9e5db9fd288047d3d94537ad86332e934be44bc92500181fffc7c7',
  '3d2fef907d65b791db2b34bc44f3f763d71aef49d23c9a9fcc64aea3918fa00c',
  '4870f6822b5b0622280382f92407ef51c3e28e4c165de9080cabf6dcb9e77946',
  '4a14049dc6fe432dff19455280545d2993d3b427ad66018921abba5c5fd26cd4',
  '513d492a798fdad21df076514038d36d19320e7be0c22ea82e9461e8cd12b9c7',
  '514f0478b7929a7b0c8f9965cb4b6e4987b6b854b04ab8a37c0755bec3ca9422',
  '5620af91925e35657bc43edc25782882b6f47608be013d1f7ea02590a67f4956',
  '5d736d56765c96ab251f03eef0033764730a77be1fd1282ccef92fe773f462dc',
  '5dbe89b48ee16b703d6a90996cc5d574fa52611723b9cf9c2d93faaaf2837d0c',
  '696a825876303895d5c01d2f82ea3b21be4d811b91a6b3b121ec5e1b44e7b1f7',
  '6a60486c00339810681cc24613cba330865dc845fb94b7e303872343c47e42a1',
  '6b2a26ef7f68288fc685e339af165bf3ea9193a74141c35db2ad78ab71ca6ccd',
  '6ca21b376c998611ac4a0ceae8d5132d314e1a256ee6b7774b2ea119316bcf6a',
  '6db7e8d06e41d8fb58975a9885b2995efacd7b2af153d68469d3125ca2a977b3',
  '750487d85c49212e0325ccb583e70acb3070822f29253a3ed9ec713881da8fa0',
  '768abd9c5a63b1517771db946f02bb2a0d7daf7f447775912ce65337a9636b4c',
  '84c0f35b4614d6f223c2db287caf52a812e1b7b9e12143ef7c5fd5796fb60ab5',
  '88a4bb9377426dce7572122fa1bde7cec7c94267eb29785ddcd9f116573fc2b6',
  '9f5d1d46d4e4ae3932ef2bd7386d99ac1e66d6147b56e383c9b282c1664e2191',
  'a31cbd927309a6087af5a2bb85a538888d608449069b3c48a80b2bf046e459b9',
  'd0c317fcbac4471e46d4d50a2213193931bc101ff1baea9cdfab73d6c5f72163',
  'd1f9101f73f9958aed58e7a2ee3b4a2df2f44bfd7cb9730d4b659e5adf256873',
  'd54d982f1d2d8cf260069e9dddbcac6496f53da232cd0891944b20706af8dd00',
  'd8355cdcaf5a6c4bc55aa8c84ed2353c7f021b388c819493dafe1e5a8dcfa94e',
  'd90897636c480130f19e9607cb2cc9c999ac63bbea7ab6c4790d4ed88c52e753',
  'f5a0ab2a50489f49d6ced155fbb730b852e2bcbb7c658ac159dc6a03bb1ac600',
  'f810397e8272a05ae195fe415b293da87057cf6eb918ee797d616407be9826de',
])

// Compact JSON with sorted keys, the same text Python's json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=False) writes.
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  if (v !== null && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as Json)[k])}`).join(',')}}`
  return JSON.stringify(v)
}

export function entryDigest(value: unknown): string {
  return createHash('sha256').update(canonical(value), 'utf8').digest('hex')
}

// The user changed goodvibes' hook, or the matcher of a group holding only goodvibes hooks.
function editedHook(group: Json, id: string): boolean {
  const hook = group.hooks.find((h: Json) => markerOf(h) === id)
  const ours = group.hooks.every((h: Json) => markerOf(h) !== null)
  return !SHIPPED_ENTRIES.has(entryDigest(hook)) || (ours && !SHIPPED_ENTRIES.has(entryDigest({ hook: id, matcher: group.matcher ?? null })))
}

// An empty entry holds nothing of the user's; goodvibes fills it.
function editedServer(name: string, current: Json, server: Json): boolean {
  return Object.keys(current).length > 0 && !same(current, server) && !SHIPPED_ENTRIES.has(entryDigest({ server: name, value: current }))
}

// One line per goodvibes hook or MCP server entry the user edited, which mergeManagedJson keeps as it is.
export function keptEntryLines(label: string, tpl: Json, user: unknown): string[] {
  if (!isJsonObject(user)) return []
  const lines: string[] = []
  for (const key of ['mcpServers', 'servers']) {
    for (const [name, server] of Object.entries<Json>(tpl[key] ?? {})) {
      const current = isJsonObject(user[key]) ? user[key][name] : undefined
      if (isJsonObject(current) && editedServer(name, current, server)) lines.push(`${label}: kept your edited ${key}.${name} entry; goodvibes did not replace it with its new version`)
    }
  }
  for (const [event, groups] of Object.entries<Json[]>(tpl.hooks ?? {})) {
    const userGroups = isJsonObject(user.hooks) ? user.hooks[event] : undefined
    for (const g of groups) {
      const id = hookId(g)
      const ug = id && Array.isArray(userGroups) ? userGroups.find((u: Json) => hookId(u) === id) : undefined
      if (id && ug && editedHook(ug, id)) lines.push(`${label}: kept your edited hook ${id} (${event}); goodvibes did not replace it with its new version`)
    }
  }
  return lines
}

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

// Claude Code path rules follow gitignore: `**` crosses folders, `*` stays inside one.
function pathMatches(spec: string, path: string): boolean {
  const rx = spec.split(/(\*\*|\*)/).map(t => (t === '**' ? '.*' : t === '*' ? '[^/]*' : t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('')
  return new RegExp(`^${rx}$`, 's').test(path)
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
  if (r === null) return false
  if (tool !== 'Bash') {
    if (!r.includes('*')) return pathMatches(a, r)
    return a === r || (a.endsWith('**') && !a.slice(0, -2).includes('*') && r.startsWith(a.slice(0, -2)))
  }
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
  if (tool !== 'Bash') {
    if (!a.includes('*')) return pathMatches(r, a)
    if (!r.includes('*')) return pathMatches(a, r)
    const ah = a.slice(0, a.indexOf('*'))
    const rh = r.slice(0, r.indexOf('*'))
    return ah.startsWith(rh) || rh.startsWith(ah)
  }
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
      if (isJsonObject(current) && editedServer(name, current, server)) continue // the user's own version
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
      if (idx >= 0 && editedHook(userGroups[idx], id)) continue // the user's own version
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
// Ask rules left out for a covering user allow rule; forgotten, so they come back once that allow rule is gone.
export function yieldedIds(tpl: Json, content: unknown, allows: string[]): Set<string> {
  const have = isJsonObject(content) && isJsonObject(content.permissions) && Array.isArray(content.permissions.ask) ? content.permissions.ask : []
  return new Set((tpl.permissions?.ask ?? []).filter((p: string) => !have.includes(p) && allows.some(a => covers(a, p))).map((p: string) => `ask:${p}`))
}

// cfg: the Claude Code settings folder, whose allow rules count for the project settings too.
export async function managedRecord(
  cwd: string,
  templateDir: string,
  prev: Record<string, string[]> = {},
  cfg?: string,
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
    let forget = new Set<string>()
    if (rel === '.claude/settings.json') {
      const allows = [...userAllowRules(content, tpl), ...(await fileAllowRules(join(cwd, '.claude', 'settings.local.json'), tpl))]
      if (cfg) allows.push(...(await fileAllowRules(join(cfg, 'settings.json'), tpl)))
      forget = yieldedIds(tpl, content, allows)
    }
    record[rel] = [...new Set([...(prev[rel] ?? []), ...presentIds(rel, tpl, content)])].filter(i => !forget.has(i))
  }
  return record
}
