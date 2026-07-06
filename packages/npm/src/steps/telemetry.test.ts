import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('sendTelemetry', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('calls fetch with POST method when no opt-out env var is set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    const { sendTelemetry } = await import('./telemetry.js')
    await sendTelemetry()
    expect(vi.mocked(fetch as any)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(fetch as any)).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('calls fetch with an X-Request-Id header matching UUID format', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', mockFetch)
    const { sendTelemetry } = await import('./telemetry.js')
    await sendTelemetry()
    const callArgs = mockFetch.mock.calls[0]
    const headers = callArgs[1]?.headers as Record<string, string>
    expect(headers['X-Request-Id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('does not call fetch when DO_NOT_TRACK is set to 1', async () => {
    vi.stubEnv('DO_NOT_TRACK', '1')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    const { sendTelemetry } = await import('./telemetry.js')
    await sendTelemetry()
    expect(vi.mocked(fetch as any)).not.toHaveBeenCalled()
  })

  it('does not call fetch when GOODVIBES_NO_TELEMETRY is set to 1', async () => {
    vi.stubEnv('GOODVIBES_NO_TELEMETRY', '1')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    const { sendTelemetry } = await import('./telemetry.js')
    await sendTelemetry()
    expect(vi.mocked(fetch as any)).not.toHaveBeenCalled()
  })

  it('does not call fetch when CI is set to true', async () => {
    vi.stubEnv('CI', 'true')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
    const { sendTelemetry } = await import('./telemetry.js')
    await sendTelemetry()
    expect(vi.mocked(fetch as any)).not.toHaveBeenCalled()
  })

  it('resolves without throwing when fetch rejects with a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const { sendTelemetry } = await import('./telemetry.js')
    await expect(sendTelemetry()).resolves.toBeUndefined()
  })
})
