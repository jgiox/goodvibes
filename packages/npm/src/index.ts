#!/usr/bin/env node
const [major] = process.version.replace('v', '').split('.').map(Number)
if (major < 20) {
  process.stderr.write(
    `goodvibes requires Node.js 20 or higher.\nYou are running Node.js ${process.version}.\nInstall the latest LTS from https://nodejs.org\n`
  )
  process.exit(1)
}

import { Command } from 'commander'

const program = new Command()

program
  .name('goodvibes')
  .version('1.0.0')
  .description('One-command bootstrap for vibe coding projects')

program
  .command('init')
  .description('Bootstrap a project with goodvibes configuration')
  .option('--dry-run', 'Preview files without writing to disk')
  .option('--minimal', 'Skip headroom install and CI workflows')
  .action(async (_options: { dryRun: boolean; minimal: boolean }) => {
    process.stdout.write('init stub — Wave 1 will implement\n')
    process.exit(0)
  })

await program.parseAsync(process.argv)
