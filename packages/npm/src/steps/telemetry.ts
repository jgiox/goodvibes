const TELEMETRY_URL =
  process.env.GOODVIBES_TELEMETRY_URL ?? 'https://goodvibes-telemetry.igiokas.workers.dev/'

const truthy = (v: string | undefined) => ['1', 'true', 'yes'].includes((v ?? '').trim().toLowerCase())

// CI services set CI to true, 1 or their own name; only an explicit 0 or false means not CI. The pip package uses the same rule.
const isCi = (v: string | undefined) => !['', '0', 'false'].includes((v ?? '').trim().toLowerCase())

export function telemetryOptedOut(env: NodeJS.ProcessEnv = process.env): boolean {
  return truthy(env.DO_NOT_TRACK) || truthy(env.GOODVIBES_NO_TELEMETRY) || isCi(env.CI)
}

export async function sendTelemetry(): Promise<void> {
  if (telemetryOptedOut()) return

  const { randomUUID } = await import('node:crypto')
  const id = randomUUID() // per-invocation, never stored to disk (TEL-02)
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 1_000)
  timer.unref()   // won't prevent process exit if fetch somehow lingers
  try {
    await fetch(TELEMETRY_URL, {
      method: 'POST',
      body: null,
      signal: ac.signal,
      headers: { 'X-Request-Id': id },
    })
  } catch {
    // ponytail: silent on error — network failure must not affect init
  } finally {
    clearTimeout(timer)
  }
}
