import type { League, NewsArticle, NewsResponse } from '@/lib/types/api'

function transformArticle(article: any): NewsArticle {
  return {
    id: String(article.id ?? ''),
    headline: article.headline ?? '',
    description: article.description ?? null,
    published: article.published ?? null,
    url: article.links?.web?.href ?? null,
    image: article.images?.[0]?.url ?? null,
    imageCaption: article.images?.[0]?.caption ?? article.images?.[0]?.alt ?? null,
    categories: (article.categories ?? [])
      .map((c: any) => c.description ?? '')
      .filter(Boolean),
  }
}

export function transformNews(espnData: any, league: League): NewsResponse {
  const articles = Array.isArray(espnData?.articles)
    ? espnData.articles
    : Array.isArray(espnData)
      ? espnData
      : []

  return {
    league,
    articles: articles.map(transformArticle),
  }
}
