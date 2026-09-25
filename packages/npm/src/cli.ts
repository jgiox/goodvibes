import { packageVersion } from './utils/version.js'
import { Command } from 'commander'
import { registerInitCommand } from './commands/init.js'
import { registerUpgradeCommand } from './commands/upgrade.js'
import { registerDoctorCommand } from './commands/doctor.js'
import { registerUpdateCommand } from './commands/update.js'
import { registerUsageCommand } from './commands/usage.js'

const program = new Command()

program
  .name('goodvibes')
  .version(packageVersion(), '-V, --version', 'Show the version and exit')
  .helpOption('-h, --help', 'Show this message and exit.')
  .description('One-command bootstrap for vibe coding projects')
  // Usage errors exit 2, as in the pip CLI (click); set before the commands so they inherit it.
  .exitOverride(err => process.exit(err.exitCode === 1 ? 2 : err.exitCode))
  .helpCommand('help [command]', 'Show help for a command')

registerInitCommand(program)
registerUpgradeCommand(program)
registerUpdateCommand(program)
registerDoctorCommand(program)
registerUsageCommand(program)

await program.parseAsync(process.argv)
