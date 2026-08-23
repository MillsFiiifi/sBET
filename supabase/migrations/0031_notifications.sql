-- In-app notifications.
--
-- Every message the platform sends a player has depended on something outside
-- it: SMS needs Arkesel configured and in credit, email needs Resend. When
-- either is missing the send is a silent no-op and the player is simply never
-- told — which is exactly how a withdrawal got paid with nobody the wiser.
--
-- This table is the delivery channel that cannot be unconfigured. It is also
-- the only one that leaves a record we own: an SMS that failed is gone, a row
-- here is still here tomorrow.

create table if not exists public.notifications (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references public.users(id) on delete cascade,
    -- 'withdrawal' | 'deposit' | 'bet' | 'system' — drives the icon, and lets
    -- a future settings screen mute categories.
    kind       text not null default 'system',
    title      text not null,
    body       text not null,
    -- Reference, amount, currency: whatever the message refers to, so a row
    -- can be traced back to the payment it describes.
    metadata   jsonb not null default '{}'::jsonb,
    read_at    timestamptz,
    created_at timestamptz not null default now()
);

-- The only query that matters: this player's notifications, newest first.
-- Partial index on unread backs the bell's badge count without scanning read
-- history that grows forever.
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

-- ON DELETE CASCADE above: a deleted player's notifications are meaningless
-- and nothing else references them.
comment on table public.notifications is
  'In-app messages to players. The delivery channel that works with no third party configured.';
