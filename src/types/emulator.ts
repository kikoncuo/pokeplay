/**
 * Shared TypeScript type definitions for the emulator subsystem.
 * Used by emulator, multiplayer, and UI components.
 */

// ---------------------------------------------------------------------------
// System identifiers
// ---------------------------------------------------------------------------

export type GameSystem = 'gb' | 'gbc' | 'gba';

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export interface MemoryReader {
  readByte: (address: number) => number;
  readWord: (address: number) => number;
  readBytes: (address: number, length: number) => Uint8Array;
  writeByte: (address: number, value: number) => void;
  writeBytes: (address: number, data: Uint8Array) => void;
}

// ---------------------------------------------------------------------------
// Player state (read from WRAM at 10 Hz)
// ---------------------------------------------------------------------------

export interface PlayerPosition {
  /** GB map ID byte from wCurMap (0xD35E) */
  mapId: number;
  /** Player X tile coordinate from wXCoord (0xD362) */
  x: number;
  /** Player Y tile coordinate from wYCoord (0xD361) */
  y: number;
  /** Facing direction sprite byte from wSpritePlayerStateData1FacingDirection (0xD430) */
  facing: number;
}

export type BattleState = 'none' | 'wild' | 'trainer';

export interface GameState {
  position: PlayerPosition;
  battleState: BattleState;
  /** Number of Pokémon in party (0–6), from wPartyCount (0xD163) */
  partyCount: number;
}

// ---------------------------------------------------------------------------
// Emulator lifecycle
// ---------------------------------------------------------------------------

export type EmulatorStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface EmulatorCallbacks {
  onReady?: () => void;
  onStart?: () => void;
  onSaveState?: (state: Uint8Array) => void;
  onLoadState?: () => void;
  onError?: (error: Error) => void;
}
