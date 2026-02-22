'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SaveManager } from '@/lib/emulator/save-manager';
import { readLocalSave, listLocalSavesForGame, deleteLocalSave, type LocalSave } from '@/lib/utils/offline-sync';
import type { SaveType } from '@/lib/supabase/storage';

export interface SaveSlotInfo {
  slot: number;
  saveType: SaveType;
  exists: boolean;
  savedAt: number | null;
  playtimeSeconds: number;
  synced: boolean;
  name?: string;
}

export interface UseSaveManagerOptions {
  userId: string | null;
  gameHash: string;
  /** Current session playtime in seconds (passed in from a timer) */
  playtimeSeconds?: number;
}

export interface UseSaveManagerReturn {
  /** Capture the current SRAM into the given slot */
  saveSram: (data: Uint8Array, slot?: number) => Promise<void>;
  /** Capture a save-state into the given slot */
  saveState: (data: Uint8Array, slot: number, playtime?: number) => Promise<void>;
  /** Load raw bytes for a slot (null if empty) */
  loadSlot: (saveType: SaveType, slot: number) => Promise<Uint8Array | null>;
  /** Delete a save slot from IndexedDB */
  deleteSlot: (saveType: SaveType, slot: number) => Promise<void>;
  /** Export a slot as a downloadable Blob */
  exportSlot: (saveType: SaveType, slot: number) => Promise<Blob | null>;
  /** Import a file into a slot */
  importSlot: (file: Blob, saveType: SaveType, slot: number) => Promise<void>;
  /** All known slots for this game */
  slots: SaveSlotInfo[];
  /** Refresh slot metadata from IndexedDB */
  refreshSlots: () => Promise<void>;
  /** Whether a sync is in progress */
  syncing: boolean;
}

export function useSaveManager({
  userId,
  gameHash,
  playtimeSeconds = 0,
}: UseSaveManagerOptions): UseSaveManagerReturn {
  const managerRef = useRef<SaveManager | null>(null);
  const [slots, setSlots] = useState<SaveSlotInfo[]>([]);
  const [syncing, setSyncing] = useState(false);

  // Re-create manager when userId or gameHash changes
  useEffect(() => {
    if (!userId) {
      managerRef.current = null;
      return;
    }
    managerRef.current = new SaveManager({ userId, gameHash });
  }, [userId, gameHash]);

  const refreshSlots = useCallback(async () => {
    const saves: LocalSave[] = await listLocalSavesForGame(gameHash);
    const slotMap = new Map<string, LocalSave>();
    for (const s of saves) slotMap.set(`${s.saveType}:${s.slot}`, s);

    const SLOT_COUNT = 3;
    const result: SaveSlotInfo[] = [];
    for (const saveType of ['sram', 'state'] as SaveType[]) {
      for (let slot = 0; slot < SLOT_COUNT; slot++) {
        const save = slotMap.get(`${saveType}:${slot}`);
        result.push({
          slot,
          saveType,
          exists: !!save,
          savedAt: save?.savedAt ?? null,
          playtimeSeconds: save?.playtimeSeconds ?? 0,
          synced: save?.synced ?? false,
          name: save?.name,
        });
      }
    }
    setSlots(result);
  }, [gameHash]);

  // Initial load
  useEffect(() => {
    refreshSlots();
  }, [refreshSlots]);

  const saveSram = useCallback(
    async (data: Uint8Array, slot = 0) => {
      setSyncing(true);
      try {
        if (managerRef.current) {
          await managerRef.current.onSramUpdate(data, slot);
        }
        await refreshSlots();
      } finally {
        setSyncing(false);
      }
    },
    [refreshSlots],
  );

  const saveState = useCallback(
    async (data: Uint8Array, slot: number, playtime?: number) => {
      setSyncing(true);
      try {
        if (managerRef.current) {
          await managerRef.current.captureState(data, slot, playtime ?? playtimeSeconds);
        }
        await refreshSlots();
      } finally {
        setSyncing(false);
      }
    },
    [playtimeSeconds, refreshSlots],
  );

  const deleteSlot = useCallback(
    async (saveType: SaveType, slot: number): Promise<void> => {
      await deleteLocalSave(gameHash, saveType, slot);
      await refreshSlots();
    },
    [gameHash, refreshSlots],
  );

  const loadSlot = useCallback(
    async (saveType: SaveType, slot: number): Promise<Uint8Array | null> => {
      const save = await readLocalSave(gameHash, saveType, slot);
      return save?.data ?? null;
    },
    [gameHash],
  );

  const exportSlot = useCallback(
    async (saveType: SaveType, slot: number): Promise<Blob | null> => {
      if (!managerRef.current) return null;
      return managerRef.current.exportSave(saveType, slot);
    },
    [],
  );

  const importSlot = useCallback(
    async (file: Blob, saveType: SaveType, slot: number): Promise<void> => {
      if (!managerRef.current) return;
      setSyncing(true);
      try {
        await managerRef.current.importSave(file, saveType, slot);
        await refreshSlots();
      } finally {
        setSyncing(false);
      }
    },
    [refreshSlots],
  );

  return {
    saveSram,
    saveState,
    loadSlot,
    deleteSlot,
    exportSlot,
    importSlot,
    slots,
    refreshSlots,
    syncing,
  };
}
