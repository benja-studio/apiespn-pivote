import { NextRequest } from 'next/server'
import { espn, leagueInfo } from '@/lib/espn-client'
import { apiSuccess, apiError, apiOptions } from '@/lib/api-response'
import { transformMatchDetail } from '@/lib/transformers/match'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const leagueSlug = request.nextUrl.searchParams.get('league') ?? 'eng.1'

  try {
    let detail: any
    try {
      detail = await espn(`${encodeURIComponent(leagueSlug)}/summary?event=${encodeURIComponent(id)}`)
    } catch {
      // Fallback to common leagues
      detail = await espn(`esp.1/summary?event=${encodeURIComponent(id)}`).catch(() =>
        espn(`eng.1/summary?event=${encodeURIComponent(id)}`),
      )
    }

    const league = leagueInfo(leagueSlug)
    const data = transformMatchDetail(detail, {
      id: league.slug,
      name: league.name,
      country: league.country,
    })

    return apiSuccess(data)
  } catch (error) {
    return apiError(
      'MATCH_NOT_FOUND',
      'No se pudo obtener el detalle del partido',
      502,
      { matchId: id, detail: error instanceof Error ? error.message : 'Error desconocido' },
    )
  }
}

export function OPTIONS() {
  return apiOptions()
}
