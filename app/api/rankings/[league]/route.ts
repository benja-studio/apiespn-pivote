import { NextRequest } from 'next/server'
import { espn, leagueInfo } from '@/lib/espn-client'
import { apiSuccess, apiError, apiOptions } from '@/lib/api-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ league: string }> },
) {
  const { league: slug } = await context.params
  const league = leagueInfo(slug)

  try {
    const raw = await espn(`${encodeURIComponent(slug)}/rankings`, 900)
    const rankings = (raw?.rankings ?? []).map((r: any) => ({
      name: r.name ?? 'Ranking',
      type: r.type ?? 'general',
      ranks: (r.ranks ?? []).map((rk: any) => ({
        current: rk.current ?? 0,
        previous: rk.previous ?? 0,
        points: rk.points ?? 0,
        team: {
          id: String(rk.team?.id ?? ''),
          name: rk.team?.displayName ?? rk.team?.name ?? '',
          logo: rk.team?.logos?.[0]?.href ?? null,
        },
      })),
    }))

    return apiSuccess(
      {
        league: { id: league.slug, name: league.name, country: league.country },
        rankings,
      },
      { cache: 's-maxage=900, stale-while-revalidate=3600' },
    )
  } catch (error) {
    return apiError(
      'RANKINGS_NOT_FOUND',
      'No se pudieron obtener los rankings de la competición',
      502,
      { league: slug, detail: error instanceof Error ? error.message : 'Error desconocido' },
    )
  }
}

export function OPTIONS() {
  return apiOptions()
}
