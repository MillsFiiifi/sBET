-- Give every sub-admin a betting wallet.
--
-- A sub-admin earns commission but had nowhere to spend it: the dashboard was
-- a reporting screen and the only way money left it was the main admin paying
-- out by hand. Linking each sub-admin to a row in `users` means the account
-- they already log in with is also the account they stake from, and moving
-- commission into it is a transfer rather than a payout.
--
-- Nullable on purpose. Existing sub-admins have no wallet until the first time
-- they need one, and it is created and linked then — no backfill, and a
-- sub-admin who never bets never gets a users row.
--
-- ON DELETE SET NULL: deleting a player must not delete the partner who
-- referred half your customers. The link just goes away and a fresh wallet is
-- created next time one is asked for.

alter table public.sub_admins
  add column if not exists user_id uuid references public.users(id) on delete set null;

-- One wallet per sub-admin, and one sub-admin per wallet. Without this a retry
-- of the create-and-link path could leave two sub-admins pointing at the same
-- balance, or one sub-admin with two wallets and commission split across them.
create unique index if not exists sub_admins_user_id_key
  on public.sub_admins (user_id)
  where user_id is not null;

comment on column public.sub_admins.user_id is
  'The sub-admin''s own betting wallet in public.users. Created on demand, not at signup.';
