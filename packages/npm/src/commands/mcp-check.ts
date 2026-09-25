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

function packageArg(args: string[]): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '-p' || a === '--package' || a === '--from') return args[i + 1]
    if (a.startsWith('--package=') || a.startsWith('--from=')) return a.slice(a.indexOf('=') + 1)
    if (!a.startsWith('-')) return a
  }
  return undefined
}

function problems(s: Server): Problem[] {
  const out: Problem[] = []
  const cmd = typeof s.command === 'string' ? (s.command.split(/[\\/]/).pop() ?? '').replace(/\.(cmd|exe)$/i, '') : ''
  const args = Array.isArray(s.args) ? s.args.filter((a): a is string => typeof a === 'string') : []

  if (cmd === 'sh' || cmd === 'bash') {
    const script = args[args.indexOf('-c') + 1] ?? ''
    if (args.includes('-c') && /curl|wget/.test(script) && script.includes('|')) {
      out.push(['pipes a download into a shell', 'Install the tool once from a release you trust and run it directly.'])
    }
  }

  const launcher = cmd === 'npx' || cmd === 'bunx' || cmd === 'uvx' ? cmd : cmd === 'pnpm' && args[0] === 'dlx' ? 'pnpm dlx' : null
  if (launcher) {
    const pkg = packageArg(launcher === 'pnpm dlx' ? args.slice(1) : args)
    if (pkg && launcher === 'uvx' && !pkg.includes('==') && !pkg.includes('@')) {
      out.push([`uvx fetches unpinned ${pkg} on every run`, `Pin a version: ${pkg}==<version>.`])
    } else if (pkg && launcher !== 'uvx' && pkg.lastIndexOf('@') <= 0) {
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

// Unreadable or missing files are skipped silently; only malformed JSON is worth a warning.
function readJson(path: string): { data?: unknown; warning?: CheckResult } {
  let raw: string
  try {
    raw = readFileSync(path, 'utf-8')
  } catch {
    return {}
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
