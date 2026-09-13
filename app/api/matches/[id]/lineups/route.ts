import { NextRequest } from 'next/server'
import { espn } from '@/lib/espn-client'
import { apiSuccess, apiError, apiOptions } from '@/lib/api-response'
import { transformLineups } from '@/lib/transformers/match'

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
    const data = transformLineups(detail.rosters ?? [])
    return apiSuccess(data)
  } catch (error) {
    return apiError(
      'LINEUPS_NOT_FOUND',
      'No se pudieron obtener las alineaciones',
      502,
      { matchId: id, detail: error instanceof Error ? error.message : 'Error desconocido' },
    )
  }
}

export function OPTIONS() {
  return apiOptions()
}
