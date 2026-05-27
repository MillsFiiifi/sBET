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
- Supabase migrations live in `supabase/migrations/*.sql`. There is no migration runner wired in — apply them by pasting into the Supabase SQL editor (`supabase/README.md` documents the project URL and first-run flow with `schema.sql`).

## Environment

`.env.local.example` is the source of truth for required vars. Notable ones:

- `ODDS_API_KEY` — without it, `/api/matches` returns `customMatches` only with `reason: "ODDS_API_KEY missing"`
- `ADMIN_PASSWORD` — **unset disables the entire admin section** (proxy returns 503 / redirects to `/admin/login?disabled=1`)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — all server-side stores throw if the URL or service-role key is missing
- `MOOLRE_PUBLIC_KEY`, `MOOLRE_ACCOUNT_NUMBER`, `MIN_FIRST_DEPOSIT` — Moolre hosted-checkout (server-side only; `MOOLRE_PUBLIC_KEY` is the JWT shown on the Moolre profile page, sent as `X-Api-Pubkey`). `MOOLRE_PRIVATE_KEY` and `MOOLRE_SECRET_KEY` are reserved for the payouts API and webhook-signature verification respectively — not used yet.

## Architecture

### Two backends coexist; the frontend currently uses the Next.js one

- **`app/api/*` (active)** — Next.js route handlers backed by Supabase Postgres. Everything the UI calls today lives here.
- **`backend/PrimeBet.API` (alternative)** — a complete ASP.NET Core 8 + EF Core + SQL Server reimplementation with JWT auth and Swagger at `/swagger`. Not wired up unless `NEXT_PUBLIC_API_BASE_URL` is set and frontend fetches are rewritten. See `backend/README.md`. Treat the two as parallel implementations — changes to one do not propagate.

### Middleware is named `proxy.ts`, not `middleware.ts`

`proxy.ts` at the repo root exports `proxy(request)` (plus a `config.matcher`). This is the Next.js middleware file under a non-default name. It guards:

- `/admin/*` and `/api/admin/*` (except `/admin/login`, `/api/admin/login`, `/api/admin/logout`)
- `/sub-admin/dashboard/*` and `/api/sub-admin/me`

Edge runtime — it can only import from `lib/admin-auth.ts` and `lib/sub-admin-auth.ts` (Web Crypto, no Node fs). Anything fs- or Supabase-backed must run inside route handlers.

### Three independent auth schemes (none use Supabase Auth)

1. **Admin**: single shared password. Cookie value is `sha256("primebet:admin:" + ADMIN_PASSWORD)`. Whoever knows the password derives the same token — fine for a single-operator gate, not a multi-user system. (`lib/admin-auth.ts`)
2. **Sub-admin**: per-record. Cookie is `"<subAdminId>:<sig>"` where sig is `sha256("primebet:sub-admin:" + id + ":" + passwordHash)`. The proxy only parses the cookie shape; full validation requires loading the record inside the route handler (`assertSubAdmin`). Changing a sub-admin's password invalidates their sessions. (`lib/sub-admin-auth.ts`)
3. **Player**: bcrypt-hashed password on the `users` table, custom cookie-based session via `lib/user-session.ts`.

### Match feed: Odds API + custom matches + admin overrides

`GET /api/matches` (in `app/api/matches/route.ts`) merges three sources and is the canonical pipeline — replicate this order if you build another match endpoint:

1. Pull admin overrides (`match_overrides` table) into a `matchId → override` map. Missing table is non-fatal — empty map.
2. Load admin-created `custom_matches` for the sport, drop any with `minute === 'FT'`.
3. Fetch Odds API events (`lib/api/odds.ts`), drop any with `minute === 'FT'`.
4. For each match, apply the override (only fields the admin set), then hydrate `markets` via `deriveMarketBook` if absent.
5. Optionally filter to "today only" using a tz offset the client passes via `?tzOffset=<minutes>`.

A `locked` override on either source freezes betting regardless of `isLive`/`startTime` — match-betting checks honor it.

### Football clock is intentionally fake-but-consistent

Real-time elapsed minutes are mapped through a regime that adds deterministic 1–4 min stoppage at the end of each half, pauses 15 min at HT, and ends at FT. The displayed minute tracks 1:1 with real time so the clock matches a real broadcast (and Sportybet) rather than drifting ahead.

- `0..44` real min → `"0'"…"44'"` (1st half)
- next 1–4 min → `"45+1'"…"45+N'"` (1st half stoppage)
- next 15 min → `"HT"`
- next 45 min → `"46'"…"90'"` (2nd half)
- next 1–4 min → `"90+1'"…"90+M'"` (2nd half stoppage)
- beyond → `"FT"` (match hidden from feed)

Stoppage length is derived per-match from a hash of the event/match id (1–4 min), so the same match always shows the same stoppage. Two implementations must stay in sync — `footballMatchClock(eventId, elapsedMin)` in `lib/api/odds.ts` for upstream events and `tickingMinute()` in `lib/custom-matches-store.ts` for admin-added matches. Don't change one without the other; same `stoppageFor()` hash recipe in both.

### Derived markets

`lib/markets.ts` fits a Poisson model to 1X2 odds and synthesises Over/Under, BTTS, correct-score, HT/FT, first-half 1X2, and draw-no-bet when the bookmaker doesn't return them. A 6% bookie margin is applied. Odds API responses that *do* include `totals`/`btts`/`double_chance` are merged in via `mergeMarketBook` and win over the derived values.

### Storage: Supabase is the source of truth; `data/*.json` is legacy

All `lib/*-store.ts` files (users, bets, sub-admins, custom matches, match overrides, payments) read/write Supabase via `supabaseServer()` (service-role client, RLS bypassed). The leftover JSON files in `data/` are no longer read by the code — do not reintroduce them as a fallback.

`supabaseServer()` is server-only. Importing it from a client component will leak the service-role key into the bundle.

### Payments ledger doubles as transaction history

The `payments` table is the unified user-facing transaction log: deposits and withdrawals are both written there via `recordPayment()` in `lib/payments-store.ts`. We distinguish the two by `metadata.type` (`'deposit'` | `'withdrawal'`) so no schema migration is needed — `recordPayment` always sets it. The `reference` column has a UNIQUE constraint and `recordPayment` is idempotent on it (returns the existing row on `23505`).

The user-facing `/me/transactions` page (and `GET /api/users/[id]/transactions`) merges payment rows with bet placements/wins/losses from the `bets` table, sorted desc by timestamp. Aggregates on `users.total_deposited` / `users.total_withdrawn` are still authoritative for the wallet card — they're not derived from `payments`.

### Other conventions

- `@/*` is aliased to the repo root (`tsconfig.json`).
- shadcn/ui style is `new-york`, base color `neutral`, components under `components/ui/`, lucide icons. Use the existing aliases in `components.json` rather than adding new ones.
- Tailwind v4 with `@tailwindcss/postcss` — CSS variables in `app/globals.css`, no `tailwind.config.*`.
- `revalidate = 30` on `/api/matches`, `revalidate = 60` on per-sport Odds API fetches — keep these aligned when adding new match endpoints so the live clock stays close to real time.
- Money in GHS (Ghana cedis). Moolre's hosted checkout accepts the major-unit amount directly — no pesewa conversion needed.
