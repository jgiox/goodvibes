import type { Command } from 'commander'
import { intro, note } from '@clack/prompts'
import { execa } from 'execa'
import { versionGte } from '../utils/sentinel-merge.js'
import { packageVersion } from '../utils/version.js'
import { runUpdate } from './update.js'

const _GV_UPGRADING = '_GV_UPGRADING'

async function checkLatestNpmVersion(): Promise<string | null> {
  try {
    const { stdout } = await execa('npm', ['view', 'goodvibes-cli', 'version'])
    return stdout.trim() || null
  } catch {
    return null
  }
}

export function registerUpgradeCommand(program: Command): void {
  program
    .command('upgrade')
    .description('Install the newest goodvibes, then update this project with it')
    .option('--dry-run', 'Preview what would change without writing')
    .action(async (options: { dryRun: boolean }) => {
      const dryRun = options.dryRun ?? false
      intro('goodvibes upgrade')

      // The re-run carries the version it should now be; if it is not, the install did not take effect.
      const target = process.env[_GV_UPGRADING]
      const current = packageVersion()
      if (target && !versionGte(current, target)) {
        note(
          `Still running goodvibes ${current} after installing ${target}. The goodvibes on your PATH is not the one that was upgraded.\n` +
            `Run: npm install -g goodvibes-cli@${target}, then goodvibes --version.`,
          'Upgrade did not take effect',
        )
        process.exit(1)
      }
      if (!target) {
        const latest = await checkLatestNpmVersion()
        if (latest && !versionGte(current, latest)) {
          if (dryRun) {
            note(`goodvibes ${latest} is available (installed: ${current}). The preview below uses ${current}.`, 'New version available')
          } else {
            note(`Updating goodvibes ${current} → ${latest}…`, 'New version available')
            await execa('npm', ['install', '-g', `goodvibes-cli@${latest}`], { stdio: 'inherit' })
            // Re-run on the new version so the project gets its templates, not this process's.
            const rerun = await execa(process.argv[1], process.argv.slice(2), {
              stdio: 'inherit',
              env: { ...process.env, [_GV_UPGRADING]: latest },
              reject: false,
            })
            process.exit(rerun.exitCode ?? 1)
          }
        }
      }

      await runUpdate(dryRun, false)
    })
}
