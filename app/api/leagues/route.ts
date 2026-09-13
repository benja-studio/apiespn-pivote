import { leagues } from '@/lib/espn-client'
import { apiSuccess, apiOptions } from '@/lib/api-response'
import type { League } from '@/lib/types/api'

export const runtime = 'nodejs'

export function GET() {
  const data: League[] = leagues.map((l) => ({
    id: l.slug,
    name: l.name,
    country: l.country,
  }))

  return apiSuccess(data, {
    cache: 's-maxage=3600, stale-while-revalidate=86400',
    pagination: { total: data.length, count: data.length, offset: 0, limit: data.length },
  })
}

export function OPTIONS() {
  return apiOptions()
}
