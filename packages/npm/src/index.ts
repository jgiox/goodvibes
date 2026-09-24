#!/usr/bin/env node
import { nodeVersionError } from './node-check.js'

const tooOld = nodeVersionError(process.version)
if (tooOld) {
  process.stderr.write(tooOld)
  process.exit(1)
}

// Loaded only after the check: execa and commander crash on import under Node < 22.12.
await import('./cli.js')
