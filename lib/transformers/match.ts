import type {
  Match, MatchState, Team, MatchVenue, League,
  MatchEvent, MatchEventType, MatchEventsResponse,
  Player, TeamLineup, LineupsResponse,
  StatItem, MatchStatsResponse,
  H2HMatch, RecentForm, H2HResponse,
  MatchDetailResponse,
} from '@/lib/types/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeState(espnState?: string): MatchState {
  if (espnState === 'in') return 'live'
  if (espnState === 'post') return 'finished'
  return 'scheduled'
}

function toTeam(espnCompetitor: any): Team {
  const t = espnCompetitor?.team ?? {}
  return {
    id: espnCompetitor?.id ?? t?.id ?? '',
    name: t?.displayName ?? t?.name ?? 'TBD',
    shortName: t?.abbreviation ?? '',
    logo: t?.logo ?? t?.logos?.[0]?.href ?? null,
    color: t?.color ? `#${t.color}` : null,
  }
}

function toVenue(competition: any): MatchVenue {
  const v = competition?.venue
  return {
    name: v?.fullName ?? null,
    city: v?.address?.city ?? null,
    country: v?.address?.country ?? null,
  }
}

// ─── Scoreboard-level match ──────────────────────────────────────────────────

function translateStatusDetail(detail?: string | null): string | null {
  if (!detail) return null
  const d = detail.trim().toUpperCase()
  if (d === 'FT' || d === 'FINAL') return 'Finalizado'
  if (d === 'HT' || d === 'HALF TIME') return 'Entretiempo'
  if (d === 'AET' || d === 'AFTER EXTRA TIME') return 'Tras suplementario'
  if (d === 'ET' || d === 'EXTRA TIME') return 'Tiempo suplementario'
  if (d === 'PEN' || d === 'SHOOTOUT' || d === 'PENALTIES') return 'Definición por penales'
  if (d === 'POSTPONED') return 'Postergado'
  if (d === 'SUSPENDED') return 'Suspendido'
  if (d === 'DELAYED') return 'Demorado'
  if (d === 'CANCELED' || d === 'CANCELLED') return 'Cancelado'
  return detail
}

export function transformMatch(espnEvent: any, league: League): Match {
  const competition = espnEvent.competitions?.[0]
  const competitors = competition?.competitors ?? []
  const home = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0]
  const away = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1]

  const rawDetail = espnEvent.status?.type?.shortDetail ?? null

  return {
    id: String(espnEvent.id ?? ''),
    league,
    homeTeam: toTeam(home),
    awayTeam: toTeam(away),
    score: {
      home: Number(home?.score ?? 0),
      away: Number(away?.score ?? 0),
    },
    status: {
      state: normalizeState(espnEvent.status?.type?.state),
      detail: translateStatusDetail(rawDetail),
      clock: espnEvent.status?.type?.state === 'in'
        ? (espnEvent.status?.type?.shortDetail ?? null)
        : null,
      description: espnEvent.status?.type?.description ?? null,
    },
    venue: toVenue(competition),
    attendance: competition?.attendance ?? null,
    startTime: espnEvent.date ?? new Date().toISOString(),
  }
}

// ─── Key events (goals, cards, subs) ─────────────────────────────────────────

function translateEventLabel(rawLabel?: string, eventType?: MatchEventType): string {
  if (!rawLabel) {
    if (eventType === 'goal') return 'Gol'
    if (eventType === 'yellowCard') return 'Tarjeta amarilla'
    if (eventType === 'redCard') return 'Tarjeta roja'
    if (eventType === 'substitution') return 'Cambio'
    return 'Incidencia'
  }
  const low = rawLabel.toLowerCase()
  if (low.includes('own goal')) return 'Gol en contra'
  if (low.includes('penalty - scored') || low.includes('penalty goal')) return 'Gol de penal'
  if (low.includes('penalty - missed') || low.includes('missed penalty')) return 'Penal errado / atajado'
  if (low.includes('goal - header') || low.includes('header goal')) return 'Gol de cabeza'
  if (low.includes('goal - free kick') || low.includes('free kick goal')) return 'Gol de tiro libre'
  if (low.includes('second yellow') || low.includes('2nd yellow')) return 'Segunda amarilla (Expulsión)'
  if (low.includes('red card')) return 'Tarjeta roja'
  if (low.includes('yellow card')) return 'Tarjeta amarilla'
  if (low.includes('substitution')) return 'Cambio'
  if (low.includes('var') || low.includes('video assistant')) return 'Revisión de VAR'
  if (low === 'goal') return 'Gol'
  return rawLabel
}

