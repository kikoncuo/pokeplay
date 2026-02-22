import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/rooms/cleanup
 *
 * Deactivates rooms that have had no activity in the last 24 hours.
 * Intended to be called by a cron job (e.g. Vercel Cron, GitHub Actions,
 * or Supabase pg_cron) with the CRON_SECRET header for authentication.
 *
 * Example cron config (vercel.json):
 *   { "crons": [{ "path": "/api/rooms/cleanup", "schedule": "0 * * * *" }] }
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Validate shared cron secret when set
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const supabase = await createClient()

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('rooms')
      .update({ is_active: false })
      .eq('is_active', true)
      .lt('last_activity_at', cutoff)
      .select('id')

    if (error) throw new Error(error.message)

    const deactivated = data?.length ?? 0
    return NextResponse.json({ deactivated, cutoff })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
