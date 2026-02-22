import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesInsert } from '../database.types'

export type Game = Tables<'games'>
export type GameInsert = TablesInsert<'games'>

export type GameSystem = 'gb' | 'gbc' | 'gba' | 'nds'

export async function getGameByHash(
  supabase: SupabaseClient<Database>,
  hash: string
): Promise<Game | null> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('sha1_hash', hash.toUpperCase())
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`getGameByHash failed: ${error.message}`)
  }

  return data
}

export async function listGames(
  supabase: SupabaseClient<Database>,
  system?: GameSystem
): Promise<Game[]> {
  let query = supabase
    .from('games')
    .select('*')
    .order('generation', { ascending: true })
    .order('title', { ascending: true })

  if (system) {
    query = query.eq('system', system)
  }

  const { data, error } = await query

  if (error) throw new Error(`listGames failed: ${error.message}`)

  return data ?? []
}

export async function registerGame(
  supabase: SupabaseClient<Database>,
  hash: string,
  title: string,
  system: GameSystem,
  generation: number
): Promise<Game> {
  const { data, error } = await supabase
    .from('games')
    .insert({
      sha1_hash: hash.toUpperCase(),
      title,
      system,
      generation,
      is_rom_hack: false,
      metadata: {},
    })
    .select()
    .single()

  if (error) throw new Error(`registerGame failed: ${error.message}`)

  return data
}
