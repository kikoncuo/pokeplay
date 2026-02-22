/**
 * Unit tests for Supabase rooms query helpers.
 *
 * Uses typed mock Supabase clients — no real network calls.
 * Tests verify query shapes, error propagation, and data transformations.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  listActiveRooms,
  getRoom,
  createRoom,
  deactivateRoom,
  touchRoom,
} from '@/lib/supabase/queries/rooms';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Builds a mock that resolves the final .order() call */
function mockOrderChain(result: { data: unknown; error: unknown }) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue(result),
    }),
  } as unknown as SupabaseClient<Database>;
}

/** Builds a mock that resolves the final .single() call */
function mockSingleChain(result: { data: unknown; error: unknown }) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(result),
    }),
  } as unknown as SupabaseClient<Database>;
}

/** Builds a mock for insert().select().single() */
function mockInsertChain(result: { data: unknown; error: unknown }) {
  const singleMock = vi.fn().mockResolvedValue(result);
  const selectMock = vi.fn().mockReturnValue({ single: singleMock });
  const insertMock = vi.fn().mockReturnValue({ select: selectMock });
  return {
    client: { from: vi.fn().mockReturnValue({ insert: insertMock }) } as unknown as SupabaseClient<Database>,
    insertMock,
  };
}

/** Builds a mock for update().eq() */
function mockUpdateChain(result: { error: unknown }) {
  const eqMock = vi.fn().mockResolvedValue(result);
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
  return {
    client: { from: vi.fn().mockReturnValue({ update: updateMock }) } as unknown as SupabaseClient<Database>,
    updateMock,
    eqMock,
  };
}

// ---------------------------------------------------------------------------
// Sample fixture
// ---------------------------------------------------------------------------

const ROOM_ROW = {
  id: 'room-1',
  name: 'Ash Room',
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  last_activity_at: '2026-01-01T01:00:00Z',
  is_active: true,
  system: 'GB',
  max_players: 8,
  game_hash: null,
  password_hash: null,
  settings: null,
};

// ---------------------------------------------------------------------------
// listActiveRooms
// ---------------------------------------------------------------------------

describe('listActiveRooms', () => {
  it('maps room_members count into member_count field', async () => {
    const rawRow = { ...ROOM_ROW, room_members: [{ count: 3 }] };
    const client = mockOrderChain({ data: [rawRow], error: null });

    const rooms = await listActiveRooms(client);

    expect(rooms).toHaveLength(1);
    expect(rooms[0].member_count).toBe(3);
  });

  it('does not include room_members key in returned objects', async () => {
    const rawRow = { ...ROOM_ROW, room_members: [{ count: 2 }] };
    const client = mockOrderChain({ data: [rawRow], error: null });

    const rooms = await listActiveRooms(client);

    // Implementation spreads { room_members, ...rest } — key removed
    expect(Object.keys(rooms[0])).not.toContain('room_members');
  });

  it('defaults member_count to 0 when room_members array is empty', async () => {
    const rawRow = { ...ROOM_ROW, room_members: [] };
    const client = mockOrderChain({ data: [rawRow], error: null });

    const rooms = await listActiveRooms(client);

    expect(rooms[0].member_count).toBe(0);
  });

  it('returns empty array when no active rooms', async () => {
    const client = mockOrderChain({ data: [], error: null });
    expect(await listActiveRooms(client)).toEqual([]);
  });

  it('returns empty array when data is null', async () => {
    const client = mockOrderChain({ data: null, error: null });
    expect(await listActiveRooms(client)).toEqual([]);
  });

  it('throws with message prefix on query error', async () => {
    const client = mockOrderChain({ data: null, error: { message: 'connection timeout' } });
    await expect(listActiveRooms(client)).rejects.toThrow('List rooms failed: connection timeout');
  });

  it('queries rooms table with is_active=true filter', async () => {
    const rawRow = { ...ROOM_ROW, room_members: [] };
    const fromSpy = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [rawRow], error: null }),
    });
    const client = { from: fromSpy } as unknown as SupabaseClient<Database>;

    await listActiveRooms(client);

    expect(fromSpy).toHaveBeenCalledWith('rooms');
  });
});

