import { NextRequest } from 'next/server'
import { espn } from '@/lib/espn-client'
import { apiSuccess, apiError, apiOptions } from '@/lib/api-response'

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
    const odds = (detail.odds ?? []).map((odd: any) => ({
      provider: odd.provider?.name ?? 'General',
      details: odd.details ?? null,
      overUnder: odd.overUnder ?? null,
      spread: odd.spread ?? null,
      homeWinOdds: odd.homeTeamOdds?.moneyLine ?? null,
      awayWinOdds: odd.awayTeamOdds?.moneyLine ?? null,
      drawOdds: odd.drawOdds?.moneyLine ?? null,
    }))

    return apiSuccess({ odds, predictors: detail.predictors ?? [], pickcenter: detail.pickcenter ?? [] })
  } catch (error) {
    return apiError(
      'ODDS_NOT_FOUND',
      'No se pudieron obtener cuotas o pronósticos para este partido',
      502,
      { matchId: id, detail: error instanceof Error ? error.message : 'Error desconocido' },
    )
  }
}

export function OPTIONS() {
  return apiOptions()
}
