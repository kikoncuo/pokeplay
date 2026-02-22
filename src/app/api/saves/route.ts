import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { listUserSaves, upsertSave } from '@/lib/supabase/queries/saves'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import type { Json } from '@/lib/supabase/database.types'

const SAVE_TYPES = ['sram', 'state'] as const

const upsertSaveSchema = z.object({
  game_hash: z.string(),
  slot: z.number().int().min(0).max(9).default(0),
  save_type: z.enum(SAVE_TYPES),
  storage_path: z.string(),
  size_bytes: z.number().int().nonnegative(),
  checksum: z.string().nullable().optional(),
  playtime_seconds: z.number().int().nonnegative().optional(),
  progress: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const gameHash = searchParams.get('game_hash') ?? undefined

    const saves = await listUserSaves(supabase, user.id, gameHash)
    return NextResponse.json(saves)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rl = checkRateLimit({ key: `saves:${user.id}`, limit: 10, windowMs: 60_000 })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', resetAt: rl.resetAt },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }

    const body: unknown = await request.json()
    const parsed = upsertSaveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const save = await upsertSave(supabase, {
      ...parsed.data,
      user_id: user.id,
      checksum: parsed.data.checksum ?? null,
      progress: (parsed.data.progress ?? null) as Json,
    })
    return NextResponse.json(save, {
      status: 201,
      headers: { 'X-RateLimit-Remaining': String(rl.remaining) },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
