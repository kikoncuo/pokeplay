/**
 * Unit tests for Supabase saves query helpers.
 *
 * Uses typed mock Supabase clients — no real network calls.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  listUserSaves,
  getSave,
  upsertSave,
  updateSave,
  deleteSave,
  listSaveHistory,
} from '@/lib/supabase/queries/saves';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function mockOrderChain(result: { data: unknown; error: unknown }) {
  const orderMock = vi.fn().mockResolvedValue(result);
  const eqMock = vi.fn().mockReturnValue({ order: orderMock });
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock, order: orderMock });
  const fromMock = vi.fn().mockReturnValue({ select: selectMock });
  return {
    client: { from: fromMock } as unknown as SupabaseClient<Database>,
    fromMock,
    selectMock,
    eqMock,
    orderMock,
  };
}

function mockSingleChain(result: { data: unknown; error: unknown }) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(result),
    }),
  } as unknown as SupabaseClient<Database>;
}

function mockUpsertChain(result: { data: unknown; error: unknown }) {
  const singleMock = vi.fn().mockResolvedValue(result);
  const selectMock = vi.fn().mockReturnValue({ single: singleMock });
  const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
  return {
    client: { from: vi.fn().mockReturnValue({ upsert: upsertMock }) } as unknown as SupabaseClient<Database>,
    upsertMock,
  };
}

function mockUpdateSingleChain(result: { data: unknown; error: unknown }) {
  const singleMock = vi.fn().mockResolvedValue(result);
  const selectMock = vi.fn().mockReturnValue({ single: singleMock });
  const eqMock = vi.fn().mockReturnValue({ select: selectMock });
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
  return {
    client: { from: vi.fn().mockReturnValue({ update: updateMock }) } as unknown as SupabaseClient<Database>,
    updateMock,
    eqMock,
  };
}

function mockDeleteChain(result: { error: unknown }) {
  const eqMock = vi.fn().mockResolvedValue(result);
  const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
  return {
    client: { from: vi.fn().mockReturnValue({ delete: deleteMock }) } as unknown as SupabaseClient<Database>,
    eqMock,
  };
}

// ---------------------------------------------------------------------------
// Sample fixture
// ---------------------------------------------------------------------------

const SAVE_ROW = {
  id: 'save-001',
  user_id: 'user-abc',
  game_hash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  slot: 0,
  save_type: 'sram',
  storage_path: 'saves/user-abc/game-hash/sram/0',
  size_bytes: 32768,
  checksum: 'deadbeef',
  version: 1,
  playtime_seconds: 3600,
  progress: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T01:00:00Z',
};

// ---------------------------------------------------------------------------
// listUserSaves
// ---------------------------------------------------------------------------

describe('listUserSaves', () => {
  it('returns saves for a user', async () => {
    const { client, eqMock } = mockOrderChain({ data: [SAVE_ROW], error: null });
    // For listUserSaves, chain is: select().eq(user_id).order()
    // We need a more flexible mock
    const orderMock = vi.fn().mockResolvedValue({ data: [SAVE_ROW], error: null });
    const eqInner = vi.fn().mockReturnValue({ order: orderMock, eq: vi.fn().mockReturnValue({ order: orderMock }) });
    const selectMock = vi.fn().mockReturnValue({ eq: eqInner });
    const mockClient = { from: vi.fn().mockReturnValue({ select: selectMock }) } as unknown as SupabaseClient<Database>;

    const result = await listUserSaves(mockClient, 'user-abc');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('save-001');
  });

  it('returns empty array when no saves', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqInner = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqInner });
    const mockClient = { from: vi.fn().mockReturnValue({ select: selectMock }) } as unknown as SupabaseClient<Database>;

    expect(await listUserSaves(mockClient, 'user-abc')).toEqual([]);
  });

  it('returns empty array when data is null', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqInner = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqInner });
    const mockClient = { from: vi.fn().mockReturnValue({ select: selectMock }) } as unknown as SupabaseClient<Database>;

    expect(await listUserSaves(mockClient, 'user-abc')).toEqual([]);
  });

  it('applies gameHash filter when provided', async () => {
    // listUserSaves builds: select().eq(user_id).order().eq(game_hash)
    // The object returned by .order() must have .eq() AND be awaitable.
    const finalResult = { data: [], error: null };
    const gameHashEqMock = vi.fn().mockResolvedValue(finalResult);
    const orderResult = { eq: gameHashEqMock, then: (r: (v: typeof finalResult) => void) => Promise.resolve(finalResult).then(r) };
    const orderMock = vi.fn().mockReturnValue(orderResult);
    const userEqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: userEqMock });
    const mockClient = { from: vi.fn().mockReturnValue({ select: selectMock }) } as unknown as SupabaseClient<Database>;

    await listUserSaves(mockClient, 'user-abc', 'hash-xyz');
    expect(gameHashEqMock).toHaveBeenCalledWith('game_hash', 'hash-xyz');
  });

  it('throws on query error', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB down' } });
    const eqInner = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqInner });
    const mockClient = { from: vi.fn().mockReturnValue({ select: selectMock }) } as unknown as SupabaseClient<Database>;

    await expect(listUserSaves(mockClient, 'user-abc')).rejects.toThrow('List saves failed: DB down');
  });
});

// ---------------------------------------------------------------------------
// getSave
// ---------------------------------------------------------------------------

describe('getSave', () => {
  it('returns save when found', async () => {
    const client = mockSingleChain({ data: SAVE_ROW, error: null });
    expect(await getSave(client, 'save-001')).toEqual(SAVE_ROW);
  });

  it('returns null for PGRST116 (row not found)', async () => {
    const client = mockSingleChain({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    });
    expect(await getSave(client, 'missing')).toBeNull();
  });

  it('throws for other errors', async () => {
    const client = mockSingleChain({
      data: null,
      error: { code: '500', message: 'server error' },
    });
    await expect(getSave(client, 'save-001')).rejects.toThrow('Get save failed: server error');
  });
});

// ---------------------------------------------------------------------------
// upsertSave
// ---------------------------------------------------------------------------

describe('upsertSave', () => {
  const saveInput = {
    user_id: 'user-abc',
    game_hash: 'abc123',
    slot: 0,
    save_type: 'sram',
    storage_path: 'saves/abc',
    size_bytes: 32768,
    version: 1,
  };

  it('returns the upserted save', async () => {
    const { client } = mockUpsertChain({ data: SAVE_ROW, error: null });
    const result = await upsertSave(client, saveInput);
    expect(result).toEqual(SAVE_ROW);
  });

  it('includes updated_at in the upsert payload', async () => {
    const { client, upsertMock } = mockUpsertChain({ data: SAVE_ROW, error: null });
    await upsertSave(client, saveInput);
    const [payload] = upsertMock.mock.calls[0];
    expect(typeof payload.updated_at).toBe('string');
    expect(isNaN(new Date(payload.updated_at).getTime())).toBe(false);
  });

  it('uses conflict target user_id,game_hash,slot,save_type', async () => {
    const { client, upsertMock } = mockUpsertChain({ data: SAVE_ROW, error: null });
    await upsertSave(client, saveInput);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ onConflict: 'user_id,game_hash,slot,save_type' }),
    );
  });

  it('throws on upsert error', async () => {
    const { client } = mockUpsertChain({ data: null, error: { message: 'constraint violation' } });
    await expect(upsertSave(client, saveInput)).rejects.toThrow('Upsert save failed: constraint violation');
  });
});

// ---------------------------------------------------------------------------
// updateSave
// ---------------------------------------------------------------------------

describe('updateSave', () => {
  it('returns updated save', async () => {
    const { client } = mockUpdateSingleChain({ data: SAVE_ROW, error: null });
    const result = await updateSave(client, 'save-001', { playtime_seconds: 7200 });
    expect(result).toEqual(SAVE_ROW);
  });

  it('merges updated_at into the update payload', async () => {
    const { client, updateMock } = mockUpdateSingleChain({ data: SAVE_ROW, error: null });
    await updateSave(client, 'save-001', { version: 2 });
    const [payload] = updateMock.mock.calls[0];
    expect(typeof payload.updated_at).toBe('string');
  });

  it('filters by saveId', async () => {
    const { client, eqMock } = mockUpdateSingleChain({ data: SAVE_ROW, error: null });
    await updateSave(client, 'save-xyz', { version: 2 });
    expect(eqMock).toHaveBeenCalledWith('id', 'save-xyz');
  });

  it('throws on update error', async () => {
    const { client } = mockUpdateSingleChain({ data: null, error: { message: 'update failed' } });
    await expect(updateSave(client, 'save-001', {})).rejects.toThrow('Update save failed: update failed');
  });
});

// ---------------------------------------------------------------------------
// deleteSave
// ---------------------------------------------------------------------------

describe('deleteSave', () => {
  it('resolves without error on success', async () => {
    const { client } = mockDeleteChain({ error: null });
    await expect(deleteSave(client, 'save-001')).resolves.toBeUndefined();
  });

  it('filters by saveId', async () => {
    const { client, eqMock } = mockDeleteChain({ error: null });
    await deleteSave(client, 'save-xyz');
    expect(eqMock).toHaveBeenCalledWith('id', 'save-xyz');
  });

  it('throws on delete error', async () => {
    const { client } = mockDeleteChain({ error: { message: 'RLS blocked delete' } });
    await expect(deleteSave(client, 'save-001')).rejects.toThrow('Delete save failed: RLS blocked delete');
  });
});

// ---------------------------------------------------------------------------
// listSaveHistory
// ---------------------------------------------------------------------------

describe('listSaveHistory', () => {
  const HISTORY_ROW = {
    id: 'hist-1',
    save_id: 'save-001',
    storage_path: 'saves/hist/1',
    size_bytes: 32768,
    checksum: 'abc',
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
  };

  it('returns history records for a save', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: [HISTORY_ROW], error: null });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const mockClient = { from: vi.fn().mockReturnValue({ select: selectMock }) } as unknown as SupabaseClient<Database>;

    const result = await listSaveHistory(mockClient, 'save-001');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('hist-1');
  });

  it('orders by version descending', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const mockClient = { from: vi.fn().mockReturnValue({ select: selectMock }) } as unknown as SupabaseClient<Database>;

    await listSaveHistory(mockClient, 'save-001');
    expect(orderMock).toHaveBeenCalledWith('version', { ascending: false });
  });

  it('returns empty array when null data', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const mockClient = { from: vi.fn().mockReturnValue({ select: selectMock }) } as unknown as SupabaseClient<Database>;

    expect(await listSaveHistory(mockClient, 'save-001')).toEqual([]);
  });

  it('throws on error', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'query error' } });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const mockClient = { from: vi.fn().mockReturnValue({ select: selectMock }) } as unknown as SupabaseClient<Database>;

    await expect(listSaveHistory(mockClient, 'save-001')).rejects.toThrow('List save history failed: query error');
  });
});
