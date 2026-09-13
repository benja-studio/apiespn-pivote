// ─── API Envelope ────────────────────────────────────────────────────────────

export interface ResponseMeta {
  api: string
  version: string
  source: string
  timestamp: string
  timezone: string
  pagination?: PaginationMeta
}

export interface PaginationMeta {
  total: number
  count: number
  offset: number
  limit: number
}

export interface ApiResponse<T> {
  data: T
  meta: ResponseMeta
}

export interface ApiErrorDetail {
  code: string
  message: string
  details?: unknown
}

export interface ApiErrorResponse {
  data: { error: ApiErrorDetail }
  meta: ResponseMeta
}

// ─── League ──────────────────────────────────────────────────────────────────

export interface League {
  id: string
  name: string
  country: string
}

// ─── Team ────────────────────────────────────────────────────────────────────

export interface Team {
  id: string
  name: string
  shortName: string
  logo: string | null
  color: string | null
}

export interface TeamProfile {
  id: string
  name: string
  shortName: string
  location: string | null
  logo: string | null
  color: string | null
  alternateColor: string | null
  standingSummary: string | null
  recordSummary: string | null
  venue: string | null
  athletesCount?: number
  athletes?: Athlete[]
}

// ─── Athletes & Squads ────────────────────────────────────────────────────────

export interface AthletePosition {
  id: string | null
  name: string
  displayName: string
  abbreviation: string
}

export interface Athlete {
  id: string
  fullName: string
  displayName: string
  shortName: string | null
  jersey: string | null
  position: AthletePosition
  citizenship: string | null
  flag: string | null
  age: number | null
  dateOfBirth: string | null
  height: string | null
  weight: string | null
  team: {
    id: string
    name: string
    shortName: string
    logo: string | null
  }
  status: string
}

export interface AthletesResponse {
  league: League
  team?: {
    id: string
    name: string
    shortName: string
    logo: string | null
  } | null
  athletes: Athlete[]
}

// ─── Match (scoreboard-level) ────────────────────────────────────────────────

export type MatchState = 'live' | 'finished' | 'scheduled'

export interface MatchScore {
  home: number
  away: number
}

export interface MatchStatus {
  state: MatchState
  detail: string | null
  clock: string | null
  description: string | null
}

export interface MatchVenue {
  name: string | null
  city: string | null
  country: string | null
}

export interface Match {
  id: string
  league: League
  homeTeam: Team
  awayTeam: Team
  score: MatchScore
  status: MatchStatus
  venue: MatchVenue
  attendance: number | null
  startTime: string
}

export interface ScoreboardResponse {
  matches: Match[]
  coverage: {
    requestedLeagues: number
    successfulLeagues: number
    failedLeagues: number
    errors: Array<{ league: string; error: string }>
  }
}

// ─── Match Events (goals, cards, subs) ───────────────────────────────────────

export type MatchEventType = 'goal' | 'yellowCard' | 'redCard' | 'substitution' | 'other'

export interface MatchEvent {
  id: string
  type: MatchEventType
  label: string
  minute: string | null
  team: string | null
  players: string[]
  isGoal: boolean
}

export interface MatchEventsResponse {
  events: MatchEvent[]
  goals: MatchEvent[]
  cards: MatchEvent[]
  substitutions: MatchEvent[]
}

// ─── Lineups ─────────────────────────────────────────────────────────────────

export interface Player {
  id: string | null
  name: string
  shortName: string | null
  number: string | null
  position: string | null
  isStarter: boolean
  subbedIn: boolean
  subbedOut: boolean
  stats: Array<{ name: string; value: string }>
}

export interface TeamLineup {
  team: Team
  formation: string | null
  starters: Player[]
  substitutes: Player[]
}

export interface LineupsResponse {
  home: TeamLineup | null
  away: TeamLineup | null
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface StatItem {
  key: string
  label: string
  homeValue: string
  awayValue: string
  homeNumeric: number
  awayNumeric: number
}

export interface MatchStatsResponse {
  homeTeam: string
  awayTeam: string
  stats: StatItem[]
}

// ─── Head-to-Head ────────────────────────────────────────────────────────────

export interface H2HMatch {
  date: string | null
  homeTeam: string
  awayTeam: string
  homeScore: string
  awayScore: string
}

export interface RecentForm {
  team: string
  matches: Array<{
    opponent: string
    score: string
    result: string
  }>
}

export interface H2HResponse {
  headToHead: H2HMatch[]
  recentForm: RecentForm[]
}

// ─── Match Detail (full) ─────────────────────────────────────────────────────

export interface MatchDetailResponse {
  match: Match
  lineups: LineupsResponse
  stats: MatchStatsResponse | null
  events: MatchEventsResponse
  h2h: H2HResponse
  venue: MatchVenue & {
    attendance: number | null
    officials: string[]
  }
}

// ─── Standings ───────────────────────────────────────────────────────────────

export interface StandingTeam {
  id: string
  name: string
  shortName: string
  logo: string | null
}

export interface StandingRow {
  position: number
  team: StandingTeam
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
}

export interface StandingGroup {
  name: string
  rows: StandingRow[]
}

export interface StandingsResponse {
  league: League
  season: string | null
  groups: StandingGroup[]
}

// ─── News ────────────────────────────────────────────────────────────────────

export interface NewsArticle {
  id: string
  headline: string
  description: string | null
  published: string | null
  url: string | null
  image: string | null
  imageCaption: string | null
  categories: string[]
}

export interface NewsResponse {
  league: League
  articles: NewsArticle[]
}
