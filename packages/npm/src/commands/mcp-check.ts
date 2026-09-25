import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { CheckResult } from './doctor.js'

type Server = { command?: unknown; args?: unknown; url?: unknown; env?: unknown; headers?: unknown }
type Problem = [string, string]

const SECRET_KEY = /key|token|secret|password|authorization/i
const VAR_REF = /\$\{[^}]+\}/
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

export function claudeJsonPath(): string {
  const dir = process.env.CLAUDE_CONFIG_DIR
  if (!dir) return join(homedir(), '.claude.json')
  const dotted = join(dir, '.claude.json')
  return existsSync(dotted) ? dotted : join(dir, 'claude.json')
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

const UVX_VALUE_OPTIONS = new Set(['-p', '--python', '--with', '--index', '--index-url', '--default-index', '--extra-index-url'])

function packageArg(args: string[], uvx: boolean): string | undefined {
  const named = uvx ? ['--from'] : ['-p', '--package']
  for (let i = 0; i < args.length; i++) {
    const eq = args[i].indexOf('=')
    if (named.includes(args[i])) return args[i + 1]
    if (eq > 0 && named.includes(args[i].slice(0, eq))) return args[i].slice(eq + 1)
  }
  for (let i = 0; i < args.length; i++) {
    if (uvx && UVX_VALUE_OPTIONS.has(args[i])) i++
    else if (!args[i].startsWith('-')) return args[i]
  }
  return undefined
}

const pinnedAfter = (pkg: string, sep: string, from: number): boolean => {
  const at = pkg.indexOf(sep, from)
  return at >= 0 && pkg.slice(at + sep.length) !== ''
}

function problems(s: Server): Problem[] {
  const out: Problem[] = []
  const raw = typeof s.command === 'string' ? s.command : ''
  const cmd = (raw.split(/[\\/]/).pop() ?? '').replace(/\.(cmd|exe)$/i, '')
  const isPath = /^[./]/.test(raw) || /[\\/]/.test(raw)
  const args = Array.isArray(s.args) ? s.args.filter((a): a is string => typeof a === 'string') : []

  if (cmd === 'sh' || cmd === 'bash') {
    const script = args[args.indexOf('-c') + 1] ?? ''
    if (args.includes('-c') && /curl|wget/.test(script) && script.includes('|')) {
      out.push(['pipes a download into a shell', 'Install the tool once from a release you trust and run it directly.'])
    }
  }

  const launcher = isPath ? null : cmd === 'npx' || cmd === 'bunx' || cmd === 'uvx' ? cmd : cmd === 'pnpm' && args[0] === 'dlx' ? 'pnpm dlx' : null
  if (launcher) {
    // `pkg@latest` still fetches whatever is newest, so it is reported as the bare, unpinned name.
    const pkg = packageArg(launcher === 'pnpm dlx' ? args.slice(1) : args, launcher === 'uvx')?.replace(/@latest$/, '')
    if (pkg && launcher === 'uvx' && !pinnedAfter(pkg, '==', 0) && !pinnedAfter(pkg, '@', 0)) {
      out.push([`uvx fetches unpinned ${pkg} on every run`, `Pin a version: ${pkg}==<version>.`])
    } else if (pkg && launcher !== 'uvx' && !pinnedAfter(pkg, '@', 1)) {
      out.push([`${launcher} fetches unpinned ${pkg} on every run`, `Pin a version: ${pkg}@<version>.`])
    }
  }

  if (typeof s.url === 'string' && /^http:\/\//i.test(s.url)) {
    const host = URL.canParse(s.url) ? new URL(s.url).hostname.replace(/^\[|\]$/g, '') : ''
    if (host && !LOCAL_HOSTS.has(host)) out.push([`uses plain http to ${host}`, 'Use an https:// URL.'])
  }

  for (const field of ['env', 'headers'] as const) {
    const values = s[field]
    if (!isObject(values)) continue
    for (const [key, value] of Object.entries(values)) {
      if (SECRET_KEY.test(key) && typeof value === 'string' && value.length > 16 && !VAR_REF.test(value)) {
        out.push([`literal secret in ${field}.${key}`, 'Move it to an environment variable and reference ${VAR}.'])
      }
    }
  }
  return out
}

function readJson(path: string): { data?: unknown; warning?: CheckResult } {
  let raw: string
  try {
    raw = readFileSync(path, 'utf-8')
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code ?? (e as Error).message
    if (code === 'ENOENT') return {}
    return { warning: { label: `${path} could not be read (${code}); its MCP servers were not checked`, status: 'warn' } }
  }
  try {
    return { data: JSON.parse(raw) }
  } catch {
    return { warning: { label: `${path} is not valid JSON; its MCP servers were not checked`, status: 'warn' } }
  }
}

export function checkMcpServers(cwd: string): CheckResult[] {
  const results: CheckResult[] = []
  const report = (servers: unknown, scope: string) => {
    if (!isObject(servers)) return
    for (const [name, server] of Object.entries(servers)) {
      if (!isObject(server)) continue
      const found = problems(server)
      if (found.length === 0) results.push({ label: `MCP ${name} (${scope})`, status: 'ok' })
      for (const [what, remedy] of found) results.push({ label: `MCP ${name} (${scope}): ${what}`, status: 'warn', remedy })
    }
  }

  const user = readJson(claudeJsonPath())
  if (user.warning) results.push(user.warning)
  if (isObject(user.data)) {
    report(user.data.mcpServers, 'user')
    const projects = user.data.projects
    if (isObject(projects) && isObject(projects[cwd])) report(projects[cwd].mcpServers, 'local')
  }

  const project = readJson(join(cwd, '.mcp.json'))
  if (project.warning) results.push(project.warning)
  if (isObject(project.data)) report(project.data.mcpServers, 'project')
  return results
}
