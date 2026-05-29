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
