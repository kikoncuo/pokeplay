/**
 * Memory reading interface for EmulatorJS / gambatte core.
 *
 * Architecture rules (CLAUDE.md):
 * - Memory polling is 10 Hz maximum.
 * - ROMs never touch the server — all processing is client-side.
 */

// ---------------------------------------------------------------------------
// Minimal byte-reading interface used by GameboyMemoryReader.
// This is intentionally narrower than the full MemoryReader so test stubs
// only need to implement readByte + readBytes.
// ---------------------------------------------------------------------------

export interface ByteReader {
  readByte: (address: number) => number;
  readBytes: (address: number, length: number) => Uint8Array;
}

// ---------------------------------------------------------------------------
// Poll result types
// ---------------------------------------------------------------------------

export interface PlayerPosition {
  mapId: number;
  x: number;
  y: number;
  facing: number;
}

export type BattleState = 'none' | 'wild' | 'trainer';

export interface GameState {
  position: PlayerPosition;
  battleState: BattleState;
  partyCount: number;
}

// ---------------------------------------------------------------------------
// WRAM base offset within the gambatte WASM heap
//
// The gambatte libretro core exposes WRAM starting at offset 0x0000 of the
// memory region accessed via the retro_memory_data(RETRO_MEMORY_SYSTEM_RAM)
// call.  EmulatorJS v4 attaches the full WASM linear memory as HEAPU8, and
// exposes the SRAM region through the gameManager API.
//
// For polling purposes we read relative to the WRAM base offset. The actual
// physical offset inside HEAPU8 is runtime-determined by the core. We expose
// a configurable base so callers can set it once the emulator is running and
// the core reports its memory layout.
// ---------------------------------------------------------------------------

const GB_WRAM_BASE_DEFAULT = 0x0000; // to be calibrated at runtime

export class GameboyMemoryReader {
  private reader: ByteReader;
  private wramBase: number;

  /**
   * @param reader   Low-level byte reader backed by HEAPU8
   * @param wramBase Offset of GB WRAM within the WASM heap (calibrated at init)
   */
  constructor(reader: ByteReader, wramBase = GB_WRAM_BASE_DEFAULT) {
    this.reader = reader;
    this.wramBase = wramBase;
  }

  /**
   * Read a single byte from a GB WRAM address (e.g. 0xD35E).
   * The address is mapped relative to wramBase inside HEAPU8.
   */
  readWramByte(gbAddress: number): number {
    return this.reader.readByte(this.wramBase + (gbAddress - 0xc000));
  }

  /**
   * Read multiple bytes starting at a GB WRAM address.
   */
  readWramBytes(gbAddress: number, length: number): Uint8Array {
    return this.reader.readBytes(this.wramBase + (gbAddress - 0xc000), length);
  }

  /** Set the WRAM base offset (called once core memory layout is known). */
  setWramBase(base: number): void {
    this.wramBase = base;
  }

  getWramBase(): number {
    return this.wramBase;
  }
}

// ---------------------------------------------------------------------------
// Gen 1 state reader helpers
// ---------------------------------------------------------------------------

import {
  wCurMap,
  wXCoord,
  wYCoord,
  wSpritePlayerStateData1FacingDirection,
  wPartyCount,
  wIsInBattle,
} from './memory-maps/gen1';

function decodeBattleState(raw: number): BattleState {
  if (raw === 1) return 'wild';
  if (raw === 2) return 'trainer';
  return 'none';
}

export function readGen1GameState(reader: GameboyMemoryReader): GameState {
  return {
    position: {
      mapId: reader.readWramByte(wCurMap),
      y: reader.readWramByte(wYCoord),
      x: reader.readWramByte(wXCoord),
      facing: reader.readWramByte(wSpritePlayerStateData1FacingDirection),
    },
    battleState: decodeBattleState(reader.readWramByte(wIsInBattle)),
    partyCount: reader.readWramByte(wPartyCount),
  };
}