function classifyEvent(espnEvent: any): MatchEventType {
  const typeText = (espnEvent.type?.text ?? '').toLowerCase()
  const typeType = (espnEvent.type?.type ?? '').toLowerCase()
  if (espnEvent.scoringPlay || typeType.includes('goal') || typeText.includes('goal')) return 'goal'
  if (typeText.includes('yellow') || typeType.includes('yellowcard')) return 'yellowCard'
  if (typeText.includes('red') || typeType.includes('redcard')) return 'redCard'
  if (typeText.includes('substitution') || typeType.includes('sub')) return 'substitution'
  return 'other'
}

function transformSingleEvent(ev: any): MatchEvent {
  const eventType = classifyEvent(ev)
  const rawLabel = ev.type?.text ?? ev.text ?? ''
  return {
    id: String(ev.id ?? ''),
    type: eventType,
    label: translateEventLabel(rawLabel, eventType),
    minute: ev.clock?.displayValue ?? null,
    team: ev.team?.displayName ?? null,
    players: (ev.participants ?? []).map((p: any) => p.athlete?.displayName ?? '').filter(Boolean),
    isGoal: eventType === 'goal',
  }
}

export function transformEvents(keyEvents: any[]): MatchEventsResponse {
  const events = (keyEvents ?? []).map(transformSingleEvent)
  return {
    events,
    goals: events.filter((e) => e.type === 'goal'),
    cards: events.filter((e) => e.type === 'yellowCard' || e.type === 'redCard'),
    substitutions: events.filter((e) => e.type === 'substitution'),
  }
}

// ─── Lineups ─────────────────────────────────────────────────────────────────

function translateLineupPosition(rawPos?: string): string {
  if (!rawPos) return 'JUG'
  const p = rawPos.toLowerCase()
  if (p.includes('goalkeeper') || p.includes('portero') || p.includes('arquero') || p === 'gk') return 'Arquero'
  if (p.includes('defender') || p.includes('defensa') || p.includes('defensor') || p === 'df') return 'Defensor'
  if (p.includes('center back') || p.includes('central') || p === 'cb') return 'Defensor Central'
  if (p.includes('right back') || p === 'rb') return 'Lateral Derecho'
  if (p.includes('left back') || p === 'lb') return 'Lateral Izquierdo'
  if (p.includes('midfielder') || p.includes('mediocampista') || p.includes('volante') || p === 'mf') return 'Mediocampista'
  if (p.includes('forward') || p.includes('delantero') || p.includes('striker') || p === 'fw' || p === 'cf') return 'Delantero'
  return rawPos
}

function transformPlayer(p: any, isStarter: boolean): Player {
  const rawPos = p.position?.displayName ?? p.position?.abbreviation ?? null
  return {
    id: p.athlete?.id ?? null,
    name: p.athlete?.displayName ?? 'Desconocido',
    shortName: p.athlete?.shortName ?? null,
    number: p.jersey ?? null,
    position: translateLineupPosition(rawPos),
    isStarter,
    subbedIn: p.subbedIn ?? false,
    subbedOut: p.subbedOut ?? false,
    stats: (p.stats ?? []).map((s: any) => ({
      name: s.name ?? s.displayName ?? '',
      value: s.displayValue ?? String(s.value ?? ''),
    })),
  }
}

function transformTeamLineup(roster: any): TeamLineup {
  const allPlayers = roster?.roster ?? []
  return {
    team: toTeam({ team: roster?.team }),
    formation: roster?.formation ?? null,
    starters: allPlayers.filter((p: any) => p.starter).map((p: any) => transformPlayer(p, true)),
    substitutes: allPlayers.filter((p: any) => !p.starter).map((p: any) => transformPlayer(p, false)),
  }
}

export function transformLineups(rosters: any[]): LineupsResponse {
  const home = rosters?.find((r: any) => r.homeAway === 'home') ?? rosters?.[0] ?? null
  const away = rosters?.find((r: any) => r.homeAway === 'away') ?? rosters?.[1] ?? null
  return {
    home: home ? transformTeamLineup(home) : null,
    away: away ? transformTeamLineup(away) : null,
  }
}

// ─── Stats ───────────────────────────────────────────────────────────────────

