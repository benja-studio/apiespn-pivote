const ESPN_BASE = 'https://site.web.api.espn.com/apis/site/v2/sports/soccer'
const ESPN_V2_BASE = 'https://site.web.api.espn.com/apis/v2/sports/soccer'
const REQUEST_TIMEOUT_MS = 9000
const MAX_RETRIES = 2

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(baseUrl: string, path: string, revalidate: number): Promise<any> {
  let lastError = 'Error desconocido'
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const response = await fetch(`${baseUrl}/${path}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'football-api/2.0' },
        next: { revalidate },
      })
      if (!response.ok) throw new Error(`ESPN respondió HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      lastError =
        error instanceof Error && error.name === 'AbortError'
          ? 'Tiempo de espera agotado'
          : error instanceof Error
            ? error.message
            : 'Error de red'
      if (attempt < MAX_RETRIES) await sleep(250 * (attempt + 1))
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error(lastError)
}

/**
 * Fetch from ESPN's primary sports API (site/v2).
 * Used for scoreboard, summary, teams, news, etc.
 */
export function espn(path: string, revalidate = 15): Promise<any> {
  return fetchWithRetry(ESPN_BASE, path, revalidate)
}

/**
 * Fetch from ESPN's v2 API.
 * Used primarily for standings data.
 */
export function espnV2(path: string, revalidate = 600): Promise<any> {
  return fetchWithRetry(ESPN_V2_BASE, path, revalidate)
}

// ─── League catalog ──────────────────────────────────────────────────────────

export const leagues = [
  ['esp.1', 'LaLiga EA Sports', 'España'],
  ['eng.1', 'Premier League', 'Inglaterra'],
  ['ita.1', 'Serie A', 'Italia'],
  ['ger.1', 'Bundesliga', 'Alemania'],
  ['fra.1', 'Ligue 1', 'Francia'],
  ['uefa.champions', 'UEFA Champions League', 'Europa'],
  ['uefa.europa', 'UEFA Europa League', 'Europa'],
  ['uefa.europa.conf', 'UEFA Conference League', 'Europa'],
  ['conmebol.libertadores', 'Copa Libertadores', 'Sudamérica'],
  ['conmebol.sudamericana', 'Copa Sudamericana', 'Sudamérica'],
  ['arg.1', 'Liga Profesional Argentina', 'Argentina'],
  ['bra.1', 'Brasileirão Serie A', 'Brasil'],
  ['mex.1', 'Liga MX', 'México'],
  ['usa.1', 'MLS', 'Estados Unidos'],
  ['ksa.1', 'Saudi Pro League', 'Arabia Saudita'],
  ['por.1', 'Primeira Liga', 'Portugal'],
  ['ned.1', 'Eredivisie', 'Países Bajos'],
  ['col.1', 'Liga BetPlay Dimayor', 'Colombia'],
  ['tur.1', 'Süper Lig', 'Turquía'],
  ['bel.1', 'Jupiler Pro League', 'Bélgica'],
  ['esp.copa_del_rey', 'Copa del Rey', 'España'],
  ['eng.fa', 'FA Cup', 'Inglaterra'],
  ['eng.league_cup', 'Carabao Cup', 'Inglaterra'],
  ['ita.coppa_italia', 'Coppa Italia', 'Italia'],
  ['ger.dfb_pokal', 'DFB-Pokal', 'Alemania'],
  ['fifa.worldq.conmebol', 'Eliminatorias CONMEBOL', 'Sudamérica'],
].map(([slug, name, country]) => ({ slug, name, country }))

export const primaryLeagueSlugs = [
  'esp.1', 'eng.1', 'ita.1', 'ger.1', 'fra.1',
  'uefa.champions', 'uefa.europa', 'conmebol.libertadores',
  'arg.1', 'bra.1', 'mex.1', 'usa.1', 'ksa.1',
]

/**
 * Look up league info by slug. Returns a default for unknown slugs.
 */
export function leagueInfo(slug: string) {
  return leagues.find((item) => item.slug === slug) ?? { slug, name: slug, country: 'Internacional' }
}

// ─── Date helpers ────────────────────────────────────────────────────────────

/**
 * Parse a date query param (YYYYMMDD) or return today's date in that format.
 */
export function dateParam(value: string | null): string {
  if (value && /^\d{8}$/.test(value)) return value
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date()).replaceAll('-', '')
}
