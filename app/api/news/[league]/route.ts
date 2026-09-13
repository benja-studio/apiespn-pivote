import { NextRequest } from 'next/server'
import { espn, leagueInfo } from '@/lib/espn-client'
import { apiSuccess, apiError, apiOptions } from '@/lib/api-response'
import { transformNews } from '@/lib/transformers/news'

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
    const raw = await espn(`${encodeURIComponent(slug)}/news`, 300)
    const data = transformNews(raw, normalizedLeague)

    return apiSuccess(data, {
      cache: 's-maxage=300, stale-while-revalidate=900',
      pagination: {
        total: data.articles.length,
        count: data.articles.length,
        offset: 0,
        limit: data.articles.length,
      },
    })
  } catch (error) {
    return apiError(
      'NEWS_NOT_FOUND',
      'No se pudieron cargar las noticias',
      502,
      { league: slug, detail: error instanceof Error ? error.message : 'Error desconocido' },
    )
  }
}

export function OPTIONS() {
  return apiOptions()
}
