import { NextRequest } from 'next/server'
import { espn, leagueInfo } from '@/lib/espn-client'
import { apiSuccess, apiError, apiOptions } from '@/lib/api-response'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ league: string }> },
) {
  const { league: slug } = await context.params
  const league = leagueInfo(slug)
  const q = request.nextUrl.searchParams.get('q')?.toLowerCase()

  try {
    const raw = await espn(`${encodeURIComponent(slug)}/teams`, 3600)

    let teams = (raw?.sports?.[0]?.leagues?.[0]?.teams ?? raw?.teams ?? []).map((entry: any) => {
      const t = entry.team ?? entry
      return {
        id: String(t.id ?? ''),
        name: t.displayName ?? t.name ?? '',
        shortName: t.abbreviation ?? '',
        location: t.location ?? null,
        logo: t.logos?.[0]?.href ?? t.logo ?? null,
        color: t.color ? `#${t.color}` : null,
        alternateColor: t.alternateColor ? `#${t.alternateColor}` : null,
        standingSummary: t.standingSummary ?? null,
      }
    })

    if (q) {
      teams = teams.filter((t: any) =>
        t.name.toLowerCase().includes(q) ||
        t.shortName.toLowerCase().includes(q) ||
        (t.location && t.location.toLowerCase().includes(q)),
      )
    }

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
      'No se pudieron obtener los clubes de esta liga',
      502,
      { league: slug, detail: error instanceof Error ? error.message : 'Error desconocido' },
    )
  }
}

export function OPTIONS() {
  return apiOptions()
}
