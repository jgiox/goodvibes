import { execa } from 'execa'

/**
 * Probe python3 → python → py in order.
 * Returns the first command that resolves to Python 3.10+, or null if none found.
 *
 * Handles:
 * - ENOENT: command not on PATH → continue to next probe
 * - Version in stdout or stderr (Python < 3.4 printed version to stderr)
 * - Windows Store guard: if output doesn't match /Python \d+\.\d+/, treat as not found
 * - Python < 3.10: continue to next probe
 */
export async function detectPython(): Promise<string | null> {
  for (const cmd of ['python3', 'python', 'py']) {
    try {
      const { stdout, stderr } = await execa(cmd, ['--version'])
      // Python < 3.4 printed version to stderr; check both
      const output = stdout || stderr
      const match = output.match(/Python (\d+)\.(\d+)/)
      if (!match) {
        // No version string in output — Windows Store guard or unexpected output
        continue
      }
      const major = parseInt(match[1], 10)
      const minor = parseInt(match[2], 10)
      if (major > 3) {
        // Future Python 4 compatibility
        return cmd
      }
      if (major === 3 && minor >= 10) {
        return cmd
      }
      // major < 3 or (major === 3 and minor < 10) — version too old, try next
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        // Command not found — try next
        continue
      }
      // Any other error: try next (may be a permission error or unusual failure)
      continue
    }
  }
  return null
}
