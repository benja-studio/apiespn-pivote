import { apiSuccess, apiOptions, API_NAME, API_VERSION, TIMEZONE } from '@/lib/api-response'

const endpoints = [
  { method: 'GET', path: '/api/scoreboard?league=all&date=YYYYMMDD', description: 'Partidos por fecha y liga (datos normalizados)' },
  { method: 'GET', path: '/api/live', description: 'Partidos en vivo en tiempo real' },
  { method: 'GET', path: '/api/matches/:id?league=:league', description: 'Detalle completo normalizado de un partido' },
  { method: 'GET', path: '/api/matches/:id/lineups?league=:league', description: 'Alineaciones: titulares y suplentes' },
  { method: 'GET', path: '/api/matches/:id/stats?league=:league', description: 'Estadísticas comparadas home vs away' },
  { method: 'GET', path: '/api/matches/:id/events?league=:league', description: 'Goles, tarjetas y sustituciones clasificados' },
  { method: 'GET', path: '/api/matches/:id/h2h?league=:league', description: 'Historial cara a cara y forma reciente' },
  { method: 'GET', path: '/api/matches/:id/odds?league=:league', description: 'Cuotas de apuestas y pronósticos de partido' },
  { method: 'GET', path: '/api/standings/:league', description: 'Tabla de posiciones con grupos y filas ordenadas' },
  { method: 'GET', path: '/api/teams/:league', description: 'Equipos de una competición con logos y colores' },
  { method: 'GET', path: '/api/athletes/:league?q=:search', description: 'Plantel de jugadores con dorsales y posiciones' },
  { method: 'GET', path: '/api/rankings/:league', description: 'Rankings y estadísticas globales por competición' },
  { method: 'GET', path: '/api/news/:league', description: 'Noticias editoriales de ESPN por liga' },
  { method: 'GET', path: '/api/leagues', description: 'Catálogo de más de 25 ligas internacionales' },
  { method: 'GET', path: '/api/health', description: 'Chequeo de salud del servicio, latencia y proxy' },
]

export function GET() {
  return apiSuccess(
    {
      name: API_NAME,
      version: API_VERSION,
      description: 'API REST de fútbol profesional y normalizada, alimentada por ESPN sin bloqueos CORS.',
      documentation: '/',
      timezone: TIMEZONE,
      response: {
        envelope: '{ data: T, meta: ResponseMeta }',
        dataDescription: 'Payload tipado y normalizado listo para consumir en Flutter, React, Vue o Python.',
        metaDescription: 'Metadatos de consulta: timestamp, version, fuente, timezone y paginación.',
      },
      endpoints,
    },
    { cache: 's-maxage=3600, stale-while-revalidate=86400' },
  )
}

export function OPTIONS() {
  return apiOptions()
}
