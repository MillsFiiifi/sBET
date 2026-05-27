// Apply a successfully-verified deposit to the user's wallet: bump balance,
// advance the withdrawal-verification gate, and fire sub-admin commission.
//
// This does NOT touch the payments ledger — that's owned by the route that
// calls this (it claims the pending→success transition atomically before
// invoking us, which is what protects against double-credit when the
// browser redirect and webhook both fire).

import {
  addCommission,
  advanceVerificationStep,
  findUserById,
  recordDeposit,
} from '@/lib/users-store'
import { creditCommission, findSubAdminById } from '@/lib/sub-admins-store'
import { COMMISSION_RATE } from '@/lib/types'

const VERIFICATION_DEPOSIT_AMOUNT = 200

export interface ApplyDepositInput {
  userId: string
  amount: number
}

export interface ApplyDepositResult {
  ok: true
  isFirstDeposit: boolean
  user: {
    id: string
    name: string
    balance: number
    totalDeposited: number
    totalWithdrawn: number
    verificationStep: number
  }
  commission: {
    commission: number
    rate: number
    subAdmin: { id: string; name: string; referralCode: string }
  } | null
}

export interface ApplyDepositFailure {
  ok: false
  error: string
  status: number
}

export async function applyDepositCredit(
  input: ApplyDepositInput,
): Promise<ApplyDepositResult | ApplyDepositFailure> {
  const existing = await findUserById(input.userId)
  if (!existing) return { ok: false, error: 'user not found', status: 404 }

  const result = await recordDeposit(input.userId, input.amount)
  if (!result) return { ok: false, error: 'user not found', status: 404 }

  let verifiedUser = result.user
  if (
    input.amount >= VERIFICATION_DEPOSIT_AMOUNT &&
    (verifiedUser.verificationStep ?? 0) < 2
  ) {
    const updated = await advanceVerificationStep(input.userId)
    if (updated) verifiedUser = updated
  }

  let commissionInfo: ApplyDepositResult['commission'] = null
  if (result.user.referredBySubAdminId) {
    const sa = await findSubAdminById(result.user.referredBySubAdminId)
    if (sa && sa.approved) {
      const commission = +(input.amount * COMMISSION_RATE).toFixed(2)
      await creditCommission(sa.id, commission)
      await addCommission({
        subAdminId: sa.id,
        userId: result.user.id,
        depositAmount: input.amount,
        commission,
        rate: COMMISSION_RATE,
      })
      commissionInfo = {
        commission,
        rate: COMMISSION_RATE,
        subAdmin: { id: sa.id, name: sa.name, referralCode: sa.referralCode },
      }
    }
  }

  return {
    ok: true,
    isFirstDeposit: result.isFirst,
    user: {
      id: verifiedUser.id,
      name: verifiedUser.name,
      balance: verifiedUser.balance ?? verifiedUser.totalDeposited,
      totalDeposited: verifiedUser.totalDeposited,
      totalWithdrawn: verifiedUser.totalWithdrawn ?? 0,
      verificationStep: verifiedUser.verificationStep ?? 0,
    },
    commission: commissionInfo,
  }
}
