# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use PowerShell on Windows. No test framework is configured.

- `npm run dev` — Next.js dev server (port 3000)
- `npm run build` — production build. `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so a green build does **not** mean type-clean — run the compiler separately if you care: `npx tsc --noEmit`
- `npm run start` — serve the production build
- `npm run lint` — ESLint
- `node scripts/create-team-flags-bucket.mjs` — one-shot, idempotent: creates the public `team-flags` Supabase Storage bucket used for custom-match crests
- `node scripts/verify-flag-setup.mjs` — sanity-check the bucket exists and is public
- `npm run migrate` — applies pending `supabase/migrations/*.sql` in filename order, tracking what has run in a `schema_migrations` table. Needs `SUPABASE_ACCESS_TOKEN` (a personal access token from https://supabase.com/dashboard/account/tokens); the service-role key **cannot** do this, since it talks to PostgREST and PostgREST refuses DDL. `npm run migrate -- --dry` lists what would run. A migration is recorded only after its SQL succeeds, so a failure leaves it pending rather than silently skipped. Pasting into the SQL editor by hand still works (`supabase/README.md`), but then `schema_migrations` won't know — re-running is safe because every migration is written `if not exists`.

## Environment

`.env.local.example` is the source of truth for required vars. Notable ones:

- `API_FOOTBALL_KEY` — API-Football (v3.football.api-sports.io) key. Without it, `/api/matches` returns `customMatches` only with `reason: "API_FOOTBALL_KEY missing"`. The API enforces an optional IP allow-list per account; on Vercel you must leave it disabled because Functions run on dynamic IPs. Only the football host is wired up — basketball/tennis/baseball/hockey/volleyball return `[]` from `getMatchesForSport()`
- `ADMIN_PASSWORD` — **unset disables the entire admin section** (proxy returns 503 / redirects to `/admin/login?disabled=1`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — all server-side stores throw if the URL or service-role key is missing
- `MOOLRE_PUBLIC_KEY`, `MOOLRE_ACCOUNT_NUMBER`, `MOOLRE_SECRET_KEY`, `MIN_FIRST_DEPOSIT` — Moolre API integration, **Ghana wallets only**. `POST /api/payments/moolre/start` calls Moolre's `embed/src/start` endpoint with `X-Api-Pubkey` + body `{ state: 'starter', accountnumber, reference, email, amount, currency, callback, nonce_value, tx_source }` and returns `data.authorization_url` for the redirect. After payment, Moolre POSTs the result to `/api/payments/moolre/callback`; the webhook receiver verifies HMAC-SHA256(body, `MOOLRE_SECRET_KEY`), looks up the pending payment by reference, and fires the same `applyDepositCredit` pipeline Paystack uses — so the verification step and sub-admin commission both land automatically. `MOOLRE_PRIVATE_KEY` is reserved for the payouts API and isn't read by either route.
- `AKWAPAY_SECRET_KEY`, `AKWAPAY_WEBHOOK_SECRET`, optional `AKWAPAY_BASE_URL` — AkwaPay, an alternative **Ghana-only** mobile-money gateway (`lib/akwapay.ts`). Amounts go out in **pesewas** (integer minor units — `50.00` is a 400). Four routes under `app/api/payments/akwapay/`: `start` (creates the intent), `otp`, `status` (poll), `webhook`, plus a `reconcile` sweep. Two rules from AkwaPay's own guide are load-bearing here: `metadata` is **not** replayed on the webhook — only `reference` is, so the user is always resolved from our own `payments` row; and status `unknown` means "no answer yet", never failure, so `classifyIntentStatus` maps it to pending (treating it as failed is how you double-charge). Nothing credits from a webhook body — the event only triggers a `GET /v1/payment_intents/{id}`, and `verifyAndCreditAkwapay` is idempotent on `reference`. **This is the live Instant tab**: the deposit page's `INSTANT_GATEWAY` constant is `'akwapay'` (set it to `null` to hide the tab, `'flutterwave'` to switch back). The tab shows whether or not `AKWAPAY_SECRET_KEY` is set — without the key `start` answers 503, so the key and the constant have to move together.

  Which gateway AkwaPay routes a charge through (Moolre until Aug 2026, Flutterwave since) is internal to them and must never be branched on: same endpoints, same webhook signature, same statuses. Two consequences live in the code. `next_action.type` now comes back as `payment_instruction` rather than `await_prompt` for mobile money — `normalizeNextAction` treats them as the same branch, and the OTP path (`submit_otp`, Moolre's flow) stays in place because routing can fail back to it. And the `raw` field on an intent mirrors the gateway's own response, so it is off limits — only the documented top-level fields are stable.

- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` — Paystack credentials used for Nigeria / Kenya / South Africa wallets (and any other non-GH user). Optional `NEXT_PUBLIC_APP_URL` overrides the callback origin. Per-country overrides for amounts: `MIN_FIRST_DEPOSIT_<CC>` and `VERIFICATION_AMOUNT_<CC>` (CC ∈ GH/NG/KE/ZA) — defaults come from `lib/countries.ts`.

## Architecture

### Two backends coexist; the frontend currently uses the Next.js one

- **`app/api/*` (active)** — Next.js route handlers backed by Supabase Postgres. Everything the UI calls today lives here.
- **`backend/PowerStakeBet.API` (alternative)** — a complete ASP.NET Core 8 + EF Core + SQL Server reimplementation with JWT auth and Swagger at `/swagger`. Not wired up unless `NEXT_PUBLIC_API_BASE_URL` is set and frontend fetches are rewritten. See `backend/README.md`. Treat the two as parallel implementations — changes to one do not propagate.

### Middleware is named `proxy.ts`, not `middleware.ts`

`proxy.ts` at the repo root exports `proxy(request)` (plus a `config.matcher`). This is the Next.js middleware file under a non-default name. It guards:

- `/admin/*` and `/api/admin/*` (except `/admin/login`, `/api/admin/login`, `/api/admin/logout`)
- `/sub-admin/dashboard/*` and `/api/sub-admin/me`

Edge runtime — it can only import from `lib/admin-auth.ts` and `lib/sub-admin-auth.ts` (Web Crypto, no Node fs). Anything fs- or Supabase-backed must run inside route handlers.

### Three independent auth schemes (none use Supabase Auth)

1. **Admin**: single shared password. Cookie value is `sha256("powerstakebet:admin:" + ADMIN_PASSWORD)`. Whoever knows the password derives the same token — fine for a single-operator gate, not a multi-user system. (`lib/admin-auth.ts`)
2. **Sub-admin**: per-record. Cookie is `"<subAdminId>:<sig>"` where sig is `sha256("powerstakebet:sub-admin:" + id + ":" + passwordHash)`. The proxy only parses the cookie shape; full validation requires loading the record inside the route handler (`assertSubAdmin`). Changing a sub-admin's password invalidates their sessions. (`lib/sub-admin-auth.ts`)
3. **Player**: bcrypt-hashed password on the `users` table, custom cookie-based session via `lib/user-session.ts`.

### Match feed: API-Football + custom matches + admin overrides

`GET /api/matches` (in `app/api/matches/route.ts`) merges three sources and is the canonical pipeline — replicate this order if you build another match endpoint:

1. Pull admin overrides (`match_overrides` table) into a `matchId → override` map. Missing table is non-fatal — empty map.
2. Load admin-created `custom_matches` for the sport, drop any with `minute === 'FT'`.
3. Fetch API-Football fixtures+odds via `lib/api/odds.ts` (football only — other sports return `[]`), drop any with `minute === 'FT'`.
4. For each match, apply the override (only fields the admin set), then hydrate `markets` via `deriveMarketBook` if absent.
5. Optionally filter to "today only" using a tz offset the client passes via `?tzOffset=<minutes>`.

A `locked` override on either source freezes betting regardless of `isLive`/`startTime` — match-betting checks honor it.

Upstream call shape: per refresh, `lib/api/odds.ts` hits `/fixtures?date=today`, `/fixtures?live=all`, then `/odds?league&season&date` for each unique league with fixtures today, plus `/odds/live?league` for live leagues. Pre-match odds cache for 300s, live for 30s — change those revalidate values together if you tune cadence.

### Football clock: real for upstream, synthetic for custom matches

Upstream matches now take their minute straight from API-Football's `fixture.status.elapsed` + `status.short` (`1H` / `HT` / `2H` / `ET` / `FT` / etc.), so we display whatever the league feed reports. No synthetic clock for those.

Admin-created custom matches still need a synthetic clock — they don't have an upstream feed driving them. `tickingMinute()` in `lib/custom-matches-store.ts` maps real elapsed minutes since kick-off into a broadcast-style clock:

- `0..44` real min → `"0'"…"44'"` (1st half)
- next 1–4 min → `"45+1'"…"45+N'"` (1st half stoppage)
- next 15 min → `"HT"`
- next 45 min → `"46'"…"90'"` (2nd half)
- next 1–4 min → `"90+1'"…"90+M'"` (2nd half stoppage)
- beyond → `"FT"` (match hidden from feed)

Stoppage length is derived per-match from a hash of the match id (1–4 min), so the same match always shows the same stoppage.

### Derived markets

`lib/markets.ts` fits a Poisson model to 1X2 odds and synthesises Over/Under, BTTS, correct-score, HT/FT, first-half 1X2, and draw-no-bet when the bookmaker doesn't return them. A 6% bookie margin is applied. Odds API responses that *do* include `totals`/`btts`/`double_chance` are merged in via `mergeMarketBook` and win over the derived values.

### Storage: Supabase is the source of truth; `data/*.json` is legacy

All `lib/*-store.ts` files (users, bets, sub-admins, custom matches, match overrides, payments) read/write Supabase via `supabaseServer()` (service-role client, RLS bypassed). The leftover JSON files in `data/` are no longer read by the code — do not reintroduce them as a fallback.

`supabaseServer()` is server-only. Importing it from a client component will leak the service-role key into the bundle.

### Payments ledger doubles as transaction history

The `payments` table is the unified user-facing transaction log: deposits and withdrawals are both written there via `recordPayment()` in `lib/payments-store.ts`. We distinguish the two by `metadata.type` (`'deposit'` | `'withdrawal'`) so no schema migration is needed — `recordPayment` always sets it. The `reference` column has a UNIQUE constraint and `recordPayment` is idempotent on it (returns the existing row on `23505`).

The user-facing `/me/transactions` page (and `GET /api/users/[id]/transactions`) merges payment rows with bet placements/wins/losses from the `bets` table, sorted desc by timestamp. Aggregates on `users.total_deposited` / `users.total_withdrawn` are still authoritative for the wallet card — they're not derived from `payments`.

### Checking a payment: route on the row's provider, never on today's gateway

`GET /api/payments/status?reference=` and `POST /api/payments/reconcile` are the provider-agnostic entry points; both dispatch through `verifyPaymentByReference()` in `lib/payment-verify.ts` on the `provider` column of the `payments` row, then hand off to that gateway's `verifyAndCredit*`. The per-gateway routes (`/api/payments/{flutterwave,akwapay,paystack}/...`) still exist and still work — use them only where the caller genuinely knows which gateway opened the charge (the deposit page does; `/me` does not).

A poller that hardcodes one provider is the failure this prevents: the wrong provider has never heard of the reference, so it answers "not confirmed" forever on a deposit the webhook already credited. Nothing is lost — the ledger and the balance are correct — but it reads to the player and to support exactly like a swallowed deposit. `/me` had this against Flutterwave; the sweep on load had it too, silently skipping every row from any other gateway.

### Other conventions

- `@/*` is aliased to the repo root (`tsconfig.json`).
- shadcn/ui style is `new-york`, base color `neutral`, components under `components/ui/`, lucide icons. Use the existing aliases in `components.json` rather than adding new ones.
- Tailwind v4 with `@tailwindcss/postcss` — CSS variables in `app/globals.css`, no `tailwind.config.*`.
- `revalidate = 30` on `/api/matches`, `revalidate = 60` on per-sport Odds API fetches — keep these aligned when adding new match endpoints so the live clock stays close to real time.
- Money is per-user currency: GHS (Ghana), NGN (Nigeria), KES (Kenya), ZAR (South Africa). `users.country` + `users.currency` are set at signup from the country selector in `app/register/page.tsx`. The wallet is denominated in that currency for life — bets, payments, and commission rows all carry the same `currency` column. `lib/countries.ts` is the single source of truth for KYC fields, phone normalisation, payout networks, gateway choice, and the per-country minimum / verification deposit amounts. Moolre is GH-only; everyone else hits Paystack (which expects amounts in the minor unit — `lib/paystack.ts` handles the ×100 conversion).
- **In-app notifications are the delivery channel that always works.** `lib/notifications-store.ts` + the `notifications` table (migration `0031`). SMS (Arkesel) and email (Resend) are both no-ops when their keys are missing — the send silently does nothing and the player is never told — so every money event also writes a notification row: deposit credited (`applyDepositCredit`), withdrawal requested, paid and rejected (`lib/withdrawal-settle.ts`). `notify()` never throws; a failed notification must not take down the payout that triggered it. Read at `/me/notifications`, with an unread badge on the header bell polling `?countOnly=1`.

- Sub-admins have their own betting wallet. `sub_admins.user_id` links to a row in `users` — the same table players bet from — so one login covers the dashboard and the betting site, and the sub-admin stakes from the account they already have. Created **on demand** by `ensureSubAdminWallet()` in `lib/sub-admin-wallet.ts` (migration `0030`), not at signup: it adopts an existing player account on the same email if there is one, otherwise creates a `DEFAULT_COUNTRY` wallet. `POST /api/sub-admin/wallet` moves commission into it — self-service, since nothing leaves the platform; cashing out still goes through the normal player withdrawal flow. Only commission in the **wallet's own currency** can move: commission balances are per-currency, a wallet is single-currency for life, and there is no FX rate in this system. The transfer debits commission first and refunds it if the wallet credit fails — the other order lets the same balance be spent twice.

- Sub-admin commission balances are per-currency: each row in `sub_admins` carries `commission_balances` and `total_commission_earned_by` JSONB maps keyed by currency. The legacy scalar `commission_balance` / `total_commission_earned` columns are kept (and mirrored for GHS) so older reports still work, but new code reads/writes the maps via `creditCommission(id, amount, currency)` and `clearCommissionBalance(id, currency)`.
