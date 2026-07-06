const TELEMETRY_URL =
  process.env.GOODVIBES_TELEMETRY_URL ?? 'https://goodvibes-telemetry.PLACEHOLDER.workers.dev/'

export async function sendTelemetry(): Promise<void> {
  if (
    process.env.DO_NOT_TRACK === '1' ||
    process.env.GOODVIBES_NO_TELEMETRY === '1' ||
    process.env.CI === 'true'
  ) return

  const { randomUUID } = await import('node:crypto')
  const id = randomUUID() // per-invocation, never stored to disk (TEL-02)
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 5_000)
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
