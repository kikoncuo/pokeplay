import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesInsert } from '../database.types'

export type RomListing = Tables<'rom_listings'>
export type RomListingInsert = TablesInsert<'rom_listings'>
export type RomComment = Tables<'rom_comments'>

export type RomListingWithProfile = RomListing & {
  owner: { display_name: string; avatar_url: string | null }
}

export type RomCommentWithProfile = RomComment & {
  profile: { display_name: string; avatar_url: string | null }
}

export async function getListingBySha1(
  supabase: SupabaseClient<Database>,
  sha1: string
): Promise<RomListingWithProfile | null> {
  const { data, error } = await supabase
    .from('rom_listings')
    .select('*, profiles!rom_listings_owner_id_fkey(display_name, avatar_url)')
    .eq('rom_sha1', sha1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw new Error(`Get listing failed: ${error.message}`)
  }

  const profile = data.profiles as unknown as { display_name: string; avatar_url: string | null } | null
  const { profiles, ...rest } = data as typeof data & { profiles: unknown }
  return {
    ...rest,
    owner: profile ?? { display_name: 'Unknown', avatar_url: null },
  } as RomListingWithProfile
}

export async function getOrCreateListing(
  supabase: SupabaseClient<Database>,
  sha1: string,
  ownerId: string,
  defaults: {
    title?: string
    system?: string
    generation?: number
    base_game_title?: string
    base_game_hash?: string
  }
): Promise<RomListing> {
  // Try to fetch existing
  const { data: existing } = await supabase
    .from('rom_listings')
    .select('*')
    .eq('rom_sha1', sha1)
    .single()

  if (existing) return existing

  // Create new
  const { data, error } = await supabase
    .from('rom_listings')
    .insert({
      rom_sha1: sha1,
      owner_id: ownerId,
      title: defaults.title ?? null,
      system: defaults.system ?? null,
      generation: defaults.generation != null ? defaults.generation : null,
      base_game_title: defaults.base_game_title ?? null,
      base_game_hash: defaults.base_game_hash ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`Create listing failed: ${error.message}`)
  return data
}

export async function updateListing(
  supabase: SupabaseClient<Database>,
  listingId: string,
  updates: Partial<Pick<RomListing, 'title' | 'description' | 'image_url' | 'is_public' | 'rom_storage_path' | 'rom_size_bytes'>>
): Promise<RomListing> {
  const { data, error } = await supabase
    .from('rom_listings')
    .update(updates)
    .eq('id', listingId)
    .select()
    .single()

  if (error) throw new Error(`Update listing failed: ${error.message}`)
  return data
}

export async function listComments(
  supabase: SupabaseClient<Database>,
  listingId: string
): Promise<RomCommentWithProfile[]> {
  const { data, error } = await supabase
    .from('rom_comments')
    .select('*, profiles!rom_comments_user_id_fkey(display_name, avatar_url)')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`List comments failed: ${error.message}`)

  return (data ?? []).map((row) => {
    const profile = row.profiles as unknown as { display_name: string; avatar_url: string | null } | null
    const { profiles, ...rest } = row as typeof row & { profiles: unknown }
    return {
      ...rest,
      profile: profile ?? { display_name: 'Unknown', avatar_url: null },
    } as RomCommentWithProfile
  })
}

export async function addComment(
  supabase: SupabaseClient<Database>,
  listingId: string,
  userId: string,
  body: string
): Promise<RomComment> {
  const { data, error } = await supabase
    .from('rom_comments')
    .insert({ listing_id: listingId, user_id: userId, body })
    .select()
    .single()

  if (error) throw new Error(`Add comment failed: ${error.message}`)
  return data
}

export async function deleteComment(
  supabase: SupabaseClient<Database>,
  commentId: string
): Promise<void> {
  const { error } = await supabase
    .from('rom_comments')
    .delete()
    .eq('id', commentId)

  if (error) throw new Error(`Delete comment failed: ${error.message}`)
}

export async function hasUserLiked(
  supabase: SupabaseClient<Database>,
  listingId: string,
  userId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('rom_likes')
    .select('*', { count: 'exact', head: true })
    .eq('listing_id', listingId)
    .eq('user_id', userId)

  if (error) throw new Error(`Check like failed: ${error.message}`)
  return (count ?? 0) > 0
}

export async function toggleLike(
  supabase: SupabaseClient<Database>,
  listingId: string,
  userId: string
): Promise<{ liked: boolean; newCount: number }> {
  // Try to insert (like)
  const { error: insertError } = await supabase
    .from('rom_likes')
    .insert({ listing_id: listingId, user_id: userId })

  if (insertError) {
    // 23505 = unique violation → already liked, so unlike
    if (insertError.code === '23505') {
      const { error: deleteError } = await supabase
        .from('rom_likes')
        .delete()
        .eq('listing_id', listingId)
        .eq('user_id', userId)

      if (deleteError) throw new Error(`Unlike failed: ${deleteError.message}`)

      // Re-fetch count
      const { data: listing } = await supabase
        .from('rom_listings')
        .select('like_count')
        .eq('id', listingId)
        .single()

      return { liked: false, newCount: listing?.like_count ?? 0 }
    }
    throw new Error(`Like failed: ${insertError.message}`)
  }

  // Re-fetch count
  const { data: listing } = await supabase
    .from('rom_listings')
    .select('like_count')
    .eq('id', listingId)
    .single()

  return { liked: true, newCount: listing?.like_count ?? 0 }
}
