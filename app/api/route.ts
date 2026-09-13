import { apiSuccess, apiOptions, API_NAME, API_VERSION, TIMEZONE } from '@/lib/api-response'

const endpoints = [
  { method: 'GET', path: '/api/leagues', description: 'Catálogo de ligas disponibles' },
  { method: 'GET', path: '/api/scoreboard?league=all&date=YYYYMMDD', description: 'Partidos por fecha y liga (datos normalizados)' },
  { method: 'GET', path: '/api/live', description: 'Partidos en vivo (datos normalizados)' },
  { method: 'GET', path: '/api/matches/:id?league=:league', description: 'Detalle completo normalizado de un partido' },
  { method: 'GET', path: '/api/matches/:id/lineups?league=:league', description: 'Alineaciones: titulares y suplentes' },
  { method: 'GET', path: '/api/matches/:id/stats?league=:league', description: 'Estadísticas comparadas home vs away' },
  { method: 'GET', path: '/api/matches/:id/events?league=:league', description: 'Goles, tarjetas y sustituciones clasificados' },
  { method: 'GET', path: '/api/matches/:id/h2h?league=:league', description: 'Historial cara a cara y forma reciente' },
  { method: 'GET', path: '/api/standings/:league', description: 'Tabla de posiciones con grupos y filas ordenadas' },
  { method: 'GET', path: '/api/teams/:league', description: 'Equipos de una competición' },
  { method: 'GET', path: '/api/news/:league', description: 'Noticias de ESPN por liga' },
]

export function GET() {
  return apiSuccess(
    {
      name: API_NAME,
      version: API_VERSION,
      description: 'API REST de fútbol con datos normalizados, alimentada por ESPN.',
      documentation: '/',
      timezone: TIMEZONE,
      response: {
        format: '{ data: T, meta: ResponseMeta }',
        dataField: 'Payload normalizado del recurso solicitado',
        metaField: 'Metadata: api, version, source, timestamp, timezone, pagination',
      },
      endpoints,
    },
    { cache: 's-maxage=3600, stale-while-revalidate=86400' },
  )
}

export function OPTIONS() {
  return apiOptions()
}
