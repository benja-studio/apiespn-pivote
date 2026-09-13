import { NextRequest } from 'next/server'
import { espn, leagueInfo } from '@/lib/espn-client'
import { apiSuccess, apiError, apiOptions } from '@/lib/api-response'
import type { Athlete, AthletePosition, TeamProfile } from '@/lib/types/api'

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
  _request: NextRequest,
  context: { params: Promise<{ league: string; team: string }> },
) {
  const { league: slug, team: teamId } = await context.params
  const league = leagueInfo(slug)

  try {
    // 1. Fetch team details
    const teamRaw = await espn(`${encodeURIComponent(slug)}/teams/${encodeURIComponent(teamId)}`, 1800)
    const t = teamRaw?.team || teamRaw

    const teamProfile: TeamProfile = {
      id: String(t.id || teamId),
      name: t.displayName || t.name || 'Club',
      shortName: t.abbreviation || '',
      location: t.location || null,
      logo: t.logos?.[0]?.href || t.logo || null,
      color: t.color ? `#${t.color}` : null,
      alternateColor: t.alternateColor ? `#${t.alternateColor}` : null,
      standingSummary: t.standingSummary || null,
      recordSummary: t.record?.items?.[0]?.summary || null,
      venue: t.venue?.fullName || null,
    }

    // 2. Fetch full squad roster
    let athletes: Athlete[] = []
    try {
      const rosterRaw = await espn(`${encodeURIComponent(slug)}/teams/${encodeURIComponent(teamId)}/roster`, 1800)
      const teamSummary = {
        id: teamProfile.id,
        name: teamProfile.name,
        shortName: teamProfile.shortName,
        logo: teamProfile.logo,
      }
      athletes = (rosterRaw?.athletes || []).map((raw: any) => normalizeAthlete(raw, teamSummary))
    } catch {
      athletes = []
    }

    teamProfile.athletesCount = athletes.length
    teamProfile.athletes = athletes

    return apiSuccess(
      {
        league: { id: league.slug, name: league.name, country: league.country },
        team: teamProfile,
      },
      {
        cache: 's-maxage=1800, stale-while-revalidate=86400',
        pagination: { total: athletes.length, count: athletes.length, offset: 0, limit: athletes.length },
      },
    )
  } catch (error) {
    return apiError(
      'TEAM_PROFILE_NOT_FOUND',
      'No se pudo obtener el perfil ni el plantel del equipo solicitado',
      502,
      { league: slug, team: teamId, detail: error instanceof Error ? error.message : 'Error desconocido' },
    )
  }
}

export function OPTIONS() {
  return apiOptions()
}
