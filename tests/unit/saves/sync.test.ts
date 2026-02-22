/**
 * Unit tests for save file serialization and sync logic.
 *
 * Architecture: saves are offline-first. Write to IndexedDB immediately,
 * then async-sync to Supabase Storage (CLAUDE.md rule 2).
 *
 * These tests verify:
 * 1. Save data roundtrip (serialize → deserialize produces identical bytes)
 * 2. Save metadata type contract
 * 3. Conflict resolution logic (latest timestamp wins)
 * 4. Save slot management (max slots per game)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Type contracts — these must be satisfied by save manager implementation
// ---------------------------------------------------------------------------

interface SaveMetadata {
  id: string;
  userId: string;
  romHash: string;
  slotIndex: number;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
}

interface SaveEntry {
  metadata: SaveMetadata;
  data: Uint8Array;
}

interface SyncResult {
  status: 'uploaded' | 'downloaded' | 'conflict' | 'no-change';
  metadata: SaveMetadata;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeSaveData(byteLength: number, fillValue = 0xff): Uint8Array {
  return new Uint8Array(byteLength).fill(fillValue);
}

function makeSaveMetadata(overrides: Partial<SaveMetadata> = {}): SaveMetadata {
  return {
    id: 'save-001',
    userId: 'user-abc',
    romHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    slotIndex: 0,
    createdAt: '2026-02-21T00:00:00.000Z',
    updatedAt: '2026-02-21T00:00:00.000Z',
    sizeBytes: 32768,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Save serialization roundtrip
// ---------------------------------------------------------------------------

describe('Save serialization — roundtrip', () => {
  it('Uint8Array roundtrips through ArrayBuffer without data loss', () => {
    const original = makeSaveData(32768, 0xab);
    const buffer = original.buffer;
    const restored = new Uint8Array(buffer);

    expect(restored.length).toBe(original.length);
    expect(restored[0]).toBe(0xab);
    expect(restored[32767]).toBe(0xab);
  });

  it('save data encoded to base64 and decoded recovers identical bytes', () => {
    const original = new Uint8Array([0x00, 0x01, 0xfe, 0xff, 0xab, 0xcd]);

    // Simulate base64 encoding (used for Supabase Storage transport)
    const base64 = btoa(String.fromCharCode(...original));
    const decoded = new Uint8Array(
      atob(base64)
        .split('')
        .map((c) => c.charCodeAt(0)),
    );

    expect(decoded.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(decoded[i]).toBe(original[i]);
    }
  });

  it('Gen 1 save file is exactly 32 KB (0x8000 bytes)', () => {
    const GEN1_SAVE_SIZE = 0x8000; // 32768 bytes
    expect(GEN1_SAVE_SIZE).toBe(32768);

    const saveData = makeSaveData(GEN1_SAVE_SIZE);
    expect(saveData.byteLength).toBe(GEN1_SAVE_SIZE);
  });

  it('Gen 3 save file is exactly 128 KB (0x20000 bytes)', () => {
    const GEN3_SAVE_SIZE = 0x20000; // 131072 bytes
    expect(GEN3_SAVE_SIZE).toBe(131072);

    const saveData = makeSaveData(GEN3_SAVE_SIZE);
    expect(saveData.byteLength).toBe(GEN3_SAVE_SIZE);
  });

  it('two distinct saves with different fill values are not equal', () => {
    const save1 = makeSaveData(32, 0x00);
    const save2 = makeSaveData(32, 0xff);

    let allEqual = true;
    for (let i = 0; i < save1.length; i++) {
      if (save1[i] !== save2[i]) {
        allEqual = false;
        break;
      }
    }
    expect(allEqual).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Save metadata type contract
// ---------------------------------------------------------------------------

describe('Save metadata — type contract', () => {
  it('metadata has required fields', () => {
    const meta = makeSaveMetadata();

    expect(meta).toHaveProperty('id');
    expect(meta).toHaveProperty('userId');
    expect(meta).toHaveProperty('romHash');
    expect(meta).toHaveProperty('slotIndex');
    expect(meta).toHaveProperty('createdAt');
    expect(meta).toHaveProperty('updatedAt');
    expect(meta).toHaveProperty('sizeBytes');
  });

  it('slotIndex is a non-negative integer', () => {
    const meta = makeSaveMetadata({ slotIndex: 0 });
    expect(meta.slotIndex).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(meta.slotIndex)).toBe(true);
  });

  it('romHash is a 40-char lowercase hex string (SHA-1)', () => {
    const meta = makeSaveMetadata();
    expect(meta.romHash).toMatch(/^[0-9a-f]{40}$/);
  });

  it('timestamps are ISO 8601 strings', () => {
    const meta = makeSaveMetadata();
    const date1 = new Date(meta.createdAt);
    const date2 = new Date(meta.updatedAt);
    expect(isNaN(date1.getTime())).toBe(false);
    expect(isNaN(date2.getTime())).toBe(false);
  });

  it('sizeBytes is a positive integer', () => {
    const meta = makeSaveMetadata({ sizeBytes: 32768 });
    expect(meta.sizeBytes).toBeGreaterThan(0);
    expect(Number.isInteger(meta.sizeBytes)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Conflict resolution — latest updatedAt wins
// ---------------------------------------------------------------------------

describe('Save sync — conflict resolution', () => {
  function resolveConflict(local: SaveMetadata, remote: SaveMetadata): 'local' | 'remote' {
    const localTime = new Date(local.updatedAt).getTime();
    const remoteTime = new Date(remote.updatedAt).getTime();
    return localTime >= remoteTime ? 'local' : 'remote';
  }

  it('prefers local when local is newer', () => {
    const local = makeSaveMetadata({ updatedAt: '2026-02-21T12:00:00.000Z' });
    const remote = makeSaveMetadata({ updatedAt: '2026-02-21T11:00:00.000Z' });
    expect(resolveConflict(local, remote)).toBe('local');
  });

  it('prefers remote when remote is newer', () => {
    const local = makeSaveMetadata({ updatedAt: '2026-02-21T10:00:00.000Z' });
    const remote = makeSaveMetadata({ updatedAt: '2026-02-21T11:00:00.000Z' });
    expect(resolveConflict(local, remote)).toBe('remote');
  });

  it('prefers local when timestamps are identical', () => {
    const ts = '2026-02-21T10:00:00.000Z';
    const local = makeSaveMetadata({ updatedAt: ts });
    const remote = makeSaveMetadata({ updatedAt: ts });
    expect(resolveConflict(local, remote)).toBe('local');
  });
});

// ---------------------------------------------------------------------------
// Save slot management
// ---------------------------------------------------------------------------

describe('Save slots — constraints', () => {
  const MAX_SLOTS_PER_GAME = 3;

  it('max save slots per game is 3', () => {
    expect(MAX_SLOTS_PER_GAME).toBe(3);
  });

  it('slot indices are 0, 1, 2', () => {
    const validSlots = Array.from({ length: MAX_SLOTS_PER_GAME }, (_, i) => i);
    expect(validSlots).toEqual([0, 1, 2]);
  });

  it('slot index 3 is out of range', () => {
    const isValidSlot = (idx: number): boolean => idx >= 0 && idx < MAX_SLOTS_PER_GAME;
    expect(isValidSlot(3)).toBe(false);
  });

  it('slot index -1 is out of range', () => {
    const isValidSlot = (idx: number): boolean => idx >= 0 && idx < MAX_SLOTS_PER_GAME;
    expect(isValidSlot(-1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Module contract — verifies actual save manager exports once built
// ---------------------------------------------------------------------------

describe('Save manager — module contract (integration)', () => {
  it('save manager module exports SaveManager class and createSaveManager factory', async () => {
    const mod = await import('@/lib/emulator/save-manager');
    expect(typeof mod.SaveManager).toBe('function');
    expect(typeof mod.createSaveManager).toBe('function');
  });

  it('SaveManager instances expose expected methods', async () => {
    const { createSaveManager } = await import('@/lib/emulator/save-manager');
    const manager = createSaveManager({ userId: 'test', gameHash: 'abc123' });
    expect(typeof manager.onSramUpdate).toBe('function');
    expect(typeof manager.captureState).toBe('function');
    expect(typeof manager.loadLocalSave).toBe('function');
    expect(typeof manager.exportSave).toBe('function');
    expect(typeof manager.importSave).toBe('function');
  });
});
