# Integrating AkwaPay — Full Endpoint Reference & Custom OTP Verification

A complete, endpoint-by-endpoint guide to accepting Mobile Money (GHS)
deposits through AkwaPay, plus a robust custom OTP-handling pattern that
doesn't break when a gateway doesn't support OTP submission yet.

Base URL used throughout: `https://akwapayapi.onrender.com` (swap for your
own instance's URL).

---

## 0. Before you start

| Thing | Where it comes from |
|---|---|
| `sk_test_...` secret key | AkwaPay dashboard → API Keys (use for all testing) |
| `sk_live_...` secret key | Same place — only once fully tested |
| A webhook secret (`whsec_...`) | Minted by `POST /v1/webhook_endpoints` (§5) |

⚠️ **Never test with `sk_live_...`.** It routes through real gateways and can
send a real MoMo prompt to a real phone. Always start on `sk_test_...`.

There are two separate families of endpoint:

- **Payment API** (§1–§6) — authenticated with your `Authorization: Bearer sk_...` secret key, or (for two specific public routes) a `client_secret`. This is what you actually integrate against to take payments.
- **Dashboard API** (§7) — authenticated by logging into AkwaPay's own merchant dashboard, not your API key. Covered briefly for completeness since you asked for everything, but you won't call these from your payment integration code.

---

## 1. `POST /v1/payment_intents` — create a payment

```
Authorization: Bearer sk_test_YOUR_KEY
Idempotency-Key: <fresh UUID per attempt>
Content-Type: application/json
```

```json
{
  "amount": 5000,
  "currency": "GHS",
  "method": "mobile_money",
  "network": "MTN",
  "customer": { "phone": "0244123456" },
  "reference": "your-own-unique-order-id",
  "return_url": "https://yoursite.com/deposit/success",
  "metadata": { "userId": "abc123" }
}
```

**Rules that matter:**
- `amount` is an **integer in pesewas**. GHS 50.00 → `5000`. Sending `50.00` is a 400.
- `method` + `network` are **both required** for mobile money — `network` is one of `MTN`, `TELECEL`, `AIRTELTIGO`.
- `reference` must be **unique across your entire account**. A repeat returns `duplicate_reference`.
- Always send a fresh `Idempotency-Key` UUID per attempt. Retrying with the *same* key safely replays the original response instead of double-charging.
- `metadata` is stored but **never sent back on the webhook** — only `reference` comes back. If you need to identify a user from the webhook, encode it into `reference` itself (e.g. `dep_<userId>_<nonce>`) and parse it back out server-side. Don't rely on metadata round-tripping.

**Response — keep the whole thing, don't flatten it (fields vary by gateway/next_action):**

```json
{
  "id": "pi_ba3a087958fd43cd",
  "object": "payment_intent",
  "status": "requires_action",
  "amount": 5000,
  "currency": "GHS",
  "reference": "your-own-unique-order-id",
  "next_action": { "type": "await_prompt", "expiresAt": "2026-08-18T18:37:48.154Z" },
  "client_secret": "cs_f55bc696046f4111889129b740a2692d",
  "checkout_url": "https://akwapay.vercel.app/checkout/pi_ba3a087958fd43cd?cs=cs_f55bc696046f4111889129b740a2692d",
  "created_at": "2026-08-18T18:32:48.208Z"
}
```

Save `id`, `reference`, and `client_secret`.

---

## 2. Branch on `next_action.type`

| Type | Meaning | What to do |
|---|---|---|
| `await_prompt` | A MoMo push prompt is already on the phone | Show a waiting screen, go to §4 |
| `submit_otp` | Network wants a one-time code first | Go to §3 |
| `redirect` | Customer must finish on a gateway-hosted page | `window.location.href = next_action.url` |
| absent / `none` | Nothing more to collect | Go straight to §4 |

Or skip the branching entirely and just send the customer to `checkout_url`
— AkwaPay's own hosted checkout page handles all four cases for you.

---

## 3. `GET /v1/checkout/{id}` — public intent lookup (no API key)

```
GET /v1/checkout/pi_ba3a087958fd43cd?cs=cs_f55bc696046f4111889129b740a2692d
```

Authenticated by `client_secret` in the query string, not your API key —
safe to call from a browser. Returns the same shape as `checkout_url` itself
renders from:

```json
{
  "id": "pi_ba3a087958fd43cd",
  "object": "payment_intent",
  "status": "requires_action",
  "amount_minor": 5000,
  "currency": "GHS",
  "reference": "your-own-unique-order-id",
  "description": null,
  "merchant_name": "Merchant",
  "method": "mobile_money"
}
```

Useful if you're building your **own** checkout UI instead of using
`checkout_url`, and want a client-side-safe way to re-fetch the intent's
current state.

---

## 4. Submitting an OTP — two equivalent endpoints

There are **two** OTP-submit routes, doing the same thing with different
auth:

### 4a. Public route — `POST /v1/checkout/{id}/validate?cs={client_secret}`
Call this from the **browser**, no secret key needed:
```
POST /v1/checkout/pi_ba3a087958fd43cd/validate?cs=cs_f55bc696046f4111889129b740a2692d
Content-Type: application/json

{ "otp": "123456" }
```

### 4b. Authenticated route — `POST /v1/payment_intents/{id}/validate`
Call this from your **backend**, with your secret key, if you'd rather
proxy the OTP through your own server instead of calling AkwaPay directly
from the client:
```
POST /v1/payment_intents/pi_ba3a087958fd43cd/validate
Authorization: Bearer sk_test_YOUR_KEY
Content-Type: application/json

{ "otp": "123456" }
```

Both resolve to the **actual gateway that is handling this specific
charge** — not some global default — so this works correctly even when
different charges on your account route to different underlying gateways.

**Response on success:**
```json
{ "status": "requires_action", "next_action": { "type": "await_prompt", "expiresAt": "..." } }
```

**Response when the underlying gateway has no OTP-submit capability yet:**
```json
{ "error": { "code": "not_supported", "message": "OTP validation is not implemented for provider 'moolre'." } }
```

That second case is real and current for at least one gateway behind
AkwaPay — this is exactly what §5 (custom OTP verification) is for.

---

## 5. Custom OTP verification — a pattern that doesn't dead-end

The problem: not every gateway AkwaPay routes to has OTP submission wired up
on their end yet. If you build a UI that shows an OTP box and then just
displays an error on `not_supported`, you've built a dead end — the
customer typed a code, hit submit, and got stuck with no way forward, even
though their payment might still complete on its own.

**The fix is simple: OTP submission is an *attempt*, not the source of
truth. The poll (§6) is always the source of truth, regardless of what the
OTP call returns.**

```
1. Show the OTP input box.
2. On submit, call §4a or §4b.
3. Whatever comes back — success, wrong code, OR not_supported — 
   transition to the polling screen (§6). Never show a dead-end error
   for not_supported specifically.
4. Only show a real error (and let them retry the code) if the response
   was a genuine rejection of the code itself — not a 501.
```

Reference implementation (pseudocode, mirrors what's actually shipped in
this project's own frontend integrations):

```javascript
async function submitOtp(intentId, clientSecret, otp) {
  try {
    const res = await fetch(
      `${AKWAPAY_BASE}/v1/checkout/${intentId}/validate?cs=${clientSecret}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otp }) }
    );
    const data = await res.json();

    if (!res.ok) {
      if (data?.error?.code === 'not_supported') {
        // Not a real failure — this gateway just can't take the OTP via
        // API. The customer may still be able to complete this directly
        // on their phone (an SMS reply, a USSD prompt). Fall through to
        // polling instead of showing an error.
        startPolling(intentId);
        return;
      }
      // A genuine rejection of the code itself — let them try again.
      showError(data?.error?.message ?? 'That code did not work.');
      return;
    }

    // Accepted — still don't assume success. Poll for the real outcome.
    startPolling(intentId);
  } catch (err) {
    // Network failure calling AkwaPay itself — safe to let them retry
    // the same code, since nothing was necessarily processed.
    showError('Could not reach the payment service. Try again.');
  }
}
```

**Why this is safe, not just convenient:** nothing about OTP submission —
success, failure, or `not_supported` — ever directly credits anything on
its own. It only ever leads to a poll, and the poll is what checks the
gateway's real status before your backend credits anyone. So falling
through on `not_supported` costs nothing: worst case, the customer waits at
a polling screen for a payment that was never going to complete anyway,
which is a strictly better experience than a dead-end error screen for a
payment that *was* about to complete.

---

## 6. `GET /v1/payment_intents/{id}` — poll for the result

```
Authorization: Bearer sk_test_YOUR_KEY
```

```json
{ "id": "pi_ba3a087958fd43cd", "status": "succeeded", "amount": 5000, "currency": "GHS" }
```

| Status | Meaning | Action |
|---|---|---|
| `succeeded` | Money collected | Credit the customer, stop polling |
| `failed` / `declined` / `cancelled` / `expired` | Nothing taken | Stop polling, let them retry |
| `processing` / `requires_action` | Still in flight | Keep polling |
| `unknown` | Gateway gave no clear answer yet | **Keep polling. This is NOT a failure.** Never tell the customer it failed on this status, never let them retry (risks a double charge) |

**A sensible polling schedule:**
```
0–30s:    every 3s
30–90s:   every 6s
90–300s:  every 15s
after 300s: stop, show "still confirming" + a manual refresh button
```

---

## 7. `POST /v1/webhook_endpoints` — register a webhook

```
Authorization: Bearer sk_test_YOUR_KEY
Content-Type: application/json

