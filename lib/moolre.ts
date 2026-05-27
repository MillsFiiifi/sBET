// Moolre POS (hosted payment page) flow.
//
// Earlier we tried Moolre's `embed/src/start` API directly — that route
// requires a server-issued public key + merchant account number, both of
// which kept returning AIN01 "Authentication Error" against our credentials.
// The POS link is a simpler hosted page (https://pos.moolre.com/<slug>) that
// any customer can hit to send money to the merchant. It has two trade-offs
// the API call doesn't:
//
//   1. No per-user/per-amount context — the URL is fixed, so the customer
//      types their own amount on Moolre's page.
//   2. No callback — Moolre doesn't redirect back here, so credits aren't
//      automatic. Admin reconciles each deposit via /admin/players → Credit.
//
// We still record a `pending` payments row at /start so the admin can see
// the user's intent (who, how much, when) and credit them on confirmation.

export function getMoolrePosUrl(): string | null {
  const url = process.env.MOOLRE_POS_URL?.trim()
  return url || null
}

export function getMinFirstDeposit(): number {
  const raw = process.env.MIN_FIRST_DEPOSIT
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 200
}
