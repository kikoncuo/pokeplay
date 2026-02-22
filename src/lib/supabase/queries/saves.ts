import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesInsert, TablesUpdate } from '../database.types'

export type Save = Tables<'saves'>
export type SaveInsert = TablesInsert<'saves'>
export type SaveUpdate = TablesUpdate<'saves'>
export type SaveHistory = Tables<'save_history'>

export async function listUserSaves(
  supabase: SupabaseClient<Database>,
  userId: string,
  gameHash?: string
): Promise<Save[]> {
  let query = supabase
    .from('saves')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (gameHash) {
    query = query.eq('game_hash', gameHash)
  }

  const { data, error } = await query

  if (error) throw new Error(`List saves failed: ${error.message}`)

  return data ?? []
}

export async function getSave(
  supabase: SupabaseClient<Database>,
  saveId: string
): Promise<Save | null> {
  const { data, error } = await supabase
    .from('saves')
    .select('*')
    .eq('id', saveId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Get save failed: ${error.message}`)
  }

  return data
}

export async function upsertSave(
  supabase: SupabaseClient<Database>,
  input: SaveInsert
): Promise<Save> {
  const { data, error } = await supabase
    .from('saves')
    .upsert(
      { ...input, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,game_hash,slot,save_type' }
    )
    .select()
    .single()

  if (error) throw new Error(`Upsert save failed: ${error.message}`)

  return data
}

export async function updateSave(
  supabase: SupabaseClient<Database>,
  saveId: string,
  updates: SaveUpdate
): Promise<Save> {
  const { data, error } = await supabase
    .from('saves')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', saveId)
    .select()
    .single()

  if (error) throw new Error(`Update save failed: ${error.message}`)

  return data
}

export async function deleteSave(
  supabase: SupabaseClient<Database>,
  saveId: string
): Promise<void> {
  const { error } = await supabase.from('saves').delete().eq('id', saveId)

  if (error) throw new Error(`Delete save failed: ${error.message}`)
}

export async function listSaveHistory(
  supabase: SupabaseClient<Database>,
  saveId: string
): Promise<SaveHistory[]> {
  const { data, error } = await supabase
    .from('save_history')
    .select('*')
    .eq('save_id', saveId)
    .order('version', { ascending: false })

  if (error) throw new Error(`List save history failed: ${error.message}`)

  return data ?? []
}
