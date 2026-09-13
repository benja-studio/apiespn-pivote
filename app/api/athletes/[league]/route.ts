import { NextRequest } from 'next/server'
import { espn, leagueInfo } from '@/lib/espn-client'
import { apiSuccess, apiError, apiOptions } from '@/lib/api-response'
import type { Athlete, AthletePosition } from '@/lib/types/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function translatePosition(rawName?: string, rawAbbr?: string) {
  const n = (rawName || '').toLowerCase()
  if (n.includes('goalkeeper') || n.includes('portero') || n.includes('arquero')) return { displayName: 'Arquero', abbreviation: 'ARQ' }
  if (n.includes('defender') || n.includes('defensa') || n.includes('defensor')) return { displayName: 'Defensor', abbreviation: 'DEF' }
  if (n.includes('midfielder') || n.includes('mediocampista') || n.includes('volante')) return { displayName: 'Mediocampista', abbreviation: 'MED' }
  if (n.includes('forward') || n.includes('delantero') || n.includes('atacante')) return { displayName: 'Delantero', abbreviation: 'DEL' }
  return { displayName: rawName || 'Jugador', abbreviation: rawAbbr || 'JUG' }
}

function normalizeAthlete(rawAthlete: any, teamInfo: { id: string; name: string; shortName: string; logo: string | null }): Athlete {
  const pos = rawAthlete.position || {}
  const trans = translatePosition(pos.displayName || pos.name, pos.abbreviation)
  const position: AthletePosition = {
    id: pos.id ? String(pos.id) : null,
    name: trans.displayName,
    displayName: trans.displayName,
    abbreviation: trans.abbreviation,
  }

  return {
    id: String(rawAthlete.id || ''),
    fullName: rawAthlete.fullName || rawAthlete.displayName || 'Jugador',
    displayName: rawAthlete.displayName || rawAthlete.fullName || 'Jugador',
    shortName: rawAthlete.shortName || null,
    jersey: rawAthlete.jersey ? String(rawAthlete.jersey) : null,
    position,
    citizenship: rawAthlete.citizenship || null,
    flag: rawAthlete.flag?.href || null,
    age: rawAthlete.age ? Number(rawAthlete.age) : null,
    dateOfBirth: rawAthlete.dateOfBirth || null,
    height: rawAthlete.displayHeight || null,
    weight: rawAthlete.displayWeight || null,
    team: teamInfo,
    status: rawAthlete.status?.name === 'Active' ? 'Activo' : rawAthlete.status?.name || 'Activo',
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ league: string }> },
) {
  const { league: slug } = await context.params
  const league = leagueInfo(slug)
  const normalizedLeague = { id: league.slug, name: league.name, country: league.country }

  const searchParams = request.nextUrl.searchParams
  const teamParam = searchParams.get('team')
  const queryParam = searchParams.get('q')?.toLowerCase()
  const positionParam = searchParams.get('position')?.toLowerCase()
  const limitParam = parseInt(searchParams.get('limit') || '100', 10)

  try {
    // 1. Fetch team catalog of this league
    const teamsData = await espn(`${encodeURIComponent(slug)}/teams`, 3600)
    const rawTeams = teamsData?.sports?.[0]?.leagues?.[0]?.teams ?? teamsData?.teams ?? []

    const teamsList = rawTeams.map((entry: any) => {
      const t = entry.team ?? entry
      return {
        id: String(t.id || ''),
        name: t.displayName || t.name || '',
        shortName: t.abbreviation || '',
        logo: t.logos?.[0]?.href || t.logo || null,
      }
    })

    let targetTeams = teamsList

    // If specific team requested by id or slug
    if (teamParam) {
      targetTeams = teamsList.filter(
        (t: any) =>
          t.id === teamParam ||
          t.name.toLowerCase().includes(teamParam.toLowerCase()) ||
          t.shortName.toLowerCase() === teamParam.toLowerCase(),
      )
      if (targetTeams.length === 0 && /^\d+$/.test(teamParam)) {
        targetTeams = [{ id: teamParam, name: 'Club ' + teamParam, shortName: '', logo: null }]
      }
    } else {
      // By default fetch squads of the top 6 teams to avoid excessive latency while providing rich data
      targetTeams = teamsList.slice(0, 6)
    }

    // 2. Fetch rosters in parallel
    const rosterPromises = targetTeams.map(async (t: any) => {
      try {
        const rosterData = await espn(`${encodeURIComponent(slug)}/teams/${encodeURIComponent(t.id)}/roster`, 1800)
        const athletes = (rosterData?.athletes || []).map((raw: any) => normalizeAthlete(raw, t))
        return athletes
      } catch {
        return []
      }
    })

    const rosterResults = await Promise.all(rosterPromises)
    let allAthletes = rosterResults.flat()

    // 3. Filters
    if (queryParam) {
      allAthletes = allAthletes.filter(
        (a) =>
          a.displayName.toLowerCase().includes(queryParam) ||
          a.fullName.toLowerCase().includes(queryParam) ||
          a.team.name.toLowerCase().includes(queryParam) ||
          (a.citizenship && a.citizenship.toLowerCase().includes(queryParam)),
      )
    }

    if (positionParam) {
      allAthletes = allAthletes.filter(
        (a) =>
          a.position.name.toLowerCase().includes(positionParam) ||
          a.position.displayName.toLowerCase().includes(positionParam) ||
          a.position.abbreviation.toLowerCase() === positionParam,
      )
    }

    const paginated = allAthletes.slice(0, limitParam)

    return apiSuccess(
      {
        league: normalizedLeague,
        teamFilter: teamParam ? targetTeams[0] || null : null,
        athletes: paginated,
      },
      {
        cache: 's-maxage=1800, stale-while-revalidate=86400',
        pagination: {
          total: allAthletes.length,
          count: paginated.length,
          offset: 0,
          limit: limitParam,
        },
      },
    )
  } catch (error) {
    return apiError(
      'ATHLETES_EXTRACTION_FAILED',
      'No se pudo extraer el plantel de jugadores para esta competición',
      502,
      { league: slug, detail: error instanceof Error ? error.message : 'Error desconocido' },
    )
  }
}

export function OPTIONS() {
  return apiOptions()
}
