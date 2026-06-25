#!/usr/bin/env node
const [major] = process.version.replace('v', '').split('.').map(Number)
if (major < 20) {
  process.stderr.write(
    `goodvibes requires Node.js 20 or higher.\nYou are running Node.js ${process.version}.\nInstall the latest LTS from https://nodejs.org\n`
  )
  process.exit(1)
}

import { Command } from 'commander'
import { registerInitCommand } from './commands/init.js'
import { registerUpgradeCommand } from './commands/upgrade.js'

const program = new Command()

program
  .name('goodvibes')
  .version('1.0.0')
  .description('One-command bootstrap for vibe coding projects')

registerInitCommand(program)
registerUpgradeCommand(program)

await program.parseAsync(process.argv)
