import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface QuotaInfo {
  ok: boolean
  remaining: number | null
  used: number | null
  status: number
  plan?: string
  message?: string
}

interface ApiFootballStatusResponse {
  errors?: unknown
  response?: {
    account?: { email?: string }
    subscription?: { plan?: string; active?: boolean; end?: string }
    requests?: { current?: number; limit_day?: number }
  }
}

async function probeApiFootball(apiKey: string): Promise<QuotaInfo> {
  try {
    const res = await fetch('https://v3.football.api-sports.io/status', {
      headers: { 'x-apisports-key': apiKey },
      cache: 'no-store',
    })
    const text = await res.text()
    let parsed: ApiFootballStatusResponse | null = null
    try {
      parsed = JSON.parse(text) as ApiFootballStatusResponse
    } catch {
      parsed = null
    }

    // API-Football frequently returns 200 + an `errors` object for IP blocks
    // and quota issues; treat those as failures rather than success.
    if (parsed?.errors && typeof parsed.errors === 'object') {
      const errs = parsed.errors as Record<string, string>
      const keys = Object.keys(errs)
      if (keys.length > 0) {
        return {
          ok: false,
          remaining: null,
          used: null,
          status: res.status,
          message: keys.map((k) => `${k}: ${errs[k]}`).join('\n'),
        }
      }
    }

    const used = parsed?.response?.requests?.current ?? null
    const limit = parsed?.response?.requests?.limit_day ?? null
    return {
      ok: res.ok,
      used,
      remaining: limit !== null && used !== null ? limit - used : null,
      status: res.status,
      plan: parsed?.response?.subscription?.plan,
      message: res.ok ? undefined : text.slice(0, 500),
    }
  } catch (e) {
    return {
      ok: false,
      remaining: null,
      used: null,
      status: 0,
      message: e instanceof Error ? e.message : String(e),
    }
  }
}

export async function GET() {
  const apiFootballKeySet = !!process.env.API_FOOTBALL_KEY
  const adminPwSet = !!process.env.ADMIN_PASSWORD

  const oddsApi = apiFootballKeySet
    ? await probeApiFootball(process.env.API_FOOTBALL_KEY as string)
    : { ok: false, remaining: null, used: null, status: 0, message: 'no key' }

  return NextResponse.json({
    env: {
      odds_api_key: apiFootballKeySet,
      admin_password: adminPwSet,
      node_env: process.env.NODE_ENV ?? 'development',
    },
    oddsApi,
  })
}
