/**
 * Gen 3 (Pokémon Ruby/Sapphire/Emerald/FireRed/LeafGreen) GBA memory address constants.
 *
 * GBA memory map:
 *   0x02000000–0x0203FFFF  EWRAM (External Work RAM, 256 KB) — main game state
 *   0x03000000–0x03007FFF  IWRAM (Internal Work RAM, 32 KB) — fast scratch
 *
 * Addresses below are absolute GBA bus addresses for Pokémon Emerald (AXVE/BPEE).
 * Source: pret/pokeemerald disassembly — https://github.com/pret/pokeemerald
 *
 * Architecture rule (CLAUDE.md): memory polling is 10 Hz maximum.
 */

// ---------------------------------------------------------------------------
// GBA memory region boundaries
// ---------------------------------------------------------------------------

/** GBA EWRAM starts at this absolute bus address (256 KB). */
export const EWRAM_START = 0x02000000;
/** GBA EWRAM ends at this absolute bus address (inclusive). */
export const EWRAM_END = 0x0203ffff;

/** GBA IWRAM starts at this absolute bus address (32 KB). */
export const IWRAM_START = 0x03000000;
/** GBA IWRAM ends at this absolute bus address (inclusive). */
export const IWRAM_END = 0x03007fff;

// ---------------------------------------------------------------------------
// Player / overworld state (EWRAM)
// Source: include/global.h, src/overworld.c in pret/pokeemerald
// ---------------------------------------------------------------------------

/**
 * gPlayerFacingDirection — player's current facing direction (1 byte).
 * Values: 1=down, 2=up, 4=left, 8=right
 */
export const gPlayerFacingDirection = 0x020370b8;

/**
 * gSaveBlock1Ptr — pointer to SaveBlock1 structure in EWRAM (4 bytes, little-endian).
 * Dereference to reach player coordinates, map info, etc.
 */
export const gSaveBlock1Ptr = 0x03005d8c;

/**
 * gSaveBlock2Ptr — pointer to SaveBlock2 (trainer info, play time) (4 bytes).
 */
export const gSaveBlock2Ptr = 0x03005d90;

// ---------------------------------------------------------------------------
// SaveBlock1 struct offsets (add to dereferenced gSaveBlock1Ptr value)
// Source: include/global.h  struct SaveBlock1
// ---------------------------------------------------------------------------

export const SaveBlock1 = {
  /** struct MapPosition pos — player tile X (2 bytes, signed) */
  playerX: 0x0000,
  /** struct MapPosition pos — player tile Y (2 bytes, signed) */
  playerY: 0x0002,
  /** u8 mapGroup */
  mapGroup: 0x0004,
  /** u8 mapNum */
  mapNum: 0x0005,
} as const;

// ---------------------------------------------------------------------------
// Battle state
// Source: include/battle.h, src/battle_main.c
// ---------------------------------------------------------------------------

/**
 * gBattleTypeFlags — active battle type bitmask (4 bytes).
 * Zero when not in battle. Non-zero values indicate battle type.
 */
export const gBattleTypeFlags = 0x02022fec;

/**
 * gBattleOutcome — result of the most recent battle (1 byte).
 * Only meaningful after a battle ends.
 */
export const gBattleOutcome = 0x020240e4;

// ---------------------------------------------------------------------------
// Party / Pokémon (EWRAM via SaveBlock1)
// ---------------------------------------------------------------------------

/**
 * Offset of party count within SaveBlock1 (u8, max 6).
 * Source: struct SaveBlock1.playerPartyCount
 */
export const SAVEBLOCK1_PARTY_COUNT_OFFSET = 0x0234;

/**
 * Offset of the party array within SaveBlock1.
 * Each party slot is a struct Pokemon (100 bytes).
 */
export const SAVEBLOCK1_PARTY_OFFSET = 0x0238;

/** Size in bytes of one struct Pokemon (encrypted). */
export const POKEMON_STRUCT_SIZE = 100;

/** Maximum party size. */
export const MAX_PARTY_SIZE = 6;

// ---------------------------------------------------------------------------
// Battle state enum values for gBattleTypeFlags
// ---------------------------------------------------------------------------

export const BattleTypeFlags = {
  /** No battle in progress (flags == 0). */
  NONE: 0,
  /** Wild Pokémon encounter (BATTLE_TYPE_WILD). */
  WILD: 1 << 0,
  /** Trainer battle (BATTLE_TYPE_TRAINER). */
  TRAINER: 1 << 1,
  /** Double battle (BATTLE_TYPE_DOUBLE). */
  DOUBLE: 1 << 2,
  /** Link battle (BATTLE_TYPE_LINK). */
  LINK: 1 << 4,
} as const;

// ---------------------------------------------------------------------------
// Facing direction values (gPlayerFacingDirection)
// ---------------------------------------------------------------------------

export const FacingDirection = {
  DOWN: 1,
  UP: 2,
  LEFT: 4,
  RIGHT: 8,
} as const;
