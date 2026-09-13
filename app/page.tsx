'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Calendar,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Database,
  ExternalLink,
  Flame,
  Globe2,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  TableProperties,
  Terminal,
  Trophy,
  Users,
  Wifi,
  Zap,
} from 'lucide-react'

import type {
  Match,
  MatchDetailResponse,
  StandingsResponse,
  NewsResponse,
  NewsArticle,
  League,
  StandingGroup,
  StandingRow,
  MatchEvent,
} from '@/lib/types/api'

// ─── Constants & Leagues ─────────────────────────────────────────────────────

const allLeaguesList = [
  { slug: 'all', name: 'Todas las ligas principales', group: 'General' },
  { slug: 'esp.1', name: 'LaLiga EA Sports (España)', group: 'Europa' },
  { slug: 'eng.1', name: 'Premier League (Inglaterra)', group: 'Europa' },
  { slug: 'ita.1', name: 'Serie A (Italia)', group: 'Europa' },
  { slug: 'ger.1', name: 'Bundesliga (Alemania)', group: 'Europa' },
  { slug: 'fra.1', name: 'Ligue 1 (Francia)', group: 'Europa' },
  { slug: 'por.1', name: 'Primeira Liga (Portugal)', group: 'Europa' },
  { slug: 'ned.1', name: 'Eredivisie (Países Bajos)', group: 'Europa' },
  { slug: 'tur.1', name: 'Süper Lig (Turquía)', group: 'Europa' },
  { slug: 'bel.1', name: 'Jupiler Pro League (Bélgica)', group: 'Europa' },
  { slug: 'uefa.champions', name: 'UEFA Champions League', group: 'Copas Continentales' },
  { slug: 'uefa.europa', name: 'UEFA Europa League', group: 'Copas Continentales' },
  { slug: 'uefa.europa.conf', name: 'UEFA Conference League', group: 'Copas Continentales' },
  { slug: 'conmebol.libertadores', name: 'Copa Libertadores', group: 'Copas Continentales' },
  { slug: 'conmebol.sudamericana', name: 'Copa Sudamericana', group: 'Copas Continentales' },
  { slug: 'arg.1', name: 'Liga Profesional (Argentina)', group: 'América' },
  { slug: 'bra.1', name: 'Brasileirão Serie A (Brasil)', group: 'América' },
  { slug: 'mex.1', name: 'Liga MX (México)', group: 'América' },
  { slug: 'usa.1', name: 'MLS (Estados Unidos)', group: 'América' },
  { slug: 'col.1', name: 'Liga BetPlay (Colombia)', group: 'América' },
  { slug: 'ksa.1', name: 'Saudi Pro League (Arabia Saudita)', group: 'Asia / Otras' },
  { slug: 'esp.copa_del_rey', name: 'Copa del Rey (España)', group: 'Copas Nacionales' },
  { slug: 'eng.fa', name: 'FA Cup (Inglaterra)', group: 'Copas Nacionales' },
  { slug: 'eng.league_cup', name: 'Carabao Cup (Inglaterra)', group: 'Copas Nacionales' },
  { slug: 'ita.coppa_italia', name: 'Coppa Italia (Italia)', group: 'Copas Nacionales' },
  { slug: 'ger.dfb_pokal', name: 'DFB-Pokal (Alemania)', group: 'Copas Nacionales' },
  { slug: 'fifa.worldq.conmebol', name: 'Eliminatorias CONMEBOL', group: 'Selecciones' },
]

// ─── Visual Badges & Formatters ──────────────────────────────────────────────

function TeamBadge({ logo, name, shortName }: { logo?: string | null; name?: string; shortName?: string }) {
  if (logo) {
    return <img className="team-badge" src={logo} alt={name || 'Equipo'} loading="lazy" />
  }
  return <span className="team-badge">{shortName?.slice(0, 2) ?? '⚽'}</span>
}

function formatMatchStatus(status: Match['status']) {
  if (status.state === 'live') return status.clock || 'EN VIVO'
  if (status.state === 'finished') return status.detail || 'FINALIZADO'
  return 'PRÓXIMO'
}

