/**
 * Unit tests for Gen 1 (Pokémon Red/Blue) memory map address constants.
 *
 * Tests verify that the memory map constants match the documented
 * WRAM addresses from the pokered disassembly.
 * Source: https://github.com/pret/pokered
 *
 * Architecture rule: memory polling is 10 Hz maximum (CLAUDE.md).
 */

import { describe, it, expect } from 'vitest';
import {
  wCurMap,
  wYCoord,
  wXCoord,
  wSpritePlayerStateData1FacingDirection,
  wPartyCount,
  wIsInBattle,
  BattleState,
  MAX_PARTY_SIZE,
  WRAM_START,
  WRAM_END,
} from '@/lib/emulator/memory-maps/gen1';

// ---------------------------------------------------------------------------
// Address constant values (verified against pokered disassembly)
// ---------------------------------------------------------------------------

describe('Gen 1 Memory Map — address constants', () => {
  it('wCurMap is 0xD35E', () => {
    expect(wCurMap).toBe(0xd35e);
  });

  it('wYCoord is 0xD361', () => {
    expect(wYCoord).toBe(0xd361);
  });

  it('wXCoord is 0xD362', () => {
    expect(wXCoord).toBe(0xd362);
  });

  it('wSpritePlayerStateData1FacingDirection is 0xD430', () => {
    expect(wSpritePlayerStateData1FacingDirection).toBe(0xd430);
  });

  it('wPartyCount is 0xD163', () => {
    expect(wPartyCount).toBe(0xd163);
  });

  it('wIsInBattle is 0xD057', () => {
    expect(wIsInBattle).toBe(0xd057);
  });
});

// ---------------------------------------------------------------------------
// WRAM range validation
// ---------------------------------------------------------------------------

describe('Gen 1 Memory Map — WRAM range', () => {
  it('WRAM_START is 0xC000', () => {
    expect(WRAM_START).toBe(0xc000);
  });

  it('WRAM_END is 0xDFFF', () => {
    expect(WRAM_END).toBe(0xdfff);
  });

  it('all address constants fall within WRAM range', () => {
    const addresses = {
      wCurMap,
      wYCoord,
      wXCoord,
      wSpritePlayerStateData1FacingDirection,
      wPartyCount,
      wIsInBattle,
    };

    for (const [name, addr] of Object.entries(addresses)) {
      expect(addr, `${name} (0x${addr.toString(16).toUpperCase()}) is below WRAM_START`).toBeGreaterThanOrEqual(WRAM_START);
      expect(addr, `${name} (0x${addr.toString(16).toUpperCase()}) is above WRAM_END`).toBeLessThanOrEqual(WRAM_END);
    }
  });

  it('addresses are all unique (no two share the same value)', () => {
    const values = [wCurMap, wYCoord, wXCoord, wSpritePlayerStateData1FacingDirection, wPartyCount, wIsInBattle];
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('X coordinate is exactly one byte after Y coordinate (adjacent bytes)', () => {
    expect(wXCoord).toBe(wYCoord + 1);
  });
});

// ---------------------------------------------------------------------------
// BattleState enum
// ---------------------------------------------------------------------------

describe('Gen 1 Memory Map — BattleState enum', () => {
  it('BattleState.NONE is 0', () => {
    expect(BattleState.NONE).toBe(0);
  });

  it('BattleState.WILD is 1', () => {
    expect(BattleState.WILD).toBe(1);
  });

  it('BattleState.TRAINER is 2', () => {
    expect(BattleState.TRAINER).toBe(2);
  });

  it('BattleState has exactly 3 values', () => {
    expect(Object.keys(BattleState).length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Party size constraint
// ---------------------------------------------------------------------------

describe('Gen 1 Memory Map — party size', () => {
  it('MAX_PARTY_SIZE is 6', () => {
    expect(MAX_PARTY_SIZE).toBe(6);
  });
});
