import type { League, StandingRow, StandingGroup, StandingsResponse } from '@/lib/types/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statAliases: Record<string, string[]> = {
  rank: ['rank', 'position'],
  gamesPlayed: ['gamesPlayed', 'played', 'games_played'],
  wins: ['wins', 'win'],
  draws: ['ties', 'draws', 'draw'],
  losses: ['losses', 'loss'],
  goalsFor: ['pointsFor', 'goalsFor', 'goals_for'],
  goalsAgainst: ['pointsAgainst', 'goalsAgainst', 'goals_against'],
  goalDifference: ['pointDifferential', 'goalDifference', 'goal_difference'],
  points: ['points', 'pts'],
}

function findStat(entry: any, key: string): number {
  const aliases = statAliases[key] ?? [key]
  const stat = (entry.stats ?? []).find(
    (s: any) => aliases.includes(s.name ?? '') || aliases.includes(s.type ?? ''),
  )
  const val = stat?.value ?? Number.parseFloat(String(stat?.displayValue ?? '').replace(',', '.'))
  return Number.isFinite(val) ? val : 0
}

function transformEntry(entry: any): StandingRow {
  return {
    position: findStat(entry, 'rank'),
    team: {
      id: entry.team?.id ?? '',
      name: entry.team?.displayName ?? '',
      shortName: entry.team?.abbreviation ?? '',
      logo: entry.team?.logos?.[0]?.href ?? null,
    },
    played: findStat(entry, 'gamesPlayed'),
    won: findStat(entry, 'wins'),
    drawn: findStat(entry, 'draws'),
    lost: findStat(entry, 'losses'),
    goalsFor: findStat(entry, 'goalsFor'),
    goalsAgainst: findStat(entry, 'goalsAgainst'),
    goalDifference: findStat(entry, 'goalDifference'),
    points: findStat(entry, 'points'),
  }
}

function sortRows(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => {
    if (a.position && b.position && a.position !== b.position) return a.position - b.position
    if (a.points !== b.points) return b.points - a.points
    if (a.goalDifference !== b.goalDifference) return b.goalDifference - a.goalDifference
    return b.goalsFor - a.goalsFor
  })
}

// ─── Main transformer ────────────────────────────────────────────────────────

export function transformStandings(espnData: any, league: League): StandingsResponse {
  const children = Array.isArray(espnData?.children) ? espnData.children : []

  let groups: StandingGroup[]

  if (children.length > 0) {
    groups = children
      .map((child: any, index: number) => {
        const entries = child.standings?.entries ?? []
        return {
          name: child.name || child.abbreviation || `Zona ${index + 1}`,
          rows: sortRows(entries.map(transformEntry)),
        }
      })
      .filter((g: StandingGroup) => g.rows.length > 0)
  } else {
    const entries = espnData?.standings?.entries ?? []
    groups = [
      {
        name: 'Clasificación general',
        rows: sortRows(entries.map(transformEntry)),
      },
    ]
  }

  return {
    league,
    season: espnData?.season?.displayName ?? espnData?.season?.year?.toString() ?? null,
    groups,
  }
}
