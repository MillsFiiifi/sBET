-- 0029_reconcile_payments.sql
-- ============================================================================
-- Fix deposits that fail with "We couldn't match that payment to your deposit".
--
-- Cause: the app writes a pending row to `payments` at deposit start, then the
-- callback / webhook / status-poll credit by looking that row up by reference.
-- If a live database still carries an OLDER `payments` table (from an earlier
-- build), `create table if not exists` in setup-all.sql skips it — so the table
-- can be missing a column or carry a stale CHECK constraint that rejects the
-- insert. The write fails, no row exists, and the completed charge can never be
-- matched or credited.
--
-- This migration reconciles the table to exactly what recordPayment() writes.
-- Idempotent: safe to run repeatedly.
-- ============================================================================

create extension if not exists "pgcrypto";

-- If the table doesn't exist at all, create it in the correct shape.
create table if not exists public.payments (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid references public.users(id) on delete set null,
    reference    text not null unique,
    amount       numeric(18, 2) not null check (amount > 0),
    currency     text not null default 'GHS',
    provider     text not null default 'flutterwave',
    status       text not null default 'pending',
    metadata     jsonb,
    created_at   timestamptz not null default now(),
    verified_at  timestamptz
);

-- Ensure every column recordPayment() writes exists (older tables may lack some).
alter table public.payments add column if not exists user_id       uuid references public.users(id) on delete set null;
alter table public.payments add column if not exists reference     text;
alter table public.payments add column if not exists amount        numeric(18, 2);
alter table public.payments add column if not exists currency      text not null default 'GHS';
alter table public.payments add column if not exists provider      text not null default 'flutterwave';
alter table public.payments add column if not exists status        text not null default 'pending';
alter table public.payments add column if not exists metadata      jsonb;
alter table public.payments add column if not exists created_at    timestamptz not null default now();
alter table public.payments add column if not exists verified_at   timestamptz;
alter table public.payments add column if not exists provider_tx_id text;

-- Unique index on reference so recordPayment()'s idempotency (ON CONFLICT 23505)
-- works even if the original UNIQUE constraint is missing on a drifted table.
create unique index if not exists payments_reference_key on public.payments (reference);

-- Drop ANY existing CHECK constraint that mentions `status`, then add the one
-- the app needs. This clears a stale check (e.g. one that never allowed
-- 'pending') that would otherwise reject the deposit insert.
do $$
declare cname text;
begin
  for cname in
    select conname from pg_constraint
     where conrelid = 'public.payments'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.payments drop constraint %I', cname);
  end loop;
end $$;

alter table public.payments
  add constraint payments_status_check
  check (status in ('pending', 'success', 'failed', 'cancelled'));

-- Helpful indexes (no-ops if already present).
create index if not exists idx_payments_user   on public.payments (user_id, created_at desc);
create index if not exists idx_payments_status  on public.payments (status);
