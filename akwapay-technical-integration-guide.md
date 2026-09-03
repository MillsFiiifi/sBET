# AkwaPay Integration: Technical Guide

Audience: engineers integrating with AkwaPay's `/v1/payment_intents` API, or auditing an existing integration for correctness after the Moolre → Flutterwave gateway change.

This is a practical implementation guide, not a full API reference. It focuses on the parts that are easy to get wrong, based on real bugs found in production integrations.

---

## 1. The contract you're building against

```
POST /v1/payment_intents
Authorization: Bearer sk_live_... (or sk_test_...)
Idempotency-Key: <fresh uuid per request>
Content-Type: application/json

{
  "amount": 100,              // integer pesewas — GHS 1.00
  "currency": "GHS",
  "method": "mobile_money",
  "network": "MTN",           // MTN | TELECEL | AIRTELTIGO
  "customer": { "phone": "0XXXXXXXXX", "email": "optional@example.com" },
  "reference": "your-own-reference",
  "return_url": "https://yoursite.com/deposit?status=return"
}
```

Response:

```json
{
  "id": "pi_...",
  "status": "processing",
  "amount": 100,
  "currency": "GHS",
  "reference": "your-own-reference",
  "next_action": {
    "type": "await_prompt",
    "expires_at": "2026-08-24T21:19:42.168Z",
    "ussd_fallback": "Please authorise this payment on your mobile number..."
  },
  "client_secret": "cs_...",
  "checkout_url": "https://akwapay.vercel.app/checkout/pi_...?cs=cs_..."
}
```

**This response shape is stable regardless of the underlying gateway.** Whether AkwaPay routes the charge through Flutterwave, Moolre, or any future gateway, your integration only ever sees this contract. Do not build logic that assumes a specific gateway.

---

## 2. Handle every `next_action.type`, not just the one you tested

| Type | Meaning | What to do |
|---|---|---|
| `await_prompt` | Push prompt sent to customer's phone | Show a waiting screen; poll or wait for webhook |
| `payment_instruction` | Same as `await_prompt` — some gateways use this label | Treat identically to `await_prompt` |
| `redirect` | Customer must be sent to a URL (card/bank flows) | Redirect to `next_action.url` |
| `submit_otp` | Gateway needs an OTP before the prompt is sent | Show OTP entry, POST to the checkout-validate route |
| `none` | No action needed | Should not occur for mobile_money, but handle gracefully |

**A single field drives your entire UI branch.** If your code only handles `await_prompt` and falls through to an error state on anything else, a gateway failover will break your integration even though nothing changed on your end. Write an explicit `switch`/match over all five values with a sensible default, not an `if (type === 'await_prompt') {...} else {error}`.

---

## 3. OTP handling — implement it, but expect it to rarely fire

Some gateways (historically Moolre) require an OTP before sending the push prompt. If `next_action.type === 'submit_otp'`, the flow is:

```
POST {akwapay-root}/v1/checkout/{intentId}/validate?cs={client_secret}
Content-Type: application/json

{ "otp": "123456" }
```

Notes:
- This is a **different route family** than `/v1/payment_intents` — it's under `/v1/checkout/`, not versioned the same way
- Auth is **entirely via the `cs=` query parameter** — no `Authorization` header, no secret key. Never attach your merchant secret key to this call.
- A `200` response means the OTP was accepted and the push prompt is now in flight — it does **not** mean the payment succeeded. Continue to your normal polling/webhook flow after this.
- If the active gateway doesn't implement OTP validation for a charge that somehow returned `submit_otp`, you'll get an error response (historically a `501`-shaped error). Treat this the same as "no OTP needed" and fall through to your polling flow — don't hard-fail the deposit over it.

**Do not delete this code path just because it's currently unused.** Gateway routing can fail over, and an integration that only handles the current happy path breaks silently the next time routing changes.

---

## 4. Status polling — implement it correctly or not at all

If you build your own status-check endpoint (rather than relying purely on webhooks), it must:

```
GET /v1/payment_intents/{id}
Authorization: Bearer sk_live_...
```

Returns the same shape as creation, with an updated `status`:

```
created | requires_action | processing | succeeded | failed | unknown
```

**Critical: `unknown` is not a failure.** It means AkwaPay asked the gateway and got no definitive answer yet — AkwaPay keeps polling internally and will resolve it. Never treat `unknown` as `failed`, and never re-issue a charge because of it. Doing so risks double-charging a customer whose payment may still complete.

**The single most common integration bug found in this migration:** a status-polling route that checks a *different, hardcoded* payment provider's status API regardless of which provider actually created the transaction. If you support multiple gateways or have migrated between them, your status-check logic must route based on which provider issued the reference — e.g. by prefix (`pi_...` for AkwaPay-issued references) — not by assuming a single provider globally. Getting this wrong doesn't lose money (the webhook still credits correctly), but it produces a UI that says "not confirmed" forever on a payment that already succeeded, which looks exactly like a lost deposit to your support team and your users.

```typescript
// Correct pattern
function isAkwaPayReference(ref: string): boolean {
  return ref.startsWith('pi_')
}

if (isAkwaPayReference(transaction.providerReference)) {
  const intent = await getAkwaPayIntent(transaction.providerReference)
  // handle intent.status
} else {
  // legacy/other provider status check
}
```

