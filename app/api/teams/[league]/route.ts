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
    const raw = await espn(`${encodeURIComponent(slug)}/teams`, 3600)

    // Normalize team data
    const teams = (raw?.sports?.[0]?.leagues?.[0]?.teams ?? raw?.teams ?? []).map((entry: any) => {
      const t = entry.team ?? entry
      return {
        id: t.id ?? '',
        name: t.displayName ?? t.name ?? '',
        shortName: t.abbreviation ?? '',
        logo: t.logos?.[0]?.href ?? t.logo ?? null,
        color: t.color ? `#${t.color}` : null,
      }
    })

    return apiSuccess(
      { league: { id: league.slug, name: league.name, country: league.country }, teams },
      {
        cache: 's-maxage=3600, stale-while-revalidate=86400',
        pagination: { total: teams.length, count: teams.length, offset: 0, limit: teams.length },
      },
    )
  } catch (error) {
    return apiError(
      'TEAMS_NOT_FOUND',
      'No se pudieron obtener los equipos',
      502,
      { league: slug, detail: error instanceof Error ? error.message : 'Error desconocido' },
    )
  }
}

export function OPTIONS() {
  return apiOptions()
}
