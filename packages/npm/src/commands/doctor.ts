import type { Command } from 'commander'
import { note, outro } from '@clack/prompts'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { execa } from 'execa'
import { packageVersion } from '../utils/version.js'
import { claudeConfigDir } from '../steps/global-setup.js'
import { MANIFEST_PATH, parseManifest } from '../steps/write-manifest.js'
import { checkMcpServers } from './mcp-check.js'

// ponytail: not imported from sentinel-merge.ts — those constants are module-private
const SENTINEL_START = '<!-- goodvibes:start -->'
const SENTINEL_END = '<!-- goodvibes:end -->'

export type Status = 'ok' | 'warn' | 'fail' | 'skip'
export type CheckResult = { label: string; status: Status; remedy?: string }

const SYMBOL: Record<Status, string> = { ok: '✓', warn: '!', fail: '✗', skip: '-' }
const okOr = (ok: boolean, status: Status): Status => (ok ? 'ok' : status)

export const formatCheck = (r: CheckResult): string => `${SYMBOL[r.status]} ${r.label}`

export function summaryLine(results: CheckResult[]): string {
  const fails = results.filter(r => r.status === 'fail').length
  const warns = results.filter(r => r.status === 'warn').length
  if (fails) return `Not ready: ${fails} problem(s).`
  return warns ? `Ready, with ${warns} warning(s).` : 'Ready.'
}

async function checkHeadroom(): Promise<CheckResult> {
  try {
    await execa('headroom', ['--version'], { timeout: 10_000 })
    return { label: 'headroom installed and working', status: 'ok' }
  } catch (e) {
    const missing = (e as NodeJS.ErrnoException).code === 'ENOENT'
    return {
      label: `headroom ${missing ? 'not installed' : 'not working'} (optional: compresses what Claude reads)`,
      status: 'warn',
      remedy: 'Run: uv tool install "headroom-ai[all]"  (or re-run goodvibes init)',
    }
  }
}

async function checkGit(): Promise<CheckResult[]> {
  const keys = ['user.name', 'user.email'] as const
  const results: CheckResult[] = []
  for (const key of keys) {
    try {
      const { stdout } = await execa('git', ['config', key])
      results.push({
        label: `git ${key}`,
        status: okOr(stdout.trim().length > 0, 'fail'),
        remedy: stdout.trim().length > 0 ? undefined : `Run: git config --global ${key} "Your Value"`,
      })
    } catch {
      results.push({
        label: `git ${key}`,
        status: 'fail',
        remedy: `Run: git config --global ${key} "Your Value"`,
      })
    }
  }
  return results
}

function checkClaudeMd(cwd: string): CheckResult {
  const present = existsSync(join(cwd, 'CLAUDE.md'))
  return {
    label: 'CLAUDE.md present',
    status: okOr(present, 'fail'),
    remedy: present ? undefined : 'Run: goodvibes init',
  }
}

function checkSentinel(cwd: string): CheckResult {
  const path = join(cwd, 'CLAUDE.md')
  if (!existsSync(path)) {
    return { label: 'goodvibes sentinel block', status: 'fail', remedy: 'Run: goodvibes init' }
  }
  const content = readFileSync(path, 'utf-8')
  const ok = content.includes(SENTINEL_START) && content.includes(SENTINEL_END)
  return {
    label: 'goodvibes sentinel block',
    status: okOr(ok, 'fail'),
    remedy: ok ? undefined : 'Run: goodvibes init (will merge sentinel block)',
  }
}

// A broken manifest is a failed check of its own; the CLAUDE.md checks still run so every problem shows at once.
function manifestCheck(cwd: string): { scope: 'global' | 'project' | null; failure?: CheckResult } {
  const path = join(cwd, MANIFEST_PATH)
  if (!existsSync(path)) return { scope: null }
  try {
    return { scope: parseManifest(readFileSync(path, 'utf-8'), path).scope === 'global' ? 'global' : 'project' }
  } catch (e) {
    return { scope: 'project', failure: { label: `${MANIFEST_PATH} readable`, status: 'fail', remedy: (e as Error).message } }
  }
}

function checkGlobalRules(): CheckResult {
  const ok = existsSync(join(claudeConfigDir(), 'rules', 'goodvibes.md'))
  return { label: 'goodvibes rules in Claude config', status: okOr(ok, 'fail'), remedy: ok ? undefined : 'Run: goodvibes init' }
}

function checkOnPath(): CheckResult {
  const exts = process.platform === 'win32' ? (process.env.PATHEXT ?? '.CMD').split(';') : ['']
  const found = (process.env.PATH ?? '').split(delimiter).some(dir => dir && exts.some(ext => existsSync(join(dir, `goodvibes${ext}`))))
  return found
    ? { label: 'goodvibes command on PATH', status: 'ok' }
    : { label: 'goodvibes command not on PATH', status: 'warn', remedy: 'Optional: lets the session-start check run. Install: npm install -g goodvibes-cli (or: uv tool install goodvibes-cli)' }
}

export function checkJournal(cwd: string): CheckResult[] {
  const path = join(cwd, 'JOURNAL.md')
  if (!existsSync(path)) return []
  const size = statSync(path).size
  if (size <= 10 * 1024) return []
  return [{
    label: `JOURNAL.md is ${Math.ceil(size / 1024)} KB; agents read it every session`,
    status: 'warn',
    remedy: 'Keep lasting decisions in its "Standing decisions" section and keep new entries short.',
  }]
}

// Global-scope projects keep the rules in the Claude config, not in the project CLAUDE.md.
function ruleChecks(cwd: string, scope: 'global' | 'project' | null): CheckResult[] {
  return scope === 'global' ? [checkGlobalRules()] : [checkClaudeMd(cwd), checkSentinel(cwd)]
}

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check goodvibes setup is complete')
    .option('--quick', 'Fast local checks only; silent when all pass, always exits 0 (used by the session-start hook)')
    .action(async (options: { quick?: boolean } = {}) => {
      const cwd = process.cwd()

      if (options.quick) {
        // Exit 2 from a SessionStart hook blocks the session, so quick mode reports and always exits 0.
        // Outside a goodvibes project (no manifest) only the machine-wide git checks apply.
        const { scope, failure } = manifestCheck(cwd)
        const quick = [...(failure ? [failure] : []), ...(await checkGit()), ...(scope ? ruleChecks(cwd, scope) : []), ...checkJournal(cwd)].filter(r => r.status === 'warn' || r.status === 'fail')
        for (const r of quick) console.log(`goodvibes doctor: ${formatCheck(r)}${r.label.endsWith('.') ? '' : '.'}${r.remedy ? ` ${r.remedy}` : ''}`)
        return
      }

      const headroomResult = await checkHeadroom()
      const gitResults = await checkGit()
      const { scope, failure } = manifestCheck(cwd)
      const all: CheckResult[] = [...(failure ? [failure] : []), headroomResult, checkOnPath(), ...gitResults, ...ruleChecks(cwd, scope), ...checkJournal(cwd), ...checkMcpServers(cwd)]

      note([`goodvibes v${packageVersion()}`, ...all.map(formatCheck)].join('\n'), 'goodvibes doctor')

      const fixes = all.filter(r => (r.status === 'warn' || r.status === 'fail') && r.remedy).map(r => `${r.label}: ${r.remedy}`)
      if (fixes.length > 0) note(fixes.join('\n'), 'How to fix')

      outro(summaryLine(all))
      if (all.some(r => r.status === 'fail')) process.exit(1)
    })
}
