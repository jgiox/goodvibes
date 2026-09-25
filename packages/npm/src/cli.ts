import { packageVersion } from './utils/version.js'
import { Command } from 'commander'
import { registerInitCommand } from './commands/init.js'
import { registerUpgradeCommand } from './commands/upgrade.js'
import { registerDoctorCommand } from './commands/doctor.js'
import { registerUpdateCommand } from './commands/update.js'

const program = new Command()

program
  .name('goodvibes')
  .version(packageVersion())
  .description('One-command bootstrap for vibe coding projects')

registerInitCommand(program)
registerUpgradeCommand(program)
registerUpdateCommand(program)
registerDoctorCommand(program)

await program.parseAsync(process.argv)
