/**
 * GBA memory reader for mGBA core via EmulatorJS.
 *
 * GBA memory map (bus addresses):
 *   0x02000000  EWRAM  (256 KB) — main game state lives here
 *   0x03000000  IWRAM  (32 KB)  — fast scratch / stack
 *
 * The mGBA libretro core exposes EWRAM and IWRAM as separate regions through
 * retro_memory_data(). Inside the WASM heap (HEAPU8) mGBA lays out memory as:
 *   [EWRAM 256 KB][IWRAM 32 KB][…rest of core state]
 *
 * The exact heap offsets are runtime-determined. `GbaMemoryReader` accepts
 * configurable base offsets for each region so they can be calibrated once
 * the emulator starts.
 *
 * Architecture rule (CLAUDE.md): memory polling is 10 Hz maximum.
 */

import type { ByteReader } from './memory-reader';
import { EWRAM_START, EWRAM_END, IWRAM_START, IWRAM_END } from './memory-maps/gen3';
import type { PlayerPosition, BattleState, GameState } from './memory-reader';
import {
  gBattleTypeFlags,
  gPlayerFacingDirection,
  gSaveBlock1Ptr,
  SaveBlock1,
  SAVEBLOCK1_PARTY_COUNT_OFFSET,
  BattleTypeFlags,
} from './memory-maps/gen3';

// ---------------------------------------------------------------------------
// GbaMemoryReader
// ---------------------------------------------------------------------------

/** Default heap base for EWRAM (to be calibrated at runtime). */
const EWRAM_HEAP_BASE_DEFAULT = 0x0000;
/** Default heap base for IWRAM (to be calibrated at runtime). */
const IWRAM_HEAP_BASE_DEFAULT = 0x40000; // typically follows EWRAM (256 KB)

export class GbaMemoryReader {
  private reader: ByteReader;
  private ewramBase: number;
  private iwramBase: number;

  /**
   * @param reader      Low-level byte reader backed by mGBA's HEAPU8.
   * @param ewramBase   Offset of GBA EWRAM within the WASM heap.
   * @param iwramBase   Offset of GBA IWRAM within the WASM heap.
   */
  constructor(
    reader: ByteReader,
    ewramBase = EWRAM_HEAP_BASE_DEFAULT,
    iwramBase = IWRAM_HEAP_BASE_DEFAULT,
  ) {
    this.reader = reader;
    this.ewramBase = ewramBase;
    this.iwramBase = iwramBase;
  }

  // ---------------------------------------------------------------------------
  // Region-mapped reads
  // ---------------------------------------------------------------------------

  /**
   * Read a byte using an absolute GBA bus address.
   * Automatically routes to the correct heap region.
   */
  readByte(gbaAddress: number): number {
    return this.reader.readByte(this.heapOffset(gbaAddress));
  }

  /**
   * Read a little-endian 16-bit word using an absolute GBA bus address.
   */
  readU16(gbaAddress: number): number {
    const offset = this.heapOffset(gbaAddress);
    const lo = this.reader.readByte(offset);
    const hi = this.reader.readByte(offset + 1);
    return (hi << 8) | lo;
  }

  /**
   * Read a little-endian 32-bit word using an absolute GBA bus address.
   */
  readU32(gbaAddress: number): number {
    const offset = this.heapOffset(gbaAddress);
    const b0 = this.reader.readByte(offset);
    const b1 = this.reader.readByte(offset + 1);
    const b2 = this.reader.readByte(offset + 2);
    const b3 = this.reader.readByte(offset + 3);
    // Use unsigned right-shift to keep value positive
    return ((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0;
  }

  /**
   * Read a signed 16-bit integer (little-endian) from a GBA bus address.
   */
  readS16(gbaAddress: number): number {
    const u = this.readU16(gbaAddress);
    return u >= 0x8000 ? u - 0x10000 : u;
  }

  /**
   * Read `length` bytes starting at a GBA bus address.
   */
  readBytes(gbaAddress: number, length: number): Uint8Array {
    return this.reader.readBytes(this.heapOffset(gbaAddress), length);
  }

  // ---------------------------------------------------------------------------
  // Base offset management
  // ---------------------------------------------------------------------------

  setEwramBase(base: number): void {
    this.ewramBase = base;
  }

  setIwramBase(base: number): void {
    this.iwramBase = base;
  }

  getEwramBase(): number {
    return this.ewramBase;
  }

  getIwramBase(): number {
    return this.iwramBase;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private heapOffset(gbaAddress: number): number {
    if (gbaAddress >= EWRAM_START && gbaAddress <= EWRAM_END) {
      return this.ewramBase + (gbaAddress - EWRAM_START);
    }
    if (gbaAddress >= IWRAM_START && gbaAddress <= IWRAM_END) {
      return this.iwramBase + (gbaAddress - IWRAM_START);
    }
    // Fallback: treat as raw heap offset (e.g. for core-internal state).
    return gbaAddress;
  }
}

// ---------------------------------------------------------------------------
// Gen 3 state reader
// ---------------------------------------------------------------------------

function decodeGen3BattleState(flags: number): BattleState {
  if (flags === 0) return 'none';
  if (flags & BattleTypeFlags.TRAINER) return 'trainer';
  if (flags & BattleTypeFlags.WILD) return 'wild';
  return 'none';
}

/**
 * Read the current game state from Pokémon Emerald EWRAM/IWRAM.
 *
 * Note: SaveBlock1 is accessed through the gSaveBlock1Ptr pointer stored in
 * IWRAM. If the pointer reads as 0 (emulator not yet initialised), all
 * positional fields are returned as 0.
 */
export function readGen3GameState(reader: GbaMemoryReader): GameState {
  // Read the SaveBlock1 pointer from IWRAM
  const sb1Ptr = reader.readU32(gSaveBlock1Ptr);

  let x = 0;
  let y = 0;
  let mapId = 0;

  if (sb1Ptr !== 0 && sb1Ptr >= EWRAM_START && sb1Ptr <= EWRAM_END) {
    x = reader.readS16(sb1Ptr + SaveBlock1.playerX);
    y = reader.readS16(sb1Ptr + SaveBlock1.playerY);
    // mapId: combine mapGroup (high byte) and mapNum (low byte)
    const mapGroup = reader.readByte(sb1Ptr + SaveBlock1.mapGroup);
    const mapNum = reader.readByte(sb1Ptr + SaveBlock1.mapNum);
    mapId = (mapGroup << 8) | mapNum;
  }

  const facing = reader.readByte(gPlayerFacingDirection);
  const battleFlags = reader.readU32(gBattleTypeFlags);
  const battleState = decodeGen3BattleState(battleFlags);

  // Party count lives in SaveBlock1 at a fixed offset
  let partyCount = 0;
  if (sb1Ptr !== 0 && sb1Ptr >= EWRAM_START && sb1Ptr <= EWRAM_END) {
    partyCount = reader.readByte(sb1Ptr + SAVEBLOCK1_PARTY_COUNT_OFFSET);
  }

  const position: PlayerPosition = { mapId, x, y, facing };
  return { position, battleState, partyCount };
}
