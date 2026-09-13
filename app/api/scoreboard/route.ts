import { NextRequest } from 'next/server'
import { espn, primaryLeagueSlugs, leagueInfo, dateParam } from '@/lib/espn-client'
import { apiSuccess, apiError, apiOptions } from '@/lib/api-response'
import { transformMatch } from '@/lib/transformers/match'
import type { Match, ScoreboardResponse } from '@/lib/types/api'

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

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const requested = params.get('league')
  const targets = requested && requested !== 'all' ? [requested] : primaryLeagueSlugs
  const date = dateParam(params.get('date'))

  const results = await Promise.all(targets.map((slug) => fetchScoreboard(slug, date)))
  const successful = results.filter((r) => r.ok)
  const errors = results
    .filter((r) => !r.ok)
    .map((r) => ({ league: r.slug, error: (r as any).error ?? 'Error desconocido' }))

  if (successful.length === 0) {
    return apiError('ESPN_UNAVAILABLE', 'ESPN no respondió en ninguna liga', 502, { errors })
  }

  const matches: Match[] = successful.flatMap((result) => {
    const league = leagueInfo(result.slug)
    return result.events.map((event: any) =>
      transformMatch(event, { id: league.slug, name: league.name, country: league.country }),
    )
  })

  const data: ScoreboardResponse = {
    matches,
    coverage: {
      requestedLeagues: targets.length,
      successfulLeagues: successful.length,
      failedLeagues: errors.length,
      errors,
    },
  }

  return apiSuccess(data, {
    pagination: { total: matches.length, count: matches.length, offset: 0, limit: matches.length },
  })
}

export function OPTIONS() {
  return apiOptions()
}
