'use client'

import { openDB, type IDBPDatabase } from 'idb'
import { uploadSave, upsertSaveRecord, type SaveType } from '@/lib/supabase/storage'

const DB_NAME = 'pokeplay-saves'
const DB_VERSION = 1
const STORE_SAVES = 'saves'
const STORE_PENDING = 'pending-sync'

export interface LocalSave {
  key: string        // "{gameHash}:{saveType}:{slot}"
  gameHash: string
  saveType: SaveType
  slot: number
  data: Uint8Array
  checksum: string | null
  playtimeSeconds: number
  savedAt: number    // Date.now()
  synced: boolean
  name?: string
}

export interface PendingSyncItem {
  key: string
  userId: string
  queuedAt: number
}

async function openSaveDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_SAVES)) {
        db.createObjectStore(STORE_SAVES, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'key' })
      }
    },
  })
}

export async function writeLocalSave(save: LocalSave): Promise<void> {
  const db = await openSaveDB()
  await db.put(STORE_SAVES, { ...save, synced: false })
}

export async function readLocalSave(
  gameHash: string,
  saveType: SaveType,
  slot: number
): Promise<LocalSave | null> {
  const db = await openSaveDB()
  const key = `${gameHash}:${saveType}:${slot}`
  return (await db.get(STORE_SAVES, key)) ?? null
}

export async function markSyncedLocally(key: string): Promise<void> {
  const db = await openSaveDB()
  const existing = await db.get(STORE_SAVES, key)
  if (existing) {
    await db.put(STORE_SAVES, { ...existing, synced: true })
  }
}

export async function listLocalSavesForGame(gameHash: string): Promise<LocalSave[]> {
  const db = await openSaveDB()
  const all: LocalSave[] = await db.getAll(STORE_SAVES)
  return all.filter((s) => s.gameHash === gameHash)
}

export async function listAllLocalSaves(): Promise<LocalSave[]> {
  const db = await openSaveDB()
  return db.getAll(STORE_SAVES)
}

export async function deleteLocalSave(
  gameHash: string,
  saveType: SaveType,
  slot: number
): Promise<void> {
  const db = await openSaveDB()
  const key = `${gameHash}:${saveType}:${slot}`
  await db.delete(STORE_SAVES, key)
  await db.delete(STORE_PENDING, key)
}

export async function updateLocalSaveName(
  gameHash: string,
  saveType: SaveType,
  slot: number,
  name: string,
): Promise<void> {
  const db = await openSaveDB()
  const key = `${gameHash}:${saveType}:${slot}`
  const existing = await db.get(STORE_SAVES, key) as LocalSave | undefined
  if (!existing) return
  await db.put(STORE_SAVES, { ...existing, name })
}

export async function queueForSync(userId: string, saveKey: string): Promise<void> {
  const db = await openSaveDB()
  const item: PendingSyncItem = { key: saveKey, userId, queuedAt: Date.now() }
  await db.put(STORE_PENDING, item)
}

export async function flushPendingSync(): Promise<void> {
  if (!navigator.onLine) return

  const db = await openSaveDB()
  const pending: PendingSyncItem[] = await db.getAll(STORE_PENDING)

  for (const item of pending) {
    const save = await db.get(STORE_SAVES, item.key) as LocalSave | undefined
    if (!save) {
      await db.delete(STORE_PENDING, item.key)
      continue
    }

    try {
      await uploadSave(item.userId, save.gameHash, save.saveType, save.slot, save.data)
      await upsertSaveRecord({
        userId: item.userId,
        gameHash: save.gameHash,
        slot: save.slot,
        saveType: save.saveType,
        sizeBytes: save.data.byteLength,
        checksum: save.checksum,
        playtimeSeconds: save.playtimeSeconds,
      })
      await markSyncedLocally(item.key)
      await db.delete(STORE_PENDING, item.key)
    } catch {
      // Leave in pending queue; retry on next flush
    }
  }
}

export function startSyncLoop(intervalMs = 30_000): () => void {
  const id = setInterval(flushPendingSync, intervalMs)
  window.addEventListener('online', flushPendingSync)

  return () => {
    clearInterval(id)
    window.removeEventListener('online', flushPendingSync)
  }
}
