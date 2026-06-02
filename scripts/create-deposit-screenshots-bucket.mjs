// One-shot script: creates the `deposit-screenshots` Storage bucket (public)
// used by the Nigeria manual-deposit flow. Players upload a payment proof,
// admins view it in /admin/deposits before crediting. Safe to re-run.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const BUCKET = 'deposit-screenshots'

const { data: existing, error: listErr } = await supabase.storage.listBuckets()
if (listErr) {
  console.error('listBuckets failed:', listErr.message)
  process.exit(1)
}
if (existing.some((b) => b.name === BUCKET)) {
  console.log(`Bucket "${BUCKET}" already exists — nothing to do.`)
  process.exit(0)
}

const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
  public: true,
  fileSizeLimit: 5_000_000,
  allowedMimeTypes: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
  ],
})
if (createErr) {
  console.error('createBucket failed:', createErr.message)
  process.exit(1)
}
console.log(`Created public bucket "${BUCKET}" with 5 MB limit, image MIMEs only.`)
