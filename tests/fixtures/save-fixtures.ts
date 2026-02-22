/**
 * Save file test fixtures and factory functions.
 *
 * Provides deterministic test data for save-related unit tests.
 */

export interface SaveMetadata {
  id: string;
  userId: string;
  romHash: string;
  slotIndex: number;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
}

export interface SaveEntry {
  metadata: SaveMetadata;
  data: Uint8Array;
}

let _idCounter = 0;

/**
 * Creates a deterministic SaveMetadata object for tests.
 * Increments a counter so each call produces a unique ID by default.
 */
export function makeSaveMetadata(overrides: Partial<SaveMetadata> = {}): SaveMetadata {
  _idCounter++;
  return {
    id: `save-${String(_idCounter).padStart(4, '0')}`,
    userId: 'test-user-id',
    romHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', // 40-char SHA-1
    slotIndex: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sizeBytes: 32768,
    ...overrides,
  };
}

/** Resets the ID counter (call in beforeEach if needed for determinism) */
export function resetFixtureCounter(): void {
  _idCounter = 0;
}

/**
 * Creates a SaveEntry with synthetic data for roundtrip tests.
 */
export function makeSaveEntry(
  metadataOverrides: Partial<SaveMetadata> = {},
  fillValue = 0xff,
): SaveEntry {
  const metadata = makeSaveMetadata(metadataOverrides);
  const data = new Uint8Array(metadata.sizeBytes).fill(fillValue);
  return { metadata, data };
}

/**
 * Creates a pair of conflicting saves: one local (newer) and one remote (older).
 * Used to test conflict resolution logic.
 */
export function makeConflictingPair(): {
  local: SaveEntry;
  remote: SaveEntry;
} {
  const base = makeSaveMetadata();

  const local = makeSaveEntry(
    { ...base, updatedAt: '2026-02-21T12:00:00.000Z' },
    0xaa,
  );
  const remote = makeSaveEntry(
    { ...base, updatedAt: '2026-02-21T10:00:00.000Z' },
    0xbb,
  );

  return { local, remote };
}

/**
 * Compares two Uint8Arrays byte-by-byte.
 * Returns true if they are identical.
 */
export function uint8ArrayEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
