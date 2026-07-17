-- ============================================================================
-- NexxtWin / EliteOdds — full database setup (schema + all migrations)
-- Generated for a fresh Supabase project. Paste this whole file into the
-- Supabase SQL Editor and run once. Safe to re-run (idempotent).
-- ============================================================================

-- ===== schema.sql =====
-- ============================================================================
-- PrimeBet — Supabase schema
-- ----------------------------------------------------------------------------
-- Paste this whole file into Supabase Studio → SQL editor → New query → Run.
-- It's idempotent: every CREATE uses "IF NOT EXISTS" so you can re-run safely.
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive email

-- ============================================================================
-- 1. SUB-ADMINS (partner / referral accounts)
-- ============================================================================
create table if not exists public.sub_admins (
    id                          uuid primary key default gen_random_uuid(),
    name                        text not null check (char_length(name) between 2 and 120),
    email                       citext not null unique,
    password_hash               text not null,
    referral_code               text not null unique check (referral_code = upper(referral_code)),
    approved                    boolean not null default false,
    -- Legacy GHS-only scalars; kept for historical reporting, application now reads/writes the JSONB maps.
    commission_balance          numeric(18, 2) not null default 0 check (commission_balance >= 0),
    total_commission_earned     numeric(18, 2) not null default 0 check (total_commission_earned >= 0),
    -- Per-currency balances: { "GHS": 12.34, "NGN": 5000, "KES": 0, "ZAR": 0 }
    commission_balances         jsonb not null default '{}'::jsonb,
    total_commission_earned_by  jsonb not null default '{}'::jsonb,
    created_at                  timestamptz not null default now()
);

create index if not exists idx_sub_admins_referral_code on public.sub_admins (referral_code);

-- ============================================================================
-- 2. USERS (players)
-- ============================================================================
create table if not exists public.users (
    id                       uuid primary key default gen_random_uuid(),
    name                     text not null check (char_length(name) between 2 and 120),
    email                    citext not null unique,
    password_hash            text not null,
    phone                    text,
    -- Country / currency the wallet is denominated in. Fixed at signup.
    country                  text not null default 'GH' check (country in ('GH', 'NG', 'KE', 'ZA', 'UG', 'TZ', 'CM', 'ZM', 'CI', 'RW', 'US', 'GB')),
    currency                 text not null default 'GHS' check (currency in ('GHS', 'NGN', 'KES', 'ZAR', 'UGX', 'TZS', 'XAF', 'ZMW', 'XOF', 'RWF', 'USD', 'GBP')),
    -- KYC value captured at signup (country-specific shape: Ghana Card, BVN/NIN, etc.).
    kyc_id                   text,
    -- Legacy column kept for Ghana users so old migration 0010 data isn't lost.
    ghana_card               text,
    referred_by_code         text,
    referred_by_sub_admin_id uuid references public.sub_admins(id) on delete set null,
    first_deposit_amount     numeric(18, 2) not null default 0 check (first_deposit_amount >= 0),
    first_deposit_at         timestamptz,
    total_deposited          numeric(18, 2) not null default 0 check (total_deposited >= 0),
    total_withdrawn          numeric(18, 2) not null default 0 check (total_withdrawn >= 0),
    balance                  numeric(18, 2) not null default 0,
    -- 4-step withdrawal verification: 0 = none, 1..3 = progressive qualifying deposits paid, 4 = fully verified
    verification_step        integer not null default 0
                             check (verification_step between 0 and 4),
    -- Admin must explicitly flip this before withdrawals are allowed
    withdrawal_approved      boolean not null default false,
    created_at               timestamptz not null default now()
);

create index if not exists idx_users_referred_by on public.users (referred_by_sub_admin_id);
create index if not exists idx_users_created_at on public.users (created_at desc);

-- ============================================================================
-- 3. COMMISSIONS (one row per first-deposit referral payout)
-- ============================================================================
create table if not exists public.commissions (
    id                uuid primary key default gen_random_uuid(),
    sub_admin_id      uuid not null references public.sub_admins(id) on delete cascade,
    user_id           uuid not null references public.users(id) on delete cascade,
    deposit_amount    numeric(18, 2) not null check (deposit_amount > 0),
    commission_amount numeric(18, 2) not null check (commission_amount > 0),
    rate              numeric(6, 4) not null check (rate > 0 and rate <= 1),
    currency          text not null default 'GHS' check (currency in ('GHS', 'NGN', 'KES', 'ZAR', 'UGX', 'TZS', 'XAF', 'ZMW', 'XOF', 'RWF', 'USD', 'GBP')),
    created_at        timestamptz not null default now()
);

