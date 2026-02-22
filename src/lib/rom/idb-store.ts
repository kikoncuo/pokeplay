/**
 * ROM IndexedDB Store — persists ROM data client-side using the idb package.
 * ROMs NEVER touch the server.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { RomMetadata } from './identifier';

const DB_NAME = 'pokeplay';
const DB_VERSION = 2; // must match patch-store.ts
const ROM_STORE = 'roms';
const ROM_META_STORE = 'rom-metadata';

export interface StoredRom {
  sha1: string;
  data: Uint8Array;
  filename: string;
  size: number;
  addedAt: number;
}

export interface StoredRomMeta {
  sha1: string;
  filename: string;
  size: number;
  addedAt: number;
  metadata: RomMetadata | null;
  customName?: string;
}

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // v1: ROM stores
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(ROM_STORE)) {
          db.createObjectStore(ROM_STORE, { keyPath: 'sha1' });
        }
        if (!db.objectStoreNames.contains(ROM_META_STORE)) {
          db.createObjectStore(ROM_META_STORE, { keyPath: 'sha1' });
        }
      }
      // v2: Patch stores (added by patch-store.ts, but must be created here too
      // since whichever module opens the DB first triggers the upgrade)
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('patches')) {
          const patchStore = db.createObjectStore('patches', { keyPath: 'id' });
          patchStore.createIndex('by-base-rom', 'baseRomSha1');
        }
        if (!db.objectStoreNames.contains('patch-metadata')) {
          const metaStore = db.createObjectStore('patch-metadata', { keyPath: 'id' });
          metaStore.createIndex('by-base-rom', 'baseRomSha1');
        }
      }
    },
  });
}

export async function storeRom(
  sha1: string,
  data: Uint8Array,
  filename: string,
  metadata: RomMetadata | null,
): Promise<void> {
  const db = await getDb();

  const storedRom: StoredRom = {
    sha1,
    data,
    filename,
    size: data.byteLength,
    addedAt: Date.now(),
  };

  const storedMeta: StoredRomMeta = {
    sha1,
    filename,
    size: data.byteLength,
    addedAt: Date.now(),
    metadata,
  };

  const tx = db.transaction([ROM_STORE, ROM_META_STORE], 'readwrite');
  await Promise.all([
    tx.objectStore(ROM_STORE).put(storedRom),
    tx.objectStore(ROM_META_STORE).put(storedMeta),
    tx.done,
  ]);
}

export async function getRom(sha1: string): Promise<StoredRom | undefined> {
  const db = await getDb();
  return db.get(ROM_STORE, sha1);
}

export async function getRomMeta(sha1: string): Promise<StoredRomMeta | undefined> {
  const db = await getDb();
  return db.get(ROM_META_STORE, sha1);
}

export async function listRoms(): Promise<StoredRomMeta[]> {
  const db = await getDb();
  return db.getAll(ROM_META_STORE);
}

export async function hasRom(sha1: string): Promise<boolean> {
  const db = await getDb();
  const count = await db.count(ROM_STORE, sha1);
  return count > 0;
}

export async function updateRomName(sha1: string, customName: string): Promise<void> {
  const db = await getDb();
  const meta = await db.get(ROM_META_STORE, sha1) as StoredRomMeta | undefined;
  if (!meta) return;
  await db.put(ROM_META_STORE, { ...meta, customName });
}

export async function deleteRom(sha1: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([ROM_STORE, ROM_META_STORE], 'readwrite');
  await Promise.all([
    tx.objectStore(ROM_STORE).delete(sha1),
    tx.objectStore(ROM_META_STORE).delete(sha1),
    tx.done,
  ]);
}
