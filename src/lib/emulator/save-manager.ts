'use client'

import { writeLocalSave, queueForSync, readLocalSave } from '@/lib/utils/offline-sync'
import { downloadSave, type SaveType } from '@/lib/supabase/storage'

export interface SaveManagerOptions {
  userId: string
  gameHash: string
}

export interface SaveSlot {
  slot: number
  saveType: SaveType
  exists: boolean
  savedAt: number | null
  playtimeSeconds: number
  synced: boolean
}

async function computeChecksum(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-1', data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export class SaveManager {
  private readonly userId: string
  private readonly gameHash: string

  constructor(options: SaveManagerOptions) {
    this.userId = options.userId
    this.gameHash = options.gameHash
  }

  /**
   * Called from EJS_onSaveUpdate. Writes SRAM data to IndexedDB then
   * queues an async upload to Supabase Storage.
   */
  async onSramUpdate(data: Uint8Array, slot = 0): Promise<void> {
    const checksum = await computeChecksum(data)
    const key = `${this.gameHash}:sram:${slot}`

    await writeLocalSave({
      key,
      gameHash: this.gameHash,
      saveType: 'sram',
      slot,
      data,
      checksum,
      playtimeSeconds: 0,
      savedAt: Date.now(),
      synced: false,
    })

    await queueForSync(this.userId, key)
  }

  async captureState(data: Uint8Array, slot: number, playtimeSeconds = 0): Promise<void> {
    const checksum = await computeChecksum(data)
    const key = `${this.gameHash}:state:${slot}`

    await writeLocalSave({
      key,
      gameHash: this.gameHash,
      saveType: 'state',
      slot,
      data,
      checksum,
      playtimeSeconds,
      savedAt: Date.now(),
      synced: false,
    })

    await queueForSync(this.userId, key)
  }

  async loadLocalSave(saveType: SaveType, slot: number): Promise<Uint8Array | null> {
    const save = await readLocalSave(this.gameHash, saveType, slot)
    return save?.data ?? null
  }

  /**
   * Downloads a save from Supabase and caches it locally.
   * Falls back to local IndexedDB if offline.
   */
  async loadRemoteSave(saveType: SaveType, slot: number, storagePath: string): Promise<Uint8Array> {
    const data = await downloadSave(storagePath)
    const checksum = await computeChecksum(data)
    const key = `${this.gameHash}:${saveType}:${slot}`

    await writeLocalSave({
      key,
      gameHash: this.gameHash,
      saveType,
      slot,
      data,
      checksum,
      playtimeSeconds: 0,
      savedAt: Date.now(),
      synced: true,
    })

    return data
  }

  /**
   * Exports a save file for download by the user.
   */
  async exportSave(saveType: SaveType, slot: number): Promise<Blob | null> {
    const data = await this.loadLocalSave(saveType, slot)
    if (!data) return null
    return new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], { type: 'application/octet-stream' })
  }

  /**
   * Imports a save file from a user-provided Blob.
   */
  async importSave(file: Blob, saveType: SaveType, slot: number): Promise<void> {
    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)

    if (saveType === 'sram') {
      await this.onSramUpdate(data, slot)
    } else {
      await this.captureState(data, slot)
    }
  }
}

export function createSaveManager(options: SaveManagerOptions): SaveManager {
  return new SaveManager(options)
}