create index if not exists idx_commissions_sub_admin on public.commissions (sub_admin_id, created_at desc);
create index if not exists idx_commissions_user on public.commissions (user_id);

-- ============================================================================
-- 4. BETS (parent record per ticket)
-- ============================================================================
create table if not exists public.bets (
    id             uuid primary key default gen_random_uuid(),
    code           text not null unique check (code = upper(code)),
    user_id        uuid references public.users(id) on delete set null,
    placed_at      timestamptz not null default now(),
    stake          numeric(18, 2) not null check (stake > 0),
    total_odds     numeric(18, 4) not null check (total_odds >= 1),
    potential_win  numeric(18, 2) not null check (potential_win >= 0),
    currency       text not null default 'GHS' check (currency in ('GHS', 'NGN', 'KES', 'ZAR', 'UGX', 'TZS', 'XAF', 'ZMW', 'XOF', 'RWF', 'USD', 'GBP')),
    status         text not null default 'pending'
                   check (status in ('pending', 'won', 'lost')),
    settled_at     timestamptz,
    payout         numeric(18, 2) check (payout is null or payout >= 0)
);

create index if not exists idx_bets_user on public.bets (user_id, placed_at desc);
create index if not exists idx_bets_status on public.bets (status, placed_at desc);

-- ============================================================================
-- 5. BET_SELECTIONS (line items of each ticket)
-- ============================================================================
create table if not exists public.bet_selections (
    id             uuid primary key default gen_random_uuid(),
    bet_id         uuid not null references public.bets(id) on delete cascade,
    match_id       text not null,
    home_team      text not null default '',
    away_team      text not null default '',
    league         text not null default '',
    country        text not null default '',
    market_key     text not null,
    market_label   text not null default '',
    outcome_key    text not null,
    outcome_label  text not null default '',
    odds           numeric(18, 4) not null check (odds >= 1),
    -- Per-leg result so the bet card can colour each match green/red
    status         text not null default 'pending'
                   check (status in ('pending', 'won', 'lost'))
);

create index if not exists idx_bet_selections_bet on public.bet_selections (bet_id);
create index if not exists idx_bet_selections_status on public.bet_selections (bet_id, status);

-- ============================================================================
-- 6. CUSTOM_MATCHES (admin-added matches)
-- ============================================================================
create table if not exists public.custom_matches (
    id              uuid primary key default gen_random_uuid(),
    sport           text not null default 'football',
    league          text not null,
    country         text not null default '',
    home_team       text not null,
    away_team       text not null,
    home_score      integer,
    away_score      integer,
    minute          text,
    minute_set_at   timestamptz,
    start_time      text,
    start_time_utc  timestamptz,
    is_live         boolean not null default false,
    odds_home       numeric(10, 2) not null check (odds_home >= 1),
    odds_draw       numeric(10, 2) not null default 0 check (odds_draw >= 0),
    odds_away       numeric(10, 2) not null check (odds_away >= 1),
    created_at      timestamptz not null default now()
);

create index if not exists idx_custom_matches_sport on public.custom_matches (sport, created_at desc);
create index if not exists idx_custom_matches_live on public.custom_matches (is_live) where is_live = true;

-- ============================================================================
-- 7. PAYMENTS (Korapay deposit log — one row per attempted payment)
-- ============================================================================
create table if not exists public.payments (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid references public.users(id) on delete set null,
    reference    text not null unique,
    amount       numeric(18, 2) not null check (amount > 0),
    currency     text not null default 'GHS',
    provider     text not null default 'korapay',
    status       text not null default 'pending'
                 check (status in ('pending', 'success', 'failed', 'cancelled')),
    metadata     jsonb,
    created_at   timestamptz not null default now(),
    verified_at  timestamptz
);

