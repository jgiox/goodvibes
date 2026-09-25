import type { Command } from 'commander'
import { intro, note } from '@clack/prompts'
import { execa } from 'execa'
import { versionGte } from '../utils/sentinel-merge.js'
import { packageVersion } from '../utils/version.js'
import { runUpdate } from './update.js'
import { readManifest } from '../steps/write-manifest.js'
import { claudeConfigDir } from '../steps/global-setup.js'

const _GV_UPGRADING = '_GV_UPGRADING'

async function checkLatestNpmVersion(): Promise<string | null> {
  try {
    const { stdout } = await execa('npm', ['view', 'goodvibes-cli', 'version'])
    return stdout.trim() || null
  } catch {
    return null
  }
}

function npmInstallFailure(e: unknown, version: string): string {
  const err = e as { stderr?: unknown; message?: string }
  const text = `${String(err.stderr ?? '')}\n${err.message ?? String(e)}`
  const retry = `Then run: npm install -g goodvibes-cli@${version}`
  if (/EACCES|permission denied/i.test(text)) {
    return `npm cannot write its global folder (permission denied).\nFix: https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally\n${retry}`
  }
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  return `npm install -g goodvibes-cli@${version} failed: ${lines.find(l => /error/i.test(l)) ?? lines[0] ?? 'unknown error'}\n${retry}`
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
            try {
              // stderr is shown live and also kept, so a failure can be explained below.
              await execa('npm', ['install', '-g', `goodvibes-cli@${latest}`], { stdin: 'inherit', stdout: 'inherit', stderr: ['pipe', 'inherit'] })
            } catch (e) {
              note(npmInstallFailure(e, latest), 'Upgrade failed')
              process.exit(1)
            }
            // Re-run on the new version so the project gets its templates, not this process's.
            // Through node itself: Windows cannot execute a .js path directly.
            const rerun = await execa(process.execPath, [process.argv[1], ...process.argv.slice(2)], {
              stdio: 'inherit',
              env: { ...process.env, [_GV_UPGRADING]: latest },
              reject: false,
            })
            process.exit(rerun.exitCode ?? 1)
          }
        }
      }

      // In a folder goodvibes never set up, update's "not set up here" reads like a failed upgrade.
      const setUp = await Promise.all([readManifest(process.cwd()), readManifest(claudeConfigDir())]).then(([p, g]) => Boolean(p || g), () => true)
      if (!setUp) {
        note(
          `goodvibes ${current} is installed. This folder has no goodvibes setup, so there is nothing to update here.\n` +
            'To update a project, go into its folder and run: goodvibes update\n' +
            'To set up a new project, go into its folder and run: goodvibes init',
          'Nothing to update here',
        )
        return
      }
      await runUpdate(dryRun, false)
    })
}
