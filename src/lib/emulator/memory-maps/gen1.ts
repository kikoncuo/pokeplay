/**
 * Gen 1 (Pokémon Red/Blue/Yellow) WRAM memory address constants.
 * Based on the pokered disassembly: https://github.com/pret/pokered
 *
 * Architecture rule: memory polling is 10 Hz maximum (CLAUDE.md).
 */

/** Current map ID (1 byte) */
export const wCurMap = 0xd35e;

/** Player Y coordinate (1 byte) */
export const wYCoord = 0xd361;

/** Player X coordinate (1 byte) */
export const wXCoord = 0xd362;

/** Player facing direction sprite state (1 byte) */
export const wSpritePlayerStateData1FacingDirection = 0xd430;

/** Number of Pokémon in party (1 byte, max 6) */
export const wPartyCount = 0xd163;

/**
 * Battle state flag (1 byte)
 * - 0: not in battle
 * - 1: wild Pokémon battle
 * - 2: trainer battle
 */
export const wIsInBattle = 0xd057;

/** Battle state enum values */
export const BattleState = {
  NONE: 0,
  WILD: 1,
  TRAINER: 2,
} as const;

export type BattleStateValue = (typeof BattleState)[keyof typeof BattleState];

/** Maximum party size */
export const MAX_PARTY_SIZE = 6;

/** WRAM address range for validation */
export const WRAM_START = 0xc000;
export const WRAM_END = 0xdfff;
