import { execa } from 'execa'
import { detectPython } from '../utils/detect-python.js'

/**
 * Install headroom-ai[all] via uv → pipx → pip fallback chain.
 *
 * @param log - Function to emit status messages (enables testing without console side effects)
 *
 * Behaviour:
 * - If Python 3.10+ is absent: logs skip message and returns (never throws, never exits 1)
 * - Prints ONNX model download warning BEFORE starting the install subprocess
 * - Tries uv first, then pipx, then pip --user
 * - All execa calls pass args as arrays — no shell:true, no string interpolation
 * - If all three installers are ENOENT: logs a warning and returns gracefully (HDR-02 spirit)
 */
export async function installHeadroom(log: (msg: string) => void): Promise<void> {
  const pythonCmd = await detectPython()

  if (pythonCmd === null) {
    log('Python 3.10+ not found — skipping headroom install. Install Python 3.10+ and run `goodvibes init` again.')
    return
  }

  // HDR-03: warn about ONNX model download BEFORE the subprocess starts
  log('Note: headroom will download its compression model on first use — this may take 1–3 minutes on a slow connection.')

  const installers: Array<{ cmd: string; args: string[] }> = [
    { cmd: 'uv', args: ['tool', 'install', 'headroom-ai[all]'] },
    { cmd: 'pipx', args: ['install', 'headroom-ai[all]'] },
    { cmd: pythonCmd, args: ['-m', 'pip', 'install', '--user', 'headroom-ai[all]'] },
  ]

  for (const installer of installers) {
    try {
      await execa(installer.cmd, installer.args)
      return
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        // Installer not found — try next
        continue
      }
      // Install failed (e.g. missing C++ compiler for native deps like hnswlib).
      // Treat as soft failure so init still exits 0 with all other files written.
      const summary = (e as Error).message?.split('\n')[0] ?? 'unknown error'
      log(`headroom install failed: ${summary}`)
      log('You can install headroom manually later: uv tool install "headroom-ai[all]"')
      return
    }
  }

  // All three installers were ENOENT — log warning and return gracefully
  log('No package installer found (uv, pipx, pip). Install Python 3.10+ with uv or pipx and run `goodvibes init` again.')
}
