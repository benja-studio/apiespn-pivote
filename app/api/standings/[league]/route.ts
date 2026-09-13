import { NextRequest } from 'next/server'
import { espn, espnV2, leagueInfo } from '@/lib/espn-client'
import { apiSuccess, apiError, apiOptions } from '@/lib/api-response'
import { transformStandings } from '@/lib/transformers/standings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ league: string }> },
) {
  const { league: slug } = await context.params
  const league = leagueInfo(slug)
  const normalizedLeague = { id: league.slug, name: league.name, country: league.country }

  try {
    let raw: any
    try {
      raw = await espnV2(`${encodeURIComponent(slug)}/standings`, 900)
    } catch {
      raw = await espn(`${encodeURIComponent(slug)}/standings`, 900)
    }

    const data = transformStandings(raw, normalizedLeague)

    if (data.groups.every((g) => g.rows.length === 0)) {
      return apiError(
        'STANDINGS_EMPTY',
        'ESPN no devolvió una tabla para este torneo o jornada',
        404,
        { league: slug },
      )
    }

    return apiSuccess(data, { cache: 's-maxage=900, stale-while-revalidate=3600' })
  } catch (error) {
    return apiError(
      'STANDINGS_NOT_FOUND',
      'No se pudo cargar la clasificación',
      502,
      { league: slug, detail: error instanceof Error ? error.message : 'Error desconocido' },
    )
  }
}

export function OPTIONS() {
  return apiOptions()
}
