/**
 * Unit tests for GameboyMemoryReader and readGen1GameState.
 *
 * Uses a synthetic MemoryReader backed by a Uint8Array to avoid
 * any dependency on the emulator runtime.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameboyMemoryReader, readGen1GameState } from '@/lib/emulator/memory-reader';
import {
  wCurMap,
  wYCoord,
  wXCoord,
  wSpritePlayerStateData1FacingDirection,
  wPartyCount,
  wIsInBattle,
  WRAM_START,
} from '@/lib/emulator/memory-maps/gen1';

// ---------------------------------------------------------------------------
// Fake MemoryReader backed by a flat Uint8Array
// ---------------------------------------------------------------------------

/** Size of WRAM in bytes: 0xC000..0xDFFF = 8192 bytes */
const WRAM_SIZE = 0x2000;

function makeHeap(size = WRAM_SIZE): Uint8Array {
  return new Uint8Array(size).fill(0);
}

function makeFakeReader(heap: Uint8Array) {
  return {
    readByte(offset: number): number {
      return heap[offset] ?? 0;
    },
    readBytes(offset: number, length: number): Uint8Array {
      return heap.slice(offset, offset + length);
    },
  };
}

/**
 * Writes a value at a GB WRAM address within the fake heap.
 * wramBase defaults to 0 (heap starts at WRAM_START).
 */
function setWram(heap: Uint8Array, gbAddress: number, value: number, wramBase = 0): void {
  heap[wramBase + (gbAddress - WRAM_START)] = value & 0xff;
}

// ---------------------------------------------------------------------------
// GameboyMemoryReader unit tests
// ---------------------------------------------------------------------------

describe('GameboyMemoryReader — readWramByte', () => {
  let heap: Uint8Array;
  let reader: GameboyMemoryReader;

  beforeEach(() => {
    heap = makeHeap();
    reader = new GameboyMemoryReader(makeFakeReader(heap));
  });

  it('reads 0 from uninitialized WRAM', () => {
    expect(reader.readWramByte(wCurMap)).toBe(0);
  });

  it('reads the correct value written at wCurMap', () => {
    setWram(heap, wCurMap, 0x25);
    expect(reader.readWramByte(wCurMap)).toBe(0x25);
  });

  it('reads the correct value at wYCoord', () => {
    setWram(heap, wYCoord, 10);
    expect(reader.readWramByte(wYCoord)).toBe(10);
  });

  it('reads the correct value at wXCoord', () => {
    setWram(heap, wXCoord, 7);
    expect(reader.readWramByte(wXCoord)).toBe(7);
  });

  it('reads 0 at wIsInBattle by default (not in battle)', () => {
    expect(reader.readWramByte(wIsInBattle)).toBe(0);
  });

  it('reads battle state value correctly', () => {
    setWram(heap, wIsInBattle, 2); // trainer battle
    expect(reader.readWramByte(wIsInBattle)).toBe(2);
  });

  it('reads party count correctly', () => {
    setWram(heap, wPartyCount, 4);
    expect(reader.readWramByte(wPartyCount)).toBe(4);
  });

  it('correctly handles wramBase offset', () => {
    const heapWithOffset = makeHeap(WRAM_SIZE + 0x100);
    const wramBase = 0x100;
    const readerWithBase = new GameboyMemoryReader(makeFakeReader(heapWithOffset), wramBase);
    setWram(heapWithOffset, wCurMap, 0x42, wramBase);
    expect(readerWithBase.readWramByte(wCurMap)).toBe(0x42);
  });

  it('setWramBase updates the offset for subsequent reads', () => {
    const heap2 = makeHeap(WRAM_SIZE + 0x200);
    const r = new GameboyMemoryReader(makeFakeReader(heap2), 0);
    r.setWramBase(0x200);
    setWram(heap2, wCurMap, 0x77, 0x200);
    expect(r.readWramByte(wCurMap)).toBe(0x77);
  });

  it('getWramBase returns the current base', () => {
    const r = new GameboyMemoryReader(makeFakeReader(heap), 0x100);
    expect(r.getWramBase()).toBe(0x100);
    r.setWramBase(0x200);
    expect(r.getWramBase()).toBe(0x200);
  });
});

describe('GameboyMemoryReader — readWramBytes', () => {
  it('reads a multi-byte slice correctly', () => {
    const heap = makeHeap();
    setWram(heap, wYCoord, 5);
    setWram(heap, wXCoord, 9);
    const reader = new GameboyMemoryReader(makeFakeReader(heap));
    const slice = reader.readWramBytes(wYCoord, 2);
    expect(slice[0]).toBe(5); // Y
    expect(slice[1]).toBe(9); // X (adjacent byte)
  });
});

// ---------------------------------------------------------------------------
// readGen1GameState
// ---------------------------------------------------------------------------

describe('readGen1GameState', () => {
  let heap: Uint8Array;
  let reader: GameboyMemoryReader;

  beforeEach(() => {
    heap = makeHeap();
    reader = new GameboyMemoryReader(makeFakeReader(heap));
  });

  it('returns GameState with correct structure', () => {
    const state = readGen1GameState(reader);
    expect(state).toHaveProperty('position');
    expect(state).toHaveProperty('battleState');
    expect(state).toHaveProperty('partyCount');
  });

  it('reads all-zero WRAM as no-battle, mapId 0, coords (0,0)', () => {
    const state = readGen1GameState(reader);
    expect(state.position.mapId).toBe(0);
    expect(state.position.x).toBe(0);
    expect(state.position.y).toBe(0);
    expect(state.battleState).toBe('none');
    expect(state.partyCount).toBe(0);
  });

  it('correctly reads player position from WRAM', () => {
    setWram(heap, wCurMap, 0x0c);
    setWram(heap, wYCoord, 12);
    setWram(heap, wXCoord, 8);
    setWram(heap, wSpritePlayerStateData1FacingDirection, 1);

    const state = readGen1GameState(reader);
    expect(state.position.mapId).toBe(0x0c);
    expect(state.position.y).toBe(12);
    expect(state.position.x).toBe(8);
    expect(state.position.facing).toBe(1);
  });

  it('decodes battleState=0 as "none"', () => {
    setWram(heap, wIsInBattle, 0);
    expect(readGen1GameState(reader).battleState).toBe('none');
  });

  it('decodes battleState=1 as "wild"', () => {
    setWram(heap, wIsInBattle, 1);
    expect(readGen1GameState(reader).battleState).toBe('wild');
  });

  it('decodes battleState=2 as "trainer"', () => {
    setWram(heap, wIsInBattle, 2);
    expect(readGen1GameState(reader).battleState).toBe('trainer');
  });

  it('decodes unknown battle values as "none"', () => {
    setWram(heap, wIsInBattle, 0xff);
    expect(readGen1GameState(reader).battleState).toBe('none');
  });

  it('reads party count correctly', () => {
    setWram(heap, wPartyCount, 6);
    expect(readGen1GameState(reader).partyCount).toBe(6);
  });
});
