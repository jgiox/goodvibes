import type { Command } from 'commander'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { claudeConfigDir } from '../steps/global-setup.js'

export type Totals = { input: number; output: number; cacheRead: number; cacheCreation: number; cacheHitRatio: number; peakContext: number }
export type SessionUsage = { id: string; file: string; mtime: string } & Totals

const DAY_MS = 86_400_000
const NEAR_LIMIT = 160_000
const FOOTER = "Claude Code's log format is internal and can change; these numbers are best effort."

export const projectFolderName = (cwd: string): string => cwd.replace(/[^A-Za-z0-9]/g, '-')

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const ratio = (t: Omit<Totals, 'cacheHitRatio' | 'peakContext'>): number => {
  const read = t.input + t.cacheRead + t.cacheCreation
  return read > 0 ? t.cacheRead / read : 0
}

// Only token counts are read; message content is never stored or printed.
export function summarizeTranscript(text: string): Totals | null {
  const byId = new Map<string, Record<string, unknown>>()
  let anonymous = 0
  for (const line of text.split('\n')) {
    let entry: any
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    const usage = entry?.message?.usage
    if (entry?.type !== 'assistant' || !usage || typeof usage !== 'object') continue
    // Claude Code logs one line per content block of a message; the last one carries the final output count.
    const key = typeof entry.message.id === 'string' ? entry.message.id : `\0${anonymous++}`
    const prev = byId.get(key)
    if (!prev || num(usage.output_tokens) > num(prev.output_tokens)) byId.set(key, usage)
  }
  if (byId.size === 0) return null
  const t = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, peakContext: 0 }
  for (const u of byId.values()) {
    const input = num(u.input_tokens), cacheRead = num(u.cache_read_input_tokens), cacheCreation = num(u.cache_creation_input_tokens)
    t.input += input
    t.output += num(u.output_tokens)
    t.cacheRead += cacheRead
    t.cacheCreation += cacheCreation
    t.peakContext = Math.max(t.peakContext, input + cacheRead + cacheCreation)
  }
  return { input: t.input, output: t.output, cacheRead: t.cacheRead, cacheCreation: t.cacheCreation, cacheHitRatio: ratio(t), peakContext: t.peakContext }
}

function totalsOf(sessions: SessionUsage[]): Totals {
  const t = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }
  for (const s of sessions) {
    t.input += s.input
    t.output += s.output
    t.cacheRead += s.cacheRead
    t.cacheCreation += s.cacheCreation
  }
  return { ...t, cacheHitRatio: ratio(t), peakContext: Math.max(0, ...sessions.map(s => s.peakContext)) }
}

const errCode = (e: unknown): string => (e as NodeJS.ErrnoException).code ?? (e as Error).message

export function findSessions(opts: { all: boolean; days: number; cwd: string; now: number }): { sessions: SessionUsage[]; problems: string[]; missing?: string } {
  const root = join(claudeConfigDir(), 'projects')
  const problems: string[] = []
  if (!existsSync(root)) return { sessions: [], problems, missing: `No Claude Code session logs found in ${root}. They appear after you use Claude Code.` }

  let folders: string[]
  if (opts.all) {
    try {
      folders = readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => join(root, d.name))
    } catch (e) {
      return { sessions: [], problems, missing: `Could not read ${root} (${errCode(e)}).` }
    }
  } else {
    const dir = join(root, projectFolderName(opts.cwd))
    if (!existsSync(dir)) return { sessions: [], problems, missing: `No Claude Code sessions found for this project (looked in ${dir}). Run goodvibes usage --all to see every project.` }
    folders = [dir]
  }

  const since = opts.now - opts.days * DAY_MS
  const sessions: SessionUsage[] = []
  for (const dir of folders) {
    let names: string[]
    try {
      names = readdirSync(dir).filter(n => n.endsWith('.jsonl'))
    } catch (e) {
      problems.push(`Skipped ${dir}: could not read it (${errCode(e)}).`)
      continue
    }
    for (const name of names) {
      const file = join(dir, name)
      try {
        const mtimeMs = statSync(file).mtimeMs
        if (mtimeMs < since) continue
        const totals = summarizeTranscript(readFileSync(file, 'utf-8'))
        if (totals) sessions.push({ id: name.slice(0, -'.jsonl'.length), file, mtime: new Date(mtimeMs).toISOString(), ...totals })
      } catch (e) {
        problems.push(`Skipped ${file}: could not read it (${errCode(e)}).`)
      }
    }
  }
  sessions.sort((a, b) => b.mtime.localeCompare(a.mtime) || a.id.localeCompare(b.id))
  return { sessions, problems }
}

const commas = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const percent = (r: number): string => `${Math.floor(r * 100)}%`
const localDate = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const columns = (first: string, total: string, hit: string, peak: string): string => first + total.padStart(12) + hit.padStart(11) + peak.padStart(14)

export function registerUsageCommand(program: Command): void {
  program
    .command('usage')
    .description('Show token use from local Claude Code session logs (offline, best effort)')
    .option('--all', 'Every project, not just this one')
    .option('--days <n>', 'Only sessions changed in the last N days', '7')
    .option('--json', 'Machine-readable output')
    .action((options: { all?: boolean; days: string; json?: boolean }) => {
      if (!/^\d+$/.test(options.days) || Number(options.days) < 1) {
        console.error(`--days must be a whole number of 1 or more (got "${options.days}").`)
        process.exit(1)
        return
      }
      const days = Number(options.days)
      const all = !!options.all
      const { sessions, problems, missing } = findSessions({ all, days, cwd: process.cwd(), now: Date.now() })
      const totals = totalsOf(sessions)
      // JSON mode keeps stdout parseable, so every human message goes to stderr.
      const say = options.json ? console.error : console.log
      for (const p of problems) console.error(p)

      if (options.json) {
        console.log(JSON.stringify({ sessions, totals }, null, 2))
        if (missing) say(missing)
        say(FOOTER)
        return
      }
      if (missing) {
        say(missing)
        say(FOOTER)
        return
      }
      if (sessions.length === 0) {
        say(`No Claude Code sessions with token usage in the last ${days} day(s).`)
        say(FOOTER)
        return
      }

      const shown = sessions.slice(0, 10)
      const sum = (t: Totals) => commas(t.input + t.output + t.cacheRead + t.cacheCreation)
      say(`Token usage for ${all ? 'all projects' : 'this project'}, last ${days} days: ${sessions.length} session(s)${sessions.length > shown.length ? `, showing the ${shown.length} most recent` : ''}`)
      say('')
      say(columns('Date'.padEnd(12) + 'Session'.padEnd(10), 'Total tokens', 'Cache hit', 'Peak context'))
      for (const s of shown) {
        say(columns(localDate(s.mtime).padEnd(12) + s.id.slice(0, 8).padEnd(10), sum(s), percent(s.cacheHitRatio), commas(s.peakContext)) + (s.peakContext > NEAR_LIMIT ? ' !' : ''))
      }
      say(columns('Total'.padEnd(22), sum(totals), percent(totals.cacheHitRatio), commas(totals.peakContext)))
      say(`Input ${commas(totals.input)}, output ${commas(totals.output)}, cache read ${commas(totals.cacheRead)}, cache creation ${commas(totals.cacheCreation)}`)
      say('')
      if (shown.some(s => s.peakContext > NEAR_LIMIT)) say('! near the context limit of most Claude models (200k); starting a fresh session is cheaper')
      say(FOOTER)
    })
}
