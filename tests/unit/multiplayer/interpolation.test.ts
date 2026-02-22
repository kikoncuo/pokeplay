/**
 * Unit tests for PlayerInterpolator and InterpolationRegistry.
 *
 * Verifies smooth position interpolation between sparse 10Hz network updates.
 * Architecture rule: render delay is 100ms behind real time (CLAUDE.md).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PlayerInterpolator, InterpolationRegistry } from '@/lib/emulator/../multiplayer/interpolation';
import type { PlayerState } from '@/types/multiplayer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _time = 1000;

function makePlayerState(x: number, y: number, overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    userId: 'player-1',
    username: 'Ash',
    mapId: 1,
    x,
    y,
    facing: 'down',
    isInBattle: false,
    timestamp: _time,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PlayerInterpolator
// ---------------------------------------------------------------------------

describe('PlayerInterpolator — initialization', () => {
  it('returns null when no snapshots have been added', () => {
    const interp = new PlayerInterpolator();
    expect(interp.getInterpolatedPosition(2000)).toBeNull();
  });

  it('getLatestState returns null when empty', () => {
    const interp = new PlayerInterpolator();
    expect(interp.getLatestState()).toBeNull();
  });
});

describe('PlayerInterpolator — single snapshot (fallback behavior)', () => {
  it('returns the only snapshot position when no interpolation is possible', () => {
    const interp = new PlayerInterpolator(100);
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    interp.addSnapshot(makePlayerState(5, 10));

    // Ask for position 200ms later — still only one snapshot, fallback to it
    const pos = interp.getInterpolatedPosition(1200);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBe(5);
    expect(pos!.y).toBe(10);

    vi.useRealTimers();
  });
});

describe('PlayerInterpolator — two snapshots (linear interpolation)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('interpolates halfway between two snapshots', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const interp = new PlayerInterpolator(0); // no render delay for easier math

    // Snapshot at t=1000: position (0, 0)
    interp.addSnapshot(makePlayerState(0, 0));

    // Simulate time advance and add second snapshot at t=1100: position (10, 20)
    vi.setSystemTime(1100);
    interp.addSnapshot(makePlayerState(10, 20));

    // Query at t=1050 — halfway → should be (5, 10)
    const pos = interp.getInterpolatedPosition(1050);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeCloseTo(5, 0);
    expect(pos!.y).toBeCloseTo(10, 0);
  });

  it('returns "to" position when t >= 1 (at or past the second snapshot)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const interp = new PlayerInterpolator(0);
    interp.addSnapshot(makePlayerState(0, 0));

    vi.setSystemTime(1100);
    interp.addSnapshot(makePlayerState(10, 20));

    // Query at exactly the "to" time
    const pos = interp.getInterpolatedPosition(1100);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeCloseTo(10, 0);
    expect(pos!.y).toBeCloseTo(20, 0);
  });

  it('clamps t to 1 so it never extrapolates beyond "to"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);

    const interp = new PlayerInterpolator(0);
    interp.addSnapshot(makePlayerState(0, 0));

    vi.setSystemTime(1100);
    interp.addSnapshot(makePlayerState(10, 20));

    // Query far in the future — should not extrapolate beyond snapshot
    const pos = interp.getInterpolatedPosition(5000);
    expect(pos!.x).toBeLessThanOrEqual(10);
    expect(pos!.y).toBeLessThanOrEqual(20);
  });
});

describe('PlayerInterpolator — snapshot buffer limit', () => {
  it('keeps at most 3 snapshots', () => {
    const interp = new PlayerInterpolator(0);

    // Add 4 snapshots
    for (let i = 0; i < 4; i++) {
      interp.addSnapshot(makePlayerState(i, i));
    }

    // getLatestState should return the 4th snapshot (the newest)
    const latest = interp.getLatestState();
    expect(latest).not.toBeNull();
    expect(latest!.x).toBe(3);
    expect(latest!.y).toBe(3);
  });
});

describe('PlayerInterpolator — getLatestState', () => {
  it('returns the most recently added state', () => {
    const interp = new PlayerInterpolator();
    interp.addSnapshot(makePlayerState(0, 0));
    interp.addSnapshot(makePlayerState(5, 10));
    interp.addSnapshot(makePlayerState(99, 88));

    const latest = interp.getLatestState();
    expect(latest!.x).toBe(99);
    expect(latest!.y).toBe(88);
  });
});

describe('PlayerInterpolator — clear', () => {
  it('clear() removes all snapshots and returns null thereafter', () => {
    const interp = new PlayerInterpolator();
    interp.addSnapshot(makePlayerState(5, 5));
    interp.clear();
    expect(interp.getInterpolatedPosition(Date.now())).toBeNull();
    expect(interp.getLatestState()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// InterpolationRegistry
// ---------------------------------------------------------------------------

describe('InterpolationRegistry', () => {
  let registry: InterpolationRegistry;

  beforeEach(() => {
    registry = new InterpolationRegistry(0);
  });

  it('returns null for unknown user ID', () => {
    expect(registry.getInterpolated('unknown', 2000)).toBeNull();
    expect(registry.getLatestState('unknown')).toBeNull();
  });

  it('tracks position for a player after update()', () => {
    registry.update(makePlayerState(3, 7, { userId: 'user-a' }));
    const latest = registry.getLatestState('user-a');
    expect(latest).not.toBeNull();
    expect(latest!.x).toBe(3);
    expect(latest!.y).toBe(7);
  });

  it('removes a player with remove()', () => {
    registry.update(makePlayerState(3, 7, { userId: 'user-b' }));
    registry.remove('user-b');
    expect(registry.getLatestState('user-b')).toBeNull();
  });

  it('getAllUserIds returns all tracked players', () => {
    registry.update(makePlayerState(0, 0, { userId: 'user-1' }));
    registry.update(makePlayerState(0, 0, { userId: 'user-2' }));
    registry.update(makePlayerState(0, 0, { userId: 'user-3' }));

    const ids = registry.getAllUserIds();
    expect(ids).toContain('user-1');
    expect(ids).toContain('user-2');
    expect(ids).toContain('user-3');
    expect(ids.length).toBe(3);
  });

  it('clear() removes all players', () => {
    registry.update(makePlayerState(0, 0, { userId: 'user-a' }));
    registry.update(makePlayerState(0, 0, { userId: 'user-b' }));
    registry.clear();
    expect(registry.getAllUserIds().length).toBe(0);
  });

  it('creates a new interpolator for each unique userId', () => {
    registry.update(makePlayerState(1, 1, { userId: 'p1' }));
    registry.update(makePlayerState(2, 2, { userId: 'p2' }));
    expect(registry.getAllUserIds().length).toBe(2);
  });

  it('reuses the same interpolator for repeated updates from the same user', () => {
    registry.update(makePlayerState(1, 1, { userId: 'p1' }));
    registry.update(makePlayerState(5, 5, { userId: 'p1' }));
    // Latest state should be the second update
    expect(registry.getLatestState('p1')!.x).toBe(5);
  });
});
