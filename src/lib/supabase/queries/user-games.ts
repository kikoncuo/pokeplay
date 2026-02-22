import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../database.types';

export type UserGame = Tables<'user_games'>;

export async function listRecentlyPlayed(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 5,
): Promise<UserGame[]> {
  const { data, error } = await supabase
    .from('user_games')
    .select('*')
    .eq('user_id', userId)
    .not('last_played_at', 'is', null)
    .order('last_played_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`List recently played failed: ${error.message}`);
  return data ?? [];
}

export async function upsertUserGame(
  supabase: SupabaseClient<Database>,
  userId: string,
  gameHash: string,
  additionalPlaytimeSeconds = 0,
): Promise<UserGame> {
  // Read current record first so we can accumulate playtime
  const { data: existing } = await supabase
    .from('user_games')
    .select('total_playtime_seconds')
    .eq('user_id', userId)
    .eq('game_hash', gameHash)
    .maybeSingle();

  const currentPlaytime = existing?.total_playtime_seconds ?? 0;

  const { data, error } = await supabase
    .from('user_games')
    .upsert(
      {
        user_id: userId,
        game_hash: gameHash,
        last_played_at: new Date().toISOString(),
        total_playtime_seconds: currentPlaytime + additionalPlaytimeSeconds,
      },
      { onConflict: 'user_id,game_hash' },
    )
    .select()
    .single();

  if (error) throw new Error(`Upsert user game failed: ${error.message}`);
  return data;
}
