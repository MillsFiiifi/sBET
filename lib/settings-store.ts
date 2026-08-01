import { supabaseServer } from '@/lib/supabase'

// Key/value platform settings (app_settings table). Reads degrade gracefully:
// if the table doesn't exist yet (migration not run), callers fall back to
// env/defaults instead of throwing.

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabaseServer()
      .from('app_settings')
      .select('key, value')
      .in('key', keys)
    if (error) return {}
    const out: Record<string, string> = {}
    for (const row of (data ?? []) as { key: string; value: string | null }[]) {
      if (row.value != null && row.value !== '') out[row.key] = row.value
    }
    return out
  } catch {
    return {}
  }
}

export async function getSetting(key: string): Promise<string | null> {
  const map = await getSettings([key])
  return map[key] ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await supabaseServer()
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`settings.set: ${error.message}`)
}
