# AkwaPay Gateway Update: Moolre → Flutterwave

## Do you need to do anything?

**No.** If you're integrated with AkwaPay's API (POST /v1/payment_intents, webhooks, status polling), your code does not need to change. AkwaPay has switched its underlying mobile-money gateway from Moolre to Flutterwave — this is entirely internal to AkwaPay. You never called Moolre directly, and you never call Flutterwave directly either. You only ever talk to AkwaPay.

This document explains what changed under the hood, and — more importantly — describes real integration bugs found in partner codebases during this switch that had nothing to do with the gateway change itself, but were surfaced by it. If your integration is older or was copied from an earlier reference implementation, check the sections below even if you think nothing needs fixing.

---

## What actually changed

| | Before | Now |
|---|---|---|
| Underlying gateway | Moolre | Flutterwave |
| Your API endpoint | POST /v1/payment_intents | unchanged |
| Your auth | Bearer sk_live / sk_test | unchanged |
| Your webhook payload shape | unchanged | unchanged |
| Your webhook signature scheme | X-AkwaPay-Signature, HMAC-SHA256 | unchanged — this is AkwaPay's own signature, not the gateway's |

The gateway swap changes what AkwaPay does behind next_action, not the contract you integrate against.

---

## What you might notice

### 1. OTP submission is effectively dead now

If your integration has a code path for next_action.type === "submit_otp" (a screen asking the customer for a one-time SMS code before the MoMo push is sent), that path was built for Moolre's flow. It is very unlikely to fire now — mobile-money charges routed through the new gateway come back with next_action.type === "payment_instruction" (a direct push prompt), skipping the OTP step entirely.

Leave that code in place. Do not delete it. AkwaPay's routing can fail over to a different gateway on a given charge, and if that ever happens the OTP path may be needed again. Removing it "because it's unused now" is the kind of cleanup that turns into an outage six months later.

### 2. next_action wording may differ slightly

The push-prompt message text (ussd_fallback, hint fields) comes from whichever gateway handled the charge. If your UI hardcodes gateway-specific copy instead of rendering these fields as opaque display text, update it to just display what AkwaPay sends, unmodified.

### 3. The raw field in status responses is gateway-shaped and unstable

If anything in your integration inspects the raw object on a payment intent or webhook payload, stop. That field mirrors whatever the underlying gateway returned and its shape is not documented or guaranteed. Use only the top-level fields AkwaPay documents: status, amount, currency, reference, next_action.type, next_action.expires_at, next_action.ussd_fallback.

---

## Bugs found in partner integrations during this migration

These are not things AkwaPay changed. They were pre-existing bugs in partner codebases that this migration happened to expose because it involved re-testing every integration end-to-end. Check your own code against these — if you copied an integration from an older reference implementation, you may have the same issue.

### Bug A — status-polling UI checking the wrong provider

One integration's "verify payment" screen polled a different, older payment provider's status-check function regardless of which provider actually handled the deposit. Since that older provider had never heard of the AkwaPay-issued reference, the poll always came back empty or errored — so the UI showed "payment not confirmed" indefinitely, even though AkwaPay's webhook had already credited the wallet correctly in the background. The money was never actually missing; the UI just never learned about it because it was asking the wrong system.

If your integration polls a payment status endpoint of your own construction (rather than relying purely on AkwaPay's webhook), make sure that endpoint routes based on which provider actually created the transaction — check the reference format or a stored provider field — rather than hardcoding a single provider's status API.

### Bug B — balance not refreshed after a successful deposit dialog

A separate integration's deposit-success dialog closed itself the instant the payment was confirmed, but only cleared local UI state — it never told the app's data layer (in this case, a React Query cache with its own staleness window) to refetch the user's balance. The customer would see the success checkmark, the dialog would close, and the balance shown on screen would still be the old, pre-deposit number until they manually refreshed the page.

If your success handler for a completed deposit only closes a modal or clears a flag, make sure it also explicitly triggers a refetch/invalidate of wherever your displayed balance comes from, and ideally await that refetch before dismissing the success UI, so the visible number is already correct the instant the modal disappears.

### Bug C — very long or symbol-heavy references

Not applicable to your webhook handling directly, but worth knowing: AkwaPay's own reference to the gateway is subject to the gateway's constraints on length and character set. AkwaPay handles the gateway-facing reference internally now, so this is not something you need to fix — but if you supply a reference when creating a payment intent, keep it reasonably short and simple for your own systems' sake.

---

## Recommended verification steps for your own integration

Even though nothing changed on your end, if you haven't tested a live deposit recently, run through this once:

1. Create a real payment intent with a small amount (e.g. GH₵ 1.00)
2. Confirm the customer receives an authorization prompt on their phone
3. Approve it
4. Confirm your webhook handler receives and correctly verifies the X-AkwaPay-Signature header
5. Confirm the user's balance actually increments in your UI — not just that a "success" state appears. This is the step that would have caught both Bug A and Bug B above.

If step 5 fails while steps 1 through 4 succeed, the issue is almost certainly in your own status-display logic, not in AkwaPay or the underlying gateway — check whether your success UI actually triggers a data refresh, and whether any custom polling you've built is asking the right service.

---

## Questions

If you notice behavior beyond what's described here, contact AkwaPay support with the id (payment intent) or reference of the affected transaction.