function formatTime(startTime: string) {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(startTime)) + ' ART'
  } catch {
    return startTime
  }
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatDateLabel(value: string) {
  try {
    return new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short' }).format(
      new Date(`${value}T12:00:00`),
    )
  } catch {
    return value
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Page() {
  // Navigation
  const [activeScreen, setActiveScreen] = useState<'overview' | 'matches' | 'match' | 'standings' | 'news' | 'api'>(
    'overview',
  )

  // Matches State
  const [matches, setMatches] = useState<Match[]>([])
  const [selectedLeague, setSelectedLeague] = useState('all')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'finished' | 'scheduled'>('all')
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [matchDate, setMatchDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [matchError, setMatchError] = useState('')
  const [coverage, setCoverage] = useState<{ successfulLeagues: number; requestedLeagues: number } | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  // Match Detail State
  const [detail, setDetail] = useState<MatchDetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState<'resumen' | 'lineups' | 'stats' | 'h2h' | 'coverage'>('resumen')
  const [eventFilter, setEventFilter] = useState<'all' | 'goal' | 'card' | 'sub'>('all')

  // Standings State
  const [standingsLeague, setStandingsLeague] = useState('esp.1')
  const [standingsData, setStandingsData] = useState<StandingsResponse | null>(null)
  const [standingsLoading, setStandingsLoading] = useState(false)
  const [standingsError, setStandingsError] = useState('')

  // News State
  const [newsLeague, setNewsLeague] = useState('esp.1')
  const [news, setNews] = useState<NewsArticle[]>([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState('')

  // API Playground Console State
  const [testEndpoint, setTestEndpoint] = useState('/api/scoreboard?league=all')
  const [consoleOutput, setConsoleOutput] = useState<string>('')
  const [consoleLoading, setConsoleLoading] = useState(false)
  const [consoleTime, setConsoleTime] = useState<number | null>(null)
  const [consoleStatus, setConsoleStatus] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [snippetLanguage, setSnippetLanguage] = useState<'fetch' | 'axios' | 'python' | 'curl'>('fetch')

  const navigateTo = useCallback((screen: typeof activeScreen) => {
    setActiveScreen(screen)
  }, [])

  // ─── Data Fetching: Scoreboard ─────────────────────────────────────────────

  const loadMatches = useCallback(async () => {
    setRefreshing(true)
    setMatchError('')
    try {
      const dateParam = matchDate.replaceAll('-', '')
      const response = await fetch(`/api/scoreboard?league=${selectedLeague}&date=${dateParam}`, { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.data?.error?.message || 'Error al consultar marcadores')

      const nextMatches: Match[] = body.data?.matches ?? []
      setMatches(nextMatches)
      if (body.data?.coverage) {
        setCoverage({
          successfulLeagues: body.data.coverage.successfulLeagues,
          requestedLeagues: body.data.coverage.requestedLeagues,
        })
      }
      setSelectedMatch((current) => (current && nextMatches.find((m) => m.id === current.id)) || nextMatches[0] || null)
      setUpdatedAt(new Date())
    } catch (err) {
      setMatchError(err instanceof Error ? err.message : 'Error de conexión')
    } finally {
      setLoadingMatches(false)
      setRefreshing(false)
    }
  }, [matchDate, selectedLeague])

  useEffect(() => {
    loadMatches()
    const interval = window.setInterval(loadMatches, 30000)
    return () => window.clearInterval(interval)
  }, [loadMatches])

  // ─── Data Fetching: Match Detail ───────────────────────────────────────────

  useEffect(() => {
    if (!selectedMatch) {
      setDetail(null)
      return
    }
    let cancelled = false
    const fetchDetail = async () => {
      setDetailLoading(true)
      try {
        const slug = selectedMatch.league?.id || 'esp.1'
        const res = await fetch(`/api/matches/${selectedMatch.id}?league=${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        })
        const body = await res.json()
        if (!cancelled && res.ok && body.data) {
          setDetail(body.data)
        }
      } catch (err) {
        console.error('Error al cargar detalle del partido:', err)
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    fetchDetail()
    return () => {
      cancelled = true
    }
  }, [selectedMatch])

  // ─── Data Fetching: Standings ──────────────────────────────────────────────

  const loadStandings = useCallback(async (slug: string) => {
    setStandingsLoading(true)
    setStandingsError('')
    try {
      const res = await fetch(`/api/standings/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.data?.error?.message || 'No se pudo cargar la clasificación')
      setStandingsData(body.data)
    } catch (err) {
      setStandingsData(null)
      setStandingsError(err instanceof Error ? err.message : 'Error al cargar la tabla')
    } finally {
      setStandingsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStandings(standingsLeague)
  }, [standingsLeague, loadStandings])

  // ─── Data Fetching: News ───────────────────────────────────────────────────

  const loadNews = useCallback(async (slug: string) => {
    setNewsLoading(true)
    setNewsError('')
    try {
      const res = await fetch(`/api/news/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.data?.error?.message || 'No se pudieron cargar las noticias')
      setNews(body.data?.articles ?? [])
    } catch (err) {
      setNews([])
      setNewsError(err instanceof Error ? err.message : 'Error al cargar noticias')
    } finally {
      setNewsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNews(newsLeague)
  }, [newsLeague, loadNews])

  // ─── Filtered Matches ──────────────────────────────────────────────────────

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      const searchMatch =
        m.homeTeam.name.toLowerCase().includes(query.toLowerCase()) ||
        m.awayTeam.name.toLowerCase().includes(query.toLowerCase()) ||
        m.league.name.toLowerCase().includes(query.toLowerCase())
      if (!searchMatch) return false

      if (statusFilter === 'all') return true
      return m.status.state === statusFilter
    })
  }, [matches, query, statusFilter])

  const liveCount = useMemo(() => matches.filter((m) => m.status.state === 'live').length, [matches])
  const finishedCount = useMemo(() => matches.filter((m) => m.status.state === 'finished').length, [matches])
  const scheduledCount = useMemo(() => matches.filter((m) => m.status.state === 'scheduled').length, [matches])
  const totalGoals = useMemo(() => matches.reduce((acc, m) => acc + m.score.home + m.score.away, 0), [matches])

  // ─── Match Center Detail Helpers ───────────────────────────────────────────

  const currentMatch = selectedMatch
  const currentDetail = detail
  const allEvents = currentDetail?.events?.events ?? []

  const filteredEvents = useMemo(() => {
    if (eventFilter === 'all') return allEvents
    if (eventFilter === 'goal') return currentDetail?.events?.goals ?? []
    if (eventFilter === 'card') return currentDetail?.events?.cards ?? []
    if (eventFilter === 'sub') return currentDetail?.events?.substitutions ?? []
    return allEvents
  }, [allEvents, currentDetail, eventFilter])

  // ─── API Console Runner ────────────────────────────────────────────────────

  const runApiTest = async (endpointUrl: string) => {
    setConsoleLoading(true)
    setTestEndpoint(endpointUrl)
    const startTime = performance.now()
    try {
      const res = await fetch(endpointUrl)
      const latency = Math.round(performance.now() - startTime)
      const data = await res.json()
      setConsoleTime(latency)
      setConsoleStatus(res.status)
      setConsoleOutput(JSON.stringify(data, null, 2))
    } catch (err) {
      setConsoleTime(Math.round(performance.now() - startTime))
      setConsoleStatus(500)
      setConsoleOutput(JSON.stringify({ error: err instanceof Error ? err.message : 'Error desconocido' }, null, 2))
    } finally {
      setConsoleLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="dashboard-shell" id="app-root">
      {/* Sidebar Navigation */}
      <aside className="sidebar" aria-label="Barra lateral">
        <div className="sidebar-brand">
          <span className="brand-mark">
            <Trophy size={20} />
          </span>
          <div>
            FÚTBOL
            <br />
            <b>API PRO</b>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-label">PANEL PRINCIPAL</span>
          <button
            className={`sidebar-link ${activeScreen === 'overview' ? 'active' : ''}`}
            onClick={() => navigateTo('overview')}
          >
            <Activity size={16} /> Resumen General
          </button>
          <button
            className={`sidebar-link ${activeScreen === 'matches' ? 'active' : ''}`}
            onClick={() => navigateTo('matches')}
          >
            <Calendar size={16} /> Partidos & Fechas
            {liveCount > 0 && <span className="nav-count" style={{ color: 'var(--cyan)' }}>{liveCount} en vivo</span>}
          </button>
          <button
            className={`sidebar-link ${activeScreen === 'match' ? 'active' : ''}`}
            onClick={() => navigateTo('match')}
          >
            <ShieldCheck size={16} /> Centro de Partido
          </button>

          <span className="sidebar-label">COMPETICIONES</span>
          <button
            className={`sidebar-link ${activeScreen === 'standings' ? 'active' : ''}`}
            onClick={() => navigateTo('standings')}
          >
            <TableProperties size={16} /> Clasificaciones
          </button>
          <button
            className={`sidebar-link ${activeScreen === 'news' ? 'active' : ''}`}
            onClick={() => navigateTo('news')}
          >
            <Flame size={16} /> Noticias ESPN <span className="nav-count">{news.length || '—'}</span>
          </button>

          <span className="sidebar-label">INTEGRACIÓN Y APIS</span>
          <button
            className={`sidebar-link ${activeScreen === 'api' ? 'active' : ''}`}
            onClick={() => {
              navigateTo('api')
              if (!consoleOutput) runApiTest('/api/scoreboard?league=all')
            }}
          >
            <Terminal size={16} /> Consola & Swagger
          </button>
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="pulse" /> ESPN PROXY ONLINE
          </div>
          <small>Respuestas normalizadas v2.0</small>
        </div>
      </aside>

      {/* Main Container */}
      <main className="dashboard-main" data-screen={activeScreen}>
        {/* Topbar */}
        <header className="topbar" id="main-header">
          <div className="brand">
            <span className="brand-mark">
              <Trophy size={18} />
            </span>
            <span>FÚTBOL API PRO</span>
            <span className="version-pill active-v2">API NORMALIZADA v2.0</span>
          </div>

          <nav className="nav-links">
            <button className={activeScreen === 'overview' ? 'active' : ''} onClick={() => navigateTo('overview')}>
              Resumen
            </button>
            <button className={activeScreen === 'matches' ? 'active' : ''} onClick={() => navigateTo('matches')}>
              Partidos
            </button>
            <button className={activeScreen === 'match' ? 'active' : ''} onClick={() => navigateTo('match')}>
              Detalle en Vivo
            </button>
            <button className={activeScreen === 'standings' ? 'active' : ''} onClick={() => navigateTo('standings')}>
              Clasificación
            </button>
            <button className={activeScreen === 'api' ? 'active' : ''} onClick={() => navigateTo('api')}>
              Playground API
            </button>
          </nav>

          <div className="top-actions">
            <span className={`live-dot ${matchError ? 'offline' : ''}`}>
              <Wifi size={14} />
              {matchError
                ? 'DESCONECTADO'
                : coverage
                  ? `${coverage.successfulLeagues}/${coverage.requestedLeagues} LIGAS SINCRONIZADAS`
                  : 'ESPN ACTIVO'}
            </span>
          </div>
        </header>

        {/* ─── SCREEN 1: OVERVIEW & HERO ───────────────────────────────────── */}
        <section className="hero page-section overview-screen" id="overview">
          <div>
            <div className="eyebrow">
              <span className="pulse" /> ARQUITECTURA DE DATOS NORMALIZADA
            </div>
            <h1>
              API de Fútbol.<br />
              <em>Simple de Integrar.</em>
            </h1>
            <p>
              Transformamos la estructura anidada de ESPN en objetos limpios, tipados y consistentes:{' '}
              <code>homeTeam</code>, <code>awayTeam</code>, <code>score</code>, formaciones tácticas, estadísticas avanzadas y clasificaciones en tiempo real.
            </p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => navigateTo('matches')}>
                Explorar Partidos <ArrowUpRight size={16} />
              </button>
              <button className="secondary-button" onClick={() => navigateTo('api')}>
                <Terminal size={15} /> Probar en Playground
              </button>
            </div>
          </div>

          {/* Featured Highlight Match Card */}
          <div className="hero-card">
            <div className="card-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={15} /> PARTIDO DESTACADO
              </span>
              {selectedMatch?.status.state === 'live' ? (
                <span className="live-badge-glow">
                  <span className="pulse" style={{ width: '6px', height: '6px' }} /> EN VIVO
                </span>
              ) : (
                <span className="version-pill">{selectedMatch ? formatMatchStatus(selectedMatch.status) : '—'}</span>
              )}
            </div>

            {selectedMatch ? (
              <div className="hero-score">
                <div>
                  <TeamBadge
                    logo={selectedMatch.homeTeam.logo}
                    name={selectedMatch.homeTeam.name}
                    shortName={selectedMatch.homeTeam.shortName}
                  />
                  <strong>{selectedMatch.homeTeam.name}</strong>
                  {detail?.lineups?.home?.formation && (
                    <span className="formation-tag">{detail.lineups.home.formation}</span>
                  )}
                </div>
                <div className="hero-numbers">
                  <b>{selectedMatch.score.home}</b>
                  <span>:</span>
                  <b>{selectedMatch.score.away}</b>
                  <small>{formatTime(selectedMatch.startTime)}</small>
                </div>
                <div>
                  <TeamBadge
                    logo={selectedMatch.awayTeam.logo}
                    name={selectedMatch.awayTeam.name}
                    shortName={selectedMatch.awayTeam.shortName}
                  />
                  <strong>{selectedMatch.awayTeam.name}</strong>
                  {detail?.lineups?.away?.formation && (
                    <span className="formation-tag">{detail.lineups.away.formation}</span>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: '#72889e' }}>
                {loadingMatches ? 'Cargando datos de ESPN…' : 'No hay partidos seleccionados'}
              </div>
            )}

            <div className="hero-foot">
              <span>
                Competición: <b>{selectedMatch?.league.name ?? 'ESPN Soccer'}</b>
              </span>
              <span>
                Estadio: <b>{selectedMatch?.venue.name ?? 'Estadio oficial'}</b>
              </span>
            </div>
          </div>
        </section>

        {/* Overview Stats Counters */}
        <section className="stats-grid page-section overview-screen">
          <div className="stat-card">
            <div className="stat-icon blue">
              <Database size={18} />
            </div>
            <span>TOTAL PARTIDOS</span>
            <strong>{loadingMatches ? '—' : matches.length}</strong>
            <small className="muted">En cartelera hoy</small>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              <Activity size={18} />
            </div>
            <span>EN VIVO AHORA</span>
            <strong>{loadingMatches ? '—' : liveCount}</strong>
            <small className="positive">Refresco cada 30s</small>
          </div>

          <div className="stat-card">
            <div className="stat-icon purple">
              <Globe2 size={18} />
            </div>
            <span>LIGAS CUBIERTAS</span>
            <strong>{allLeaguesList.length - 1}</strong>
            <small className="muted">Europa, América y Copas</small>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              <Zap size={18} />
            </div>
            <span>DATOS NORMALIZADOS</span>
            <strong>100%</strong>
            <small className="positive">Tipados en TypeScript</small>
          </div>

          <div className="stat-card">
            <div className="stat-icon red">
              <Activity size={18} />
            </div>
            <span>GOLES REGISTRADOS</span>
            <strong>{loadingMatches ? '—' : totalGoals}</strong>
            <small className="muted">En partidos activos</small>
          </div>
        </section>

        {/* ─── SCREEN 2: MATCHES & MATCH CENTER ────────────────────────────── */}
        <section className="content-grid page-section matches-screen">
          {/* Left Panel: Matches List */}
          <div className="panel matches-panel">
            <div className="panel-header">
              <div>
                <h2>Partidos y Resultados</h2>
                <p>
                  {updatedAt
                    ? `Actualizado ${updatedAt.toLocaleTimeString()} · ${formatDateLabel(matchDate)}`
                    : `Jornada del ${formatDateLabel(matchDate)}`}
                </p>
              </div>
              <button className="refresh-button" onClick={loadMatches} disabled={refreshing}>
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Actualizando…' : 'Actualizar'}
              </button>
            </div>

            {/* Filter Bar */}
            <div className="filters-bar">
              <div className="filters-row">
                <div className="select-wrap" style={{ flex: 1.2 }}>
                  <select
                    value={selectedLeague}
                    onChange={(e) => setSelectedLeague(e.target.value)}
                    aria-label="Filtrar por liga"
                  >
                    {Array.from(new Set(allLeaguesList.map((item) => item.group))).map((group) => (
                      <optgroup key={group} label={group}>
                        {allLeaguesList
                          .filter((item) => item.group === group)
                          .map((item) => (
                            <option key={item.slug} value={item.slug}>
                              {item.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>

                <div className="search">
                  <Search size={14} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar equipo o competición..."
                  />
                </div>
              </div>

              {/* Date Navigation Strip */}
              <div className="date-controls">
                <button
                  className="pill-btn"
                  onClick={() => setMatchDate((curr) => shiftDate(curr, -1))}
                  title="Día anterior"
                >
                  ◀ Ayer
                </button>
                <input
                  type="date"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  aria-label="Seleccionar fecha"
                />
                <button
                  className="pill-btn"
                  onClick={() => setMatchDate((curr) => shiftDate(curr, 1))}
                  title="Día siguiente"
                >
                  Mañana ▶
                </button>
                <button
                  className="pill-btn"
                  onClick={() => setMatchDate(new Date().toISOString().slice(0, 10))}
                  title="Hoy"
                >
                  Hoy
                </button>
              </div>

              {/* Status Filter Pills */}
              <div className="pill-group">
                <button
                  className={`pill-btn ${statusFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('all')}
                >
                  Todos ({matches.length})
                </button>
                <button
                  className={`pill-btn ${statusFilter === 'live' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('live')}
                >
                  🔴 En Vivo ({liveCount})
                </button>
                <button
                  className={`pill-btn ${statusFilter === 'finished' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('finished')}
                >
                  Finalizados ({finishedCount})
                </button>
                <button
                  className={`pill-btn ${statusFilter === 'scheduled' ? 'active' : ''}`}
                  onClick={() => setStatusFilter('scheduled')}
                >
                  Próximos ({scheduledCount})
                </button>
              </div>
            </div>

            {/* Error Message if any */}
            {matchError && <div className="error-state">{matchError}. Revisa la conexión de red.</div>}

            {/* Matches List Rows */}
            <div className="match-list">
              {!loadingMatches &&
                filteredMatches.map((m) => {
                  const isSelected = selectedMatch?.id === m.id
                  const isLive = m.status.state === 'live'
                  const isFinished = m.status.state === 'finished'

                  return (
                    <button
                      key={m.id}
                      className={`match-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedMatch(m)
                        navigateTo('match')
                      }}
                    >
                      <div className="match-status">
                        <span className={`status-dot ${isLive ? 'green-dot' : isFinished ? 'gray-dot' : 'yellow-dot'}`} />
                        <b>{formatMatchStatus(m.status)}</b>
                        <small title={m.league.name}>{m.league.name}</small>
                      </div>

                      <div className="teams">
                        <span>
                          <TeamBadge logo={m.homeTeam.logo} name={m.homeTeam.name} shortName={m.homeTeam.shortName} />
                          {m.homeTeam.name}
                        </span>
                        <strong>{m.status.state === 'scheduled' ? '-' : m.score.home}</strong>
                        <span>
                          <TeamBadge logo={m.awayTeam.logo} name={m.awayTeam.name} shortName={m.awayTeam.shortName} />
                          {m.awayTeam.name}
                        </span>
                        <strong>{m.status.state === 'scheduled' ? '-' : m.score.away}</strong>
                      </div>

                      <div className="match-time">
                        <b>{formatTime(m.startTime)}</b>
                        <small>{isLive ? 'LIVE' : m.venue.city || 'Estadio'}</small>
                      </div>
                    </button>
                  )
                })}

              {!loadingMatches && filteredMatches.length === 0 && (
                <div style={{ padding: '36px', textAlign: 'center', color: '#72889e' }}>
                  No se encontraron partidos para este filtro o fecha. Prueba cambiando de fecha o liga.
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Comprehensive Match Center */}
          <aside className="right-column">
            <div className="panel detail-panel">
              <div className="panel-header">
                <div>
                  <h2>Centro de Partido</h2>
                  <p>{selectedMatch?.league.name ?? 'Detalle completo del encuentro'}</p>
                </div>
                {selectedMatch && (
                  <span className="version-pill active-v2">
                    {formatMatchStatus(selectedMatch.status)}
                  </span>
                )}
              </div>

              {selectedMatch ? (
                <>
                  {/* Scoreboard Header */}
                  <div className="detail-teams">
                    <div>
                      <TeamBadge
                        logo={selectedMatch.homeTeam.logo}
                        name={selectedMatch.homeTeam.name}
                        shortName={selectedMatch.homeTeam.shortName}
                      />
                      <b>{selectedMatch.homeTeam.name}</b>
                      {detail?.lineups?.home?.formation && (
                        <span className="formation-tag">{detail.lineups.home.formation}</span>
                      )}
                    </div>
                    <div className="detail-score">
                      <strong>
                        {selectedMatch.score.home} : {selectedMatch.score.away}
                      </strong>
                      <small>{formatTime(selectedMatch.startTime)}</small>
                    </div>
                    <div>
                      <TeamBadge
                        logo={selectedMatch.awayTeam.logo}
                        name={selectedMatch.awayTeam.name}
                        shortName={selectedMatch.awayTeam.shortName}
                      />
                      <b>{selectedMatch.awayTeam.name}</b>
                      {detail?.lineups?.away?.formation && (
                        <span className="formation-tag">{detail.lineups.away.formation}</span>
                      )}
                    </div>
                  </div>

                  {/* Navigation Tabs */}
                  <div className="detail-tabs">
                    <button
                      className={`tab-btn ${activeDetailTab === 'resumen' ? 'active' : ''}`}
                      onClick={() => setActiveDetailTab('resumen')}
                    >
                      <Activity size={14} /> Incidencias
                    </button>
                    <button
                      className={`tab-btn ${activeDetailTab === 'lineups' ? 'active' : ''}`}
                      onClick={() => setActiveDetailTab('lineups')}
                    >
                      <Users size={14} /> Alineaciones
                    </button>
                    <button
                      className={`tab-btn ${activeDetailTab === 'stats' ? 'active' : ''}`}
                      onClick={() => setActiveDetailTab('stats')}
                    >
                      <BarChart3 size={14} /> Estadísticas
                    </button>
                    <button
                      className={`tab-btn ${activeDetailTab === 'h2h' ? 'active' : ''}`}
                      onClick={() => setActiveDetailTab('h2h')}
                    >
                      <Flame size={14} /> Cara a Cara (H2H)
                    </button>
                    <button
                      className={`tab-btn ${activeDetailTab === 'coverage' ? 'active' : ''}`}
                      onClick={() => setActiveDetailTab('coverage')}
                    >
                      <Globe2 size={14} /> Estadio & Cobertura
                    </button>
                  </div>

                  {detailLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--cyan)', fontSize: '12px', marginBottom: '14px' }}>
                      <RefreshCw size={14} className="animate-spin" /> Obteniendo detalle y alineaciones normalizadas...
                    </div>
                  )}

                  {/* Tab 1: Resumen & Timeline */}
                  {activeDetailTab === 'resumen' && (
                    <div>
                      <div className="pill-group" style={{ marginBottom: '14px' }}>
                        <button
                          className={`pill-btn ${eventFilter === 'all' ? 'active' : ''}`}
                          onClick={() => setEventFilter('all')}
                        >
                          Todos ({allEvents.length})
                        </button>
                        <button
                          className={`pill-btn ${eventFilter === 'goal' ? 'active' : ''}`}
                          onClick={() => setEventFilter('goal')}
                        >
                          ⚽ Goles ({currentDetail?.events?.goals?.length ?? 0})
                        </button>
                        <button
                          className={`pill-btn ${eventFilter === 'card' ? 'active' : ''}`}
                          onClick={() => setEventFilter('card')}
                        >
                          🟨 Tarjetas ({currentDetail?.events?.cards?.length ?? 0})
                        </button>
                        <button
                          className={`pill-btn ${eventFilter === 'sub' ? 'active' : ''}`}
                          onClick={() => setEventFilter('sub')}
                        >
                          🔄 Cambios ({currentDetail?.events?.substitutions?.length ?? 0})
                        </button>
                      </div>

                      <div className="timeline-list">
                        {filteredEvents.map((ev, idx) => {
                          const isGoal = ev.type === 'goal'
                          const isCard = ev.type === 'yellowCard' || ev.type === 'redCard'
                          const icon = isGoal ? '⚽' : isCard ? (ev.type === 'redCard' ? '🟥' : '🟨') : ev.type === 'substitution' ? '🔄' : '📌'

                          return (
                            <div
                              key={ev.id || idx}
                              className={`timeline-event-card ${isGoal ? 'scoring' : isCard ? 'card-event' : ''}`}
                            >
                              <span className="event-min">{ev.minute ?? '—'}</span>
                              <span style={{ fontSize: '16px' }}>{icon}</span>
                              <div>
                                <b style={{ color: '#edf5fb' }}>{ev.label}</b>
                                <div style={{ fontSize: '11px', color: '#72889e' }}>
                                  {ev.team} {ev.players.length > 0 ? `· ${ev.players.join(', ')}` : ''}
                                </div>
                              </div>
                            </div>
                          )
                        })}

                        {filteredEvents.length === 0 && (
                          <div style={{ padding: '24px', textAlign: 'center', color: '#72889e', fontSize: '12px' }}>
                            {detailLoading ? 'Cargando eventos...' : 'No hay incidencias registradas en esta categoría.'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Alineaciones & Cancha Táctica */}
                  {activeDetailTab === 'lineups' && (
                    <div>
                      {/* Virtual Tactical Pitch */}
                      <div className="tactical-pitch">
                        <div className="pitch-center-circle" />

                        {/* Home Half */}
                        <div className="pitch-half">
                          <div style={{ position: 'absolute', top: 10, left: 12, color: 'var(--cyan)', font: '10px monospace', fontWeight: 700 }}>
                            {detail?.lineups?.home?.team?.name || selectedMatch.homeTeam.name} ({detail?.lineups?.home?.formation || '4-3-3'})
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: '100%', paddingTop: '16px' }}>
                            {(detail?.lineups?.home?.starters?.slice(0, 11) ?? []).map((p, idx) => (
                              <div key={idx} className="pitch-player">
                                <span className="pitch-player-badge">{p.number || idx + 1}</span>
                                <span style={{ maxWidth: '48px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.shortName || p.name.split(' ').pop()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Away Half */}
                        <div className="pitch-half">
                          <div style={{ position: 'absolute', top: 10, right: 12, color: '#38bdf8', font: '10px monospace', fontWeight: 700 }}>
                            {detail?.lineups?.away?.team?.name || selectedMatch.awayTeam.name} ({detail?.lineups?.away?.formation || '4-3-3'})
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: '100%', paddingTop: '16px' }}>
                            {(detail?.lineups?.away?.starters?.slice(0, 11) ?? []).map((p, idx) => (
                              <div key={idx} className="pitch-player">
                                <span className="pitch-player-badge away-badge">{p.number || idx + 1}</span>
                                <span style={{ maxWidth: '48px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.shortName || p.name.split(' ').pop()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Lineup Lists */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                        {/* Home Roster */}
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cyan)', marginBottom: '10px' }}>
                            Titulares {selectedMatch.homeTeam.name}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {(detail?.lineups?.home?.starters ?? []).map((p, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: 'rgba(10, 22, 38, 0.6)',
                                  padding: '7px 10px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  border: '1px solid rgba(255,255,255,0.04)',
                                }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <b style={{ color: 'var(--cyan)', font: '11px monospace' }}>#{p.number || '-'}</b>
                                  <span>{p.name}</span>
                                </span>
                                <span style={{ color: '#7991a6', font: '10px monospace' }}>{p.position || 'JUG'}</span>
                              </div>
                            ))}
                            {(detail?.lineups?.home?.starters ?? []).length === 0 && (
                              <div style={{ color: '#72889e', fontSize: '12px' }}>Alineación no disponible aún.</div>
                            )}
                          </div>
                        </div>

                        {/* Away Roster */}
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', marginBottom: '10px' }}>
                            Titulares {selectedMatch.awayTeam.name}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {(detail?.lineups?.away?.starters ?? []).map((p, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: 'rgba(10, 22, 38, 0.6)',
                                  padding: '7px 10px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  border: '1px solid rgba(255,255,255,0.04)',
                                }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <b style={{ color: '#38bdf8', font: '11px monospace' }}>#{p.number || '-'}</b>
                                  <span>{p.name}</span>
                                </span>
                                <span style={{ color: '#7991a6', font: '10px monospace' }}>{p.position || 'JUG'}</span>
                              </div>
                            ))}
                            {(detail?.lineups?.away?.starters ?? []).length === 0 && (
                              <div style={{ color: '#72889e', fontSize: '12px' }}>Alineación no disponible aún.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Estadísticas Comparativas */}
                  {activeDetailTab === 'stats' && (
                    <div>
                      <div className="stats-list">
                        {(detail?.stats?.stats ?? []).map((st) => {
                          const total = st.homeNumeric + st.awayNumeric || 1
                          const homePct = Math.round((st.homeNumeric / total) * 100)
                          const awayPct = 100 - homePct

                          return (
                            <div key={st.key} className="stat-row">
                              <div className="stat-header-row">
                                <b style={{ color: 'var(--cyan)', font: '13px monospace' }}>{st.homeValue}</b>
                                <span>{st.label}</span>
                                <b style={{ color: '#3b82f6', font: '13px monospace' }}>{st.awayValue}</b>
                              </div>
                              <div className="stat-bar-track">
                                <div className="stat-bar-home" style={{ width: `${homePct}%` }} />
                                <div className="stat-bar-away" style={{ width: `${awayPct}%` }} />
                              </div>
                            </div>
                          )
                        })}

                        {(detail?.stats?.stats ?? []).length === 0 && (
                          <div style={{ padding: '24px', textAlign: 'center', color: '#72889e', fontSize: '12px' }}>
                            {detailLoading ? 'Cargando estadísticas...' : 'Estadísticas disponibles al inicio del juego.'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tab 4: Cara a Cara (H2H) */}
                  {activeDetailTab === 'h2h' && (
                    <div>
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--cyan)', marginBottom: '8px' }}>
                          Historial Directo Reciente
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(detail?.h2h?.headToHead ?? []).map((m, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                background: 'rgba(10, 22, 38, 0.6)',
                                padding: '9px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                border: '1px solid rgba(255,255,255,0.04)',
                              }}
                            >
                              <span>{m.date ? new Date(m.date).toLocaleDateString() : 'Encuentro previo'}</span>
                              <b style={{ color: '#fff' }}>
                                {m.homeTeam} {m.homeScore} - {m.awayScore} {m.awayTeam}
                              </b>
                            </div>
                          ))}
                          {(detail?.h2h?.headToHead ?? []).length === 0 && (
                            <div style={{ color: '#72889e', fontSize: '12px' }}>Sin partidos previos registrados.</div>
                          )}
                        </div>
                      </div>

                      {/* Recent Form */}
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#88a0b5', marginBottom: '8px' }}>
                          Últimos 5 Partidos (Racha)
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          {(detail?.h2h?.recentForm ?? []).map((rf, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: 'rgba(10, 22, 38, 0.7)',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.06)',
                              }}
                            >
                              <b style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#fff' }}>
                                {rf.team}
                              </b>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {rf.matches.map((match, mIdx) => {
                                  const isWin = match.result === 'W'
                                  const isLoss = match.result === 'L'
                                  const bg = isWin ? '#10b981' : isLoss ? '#f43f5e' : '#f59e0b'

                                  return (
                                    <div
                                      key={mIdx}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: '11px',
                                        color: '#94a7b8',
                                      }}
                                    >
                                      <span>vs {match.opponent}</span>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>{match.score}</span>
                                        <span
                                          style={{
                                            background: bg,
                                            color: '#fff',
                                            padding: '1px 5px',
                                            borderRadius: '3px',
                                            fontWeight: 700,
                                            fontSize: '9px',
                                          }}
                                        >
                                          {match.result}
                                        </span>
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 5: Cobertura & Estadio */}
                  {activeDetailTab === 'coverage' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div style={{ background: 'rgba(10, 22, 38, 0.6)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ color: '#72889e', font: '10px monospace' }}>ESTADIO Y SEDE</span>
                        <b style={{ display: 'block', fontSize: '14px', color: '#fff', margin: '4px 0' }}>
                          {detail?.venue?.name || selectedMatch.venue.name || 'Estadio oficial'}
                        </b>
                        <small style={{ color: '#8aa1b6' }}>
                          {detail?.venue?.city || selectedMatch.venue.city || 'Ciudad'}
                          {detail?.venue?.country ? `, ${detail.venue.country}` : ''}
                        </small>
                      </div>

                      <div style={{ background: 'rgba(10, 22, 38, 0.6)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ color: '#72889e', font: '10px monospace' }}>ASISTENCIA OFICIAL</span>
                        <b style={{ display: 'block', fontSize: '14px', color: '#fff', margin: '4px 0' }}>
                          {detail?.venue?.attendance ? `${detail.venue.attendance.toLocaleString()} espectadores` : 'No reportada'}
                        </b>
                        <small style={{ color: '#8aa1b6' }}>Aforo verificado en acta</small>
                      </div>

                      <div style={{ gridColumn: '1 / -1', background: 'rgba(10, 22, 38, 0.6)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ color: '#72889e', font: '10px monospace' }}>CUERPO ARBITRAL</span>
                        <b style={{ display: 'block', fontSize: '13px', color: '#fff', margin: '4px 0' }}>
                          {detail?.venue?.officials?.join(' · ') || 'Designación oficial pendiente'}
                        </b>
                      </div>
                    </div>
                  )}

                  {/* Direct API Endpoint Link */}
                  <div style={{ marginTop: '22px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                    <button
                      className="secondary-button"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => {
                        navigateTo('api')
                        runApiTest(`/api/matches/${selectedMatch.id}?league=${selectedMatch.league.id}`)
                      }}
                    >
                      <Terminal size={15} /> Probar Endpoint en Vivo ({selectedMatch.id})
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#72889e' }}>
                  Selecciona un partido del listado para explorar sus incidencias, alineaciones y estadísticas en tiempo real.
                </div>
              )}
            </div>
          </aside>
        </section>

        {/* ─── SCREEN 3: STANDINGS (TABLAS DE POSICIONES) ──────────────────── */}
        <section className="panel page-section standings-screen" id="tablas">
          <div className="panel-header">
            <div>
              <div className="eyebrow">
                <TableProperties size={14} /> CLASIFICACIÓN OFICIAL NORMALIZADA
              </div>
              <h2>{standingsData?.league?.name || 'Tabla de Posiciones'}</h2>
              <p>Posición, rendimiento, partidos jugados, goles a favor/en contra, diferencia y puntos oficiales.</p>
            </div>

            <div className="select-wrap" style={{ minWidth: '240px' }}>
              <select
                value={standingsLeague}
                onChange={(e) => setStandingsLeague(e.target.value)}
                aria-label="Seleccionar liga"
              >
                {allLeaguesList
                  .filter((l) => l.slug !== 'all')
                  .map((l) => (
                    <option key={l.slug} value={l.slug}>
                      {l.name}
                    </option>
                  ))}
              </select>
              <ChevronDown size={14} />
            </div>
          </div>

          {standingsLoading ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--cyan)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              Obteniendo clasificación normalizada desde ESPN...
            </div>
          ) : standingsError ? (
            <div className="error-state" style={{ padding: '16px' }}>
              {standingsError}
            </div>
          ) : standingsData && standingsData.groups.length > 0 ? (
            standingsData.groups.map((group: StandingGroup, gIdx: number) => (
              <div key={gIdx} style={{ marginBottom: '24px' }}>
                {standingsData.groups.length > 1 && (
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--cyan)', margin: '14px 0 8px' }}>
                    {group.name}
                  </div>
                )}
                <div className="standings-table-wrap">
                  <table className="standings-table">
                    <thead>
                      <tr>
                        <th style={{ width: '45px', textAlign: 'center' }}>POS</th>
                        <th>EQUIPO</th>
                        <th style={{ textAlign: 'center' }}>PJ</th>
                        <th style={{ textAlign: 'center' }}>G</th>
                        <th style={{ textAlign: 'center' }}>E</th>
                        <th style={{ textAlign: 'center' }}>P</th>
                        <th style={{ textAlign: 'center' }}>GF</th>
                        <th style={{ textAlign: 'center' }}>GC</th>
                        <th style={{ textAlign: 'center' }}>DIF</th>
                        <th style={{ textAlign: 'center', color: '#fff' }}>PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row: StandingRow, rIdx: number) => {
                        const isCL = row.position <= 4
                        const isEL = row.position === 5 || row.position === 6
                        const isRel = row.position >= group.rows.length - 2
                        const rankClass = isCL ? 'rank-cl' : isEL ? 'rank-el' : isRel ? 'rank-rel' : ''

                        return (
                          <tr key={row.team.id || rIdx}>
                            <td className={rankClass} style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                              {row.position || rIdx + 1}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <TeamBadge logo={row.team.logo} name={row.team.name} shortName={row.team.shortName} />
                                <span style={{ fontWeight: 600 }}>{row.team.name}</span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>{row.played}</td>
                            <td style={{ textAlign: 'center', color: '#10b981' }}>{row.won}</td>
                            <td style={{ textAlign: 'center', color: '#f59e0b' }}>{row.drawn}</td>
                            <td style={{ textAlign: 'center', color: '#f43f5e' }}>{row.lost}</td>
                            <td style={{ textAlign: 'center' }}>{row.goalsFor}</td>
                            <td style={{ textAlign: 'center' }}>{row.goalsAgainst}</td>
                            <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{row.goalDifference}</td>
                            <td style={{ textAlign: 'center', fontWeight: 800, color: '#fff', fontSize: '14px' }}>
                              {row.points}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#72889e' }}>
              No hay tabla disponible para esta competición o fase de copa.
            </div>
          )}
        </section>

        {/* ─── SCREEN 4: NEWS (NOTICIAS ESPN) ──────────────────────────────── */}
        <section className="panel page-section news-screen" id="noticias">
          <div className="panel-header">
            <div>
              <div className="eyebrow">
                <Flame size={14} /> NOTICIAS EN TIEMPO REAL
              </div>
              <h2>Actualidad y Fichajes</h2>
              <p>Noticias de fútbol sincronizadas y normalizadas con imágenes y enlaces oficiales.</p>
            </div>

            <div className="select-wrap" style={{ minWidth: '220px' }}>
              <select value={newsLeague} onChange={(e) => setNewsLeague(e.target.value)} aria-label="Liga noticias">
                <option value="esp.1">LaLiga EA Sports</option>
                <option value="eng.1">Premier League</option>
                <option value="uefa.champions">UEFA Champions League</option>
                <option value="arg.1">Liga Profesional Argentina</option>
                <option value="mex.1">Liga MX</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </div>

          {newsLoading ? (
            <div style={{ padding: '50px', textAlign: 'center', color: 'var(--cyan)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              Cargando noticias de ESPN...
            </div>
          ) : newsError ? (
            <div className="error-state">{newsError}</div>
          ) : news.length > 0 ? (
            <div className="news-grid">
              {news.map((item, idx) => (
                <article key={item.id || idx} className="news-card">
                  {item.image ? (
                    <img src={item.image} alt={item.headline} loading="lazy" />
                  ) : (
                    <div style={{ height: '140px', background: '#0a1a2c', display: 'grid', placeItems: 'center' }}>
                      <Flame size={28} style={{ color: 'var(--cyan)' }} />
                    </div>
                  )}
                  <div className="news-card-body">
                    <span style={{ color: 'var(--cyan)', font: '10px monospace', textTransform: 'uppercase' }}>
                      {item.categories[0] || 'Fútbol'}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '14px', lineHeight: 1.4, color: '#fff' }}>{item.headline}</h3>
                    <p style={{ margin: 0, color: '#889eb0', fontSize: '12px', lineHeight: 1.5, flex: 1 }}>
                      {item.description}
                    </p>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--cyan)', fontSize: '11px', marginTop: '6px' }}
                      >
                        Leer noticia completa <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#72889e' }}>
              No hay artículos disponibles en este momento.
            </div>
          )}
        </section>

        {/* ─── SCREEN 5: INTERACTIVE API PLAYGROUND & EXPLORER ─────────────── */}
        <section className="panel page-section api-screen" id="api">
          <div className="panel-header">
            <div>
              <div className="eyebrow">
                <Terminal size={14} /> PLAYGROUND & CONSOLA EN VIVO
              </div>
              <h2>Explorador y Pruebas de la API v2.0</h2>
              <p>
                Ejecutá consultas en vivo a cualquiera de los endpoints normalizados. Respuestas JSON predecibles sin bloqueos de CORS.
              </p>
            </div>
            <span className="version-pill active-v2">JSON REST / 100% TIPADO</span>
          </div>

          {/* Quick Endpoint Selection Bar */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[
              { label: 'Scoreboard', path: '/api/scoreboard?league=all' },
              { label: 'En Vivo', path: '/api/live' },
              { label: 'Detalle de Partido', path: `/api/matches/${selectedMatch?.id || '401882881'}?league=${selectedMatch?.league?.id || 'esp.1'}` },
              { label: 'Alineaciones', path: `/api/matches/${selectedMatch?.id || '401882881'}/lineups?league=${selectedMatch?.league?.id || 'esp.1'}` },
              { label: 'Estadísticas', path: `/api/matches/${selectedMatch?.id || '401882881'}/stats?league=${selectedMatch?.league?.id || 'esp.1'}` },
              { label: 'Eventos & Goles', path: `/api/matches/${selectedMatch?.id || '401882881'}/events?league=${selectedMatch?.league?.id || 'esp.1'}` },
              { label: 'Cara a Cara', path: `/api/matches/${selectedMatch?.id || '401882881'}/h2h?league=${selectedMatch?.league?.id || 'esp.1'}` },
              { label: 'Clasificación', path: `/api/standings/${standingsLeague}` },
              { label: 'Equipos', path: `/api/teams/${standingsLeague}` },
              { label: 'Noticias', path: `/api/news/${newsLeague}` },
              { label: 'Catálogo Ligas', path: '/api/leagues' },
            ].map((ep) => (
              <button
                key={ep.path}
                className={`pill-btn ${testEndpoint === ep.path ? 'active' : ''}`}
                onClick={() => runApiTest(ep.path)}
              >
                {ep.label}
              </button>
            ))}
          </div>

          {/* Execution Bar */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="search" style={{ flex: 1, fontFamily: 'monospace' }}>
              <span className="version-pill active-v2" style={{ padding: '2px 6px' }}>GET</span>
              <input
                value={testEndpoint}
                onChange={(e) => setTestEndpoint(e.target.value)}
                placeholder="Ruta del endpoint..."
              />
            </div>
            <button
              className="primary-button"
              onClick={() => runApiTest(testEndpoint)}
              disabled={consoleLoading}
            >
              <Play size={14} /> {consoleLoading ? 'Ejecutando...' : 'Ejecutar Petición'}
            </button>
          </div>

          {/* Interactive Live Console Output */}
          <div className="api-console-box">
            <div className="console-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#fff', font: '11px monospace' }}>RESPUESTA EN VIVO:</span>
                {consoleStatus !== null && (
                  <span
                    style={{
                      background: consoleStatus === 200 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: consoleStatus === 200 ? 'var(--cyan)' : '#f87171',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      font: '10px monospace',
                      fontWeight: 700,
                    }}
                  >
                    HTTP {consoleStatus}
                  </span>
                )}
                {consoleTime !== null && (
                  <span style={{ color: '#72889e', font: '10px monospace' }}>{consoleTime} ms</span>
                )}
              </div>

              <div className="console-actions">
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(consoleOutput)}
                  title="Copiar JSON"
                >
                  {copied ? <Check size={12} style={{ color: 'var(--cyan)' }} /> : <Copy size={12} />}
                  {copied ? '¡Copiado!' : 'Copiar JSON'}
                </button>
              </div>
            </div>

            <pre className="code-viewer">
              {consoleOutput || '// Hacé clic en "Ejecutar Petición" para consultar el endpoint seleccionado.'}
            </pre>
          </div>

          {/* Code Integration Snippets Generator */}
          <div style={{ marginTop: '28px', borderTop: '1px solid var(--line)', paddingTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#fff' }}>Snippet de Integración</h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#72889e' }}>
                  Copiá el código listo para tu lenguaje o framework favorito:
                </p>
              </div>

              <div className="pill-group">
                {(['fetch', 'axios', 'python', 'curl'] as const).map((lang) => (
                  <button
                    key={lang}
                    className={`pill-btn ${snippetLanguage === lang ? 'active' : ''}`}
                    onClick={() => setSnippetLanguage(lang)}
                  >
                    {lang === 'fetch' ? 'JS / TS (Fetch)' : lang === 'axios' ? 'Axios' : lang === 'python' ? 'Python' : 'cURL'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: '#050c16', border: '1px solid var(--line)', borderRadius: '8px', padding: '16px', position: 'relative' }}>
              <button
                className="copy-btn"
                style={{ position: 'absolute', top: 12, right: 12 }}
                onClick={() => {
                  const code =
                    snippetLanguage === 'fetch'
                      ? `const response = await fetch('${testEndpoint}')\nconst { data, meta } = await response.json()\nconsole.log(data)`
                      : snippetLanguage === 'axios'
                        ? `import axios from 'axios'\n\nconst { data } = await axios.get('${testEndpoint}')\nconsole.log(data.data)`
                        : snippetLanguage === 'python'
                          ? `import requests\n\nresponse = requests.get('http://localhost:3000${testEndpoint}')\ndata = response.json()\nprint(data['data'])`
                          : `curl -X GET "http://localhost:3000${testEndpoint}" \\\n  -H "Accept: application/json"`
                  copyToClipboard(code)
                }}
              >
                <Copy size={12} /> Copiar Código
              </button>

              <pre style={{ margin: 0, font: '12px monospace', color: '#6ee7b7', lineHeight: 1.6 }}>
                {snippetLanguage === 'fetch' &&
                  `const response = await fetch('${testEndpoint}')\nconst { data, meta } = await response.json()\nconsole.log('Partidos:', data)`}
                {snippetLanguage === 'axios' &&
                  `import axios from 'axios'\n\nconst { data } = await axios.get('${testEndpoint}')\nconsole.log('Payload:', data.data)`}
                {snippetLanguage === 'python' &&
                  `import requests\n\nresponse = requests.get('http://localhost:3000${testEndpoint}')\ndata = response.json()\nprint(data['data'])`}
                {snippetLanguage === 'curl' &&
                  `curl -X GET "http://localhost:3000${testEndpoint}" \\\n  -H "Accept: application/json"`}
              </pre>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer>
          <span>FÚTBOL API PRO © 2026 · Versión 2.0 Normalizada</span>
          <span>Datos en tiempo real sincronizados vía ESPN Server Proxy</span>
          <span className="footer-navigation">
            <button onClick={() => navigateTo('overview')}>Inicio</button> ·{' '}
            <button onClick={() => navigateTo('matches')}>Partidos</button> ·{' '}
            <button onClick={() => navigateTo('standings')}>Tablas</button> ·{' '}
            <button onClick={() => navigateTo('api')}>Consola API</button>
          </span>
        </footer>
      </main>
    </div>
  )
}
