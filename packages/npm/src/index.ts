#!/usr/bin/env node
const [major] = process.version.replace('v', '').split('.').map(Number)
if (major < 20) {
  process.stderr.write(
    `goodvibes requires Node.js 20 or higher.\nYou are running Node.js ${process.version}.\nInstall the latest LTS from https://nodejs.org\n`
  )
  process.exit(1)
}

import { createRequire } from 'node:module'
import { Command } from 'commander'
import { registerInitCommand } from './commands/init.js'
import { registerUpgradeCommand } from './commands/upgrade.js'
import { registerDoctorCommand } from './commands/doctor.js'

const _require = createRequire(import.meta.url)
const _pkg = _require('../package.json') as { version: string }

const program = new Command()

program
  .name('goodvibes')
  .version(_pkg.version)
  .description('One-command bootstrap for vibe coding projects')

registerInitCommand(program)
registerUpgradeCommand(program)
registerDoctorCommand(program)

await program.parseAsync(process.argv)
