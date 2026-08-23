#!/usr/bin/env node
// Apply pending SQL migrations to Supabase.
//
// Until now migrations were applied by pasting them into the SQL editor, which
// is fine until you forget one — a deployed feature then fails against a
// schema that never got the column, and the only clue is a 500 from a route
// nobody is watching.
//
// Runs over the Management API rather than a Postgres connection, so there is
// no driver to install and no database password to keep anywhere. It needs a
// personal access token:
//
//   1. https://supabase.com/dashboard/account/tokens  → Generate new token
//   2. Put it in .env.local as SUPABASE_ACCESS_TOKEN=sbp_...
//
// A PAT is scoped to your account and revocable from that same page, which is
// why this asks for one instead of the database password.
//
// Usage:
//   npm run migrate            apply everything pending
//   npm run migrate -- --dry   list what would run, change nothing

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS_DIR = 'supabase/migrations'
const API = 'https://api.supabase.com/v1'
const dryRun = process.argv.includes('--dry') || process.argv.includes('--dry-run')

function loadEnv() {
  const out = { ...process.env }
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const i = t.indexOf('=')
      const key = t.slice(0, i).trim()
      // Real env wins, so CI can override the file.
      if (!out[key]) out[key] = t.slice(i + 1).trim()
    }
  } catch {
    /* no .env.local — rely on the real environment */
  }
  return out
}

const env = loadEnv()
const token = env.SUPABASE_ACCESS_TOKEN?.trim()
const projectUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
const ref = projectUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]

if (!ref) {
  console.error('✖ NEXT_PUBLIC_SUPABASE_URL is missing or not a supabase.co URL.')
  process.exit(1)
}
if (!token) {
  console.error(`
✖ SUPABASE_ACCESS_TOKEN is not set, so there is no way to reach the database.

  The service-role key cannot do this: it talks to PostgREST, which refuses
  DDL by design. Applying schema changes needs a personal access token.

    1. https://supabase.com/dashboard/account/tokens  → Generate new token
    2. Add to .env.local:  SUPABASE_ACCESS_TOKEN=sbp_...

  Then run this again. The token is account-scoped and revocable from that
  same page — unlike the database password, which is neither.

  Or paste the files by hand:
    https://supabase.com/dashboard/project/${ref}/sql/new
`)
  process.exit(1)
}

/** Run one SQL statement batch. Throws with the server's message on failure. */
async function query(sql) {
  const res = await fetch(`${API}/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) {
    let msg = text
    try {
      msg = JSON.parse(text).message ?? text
    } catch {
      /* keep the raw body */
    }
    throw new Error(msg)
  }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function main() {
  // The ledger of what has run. Created first, and by the same mechanism as
  // everything else, so a fresh project needs no manual setup.
  await query(`
    create table if not exists public.schema_migrations (
      name        text primary key,
      applied_at  timestamptz not null default now()
    );
  `)

  const applied = new Set(
    ((await query('select name from public.schema_migrations')) ?? []).map((r) => r.name),
  )

  // Lexical order is chronological because every file is numbered.
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const pending = files.filter((f) => !applied.has(f))

  console.log(`${files.length} migration${files.length === 1 ? '' : 's'} on disk, ${applied.size} already applied.`)

  if (pending.length === 0) {
    console.log('✔ Nothing to do — the database is up to date.')
    return
  }

  console.log(`\n${pending.length} pending:`)
  for (const f of pending) console.log(`  · ${f}`)

  if (dryRun) {
    console.log('\n(dry run — nothing was changed)')
    return
  }

  console.log('')
  for (const file of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    process.stdout.write(`  applying ${file} … `)
    try {
      await query(sql)
      // Recorded only after the SQL succeeded, so a failure leaves it pending
      // and the next run retries it rather than skipping it forever.
      await query(
        `insert into public.schema_migrations (name) values ('${file.replace(/'/g, "''")}')
         on conflict (name) do nothing;`,
      )
      console.log('ok')
    } catch (e) {
      console.log('FAILED')
      console.error(`\n✖ ${file} did not apply:\n  ${e.message}\n`)
      console.error('Nothing after this was attempted. Fix the file and run again.')
      process.exit(1)
    }
  }

  console.log(`\n✔ Applied ${pending.length} migration${pending.length === 1 ? '' : 's'}.`)
}

main().catch((e) => {
  console.error('✖ migrate failed:', e.message)
  process.exit(1)
})
