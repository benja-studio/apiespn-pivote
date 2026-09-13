import { espn } from '@/lib/espn-client'
import { apiSuccess, apiOptions, API_NAME, API_VERSION } from '@/lib/api-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const startTime = Date.now()
  let espnStatus = 'healthy'
  let espnLatency = 0

  try {
    const espnStart = Date.now()
    await espn('esp.1/scoreboard', 10)
    espnLatency = Date.now() - espnStart
  } catch {
    espnStatus = 'degraded'
  }

  const uptime = process.uptime ? Math.round(process.uptime()) : 0

  return apiSuccess(
    {
      status: espnStatus === 'healthy' ? 'optimal' : 'degraded',
      service: API_NAME,
      version: API_VERSION,
      uptimeSeconds: uptime,
      espnProxy: {
        status: espnStatus,
        latencyMs: espnLatency,
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        serverTime: new Date().toISOString(),
      },
    },
    { cache: 'no-store' },
  )
}

export function OPTIONS() {
  return apiOptions()
}
