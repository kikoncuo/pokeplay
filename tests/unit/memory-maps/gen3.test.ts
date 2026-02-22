/**
 * Unit tests for Gen 3 (Pokémon Ruby/Sapphire/Emerald/FireRed/LeafGreen)
 * GBA memory address constants.
 *
 * Source: pret/pokeemerald disassembly.
 * Architecture rule: memory polling is 10 Hz maximum (CLAUDE.md).
 */

import { describe, it, expect } from 'vitest';
import {
  EWRAM_START,
  EWRAM_END,
  IWRAM_START,
  IWRAM_END,
  gPlayerFacingDirection,
  gSaveBlock1Ptr,
  gSaveBlock2Ptr,
  SaveBlock1,
  gBattleTypeFlags,
  gBattleOutcome,
  SAVEBLOCK1_PARTY_COUNT_OFFSET,
  SAVEBLOCK1_PARTY_OFFSET,
  POKEMON_STRUCT_SIZE,
  MAX_PARTY_SIZE,
  BattleTypeFlags,
  FacingDirection,
} from '@/lib/emulator/memory-maps/gen3';

// ---------------------------------------------------------------------------
// GBA memory region boundaries
// ---------------------------------------------------------------------------

describe('Gen 3 Memory Map — GBA memory regions', () => {
  it('EWRAM_START is 0x02000000', () => {
    expect(EWRAM_START).toBe(0x02000000);
  });

  it('EWRAM_END is 0x0203FFFF (256 KB range)', () => {
    expect(EWRAM_END).toBe(0x0203ffff);
    expect(EWRAM_END - EWRAM_START + 1).toBe(256 * 1024);
  });

  it('IWRAM_START is 0x03000000', () => {
    expect(IWRAM_START).toBe(0x03000000);
  });

  it('IWRAM_END is 0x03007FFF (32 KB range)', () => {
    expect(IWRAM_END).toBe(0x03007fff);
    expect(IWRAM_END - IWRAM_START + 1).toBe(32 * 1024);
  });

  it('EWRAM and IWRAM regions do not overlap', () => {
    expect(EWRAM_END).toBeLessThan(IWRAM_START);
  });
});

// ---------------------------------------------------------------------------
// Player overworld state
// ---------------------------------------------------------------------------

