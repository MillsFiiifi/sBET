import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE, isValidSessionCookie } from '@/lib/admin-auth'
import { listAllPayments } from '@/lib/payments-store'
import { listUsersForAdmin } from '@/lib/users-store'

export const dynamic = 'force-dynamic'

async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies()
  return isValidSessionCookie(store.get(ADMIN_COOKIE)?.value)
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [payments, users] = await Promise.all([
    listAllPayments({ type: 'deposit', limit: 1000 }),
    listUsersForAdmin(),
  ])

  const userById = new Map(users.map((u) => [u.id, u]))

  const deposits = payments.map((p) => {
    const u = p.userId ? userById.get(p.userId) ?? null : null
    const source =
      (typeof p.metadata?.source === 'string' && p.metadata.source) || null
    const note =
      (typeof p.metadata?.note === 'string' && p.metadata.note) || null
    return {
      id: p.id,
      reference: p.reference,
      amount: p.amount,
      currency: p.currency,
      provider: p.provider,
      status: p.status,
      source, // 'admin_credit' | null
      note,
      createdAt: p.createdAt,
      user: u
        ? {
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone ?? null,
            totalDeposited: u.totalDeposited,
            balance: u.balance ?? 0,
          }
        : null,
    }
  })

  // Per-user roll-up so the page can also show "users who have deposited"
  const byUser = new Map<
    string,
    {
      userId: string
      name: string
      email: string
      depositCount: number
      depositTotal: number
      lastDepositAt: string
      balance: number
    }
  >()
  for (const d of deposits) {
    if (!d.user || d.status !== 'success') continue
    const prev = byUser.get(d.user.id)
    if (prev) {
      prev.depositCount += 1
      prev.depositTotal = +(prev.depositTotal + d.amount).toFixed(2)
      if (d.createdAt > prev.lastDepositAt) prev.lastDepositAt = d.createdAt
    } else {
      byUser.set(d.user.id, {
        userId: d.user.id,
        name: d.user.name,
        email: d.user.email,
        depositCount: 1,
        depositTotal: d.amount,
        lastDepositAt: d.createdAt,
        balance: d.user.balance,
      })
    }
  }
  const userRollup = Array.from(byUser.values()).sort((a, b) =>
    a.lastDepositAt < b.lastDepositAt ? 1 : -1,
  )

  return NextResponse.json({
    deposits,
    userRollup,
    totals: {
      successCount: deposits.filter((d) => d.status === 'success').length,
      successAmount: +deposits
        .filter((d) => d.status === 'success')
        .reduce((s, d) => s + d.amount, 0)
        .toFixed(2),
    },
  })
}
