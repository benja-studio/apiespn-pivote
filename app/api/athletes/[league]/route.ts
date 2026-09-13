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
  const query = request.nextUrl.searchParams.get('q')?.toLowerCase()

  try {
    const raw = await espn(`${encodeURIComponent(slug)}/athletes`, 3600)
    let athletes = (raw?.items ?? raw?.athletes ?? []).map((a: any) => ({
      id: String(a.id ?? ''),
      name: a.displayName ?? a.fullName ?? a.name ?? 'Jugador',
      shortName: a.shortName ?? null,
      position: a.position?.name ?? a.position?.displayName ?? null,
      jersey: a.jersey ?? null,
      team: a.team?.displayName ?? null,
      headshot: a.headshot?.href ?? a.images?.[0]?.href ?? null,
    }))

    if (query) {
      athletes = athletes.filter((a: any) =>
        a.name.toLowerCase().includes(query) || (a.team && a.team.toLowerCase().includes(query)),
      )
    }

    return apiSuccess(
      {
        league: { id: league.slug, name: league.name, country: league.country },
        athletes,
      },
      {
        cache: 's-maxage=3600, stale-while-revalidate=86400',
        pagination: { total: athletes.length, count: athletes.length, offset: 0, limit: athletes.length },
      },
    )
  } catch (error) {
    return apiError(
      'ATHLETES_NOT_FOUND',
      'No se pudo obtener el catálogo de jugadores',
      502,
      { league: slug, detail: error instanceof Error ? error.message : 'Error desconocido' },
    )
  }
}

export function OPTIONS() {
  return apiOptions()
}