create index if not exists idx_payments_user on public.payments (user_id, created_at desc);
create index if not exists idx_payments_status on public.payments (status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
-- All access goes through the Next.js server using the SERVICE ROLE key,
-- which bypasses RLS. RLS is still enabled with conservative deny-by-default
-- policies so that the anon key — which ships to the browser — can't read
-- anything sensitive. Tighten / open up as needed.
-- ============================================================================

alter table public.sub_admins      enable row level security;
alter table public.users           enable row level security;
alter table public.commissions     enable row level security;
alter table public.bets            enable row level security;
alter table public.bet_selections  enable row level security;
alter table public.custom_matches  enable row level security;
alter table public.payments        enable row level security;

-- Public can read live / upcoming custom matches (used by the public matches API).
drop policy if exists "anon read custom matches" on public.custom_matches;
create policy "anon read custom matches" on public.custom_matches
    for select to anon
    using (true);

-- Everything else: no anon access. Service role bypasses these by design.

-- ============================================================================
-- HELPER VIEW (optional) — for the /api/admin/stats endpoint
-- ============================================================================
create or replace view public.admin_stats as
select
    (select count(*) from public.users)                                  as total_users,
    (select count(*) from public.bets)                                   as total_bets,
    (select count(*) from public.bets where status = 'pending')          as pending_bets,
    (select count(*) from public.sub_admins)                             as total_sub_admins,
    (select count(*) from public.custom_matches)                         as total_custom_matches,
    (select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
       from (select currency, sum(total_deposited) as total
               from public.users group by currency) t)                   as total_deposited_by_currency,
    (select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
       from (select currency, sum(total_withdrawn) as total
               from public.users group by currency) t)                   as total_withdrawn_by_currency,
    (select coalesce(sum(total_deposited), 0) from public.users)         as total_deposited,
    (select coalesce(sum(total_withdrawn), 0) from public.users)         as total_withdrawn,
    (select coalesce(sum(total_commission_earned), 0) from public.sub_admins) as total_commissions_paid;


-- ===== migrations/0001_verification_step.sql =====
-- Add a 2-step withdrawal verification gate.
-- 0 = not verified yet, must pay 200 GHS verification deposit
-- 1 = first verification done, must pay another 200 for "final verification"
-- 2 = fully verified, withdrawals allowed
alter table public.users
    add column if not exists verification_step
        integer not null default 0
        check (verification_step between 0 and 2);

-- Backfill: anyone who already has deposits gets considered partly verified.
-- Two deposits ≥ 200 each → fully verified. One ≥ 200 → step 1. None → step 0.
update public.users
   set verification_step = least(
       2,
       (case when total_deposited >= 400 then 2
             when total_deposited >= 200 then 1
             else 0 end)
   )
 where verification_step = 0;


-- ===== migrations/0002_selection_status.sql =====
-- Per-selection result tracking, so a bet card can show each leg's win/loss
-- (Sportybet-style: green for the legs that won, red for the one that lost).
alter table public.bet_selections
    add column if not exists status text not null default 'pending'
        check (status in ('pending', 'won', 'lost'));

create index if not exists idx_bet_selections_status
    on public.bet_selections (bet_id, status);

-- Backfill: existing selections inherit the parent bet's status, so
-- already-settled tickets show correct colors immediately.
update public.bet_selections s
   set status = b.status
  from public.bets b
 where s.bet_id = b.id
   and s.status = 'pending'
   and b.status <> 'pending';


-- ===== migrations/0003_minute_set_at.sql =====
-- Ticking minute support for custom live matches.
-- We store the minute as the admin entered it ("45'") plus a timestamp of
-- when they entered it. The read-side computes the current minute as
--   stored_minute + floor((now - minute_set_at) / 60_000)
-- so the displayed clock keeps moving without further admin input.
-- If the admin updates the minute later, both columns are bumped and the
-- clock continues from there.

alter table public.custom_matches
    add column if not exists minute_set_at timestamptz;

-- Backfill: anything currently marked live gets minute_set_at = created_at
-- so it doesn't tick from epoch. Anything finished/upcoming stays null.
update public.custom_matches
   set minute_set_at = created_at
 where is_live = true and minute_set_at is null;


-- ===== migrations/0004_withdrawal_approved.sql =====
-- Admin approval gate for withdrawals. A user must reach verification_step=2
-- AND have withdrawal_approved=true before /api/users/withdraw will pay out.
alter table public.users
    add column if not exists withdrawal_approved boolean not null default false;

create index if not exists idx_users_withdrawal_approved
    on public.users (withdrawal_approved)
    where withdrawal_approved = false;


-- ===== migrations/0005_user_phone.sql =====
-- Phone number for mobile money withdrawals. Optional at signup, captured
-- on first withdrawal and reused thereafter so the user doesn't have to
-- retype it each time.
alter table public.users
    add column if not exists phone text;

create index if not exists idx_users_phone on public.users (phone)
    where phone is not null;


-- ===== migrations/0006_custom_match_team_flags.sql =====
-- Add optional team flag/logo URL columns to custom_matches.
-- The admin uploads images via POST /api/admin/upload-flag, which stores them
-- in the `team-flags` Supabase Storage bucket and writes the public URL here.

alter table custom_matches
  add column if not exists home_flag_url text,
  add column if not exists away_flag_url text;

-- Required Storage setup (run once via the Supabase dashboard or CLI):
--   1. Create a Storage bucket named `team-flags` with Public read access.
--   2. The server uses the service-role key, so no RLS policies are needed
--      for the upload itself — public read on the bucket is sufficient.


-- ===== migrations/0007_custom_match_locked.sql =====
-- Admin-controlled manual lock for custom matches.
-- When true, getBettingState() in lib/match-betting.ts reports the match as
-- closed regardless of isLive / startTime — used to stop bets at any moment.

alter table custom_matches
  add column if not exists locked boolean not null default false;


-- ===== migrations/0008_match_overrides.sql =====
-- Admin-set overrides for ANY match (Odds API or custom). Each row keys off
-- the public match id; the merge layer in /api/matches overlays these values
-- on top of whatever the upstream source returned, so admin can fix scores
-- or lock a game when the API hasn't caught up.

create table if not exists match_overrides (
  match_id     text primary key,
  home_score   integer,
  away_score   integer,
  minute       text,
  is_live      boolean,
  locked       boolean not null default false,
  updated_at   timestamptz not null default now()
);

create index if not exists match_overrides_updated_at_idx
  on match_overrides (updated_at desc);


-- ===== migrations/0009_payments_rebrand_provider.sql =====
-- 0009_payments_rebrand_provider.sql
-- One-shot data migration: after switching the payment gateway from
-- Paystack to Moolre, rewrite the legacy provider label on existing
-- rows so the UI doesn't surface "paystack" anywhere. The underlying
-- transactions are historically Paystack's, but for product purposes
-- we treat them as part of the Moolre ledger going forward.
--
-- Safe to re-run: the WHERE clause makes it a no-op after the first run.

update payments
set provider = 'moolre'
where provider = 'paystack';


-- ===== migrations/0010_user_ghana_card.sql =====
-- 0010_user_ghana_card.sql
-- Add a Ghana Card column to users for KYC capture at registration.
-- Format: GHA-XXXXXXXXX-X (3 letters + 9 digits + 1 check digit).
-- Nullable so existing users (who registered before this column existed)
-- are not blocked from logging in. New registrations are gated in the
-- /api/users/register route.

alter table users
  add column if not exists ghana_card text;

-- Case-insensitive lookup later (admin search etc).
create index if not exists users_ghana_card_idx
  on users (lower(ghana_card));


-- ===== migrations/0011_multi_country.sql =====
-- ============================================================================
-- 0011 — Multi-country (GH, NG, KE, ZA) support
-- ----------------------------------------------------------------------------
-- Adds the country / currency dimension to users, bets, and commissions, and
-- replaces the single-currency sub_admins.commission_balance scalar with a
-- per-currency JSONB map so we can track NGN / KES / ZAR balances separately.
--
-- Idempotent: every ALTER is wrapped in "if not exists" or guarded by
-- information_schema checks so re-running on a partially-migrated DB is safe.
-- ============================================================================

-- ─── USERS ─────────────────────────────────────────────────────────────────
alter table public.users
    add column if not exists country  text not null default 'GH',
    add column if not exists currency text not null default 'GHS';

-- Add the country / currency check constraints in a guarded block so re-runs
-- don't error on "constraint already exists".
do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'users_country_check'
    ) then
        alter table public.users
            add constraint users_country_check
            check (country in ('GH', 'NG', 'KE', 'ZA', 'UG', 'TZ', 'CM', 'ZM', 'CI', 'RW', 'US', 'GB'));
    end if;
    if not exists (
        select 1 from pg_constraint where conname = 'users_currency_check'
    ) then
        alter table public.users
            add constraint users_currency_check
            check (currency in ('GHS', 'NGN', 'KES', 'ZAR', 'UGX', 'TZS', 'XAF', 'ZMW', 'XOF', 'RWF', 'USD', 'GBP'));
    end if;
