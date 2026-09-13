import { NextRequest } from 'next/server'
import { espn } from '@/lib/espn-client'
import { apiSuccess, apiError, apiOptions } from '@/lib/api-response'
import { transformStats } from '@/lib/transformers/match'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const leagueSlug = request.nextUrl.searchParams.get('league') ?? 'eng.1'

  try {
    const detail = await espn(
      `${encodeURIComponent(leagueSlug)}/summary?event=${encodeURIComponent(id)}`,
    )
    const data = transformStats(detail.boxscore)

    if (!data) {
      return apiError('STATS_NOT_AVAILABLE', 'Estadísticas no disponibles para este partido', 404, { matchId: id })
    }

    return apiSuccess(data)
  } catch (error) {
    return apiError(
      'STATS_NOT_FOUND',
      'No se pudieron obtener las estadísticas',
      502,
      { matchId: id, detail: error instanceof Error ? error.message : 'Error desconocido' },
    )
  }
}

export function OPTIONS() {
  return apiOptions()
}
