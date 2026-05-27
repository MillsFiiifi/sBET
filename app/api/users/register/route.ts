import { NextResponse } from 'next/server'
import { addUser, findUserByEmail } from '@/lib/users-store'
import { findSubAdminByReferralCode } from '@/lib/sub-admins-store'
import { hashPassword } from '@/lib/password'

export const dynamic = 'force-dynamic'

// Canonical Ghana Card format: GHA-XXXXXXXXX-X (3 letters + 9 digits + 1 check digit).
// Accept input with or without hyphens, in any case, then normalize.
function normalizeGhanaCard(raw: string): string | null {
  const stripped = raw.toUpperCase().replace(/[\s-]/g, '')
  if (!/^GHA\d{10}$/.test(stripped)) return null
  return `${stripped.slice(0, 3)}-${stripped.slice(3, 12)}-${stripped.slice(12)}`
}

export async function POST(request: Request) {
  let body: {
    name?: string
    email?: string
    password?: string
    phone?: string
    ghanaCard?: string
    referralCode?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const referralCode = (body.referralCode ?? '').trim().toUpperCase()
  // Normalise phone to 10-digit local format. Required at signup.
  let phone = (body.phone ?? '').replace(/\s|-/g, '')
  if (phone.startsWith('+233')) phone = '0' + phone.slice(4)
  else if (phone.startsWith('233')) phone = '0' + phone.slice(3)
  if (!/^0\d{9}$/.test(phone)) {
    return NextResponse.json(
      { error: 'phone must be a 10-digit number starting with 0' },
      { status: 400 },
    )
  }

  const ghanaCard = normalizeGhanaCard(body.ghanaCard ?? '')
  if (!ghanaCard) {
    return NextResponse.json(
      { error: 'Ghana Card number is required (format: GHA-XXXXXXXXX-X)' },
      { status: 400 },
    )
  }

  if (!name || !email || !password || !phone) {
    return NextResponse.json(
      { error: 'name, email, phone, Ghana Card, and password are required' },
      { status: 400 },
    )
  }
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'password must be at least 6 characters' },
      { status: 400 },
    )
  }

  if (await findUserByEmail(email)) {
    return NextResponse.json(
      { error: 'a user with that email already exists' },
      { status: 409 },
    )
  }

  let referredBySubAdminId: string | undefined = undefined
  let validatedReferralCode: string | undefined = undefined
  if (referralCode) {
    const sa = await findSubAdminByReferralCode(referralCode)
    if (!sa) {
      return NextResponse.json({ error: 'invalid referral code' }, { status: 400 })
    }
    if (!sa.approved) {
      return NextResponse.json(
        { error: 'this referral code is currently disabled' },
        { status: 400 },
      )
    }
    referredBySubAdminId = sa.id
    validatedReferralCode = sa.referralCode
  }

  const user = await addUser({
    name,
    email,
    passwordHash: hashPassword(password),
    phone: phone || undefined,
    ghanaCard,
    referredByCode: validatedReferralCode,
    referredBySubAdminId,
  })

  return NextResponse.json(
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        referredByCode: user.referredByCode,
        hasFirstDeposit: !!user.firstDepositAt,
      },
    },
    { status: 201 },
  )
}
