import { espn, primaryLeagueSlugs, leagueInfo, dateParam } from '@/lib/espn-client'
import { apiSuccess, apiError, apiOptions } from '@/lib/api-response'
import { transformMatch } from '@/lib/transformers/match'
import type { Match } from '@/lib/types/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function fetchScoreboard(slug: string, date: string) {
  try {
    const res = await espn(`${encodeURIComponent(slug)}/scoreboard?dates=${encodeURIComponent(date)}`)
    return { slug, ok: true as const, events: res.events ?? [] }
  } catch (error) {
    return { slug, ok: false as const, events: [], error: error instanceof Error ? error.message : 'Error de red' }
  }
}

export async function GET() {
  const date = dateParam(null)
  const results = await Promise.all(primaryLeagueSlugs.map((slug) => fetchScoreboard(slug, date)))
  const successful = results.filter((r) => r.ok)

  if (successful.length === 0) {
    return apiError('ESPN_UNAVAILABLE', 'ESPN no respondió en ninguna liga', 502)
  }

  const allMatches: Match[] = successful.flatMap((result) => {
    const league = leagueInfo(result.slug)
    return result.events.map((event: any) =>
      transformMatch(event, { id: league.slug, name: league.name, country: league.country }),
    )
  })

  const liveMatches = allMatches.filter((m) => m.status.state === 'live')

  return apiSuccess(
    { matches: liveMatches },
    {
      pagination: { total: liveMatches.length, count: liveMatches.length, offset: 0, limit: liveMatches.length },
    },
  )
}

export function OPTIONS() {
  return apiOptions()
}
