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

export function transformMatch(espnEvent: any, league: League): Match {
  const competition = espnEvent.competitions?.[0]
  const competitors = competition?.competitors ?? []
  const home = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0]
  const away = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1]

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
      detail: espnEvent.status?.type?.shortDetail ?? null,
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
  return {
    id: String(ev.id ?? ''),
    type: eventType,
    label: ev.type?.text ?? ev.text ?? '',
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

function transformPlayer(p: any, isStarter: boolean): Player {
  return {
    id: p.athlete?.id ?? null,
    name: p.athlete?.displayName ?? 'Desconocido',
    shortName: p.athlete?.shortName ?? null,
    number: p.jersey ?? null,
    position: p.position?.displayName ?? p.position?.abbreviation ?? null,
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
  possessionPct: 'Posesión de Balón',
  shotsTotal: 'Tiros Totales',
  shotsOnTarget: 'Tiros al Arco',
  foulsCommitted: 'Faltas Cometidas',
  wonCorners: 'Tiros de Esquina',
  offsides: 'Fueras de Juego',
  saves: 'Atajadas de Portero',
  yellowCards: 'Tarjetas Amarillas',
  redCards: 'Tarjetas Rojas',
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
