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
