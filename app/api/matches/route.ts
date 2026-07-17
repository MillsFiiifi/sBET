import { NextResponse } from 'next/server'
import { readCustomMatches, toUiMatch } from '@/lib/custom-matches-store'
import { fetchApiFootballMatches } from '@/lib/api-football'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Admin-curated matches first, then real fixtures from API-Football
    // (empty when API_FOOTBALL_KEY isn't set — so the site still works).
    const [custom, live] = await Promise.all([
      readCustomMatches().catch(() => []),
      fetchApiFootballMatches().catch(() => []),
    ])
    return NextResponse.json({ matches: [...custom.map(toUiMatch), ...live] })
  } catch (e) {
    return NextResponse.json(
      { matches: [], error: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    )
  }
}
