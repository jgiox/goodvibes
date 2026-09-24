import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { execa } from 'execa'
import { listTemplateFiles } from './copy-templates.js'
import { readManifest, type Manifest, MANIFEST_PATH } from './write-manifest.js'
import { mergeManagedJson, presentIds, isJsonObject } from '../utils/json-merge.js'
import { writeFileAtomic } from '../utils/fs-safe.js'
import { goodvibesBlock } from '../utils/scope.js'
import { versionGte } from '../utils/sentinel-merge.js'

const CONTEXT7_URL = 'https://mcp.context7.com/mcp'

export function claudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude')
}

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')

export type McpStatus = { status: 'registered' | 'already-registered' | 'skipped' | 'failed'; reason?: string }

export async function registerContext7(dryRun: boolean): Promise<McpStatus> {
  try {
    const { stdout } = await execa('claude', ['mcp', 'list'], { timeout: 10_000 })
    if (/^context7\b/m.test(stdout)) return { status: 'already-registered' }
    if (dryRun) return { status: 'skipped', reason: 'dry run' }
    await execa('claude', ['mcp', 'add', '--transport', 'http', '--scope', 'user', 'context7', CONTEXT7_URL], { timeout: 10_000 })
    return { status: 'registered' }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return { status: 'skipped', reason: `claude CLI not found; run: claude mcp add --transport http --scope user context7 ${CONTEXT7_URL}` }
    }
    return { status: 'failed', reason: (e as Error).message.split('\n')[0] }
  }
}

export type CliStatus = { status: 'installed' | 'already-installed' | 'failed' | 'skipped'; reason?: string }

export async function ensureGlobalCli(version: string, dryRun: boolean): Promise<CliStatus> {
  try {
    const { stdout } = await execa('npm', ['ls', '-g', 'goodvibes-cli', '--depth=0', '--json'], { reject: false, timeout: 30_000 })
    const current = JSON.parse(stdout || '{}').dependencies?.['goodvibes-cli']?.version
    // Never downgrade: an older npx run must not replace a newer global install.
    if (current && versionGte(current, version)) return { status: 'already-installed' }
    if (dryRun) return { status: 'skipped', reason: `dry run; would run npm install -g goodvibes-cli@${version}` }
    await execa('npm', ['install', '-g', `goodvibes-cli@${version}`], { timeout: 120_000 })
    return { status: 'installed' }
  } catch (e) {
    const msg = (e as Error).message
    const hint = /EACCES|permission/i.test(msg)
      ? 'npm cannot write its global folder; see https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally'
      : msg.split('\n')[0]
    return { status: 'failed', reason: `${hint}. Install manually: npm install -g goodvibes-cli@${version}` }
  }
}

export type GlobalResult = {
  configDir: string
  written: string[]
  kept: string[]
  removed: string[]
  settingsChanges: string[]
  settingsError?: string
}

// Writes goodvibes-owned files into the Claude Code user config; a file the user edited since goodvibes wrote it is kept.
export async function applyGlobalConfig(templateDir: string, version: string, dryRun: boolean): Promise<GlobalResult> {
  const cfg = claudeConfigDir()
  const prev: Manifest | null = await readManifest(cfg)
  const owned: [string, string][] = [['rules/goodvibes.md', goodvibesBlock(await readFile(join(templateDir, 'CLAUDE.md'), 'utf-8'))]]
  for (const rel of (await listTemplateFiles(templateDir)).map(f => f.split('\\').join('/'))) {
    if (rel.startsWith('.claude/skills/')) owned.push([rel.slice('.claude/'.length), await readFile(join(templateDir, rel), 'utf-8')])
  }

  const result: GlobalResult = { configDir: cfg, written: [], kept: [], removed: [], settingsChanges: [] }
  const files: Record<string, string> = {}
  for (const [rel, content] of owned) {
    const dest = join(cfg, rel)
    const recorded = prev?.files[rel]
    // Tracked but gone: the user deleted it, so it is neither rewritten nor kept in the manifest.
    if (recorded && !existsSync(dest)) {
      result.removed.push(rel)
      continue
    }
    if (existsSync(dest) && sha(await readFile(dest, 'utf-8')) !== recorded) {
      result.kept.push(rel)
      if (recorded) files[rel] = recorded
      continue
    }
    result.written.push(rel)
    files[rel] = sha(content)
    if (!dryRun) {
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, content, 'utf-8')
    }
  }

  const tpl = JSON.parse(await readFile(join(templateDir, '.claude', 'settings.json'), 'utf-8'))
  const settingsPath = join(cfg, 'settings.json')
  let managed = prev?.managed ?? {}
  let user: unknown
  try {
    user = existsSync(settingsPath) ? JSON.parse(await readFile(settingsPath, 'utf-8')) : {}
    if (!isJsonObject(user)) result.settingsError = `${settingsPath}: not a JSON object; left unchanged, fix it and re-run`
  } catch (e) {
    result.settingsError = `${settingsPath}: not valid JSON (${(e as Error).message}); left unchanged, fix it and re-run`
  }
  if (isJsonObject(user)) {
    const { merged, changes } = mergeManagedJson('.claude/settings.json', tpl, user, managed['settings.json'])
    result.settingsChanges = changes
    if (!dryRun && changes.length > 0) {
      await mkdir(cfg, { recursive: true })
      await writeFileAtomic(settingsPath, JSON.stringify(merged, null, 2) + '\n')
    }
    managed = { ...managed, 'settings.json': [...new Set([...(managed['settings.json'] ?? []), ...presentIds('.claude/settings.json', tpl, merged)])] }
  }

  if (!dryRun) {
    await mkdir(cfg, { recursive: true })
    await writeFileAtomic(join(cfg, MANIFEST_PATH), JSON.stringify({ version, scope: 'global', files, managed }, null, 2) + '\n')
  }
  return result
}

export function formatGlobal(g: GlobalResult, cli: CliStatus | undefined, c7: McpStatus | undefined): string {
  const lines = [
    ...g.written.map(f => `written: ${f}`),
    ...g.kept.map(f => `kept (you edited it): ${f}`),
    ...g.removed.map(f => `${f}: removed by you, not re-added (run goodvibes init to restore)`),
    ...g.settingsChanges.map(c => `settings.json ${c}`),
    ...(g.settingsError ? [`settings.json not changed: ${g.settingsError}`] : []),
  ]
  if (c7) lines.push(`context7 MCP: ${c7.status}${c7.reason ? ` (${c7.reason})` : ''}`)
  if (cli) lines.push(`goodvibes CLI: ${cli.status}${cli.reason ? ` (${cli.reason})` : ''}`)
  return lines.join('\n') || 'already up to date'
}
