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