{ "url": "https://yourbackend.com/webhooks/akwapay" }
```

```json
{
  "id": "we_...",
  "object": "webhook_endpoint",
  "url": "https://yourbackend.com/webhooks/akwapay",
  "secret": "whsec_...",
  "events": ["*"],
  "message": "Store this secret now — it is shown only once."
}
```

- URL must be **HTTPS**.
- `secret` is shown **exactly once** — save it immediately. If lost, create a new endpoint (you can't retrieve an old secret).

**Webhook payload:**
```json
{
  "id": "evt_pi_ba3a087958fd43cd",
  "type": "payment_intent.succeeded",
  "sequence": 1,
  "created_at": "2026-08-18T18:33:02.000Z",
  "data": {
    "intent_id": "pi_ba3a087958fd43cd",
    "amount": 5000,
    "currency": "GHS",
    "reference": "your-own-unique-order-id",
    "status": "succeeded"
  }
}
```

**Signature header:** `X-AkwaPay-Signature: t=1754049600,v1=5f3c9a...`
```
expected = HMAC-SHA256( "{timestamp}.{raw_body}", your_whsec )
```
1. Sign the **raw body bytes** — never re-serialize parsed JSON first.
2. Reject timestamps older than **5 minutes** (replay protection).
3. Compare in **constant time**, not `===`.
4. Deliveries are **at-least-once** — dedupe on `reference` before crediting.

---

## 8. `GET /v1/account` — sanity check your key

```
Authorization: Bearer sk_test_YOUR_KEY
```
```json
{ "merchant_id": "mch_abc123", "mode": "test" }
```
Cheapest possible call to confirm a key is valid and which mode it's in
before you build anything else on top of it.

---

## 9. Belt-and-braces: don't rely on the webhook alone

1. On intent creation, save it to your own `pending_deposits` table.
2. Run a background sweep every few seconds, polling any pending row via §6.
3. Whichever resolves first — webhook or sweep — credits the customer and dedupes on `reference`.
4. Delete the row once resolved. Give up (mark abandoned) after ~24h.

This is the same reason `unknown` must never be treated as failure: as long
as the row exists, you'll eventually learn the truth and credit correctly —
even if the webhook never fires at all.

---

## 10. Appendix — Dashboard API (not part of your payment integration)

These are called by AkwaPay's own merchant dashboard web app (session
login, not your API key). Listed for completeness only — you won't call
these from a deposit flow.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/v1/me` | Current merchant profile + balances |
| `GET` | `/v1/me/payments` | List your own charges |
| `GET` | `/v1/me/keys` | List your API keys |
| `POST` | `/v1/me/keys` | Create a new API key |
| `POST` | `/v1/me/playground` | Sandbox tool for testing requests in the dashboard UI |
| `GET` | `/v1/me/payouts` | List your withdrawal history |
| `POST` | `/v1/me/payouts` | Request a manual withdrawal |
| `GET` | `/v1/me/settings/auto-withdrawal` | Current auto-withdrawal setting |
| `PATCH` | `/v1/me/settings/auto-withdrawal` | Turn auto-withdrawal on/off |
| `*` | `/v1/me/webhooks/*` | Manage webhook endpoints from the dashboard UI |

---

## Checklist before going live

- [ ] Tested with `sk_test_...` end to end: create → prompt/OTP → poll → webhook
- [ ] OTP flow falls through to polling on `not_supported`, never dead-ends
- [ ] Webhook registered, signature verified, `whsec_` saved securely
- [ ] Idempotency-Key sent on every intent creation
- [ ] `unknown` status always treated as "keep waiting," never "failed"
- [ ] `reference` encodes enough to route the webhook back to the right user
- [ ] Background sweep in place as a fallback to the webhook
- [ ] Swapped `sk_test_...` → `sk_live_...` only after all of the above pass