---

## 5. Webhooks — the primary settlement path

Register your endpoint via AkwaPay's dashboard (Developers → Webhook endpoints). AkwaPay signs every delivery:

```
X-AkwaPay-Signature: t=<unix_timestamp>,v1=<hex_hmac_sha256>
```

Signed payload is `"{t}.{raw_body}"`. Reject anything with a timestamp older than 5 minutes (replay protection).

```typescript
function verifyAkwaPayWebhook(rawBody: Buffer, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(',').map(p => {
      const [k, ...rest] = p.trim().split('=')
      return [k, rest.join('=')]
    })
  )
  if (!parts.t || !parts.v1) return false

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(parts.t))
  if (age > 300) return false

  const expected = crypto.createHmac('sha256', secret)
    .update(`${parts.t}.${rawBody.toString('utf8')}`)
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1))
}
```

Rules:
- **Read the raw body before any JSON middleware touches it.** A framework that re-serializes JSON before your handler sees it will break the HMAC — the bytes you verify must be exactly the bytes AkwaPay sent.
- **Respond 200 immediately, process asynchronously.** AkwaPay retries on non-2xx or timeout. A slow handler risks duplicate deliveries piling up in the retry queue for work you already completed.
- **Handlers must be idempotent on `event.id`.** Delivery is at-least-once — you will receive the same event more than once. Store processed event IDs and skip duplicates.
- **Metadata is NOT echoed back on the webhook.** The only handle you get is `data.reference` — whatever you set as `reference` when creating the intent is what comes back. If you need to route a webhook to a specific user/transaction, encode that into `reference` itself (or look it up via your own stored mapping keyed by the AkwaPay intent id).

Webhook payload:

```json
{
  "id": "evt_...",
  "type": "payment_intent.succeeded",
  "sequence": 42,
  "created_at": "2026-08-24T...",
  "data": {
    "intent_id": "pi_...",
    "amount": 100,
    "currency": "GHS",
    "reference": "your-reference",
    "status": "succeeded"
  }
}
```

Only `payment_intent.succeeded` needs action from most integrations. Log and ignore other event types rather than erroring on them — new event types may be added over time.

---

## 6. Crediting a wallet/balance — the part that's easy to get subtly wrong

**Credit atomically, in the same DB transaction as marking the payment complete.** Two separate writes (mark-complete, then increment-balance) create a window where a crash between them leaves the payment marked done but the user uncredited.

```typescript
await db.transaction([
  db.transaction.update({ where: { id }, data: { status: 'COMPLETED' } }),
  db.user.update({ where: { id: userId }, data: { balance: { increment: amount } } }),
])
```

**Verify the amount before crediting.** Compare `event.data.amount` against what you originally charged. A mismatch (even by a small margin, allowing for rounding) should block the credit and alert — it may indicate tampering or a provider-side reconciliation issue.

**After a successful deposit, explicitly refresh whatever drives your displayed balance.** This sounds obvious but is the second most common bug found in this migration: a deposit-success UI that closes its modal without telling the app's data layer to refetch. If your balance display is backed by a cache with its own staleness window (React Query, SWR, Redux with memoized selectors, etc.), closing a success modal does not automatically invalidate that cache. Explicitly invalidate/refetch, and — ideally — await that refetch before dismissing the success state, so the number on screen is already correct the instant the user sees "Payment successful."

```typescript
onSuccess={async () => {
  await queryClient.invalidateQueries({ queryKey: ['currentUser'] })
  closeDialog()
}}
```

Not:

```typescript
onSuccess={() => closeDialog()}  // balance display now stale until next natural refetch
```

---

## 7. Amounts — always integer pesewas

`GHS 50.00` is `5000`. Never send `50.00` or `50`. A float where an integer is expected returns a `400`. This applies both when creating an intent and when reading `amount` back from any response — no division by 100 is applied server-side; you own that conversion in both directions.

---

## 8. Reference format

You choose your own `reference` when creating an intent. Two practical constraints, even though AkwaPay handles gateway-facing reference translation internally now:

- Keep it reasonably short (under ~40 characters is safe)
- Alphanumeric plus common separators (hyphens, underscores) is safe; avoid exotic characters
- It must be unique per attempt — reusing a reference across retries can trigger idempotency conflicts depending on how you've structured your own request flow

---

## 9. Testing checklist before going live

1. Create a real intent for a small amount (GH₵ 1.00)
2. Confirm `next_action.type` matches what your UI branch expects
3. Approve the prompt on a real phone
4. Confirm your webhook handler receives the event and the `X-AkwaPay-Signature` verifies
5. Confirm your handler is idempotent — manually POST the same webhook payload twice, confirm no double-credit
6. **Confirm the balance shown in your UI updates without a manual page refresh**
7. Test the `unknown` status path — confirm your code doesn't treat it as a failure
8. If you support OTP, test that flow even though it may rarely trigger in normal operation

Step 6 is the one most often skipped, and the one that produces the most confusing support tickets ("I paid but wasn't credited" when the money landed correctly and the UI just didn't refresh).
