import { NextResponse } from 'next/server'
import type { ResponseMeta, PaginationMeta } from '@/lib/types/api'

const API_NAME = 'Fútbol API PRO'
const API_VERSION = '2.0'
const TIMEZONE = 'America/Argentina/Buenos_Aires'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function buildMeta(pagination?: PaginationMeta): ResponseMeta {
  return {
    api: API_NAME,
    version: API_VERSION,
    source: 'ESPN',
    timestamp: new Date().toISOString(),
    timezone: TIMEZONE,
    ...(pagination ? { pagination } : {}),
  }
}

/**
 * Return a successful JSON response wrapped in the standard envelope.
 */
export function apiSuccess<T>(
  data: T,
  options?: {
    status?: number
    cache?: string
    pagination?: PaginationMeta
  },
) {
  const status = options?.status ?? 200
  const cache = options?.cache ?? 's-maxage=15, stale-while-revalidate=30'
  return NextResponse.json(
    { data, meta: buildMeta(options?.pagination) },
    { status, headers: { ...corsHeaders, 'Cache-Control': cache } },
  )
}

/**
 * Return an error JSON response in the standard envelope.
 */
export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    {
      data: { error: { code, message, ...(details !== undefined ? { details } : {}) } },
      meta: buildMeta(),
    },
    { status, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } },
  )
}

/**
 * Standard CORS preflight response.
 */
export function apiOptions() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

export { API_NAME, API_VERSION, TIMEZONE }
