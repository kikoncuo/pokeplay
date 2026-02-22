import { createClient } from './client'
import type { Json } from './database.types'

const SAVES_BUCKET = 'saves'

export type SaveType = 'sram' | 'state'

export interface SaveMetadata {
  userId: string
  gameHash: string
  slot: number
  saveType: SaveType
  sizeBytes: number
  checksum: string | null
  playtimeSeconds?: number
  progress?: Record<string, unknown>
}

export interface SaveRecord {
  id: string
  userId: string
  gameHash: string
  slot: number
  saveType: SaveType
  storagePath: string
  sizeBytes: number
  version: number
  checksum: string | null
  playtimeSeconds: number
  progress: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

function buildStoragePath(userId: string, gameHash: string, saveType: SaveType, slot: number): string {
  const ext = saveType === 'sram' ? 'sav' : 'state'
  return `${userId}/${gameHash}/${saveType}/slot_${slot}.${ext}`
}

export async function uploadSave(
  userId: string,
  gameHash: string,
  saveType: SaveType,
  slot: number,
  data: Uint8Array
): Promise<string> {
  const supabase = createClient()
  const storagePath = buildStoragePath(userId, gameHash, saveType, slot)

  const { error } = await supabase.storage
    .from(SAVES_BUCKET)
    .upload(storagePath, data, {
      contentType: 'application/octet-stream',
      upsert: true,
    })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  return storagePath
}

export async function downloadSave(storagePath: string): Promise<Uint8Array> {
  const supabase = createClient()

  const { data, error } = await supabase.storage
    .from(SAVES_BUCKET)
    .download(storagePath)

  if (error) throw new Error(`Download failed: ${error.message}`)

  const buffer = await data.arrayBuffer()
  return new Uint8Array(buffer)
}

export async function upsertSaveRecord(meta: SaveMetadata): Promise<SaveRecord> {
  const supabase = createClient()
  const storagePath = buildStoragePath(meta.userId, meta.gameHash, meta.saveType, meta.slot)

  const { data, error } = await supabase
    .from('saves')
    .upsert(
      {
        user_id: meta.userId,
        game_hash: meta.gameHash,
        slot: meta.slot,
        save_type: meta.saveType,
        storage_path: storagePath,
        size_bytes: meta.sizeBytes,
        checksum: meta.checksum,
        playtime_seconds: meta.playtimeSeconds ?? 0,
        progress: (meta.progress ?? {}) as Json,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,game_hash,slot,save_type' }
    )
    .select()
    .single()

  if (error) throw new Error(`Upsert save record failed: ${error.message}`)

  return {
    id: data.id,
    userId: data.user_id,
    gameHash: data.game_hash,
    slot: data.slot,
    saveType: data.save_type as SaveType,
    storagePath: data.storage_path,
    sizeBytes: data.size_bytes,
    version: data.version,
    checksum: data.checksum,
    playtimeSeconds: data.playtime_seconds ?? 0,
    progress: (data.progress ?? {}) as Record<string, unknown>,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

export async function listSaveRecords(userId: string, gameHash: string): Promise<SaveRecord[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('saves')
    .select('*')
    .eq('user_id', userId)
    .eq('game_hash', gameHash)
    .order('slot', { ascending: true })

  if (error) throw new Error(`List saves failed: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    gameHash: row.game_hash,
    slot: row.slot,
    saveType: row.save_type as SaveType,
    storagePath: row.storage_path,
    sizeBytes: row.size_bytes,
    version: row.version,
    checksum: row.checksum,
    playtimeSeconds: row.playtime_seconds ?? 0,
    progress: (row.progress ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function deleteSaveRecord(saveId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('saves').delete().eq('id', saveId)

  if (error) throw new Error(`Delete save failed: ${error.message}`)
}
