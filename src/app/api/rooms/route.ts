import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { listActiveRooms, createRoom } from '@/lib/supabase/queries/rooms'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import type { Json } from '@/lib/supabase/database.types'

const SYSTEMS = ['gb', 'gbc', 'gba', 'nds'] as const

const createRoomSchema = z.object({
  name: z.string().min(1).max(64),
  system: z.enum(SYSTEMS),
  game_hash: z.string().optional(),
  max_players: z.number().int().min(2).max(16).default(8),
  password_hash: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const rooms = await listActiveRooms(supabase)
    return NextResponse.json(rooms)
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

    const rl = checkRateLimit({ key: `rooms:${user.id}`, limit: 10, windowMs: 60_000 })
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
    const parsed = createRoomSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const room = await createRoom(
      supabase,
      {
        ...parsed.data,
        settings: (parsed.data.settings ?? null) as Json,
      },
      user.id
    )
    return NextResponse.json(room, {
      status: 201,
      headers: { 'X-RateLimit-Remaining': String(rl.remaining) },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