// ---------------------------------------------------------------------------
// getRoom
// ---------------------------------------------------------------------------

describe('getRoom', () => {
  it('returns the room when found', async () => {
    const client = mockSingleChain({ data: ROOM_ROW, error: null });
    const result = await getRoom(client, 'room-1');
    expect(result).toEqual(ROOM_ROW);
  });

  it('returns null when Supabase returns PGRST116 (not found)', async () => {
    const client = mockSingleChain({
      data: null,
      error: { code: 'PGRST116', message: 'Row not found' },
    });
    expect(await getRoom(client, 'missing')).toBeNull();
  });

  it('throws for non-PGRST116 errors', async () => {
    const client = mockSingleChain({
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    });
    await expect(getRoom(client, 'room-1')).rejects.toThrow(
      'Get room failed: relation does not exist',
    );
  });
});

// ---------------------------------------------------------------------------
// createRoom
// ---------------------------------------------------------------------------

describe('createRoom', () => {
  it('includes created_by from userId parameter in insert payload', async () => {
    const { client, insertMock } = mockInsertChain({ data: ROOM_ROW, error: null });
    await createRoom(client, { name: 'Test Room', system: 'GB' }, 'user-42');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ created_by: 'user-42' }),
    );
  });

  it('includes name and system from input in insert payload', async () => {
    const { client, insertMock } = mockInsertChain({ data: ROOM_ROW, error: null });
    await createRoom(client, { name: 'My Room', system: 'GBA' }, 'user-1');
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Room', system: 'GBA' }),
    );
  });

  it('returns the created room data', async () => {
    const { client } = mockInsertChain({ data: ROOM_ROW, error: null });
    const result = await createRoom(client, { name: 'Room', system: 'GB' }, 'user-1');
    expect(result).toEqual(ROOM_ROW);
  });

  it('throws on insert error', async () => {
    const { client } = mockInsertChain({ data: null, error: { message: 'unique violation' } });
    await expect(createRoom(client, { name: 'Room', system: 'GB' }, 'user-1')).rejects.toThrow(
      'Create room failed: unique violation',
    );
  });
});

// ---------------------------------------------------------------------------
// deactivateRoom
// ---------------------------------------------------------------------------

describe('deactivateRoom', () => {
  it('calls update with is_active: false', async () => {
    const { client, updateMock } = mockUpdateChain({ error: null });
    await deactivateRoom(client, 'room-1');
    expect(updateMock).toHaveBeenCalledWith({ is_active: false });
  });

  it('filters by the provided roomId', async () => {
    const { client, eqMock } = mockUpdateChain({ error: null });
    await deactivateRoom(client, 'target-room');
    expect(eqMock).toHaveBeenCalledWith('id', 'target-room');
  });

  it('throws on update error', async () => {
    const { client } = mockUpdateChain({ error: { message: 'RLS violation' } });
    await expect(deactivateRoom(client, 'room-1')).rejects.toThrow(
      'Deactivate room failed: RLS violation',
    );
  });
});

// ---------------------------------------------------------------------------
// touchRoom
// ---------------------------------------------------------------------------

describe('touchRoom', () => {
  it('calls update with a last_activity_at ISO timestamp', async () => {
    const { client, updateMock } = mockUpdateChain({ error: null });
    await touchRoom(client, 'room-1');
    const [payload] = updateMock.mock.calls[0];
    expect(typeof payload.last_activity_at).toBe('string');
    expect(() => new Date(payload.last_activity_at)).not.toThrow();
    expect(isNaN(new Date(payload.last_activity_at).getTime())).toBe(false);
  });

  it('filters by the provided roomId', async () => {
    const { client, eqMock } = mockUpdateChain({ error: null });
    await touchRoom(client, 'target-room');
    expect(eqMock).toHaveBeenCalledWith('id', 'target-room');
  });

  it('throws on update error', async () => {
    const { client } = mockUpdateChain({ error: { message: 'connection lost' } });
    await expect(touchRoom(client, 'room-1')).rejects.toThrow('Touch room failed: connection lost');
  });
});