end $$;

-- The Ghana Card column was added in 0010; relax it to nullable for non-Ghana
-- users (Nigerian / Kenyan / SA signups carry a different KYC value, stored in
-- the new `kyc_id` column below).
alter table public.users
    add column if not exists kyc_id text;

-- ─── BETS ──────────────────────────────────────────────────────────────────
alter table public.bets
    add column if not exists currency text not null default 'GHS';

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'bets_currency_check'
    ) then
        alter table public.bets
            add constraint bets_currency_check
            check (currency in ('GHS', 'NGN', 'KES', 'ZAR', 'UGX', 'TZS', 'XAF', 'ZMW', 'XOF', 'RWF', 'USD', 'GBP'));
    end if;
end $$;

-- ─── COMMISSIONS ───────────────────────────────────────────────────────────
alter table public.commissions
    add column if not exists currency text not null default 'GHS';

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'commissions_currency_check'
    ) then
        alter table public.commissions
            add constraint commissions_currency_check
            check (currency in ('GHS', 'NGN', 'KES', 'ZAR', 'UGX', 'TZS', 'XAF', 'ZMW', 'XOF', 'RWF', 'USD', 'GBP'));
    end if;
end $$;

-- ─── SUB-ADMINS: per-currency balances ─────────────────────────────────────
-- The old commission_balance / total_commission_earned scalars were GHS-only.
-- We keep them around for historic reporting and add two JSONB maps that the
-- application now treats as authoritative:
--   commission_balances        = { "GHS": 12.34, "NGN": 5000, ... }
--   total_commission_earned_by = { "GHS": 100.00, "NGN": 250000, ... }
alter table public.sub_admins
    add column if not exists commission_balances        jsonb not null default '{}'::jsonb,
    add column if not exists total_commission_earned_by jsonb not null default '{}'::jsonb;