const STAT_LABELS: Record<string, string> = {
  possessionPct: 'Posesión de la pelota',
  shotsTotal: 'Remates totales',
  shotsOnTarget: 'Remates al arco',
  foulsCommitted: 'Faltas cometidas',
  wonCorners: 'Tiros de esquina',
  offsides: 'Posición adelantada (Offside)',
  saves: 'Atajadas del arquero',
  yellowCards: 'Tarjetas amarillas',
  redCards: 'Tarjetas rojas',
  totalPasses: 'Pases totales',
  passPct: 'Efectividad en pases',
  tackles: 'Quites y barridas',
  interceptions: 'Intercepciones',
  aerialsWon: 'Duelos aéreos ganados',
  clearances: 'Despejes defensivos',
  crossPct: 'Efectividad en centros',
  cornerKicks: 'Tiros de esquina',
  blockedShots: 'Remates bloqueados',
  expectedGoals: 'Goles esperados (xG)',
  xg: 'Goles esperados (xG)',
}

export function transformStats(boxscore: any): MatchStatsResponse | null {
  const teams = boxscore?.teams
  if (!Array.isArray(teams) || teams.length < 2) return null

  const homeStats = teams[0]?.statistics ?? []
  const awayStats = teams[1]?.statistics ?? []

  // Build a unique set of all stat keys present
  const allKeys = new Set<string>()
  homeStats.forEach((s: any) => allKeys.add(s.name))
  awayStats.forEach((s: any) => allKeys.add(s.name))

  const stats: StatItem[] = Array.from(allKeys).map((key) => {
    const h = homeStats.find((s: any) => s.name === key)
    const a = awayStats.find((s: any) => s.name === key)
    return {
      key,
      label: STAT_LABELS[key] ?? h?.displayName ?? a?.displayName ?? key,
      homeValue: h?.displayValue ?? String(h?.value ?? '0'),
      awayValue: a?.displayValue ?? String(a?.value ?? '0'),
      homeNumeric: Number(h?.value ?? 0),
      awayNumeric: Number(a?.value ?? 0),
    }
  })

  return {
    homeTeam: teams[0]?.team?.displayName ?? 'Local',
    awayTeam: teams[1]?.team?.displayName ?? 'Visitante',
    stats,
  }
}

// ─── Head-to-Head ────────────────────────────────────────────────────────────

export function transformH2H(seasonseries: any[], lastFiveGames: any[]): H2HResponse {
  const headToHead: H2HMatch[] = (seasonseries ?? []).flatMap((series: any) =>
    (series.events ?? []).map((ev: any) => {
      const comps = ev.competitions?.[0]?.competitors ?? []
      return {
        date: ev.date ?? null,
        homeTeam: comps[0]?.team?.displayName ?? '',
        awayTeam: comps[1]?.team?.displayName ?? '',
        homeScore: comps[0]?.score?.displayValue ?? comps[0]?.score ?? '',
        awayScore: comps[1]?.score?.displayValue ?? comps[1]?.score ?? '',
      }
    }),
  )

  const recentForm: RecentForm[] = (lastFiveGames ?? []).map((entry: any) => ({
    team: entry.team?.displayName ?? '',
    matches: (entry.events ?? []).map((ev: any) => ({
      opponent: ev.opponent?.displayName ?? '',
      score: ev.score ?? '',
      result: ev.result ?? '',
    })),
  }))

  return { headToHead, recentForm }
}

// ─── Full match detail ───────────────────────────────────────────────────────

export function transformMatchDetail(espnSummary: any, league: League): MatchDetailResponse {
  // Build a pseudo-event from the summary header if available
  const header = espnSummary.header ?? {}
  const competition = header.competitions?.[0] ?? espnSummary.boxscore?.teams?.[0] ? {} : {}

  // Use the first event-like data to build a match
  const pseudoEvent = {
    id: header.id ?? espnSummary.id ?? '',
    date: header.date ?? espnSummary.date ?? new Date().toISOString(),
    competitions: header.competitions ?? [],
    status: header.competitions?.[0]?.status ?? espnSummary.header?.competitions?.[0]?.status ?? { type: {} },
  }

  const match = transformMatch(pseudoEvent, league)

  return {
    match,
    lineups: transformLineups(espnSummary.rosters ?? []),
    stats: transformStats(espnSummary.boxscore),
    events: transformEvents(espnSummary.keyEvents ?? []),
    h2h: transformH2H(espnSummary.seasonseries ?? [], espnSummary.lastFiveGames ?? []),
    venue: {
      name: espnSummary.gameInfo?.venue?.fullName ?? match.venue.name,
      city: espnSummary.gameInfo?.venue?.address?.city ?? match.venue.city,
      country: espnSummary.gameInfo?.venue?.address?.country ?? match.venue.country,
      attendance: espnSummary.gameInfo?.attendance ?? null,
      officials: (espnSummary.gameInfo?.officials ?? []).map((o: any) => o.displayName).filter(Boolean),
    },
  }
}
