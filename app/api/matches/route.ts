import { NextResponse } from 'next/server'
import { readCustomMatches, toUiMatch } from '@/lib/custom-matches-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const matches = await readCustomMatches()
    return NextResponse.json({ matches: matches.map(toUiMatch) })
  } catch (e) {
    return NextResponse.json(
      { matches: [], error: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    )
  }
}