-- Backfill the JSONB maps from the legacy scalars on first run (only for rows
-- that have not been migrated yet so re-runs stay idempotent).
update public.sub_admins
   set commission_balances = jsonb_build_object('GHS', commission_balance)
 where commission_balances = '{}'::jsonb
   and commission_balance > 0;

update public.sub_admins
   set total_commission_earned_by = jsonb_build_object('GHS', total_commission_earned)
 where total_commission_earned_by = '{}'::jsonb
   and total_commission_earned > 0;

-- ─── PAYMENTS ──────────────────────────────────────────────────────────────
-- Payments already has a `currency` column with default 'GHS' — no change
-- needed. The Paystack provider will start writing NGN/KES/ZAR there directly.

-- ─── ADMIN STATS VIEW: group money by currency ─────────────────────────────
-- The view used by /api/admin/stats summed total_deposited across all users,
-- which silently mixed GHS+NGN+KES+ZAR into a meaningless number. Rebuild it
-- to return JSON maps so the admin dashboard can render per-currency rows.
drop view if exists public.admin_stats;
create or replace view public.admin_stats as
select
    (select count(*) from public.users)                                  as total_users,
    (select count(*) from public.bets)                                   as total_bets,
    (select count(*) from public.bets where status = 'pending')          as pending_bets,
    (select count(*) from public.sub_admins)                             as total_sub_admins,
    (select count(*) from public.custom_matches)                         as total_custom_matches,
    (select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
       from (select currency, sum(total_deposited) as total
               from public.users group by currency) t)                   as total_deposited_by_currency,
    (select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
       from (select currency, sum(total_withdrawn) as total
               from public.users group by currency) t)                   as total_withdrawn_by_currency,
    (select coalesce(sum(total_deposited), 0)  from public.users)        as total_deposited,      -- legacy, GHS-only meaningful
    (select coalesce(sum(total_withdrawn), 0)  from public.users)        as total_withdrawn,      -- legacy
    (select coalesce(sum(total_commission_earned), 0) from public.sub_admins) as total_commissions_paid;


