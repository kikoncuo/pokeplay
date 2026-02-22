import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesInsert } from '../database.types'

export type Room = Tables<'rooms'>
export type RoomInsert = TablesInsert<'rooms'>

export type RoomWithMemberCount = Room & { member_count: number }

export async function listActiveRooms(
  supabase: SupabaseClient<Database>
): Promise<RoomWithMemberCount[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, room_members(count)')
    .eq('is_active', true)
    .order('last_activity_at', { ascending: false })

  if (error) throw new Error(`List rooms failed: ${error.message}`)

  return (data ?? []).map((row) => {
    const members = row.room_members as unknown as { count: number }[]
    const { room_members, ...rest } = row
    return {
      ...rest,
      member_count: members[0]?.count ?? 0,
    } as RoomWithMemberCount
  })
}

export async function getRoom(
  supabase: SupabaseClient<Database>,
  roomId: string
): Promise<Room | null> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Get room failed: ${error.message}`)
  }

  return data
}

export async function createRoom(
  supabase: SupabaseClient<Database>,
  input: Omit<RoomInsert, 'created_by'>,
  userId: string
): Promise<Room> {
  const { data, error } = await supabase
    .from('rooms')
    .insert({ ...input, created_by: userId })
    .select()
    .single()

  if (error) throw new Error(`Create room failed: ${error.message}`)

  return data
}

export async function deactivateRoom(
  supabase: SupabaseClient<Database>,
  roomId: string
): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update({ is_active: false })
    .eq('id', roomId)

  if (error) throw new Error(`Deactivate room failed: ${error.message}`)
}

export async function touchRoom(
  supabase: SupabaseClient<Database>,
  roomId: string
): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', roomId)

  if (error) throw new Error(`Touch room failed: ${error.message}`)
}
