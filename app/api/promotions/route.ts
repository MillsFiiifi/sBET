import { NextResponse } from 'next/server'
import { readPromotions } from '@/lib/promotions-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const promotions = await readPromotions(false)
    return NextResponse.json({ promotions })
  } catch (e) {
    return NextResponse.json(
      { promotions: [], error: e instanceof Error ? e.message : String(e) },
      { status: 200 },
    )
  }
}
