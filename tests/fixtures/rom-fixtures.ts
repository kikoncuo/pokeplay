/**
 * ROM test fixtures.
 *
 * Provides minimal synthetic ROM-like Uint8Arrays for unit tests.
 * These are NOT real ROM files — they just satisfy the byte-length
 * and structural requirements for validation logic tests.
 *
 * Real ROM files (gitignored) live in the project root as zip archives.
 */

/** Gen 1 (GB) save file size: 32 KB */
export const GEN1_SAVE_SIZE = 0x8000; // 32768 bytes

/** Gen 2 (GBC) save file size: 128 KB */
export const GEN2_SAVE_SIZE = 0x20000; // 131072 bytes

/** Gen 3 (GBA) save file size: 128 KB */
export const GEN3_SAVE_SIZE = 0x20000; // 131072 bytes

/** ROM max size: 64 MB */
export const MAX_ROM_SIZE = 64 * 1024 * 1024;

/** Known ROM SHA-1 hashes (computed from real files for identification) */
export const KNOWN_ROM_HASHES = {
  /** Pokémon Red (USA, Europe) (SGB Enhanced) */
  POKEMON_RED: '84aaef30656d4b50f040f6ef822be7a7a2cf61c5',
  /** Pokémon Emerald (USA, Europe) */
  POKEMON_EMERALD: 'f3ae088181bf583e55daf962a92bb46d4d6a0c8a',
} as const;

/**
 * Creates a synthetic save file buffer filled with a given value.
 * Used to test serialization without real ROM data.
 */
export function makeSyntheticSave(
  size: number = GEN1_SAVE_SIZE,
  fill: number = 0xff,
): Uint8Array {
  return new Uint8Array(size).fill(fill);
}

/**
 * Creates a minimal synthetic ROM-like buffer.
 * For GB/GBC: first 0x150 bytes contain the header area.
 * This is NOT a valid ROM — it only passes byte-length validation.
 */
export function makeSyntheticRomBuffer(sizeBytes: number = 1024 * 32): Uint8Array {
  return new Uint8Array(sizeBytes).fill(0x00);
}

/**
 * Creates a mock File object for testing ROM upload validation.
 * Used in unit tests that need a File without real DOM APIs.
 */
export function makeMockFile(
  name: string,
  sizeBytes: number,
  type = 'application/octet-stream',
): File {
  const buffer = new Uint8Array(sizeBytes).fill(0xab);
  return new File([buffer], name, { type });
}

/**
 * Extended mock File that supports the File.arrayBuffer() API.
 * Use this in jsdom environments where File.arrayBuffer() may not work.
 */
export class MockRomFile extends File {
  private _data: Uint8Array;

  constructor(name: string, data: Uint8Array, type = 'application/octet-stream') {
    super([data as BlobPart], name, { type });
    this._data = data;
  }

  override async arrayBuffer(): Promise<ArrayBuffer> {
    return this._data.buffer as ArrayBuffer;
  }

  get romData(): Uint8Array {
    return this._data;
  }
}