-- ===== migrations/0012_verification_step_4.sql =====
-- ============================================================================
-- 0012 — Raise the withdrawal-verification gate from 2 to 4 deposits
-- ----------------------------------------------------------------------------
-- Original 0001 capped users.verification_step at 2 with a CHECK constraint.
-- Operations now want 4 qualifying deposits before withdrawals unlock, so we
-- relax the check to (0..4). Existing rows already inside (0..2) satisfy the
-- new range without any data change.
--
-- Idempotent: the constraint drop / recreate is wrapped in a DO block so
-- re-running on a partially-migrated DB is safe.
-- ============================================================================

do $$
declare
    cname text;
begin
    -- Drop the old check constraint, whatever Postgres named it.
    for cname in
        select conname
          from pg_constraint
         where conrelid = 'public.users'::regclass
           and contype = 'c'
           and pg_get_constraintdef(oid) like '%verification_step%between 0 and 2%'
    loop
        execute format('alter table public.users drop constraint %I', cname);
    end loop;

    -- Add the new one if it doesn't exist.
    if not exists (
        select 1 from pg_constraint where conname = 'users_verification_step_check'
    ) then
        alter table public.users
            add constraint users_verification_step_check
            check (verification_step between 0 and 4);
    end if;
end $$;

-- ===== migrations/0019_match_overrides_postponed.sql =====
-- Admin can mark a match as postponed. Players see a "Postponed" badge and
-- new bets are locked; existing bets are left untouched (settle/handle later).
alter table match_overrides
  add column if not exists postponed boolean not null default false;

-- ===== migrations/0020_bookings_expiry.sql =====
-- Booking codes expire once their games are done. We stamp expires_at at
-- creation (latest selection kickoff + a match-duration buffer); loading a code
-- past that time is rejected. Null = never expires (legacy rows).
-- Guarded: the `bookings` table is created by an earlier feature migration that
-- isn't part of this consolidated file, so only add the column when it exists.
do $$
begin
  if to_regclass('public.bookings') is not null then
    alter table bookings add column if not exists expires_at timestamptz;
  end if;
end $$;

-- ===== migrations/0021_push_and_goal_alerts.sql =====
create table if not exists push_subscriptions (
  endpoint    text primary key,
  user_id     text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx
  on push_subscriptions (user_id);

create table if not exists goal_notifications (
  match_id    text primary key,
  home        integer not null default 0,
  away        integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- ===== migrations/0022_promotions.sql =====
-- Admin-managed promotions shown on the player Promotions page.
-- Replaces the old hard-coded PROMOTIONS constant with real, editable rows.
create table if not exists public.promotions (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 2 and 120),
  description  text not null default '',
  bonus        text not null default '',
  percentage   text not null default '',
  requirements text not null default '',
  expires_in   text not null default '',
  status       text not null default 'active'
               check (status in ('active', 'available', 'claimed')),
  badge        text not null default 'Active',
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists idx_promotions_active
  on public.promotions (active, sort_order) where active = true;

alter table public.promotions enable row level security;

-- Players (anon key in the browser) may read active promotions only.
drop policy if exists "anon read active promotions" on public.promotions;
create policy "anon read active promotions" on public.promotions
  for select to anon using (active = true);

-- ===== migrations/0023_transactions.sql =====
-- Real wallet ledger: deposits, withdrawals, and bet settlements. Deposit /
-- withdrawal rows start 'pending' and an admin approves them, which credits or
-- debits the user's balance. Replaces the old hard-coded TRANSACTIONS constant.
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.users(id) on delete cascade,
  type         text not null
               check (type in ('deposit', 'withdrawal', 'bet_win', 'bet_loss', 'bonus', 'adjustment')),
  amount       numeric(18, 2) not null check (amount >= 0),
  currency     text not null default 'GHS',
  method       text not null default '',
  status       text not null default 'pending'
               check (status in ('pending', 'completed', 'failed', 'cancelled')),
  note         text,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_transactions_user
  on public.transactions (user_id, created_at desc);
create index if not exists idx_transactions_status
  on public.transactions (status, created_at desc);

alter table public.transactions enable row level security;
-- No anon access — the app reads/writes these through the service-role key.

