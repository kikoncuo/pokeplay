/**
 * Unit tests for multiplayer wire format serialization/deserialization.
 *
 * Tests the PlayerStateWire compact format used for Supabase Realtime
 * position broadcasting (~20 bytes per message).
 */

import { describe, it, expect } from 'vitest';
import { serializePlayerState, deserializePlayerState } from '@/lib/multiplayer/types';
import type { PlayerState, FacingDirection } from '@/types/multiplayer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayerState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    userId: 'user-123',
    username: 'AshK',
    mapId: 0x0c,
    x: 8,
    y: 12,
    facing: 'down',
    isInBattle: false,
    timestamp: 1740000000000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// serializePlayerState
// ---------------------------------------------------------------------------

describe('serializePlayerState — wire format', () => {
  it('serializes userId to "u" field', () => {
    const state = makePlayerState({ userId: 'abc-123' });
    expect(serializePlayerState(state).u).toBe('abc-123');
  });

  it('serializes username to "n" field', () => {
    const state = makePlayerState({ username: 'Misty' });
    expect(serializePlayerState(state).n).toBe('Misty');
  });

  it('serializes mapId to "m" field', () => {
    const state = makePlayerState({ mapId: 42 });
    expect(serializePlayerState(state).m).toBe(42);
  });

  it('serializes x to "x" field', () => {
    const state = makePlayerState({ x: 15 });
    expect(serializePlayerState(state).x).toBe(15);
  });

  it('serializes y to "y" field', () => {
    const state = makePlayerState({ y: 7 });
    expect(serializePlayerState(state).y).toBe(7);
  });

  it('serializes timestamp to "t" field', () => {
    const ts = 1740000000000;
    const state = makePlayerState({ timestamp: ts });
    expect(serializePlayerState(state).t).toBe(ts);
  });

  it('serializes isInBattle=false as 0', () => {
    const state = makePlayerState({ isInBattle: false });
    expect(serializePlayerState(state).b).toBe(0);
  });

  it('serializes isInBattle=true as 1', () => {
    const state = makePlayerState({ isInBattle: true });
    expect(serializePlayerState(state).b).toBe(1);
  });

  it('serializes facing "down" as 0', () => {
    expect(serializePlayerState(makePlayerState({ facing: 'down' })).f).toBe(0);
  });

  it('serializes facing "up" as 1', () => {
    expect(serializePlayerState(makePlayerState({ facing: 'up' })).f).toBe(1);
  });

  it('serializes facing "left" as 2', () => {
    expect(serializePlayerState(makePlayerState({ facing: 'left' })).f).toBe(2);
  });

  it('serializes facing "right" as 3', () => {
    expect(serializePlayerState(makePlayerState({ facing: 'right' })).f).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// deserializePlayerState
// ---------------------------------------------------------------------------

describe('deserializePlayerState — from wire format', () => {
  it('deserializes "u" field to userId', () => {
    const wire = serializePlayerState(makePlayerState({ userId: 'xyz' }));
    expect(deserializePlayerState(wire).userId).toBe('xyz');
  });

  it('deserializes "n" field to username', () => {
    const wire = serializePlayerState(makePlayerState({ username: 'Brock' }));
    expect(deserializePlayerState(wire).username).toBe('Brock');
  });

  it('deserializes facing 0 as "down"', () => {
    const wire = serializePlayerState(makePlayerState({ facing: 'down' }));
    expect(deserializePlayerState(wire).facing).toBe('down');
  });

  it('deserializes facing 1 as "up"', () => {
    const wire = serializePlayerState(makePlayerState({ facing: 'up' }));
    expect(deserializePlayerState(wire).facing).toBe('up');
  });

  it('deserializes facing 2 as "left"', () => {
    const wire = serializePlayerState(makePlayerState({ facing: 'left' }));
    expect(deserializePlayerState(wire).facing).toBe('left');
  });

  it('deserializes facing 3 as "right"', () => {
    const wire = serializePlayerState(makePlayerState({ facing: 'right' }));
    expect(deserializePlayerState(wire).facing).toBe('right');
  });

  it('deserializes b=0 as isInBattle=false', () => {
    const wire = serializePlayerState(makePlayerState({ isInBattle: false }));
    expect(deserializePlayerState(wire).isInBattle).toBe(false);
  });

  it('deserializes b=1 as isInBattle=true', () => {
    const wire = serializePlayerState(makePlayerState({ isInBattle: true }));
    expect(deserializePlayerState(wire).isInBattle).toBe(true);
  });

  it('falls back to "down" for unknown facing values', () => {
    const wire = serializePlayerState(makePlayerState({ facing: 'down' }));
    // Manually corrupt the facing field
    const corrupt = { ...wire, f: 99 };
    expect(deserializePlayerState(corrupt).facing).toBe('down');
  });
});

// ---------------------------------------------------------------------------
// Roundtrip tests
// ---------------------------------------------------------------------------

describe('serializePlayerState + deserializePlayerState — roundtrip', () => {
  const directions: FacingDirection[] = ['down', 'up', 'left', 'right'];

  for (const facing of directions) {
    it(`roundtrips facing="${facing}" correctly`, () => {
      const original = makePlayerState({ facing });
      const restored = deserializePlayerState(serializePlayerState(original));
      expect(restored.facing).toBe(original.facing);
    });
  }

  it('roundtrips a complete PlayerState without data loss', () => {
    const original = makePlayerState({
      userId: 'user-999',
      username: 'Gary',
      mapId: 0x1a,
      x: 20,
      y: 15,
      facing: 'right',
      isInBattle: true,
      timestamp: 1740001234567,
    });

    const restored = deserializePlayerState(serializePlayerState(original));

    expect(restored.userId).toBe(original.userId);
    expect(restored.username).toBe(original.username);
    expect(restored.mapId).toBe(original.mapId);
    expect(restored.x).toBe(original.x);
    expect(restored.y).toBe(original.y);
    expect(restored.facing).toBe(original.facing);
    expect(restored.isInBattle).toBe(original.isInBattle);
    expect(restored.timestamp).toBe(original.timestamp);
  });
});
