import type { Command } from 'commander'
import { note, outro } from '@clack/prompts'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execa } from 'execa'

// ponytail: not imported from sentinel-merge.ts — those constants are module-private
const SENTINEL_START = '<!-- goodvibes:start -->'
const SENTINEL_END = '<!-- goodvibes:end -->'

type CheckResult = { label: string; pass: boolean; remedy?: string }

async function checkHeadroom(): Promise<CheckResult> {
  try {
    await execa('headroom', ['--version'])
    return { label: 'headroom on PATH', pass: true }
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        label: 'headroom on PATH',
        pass: false,
        remedy: 'Run: uv tool install "headroom-ai[all]"  (or re-run goodvibes init)',
      }
    }
    throw e
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

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check goodvibes setup is complete')
    .action(async () => {
      const cwd = process.cwd()

      const headroomResult = await checkHeadroom()
      const gitResults = await checkGit()
      const claudeMdResult = checkClaudeMd(cwd)
      const sentinelResult = checkSentinel(cwd)

      const all: CheckResult[] = [headroomResult, ...gitResults, claudeMdResult, sentinelResult]

      const lines = all.map(r => `${r.pass ? '✓' : '✗'} ${r.label}`)
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
