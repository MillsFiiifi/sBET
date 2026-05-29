// Apply a confirmed deposit to a user's wallet: update totals (via
// recordDeposit, which also stamps firstDepositAt for first-timers),
// advance the withdrawal-verification gate when the amount qualifies,
// and fire sub-admin commission for referred users.
//
// Reused by every path that confirms a deposit:
//   - /api/admin/users/[id]/credit (admin manually crediting from /admin/players)
//   - /api/admin/payments/[id]/resolve (admin clicking 'Credit & resolve' on a
//     pending/failed payments row)
//   - /api/payments/paystack/callback (Paystack auto-credit after verify)
//
// Pure 'bonus' credits (which should NOT count toward verification or
// commission) should bypass this helper and call creditBalance directly.
//
// The verification threshold is country-aware: 200 GHS for Ghana, ₦30,000 for
// Nigeria, etc. (see lib/countries.ts).

import {
  addCommission,
  advanceVerificationStep,
  findUserById,
  recordDeposit,
} from '@/lib/users-store'
import { creditCommission, findSubAdminById } from '@/lib/sub-admins-store'
import { COMMISSION_RATE, type AppUser } from '@/lib/types'
import { getVerificationAmount } from '@/lib/countries'

export interface ApplyDepositResult {
  user: AppUser
  isFirstDeposit: boolean
  commission: {
    amount: number
    rate: number
    subAdminId: string
    currency: AppUser['currency']
  } | null
}

export async function applyDepositCredit(
  userId: string,
  amount: number,
): Promise<ApplyDepositResult | null> {
  // Need the user's country to know what verification threshold applies and
  // what currency to attribute the commission row to.
  const userBefore = await findUserById(userId)
  if (!userBefore) return null

  const result = await recordDeposit(userId, amount)
  if (!result) return null

  let user = result.user
  const verificationThreshold = getVerificationAmount(userBefore.country)

  if (
    amount >= verificationThreshold &&
    (user.verificationStep ?? 0) < 4
  ) {
    const advanced = await advanceVerificationStep(userId)
    if (advanced) user = advanced
  }

  let commission: ApplyDepositResult['commission'] = null
  if (user.referredBySubAdminId) {
    const sa = await findSubAdminById(user.referredBySubAdminId)
    if (sa && sa.approved) {
      const amt = +(amount * COMMISSION_RATE).toFixed(2)
      await creditCommission(sa.id, amt, user.currency)
      await addCommission({
        subAdminId: sa.id,
        userId: user.id,
        depositAmount: amount,
        commission: amt,
        rate: COMMISSION_RATE,
        currency: user.currency,
      })
      commission = {
        amount: amt,
        rate: COMMISSION_RATE,
        subAdminId: sa.id,
        currency: user.currency,
      }
    }
  }

  return { user, isFirstDeposit: result.isFirst, commission }
}
