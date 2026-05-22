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
