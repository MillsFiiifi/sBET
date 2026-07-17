import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { isAdminRequest } from '@/lib/admin-guard'
import { supabaseServer } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const BUCKET = 'team-flags'
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'])

/**
 * POST /api/admin/upload-flag  (multipart form-data, field "file")
 * Stores a team crest/logo in the public `team-flags` Storage bucket and
 * returns its public URL. The bucket is created on first use.
 */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'expected multipart form-data' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no file uploaded' }, { status: 400 })
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'file must be a PNG, JPG, WEBP, SVG or GIF' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'image too large (max 2 MB)' }, { status: 400 })
  }

  const sb = supabaseServer()
  // Ensure the public bucket exists (no-op once created).
  await sb.storage.createBucket(BUCKET, { public: true }).catch(() => {})

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const path = `${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await sb.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (error) {
    return NextResponse.json({ error: `upload failed: ${error.message}` }, { status: 500 })
  }

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl }, { status: 201 })
}