describe('Gen 3 Memory Map — player addresses', () => {
  it('gPlayerFacingDirection is in EWRAM', () => {
    expect(gPlayerFacingDirection).toBeGreaterThanOrEqual(EWRAM_START);
    expect(gPlayerFacingDirection).toBeLessThanOrEqual(EWRAM_END);
  });

  it('gPlayerFacingDirection is 0x020370B8', () => {
    expect(gPlayerFacingDirection).toBe(0x020370b8);
  });

  it('gSaveBlock1Ptr is in IWRAM', () => {
    expect(gSaveBlock1Ptr).toBeGreaterThanOrEqual(IWRAM_START);
    expect(gSaveBlock1Ptr).toBeLessThanOrEqual(IWRAM_END);
  });

  it('gSaveBlock2Ptr is in IWRAM and after gSaveBlock1Ptr', () => {
    expect(gSaveBlock2Ptr).toBeGreaterThan(gSaveBlock1Ptr);
    expect(gSaveBlock2Ptr).toBeLessThanOrEqual(IWRAM_END);
  });

  it('gSaveBlock1Ptr and gSaveBlock2Ptr are 4 bytes apart (pointer size)', () => {
    expect(gSaveBlock2Ptr - gSaveBlock1Ptr).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// SaveBlock1 struct offsets
// ---------------------------------------------------------------------------

describe('Gen 3 Memory Map — SaveBlock1 offsets', () => {
  it('playerX offset is 0x0000', () => {
    expect(SaveBlock1.playerX).toBe(0x0000);
  });

  it('playerY offset is 0x0002 (after 2-byte X)', () => {
    expect(SaveBlock1.playerY).toBe(0x0002);
  });

  it('mapGroup is at offset 0x0004', () => {
    expect(SaveBlock1.mapGroup).toBe(0x0004);
  });

  it('mapNum is at offset 0x0005 (adjacent to mapGroup)', () => {
    expect(SaveBlock1.mapNum).toBe(SaveBlock1.mapGroup + 1);
  });

  it('all SaveBlock1 offsets are non-negative', () => {
    for (const val of Object.values(SaveBlock1)) {
      expect(val).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Battle state
// ---------------------------------------------------------------------------

describe('Gen 3 Memory Map — battle addresses', () => {
  it('gBattleTypeFlags is in EWRAM', () => {
    expect(gBattleTypeFlags).toBeGreaterThanOrEqual(EWRAM_START);
    expect(gBattleTypeFlags).toBeLessThanOrEqual(EWRAM_END);
  });

  it('gBattleOutcome is in EWRAM', () => {
    expect(gBattleOutcome).toBeGreaterThanOrEqual(EWRAM_START);
    expect(gBattleOutcome).toBeLessThanOrEqual(EWRAM_END);
  });
});

describe('Gen 3 Memory Map — BattleTypeFlags enum', () => {
  it('NONE is 0', () => {
    expect(BattleTypeFlags.NONE).toBe(0);
  });

  it('WILD is bit 0 (value 1)', () => {
    expect(BattleTypeFlags.WILD).toBe(1);
  });

  it('TRAINER is bit 1 (value 2)', () => {
    expect(BattleTypeFlags.TRAINER).toBe(2);
  });

  it('DOUBLE is bit 2 (value 4)', () => {
    expect(BattleTypeFlags.DOUBLE).toBe(4);
  });

  it('LINK is bit 4 (value 16)', () => {
    expect(BattleTypeFlags.LINK).toBe(16);
  });

  it('WILD and TRAINER are distinguishable by bitmask', () => {
    const flags = BattleTypeFlags.WILD | BattleTypeFlags.TRAINER;
    expect(flags & BattleTypeFlags.WILD).toBeTruthy();
    expect(flags & BattleTypeFlags.TRAINER).toBeTruthy();
    expect(flags & BattleTypeFlags.DOUBLE).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// Party / Pokémon struct
// ---------------------------------------------------------------------------

describe('Gen 3 Memory Map — party constants', () => {
  it('MAX_PARTY_SIZE is 6', () => {
    expect(MAX_PARTY_SIZE).toBe(6);
  });

  it('POKEMON_STRUCT_SIZE is 100 bytes', () => {
    expect(POKEMON_STRUCT_SIZE).toBe(100);
  });

  it('SAVEBLOCK1_PARTY_COUNT_OFFSET is 0x0234', () => {
    expect(SAVEBLOCK1_PARTY_COUNT_OFFSET).toBe(0x0234);
  });

  it('SAVEBLOCK1_PARTY_OFFSET is after PARTY_COUNT_OFFSET', () => {
    expect(SAVEBLOCK1_PARTY_OFFSET).toBeGreaterThan(SAVEBLOCK1_PARTY_COUNT_OFFSET);
  });
});

// ---------------------------------------------------------------------------
// Facing direction values
// ---------------------------------------------------------------------------

describe('Gen 3 Memory Map — FacingDirection enum', () => {
  it('DOWN is 1', () => {
    expect(FacingDirection.DOWN).toBe(1);
  });

  it('UP is 2', () => {
    expect(FacingDirection.UP).toBe(2);
  });

  it('LEFT is 4', () => {
    expect(FacingDirection.LEFT).toBe(4);
  });

  it('RIGHT is 8', () => {
    expect(FacingDirection.RIGHT).toBe(8);
  });

  it('all directions are distinct powers of 2 (bitmask-safe)', () => {
    const vals = Object.values(FacingDirection);
    const unique = new Set(vals);
    expect(unique.size).toBe(vals.length);
    for (const v of vals) {
      // Each should be a power of 2
      expect(v & (v - 1)).toBe(0);
    }
  });
});
