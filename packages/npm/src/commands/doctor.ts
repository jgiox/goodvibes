import type { Command } from 'commander'
import { note, outro } from '@clack/prompts'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execa } from 'execa'
import { packageVersion } from '../utils/version.js'
import { claudeConfigDir } from '../steps/global-setup.js'
import { MANIFEST_PATH, parseManifest } from '../steps/write-manifest.js'

// ponytail: not imported from sentinel-merge.ts — those constants are module-private
const SENTINEL_START = '<!-- goodvibes:start -->'
const SENTINEL_END = '<!-- goodvibes:end -->'

type CheckResult = { label: string; pass: boolean; remedy?: string }

async function checkHeadroom(): Promise<CheckResult> {
  try {
    await execa('headroom', ['--version'], { timeout: 10_000 })
    return { label: 'headroom installed and working', pass: true }
  } catch {
    return {
      label: 'headroom installed and working',
      pass: false,
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
        pass: stdout.trim().length > 0,
        remedy: stdout.trim().length > 0 ? undefined : `Run: git config --global ${key} "Your Value"`,
      })
    } catch {
      results.push({
        label: `git ${key}`,
        pass: false,
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
    pass: present,
    remedy: present ? undefined : 'Run: goodvibes init',
  }
}

function checkSentinel(cwd: string): CheckResult {
  const path = join(cwd, 'CLAUDE.md')
  if (!existsSync(path)) {
    return { label: 'goodvibes sentinel block', pass: false, remedy: 'Run: goodvibes init' }
  }
  const content = readFileSync(path, 'utf-8')
  const ok = content.includes(SENTINEL_START) && content.includes(SENTINEL_END)
  return {
    label: 'goodvibes sentinel block',
    pass: ok,
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
    return { scope: 'project', failure: { label: `${MANIFEST_PATH} readable`, pass: false, remedy: (e as Error).message } }
  }
}

function checkGlobalRules(): CheckResult {
  const ok = existsSync(join(claudeConfigDir(), 'rules', 'goodvibes.md'))
  return { label: 'goodvibes rules in Claude config', pass: ok, remedy: ok ? undefined : 'Run: goodvibes init' }
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
        const quick = [...(failure ? [failure] : []), ...(await checkGit()), ...(scope ? ruleChecks(cwd, scope) : [])].filter(r => !r.pass)
        for (const r of quick) console.log(`goodvibes doctor: ✗ ${r.label}.${r.remedy ? ` ${r.remedy}` : ''}`)
        return
      }

      const headroomResult = await checkHeadroom()
      const gitResults = await checkGit()
      const { scope, failure } = manifestCheck(cwd)
      const all: CheckResult[] = [...(failure ? [failure] : []), headroomResult, ...gitResults, ...ruleChecks(cwd, scope)]

      const version = packageVersion()
      const lines = [`goodvibes v${version}`, ...all.map(r => `${r.pass ? '✓' : '✗'} ${r.label}`)]
      note(lines.join('\n'), 'goodvibes doctor')

      const failures = all.filter(r => !r.pass)
      if (failures.length > 0) {
        const remediation = failures
          .filter(r => r.remedy)
          .map(r => r.remedy!)
          .join('\n')
        note(remediation, 'How to fix')
        process.exit(1)
      }

      outro('All checks passed.')
    })
}
