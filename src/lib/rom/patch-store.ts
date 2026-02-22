/**
 * Patch IndexedDB store — persists patch files and their metadata client-side.
 * Patches are stored alongside ROMs; neither ever touches the server.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { PatchFormat } from './patcher';

const DB_NAME = 'pokeplay';
const DB_VERSION = 2; // bumped from v1 to add patch stores
const PATCH_STORE = 'patches';
const PATCH_META_STORE = 'patch-metadata';

export interface StoredPatch {
  id: string; // "{baseRomSha1}:{patchSha1}"
  baseRomSha1: string;
  patchSha1: string;
  data: Uint8Array;
  filename: string;
  format: PatchFormat;
  size: number;
  addedAt: number;
  /** SHA-1 of the patched output ROM, set after first successful patch application */
  outputSha1?: string;
}

export interface StoredPatchMeta {
  id: string;
  baseRomSha1: string;
  patchSha1: string;
  filename: string;
  format: PatchFormat;
  size: number;
  addedAt: number;
  outputSha1?: string;
  /** User-supplied display title */
  title?: string;
}

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // ROM stores from v1
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('roms')) {
          db.createObjectStore('roms', { keyPath: 'sha1' });
        }
        if (!db.objectStoreNames.contains('rom-metadata')) {
          db.createObjectStore('rom-metadata', { keyPath: 'sha1' });
        }
      }
      // Patch stores added in v2
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(PATCH_STORE)) {
          const patchStore = db.createObjectStore(PATCH_STORE, { keyPath: 'id' });
          patchStore.createIndex('by-base-rom', 'baseRomSha1');
        }
        if (!db.objectStoreNames.contains(PATCH_META_STORE)) {
          const metaStore = db.createObjectStore(PATCH_META_STORE, { keyPath: 'id' });
          metaStore.createIndex('by-base-rom', 'baseRomSha1');
        }
      }
    },
  });
}

export async function storePatch(
  baseRomSha1: string,
  patchSha1: string,
  data: Uint8Array,
  filename: string,
  format: PatchFormat,
  title?: string,
): Promise<string> {
  const db = await getDb();
  const id = `${baseRomSha1}:${patchSha1}`;

  const patch: StoredPatch = {
    id,
    baseRomSha1,
    patchSha1,
    data,
    filename,
    format,
    size: data.byteLength,
    addedAt: Date.now(),
  };

  const meta: StoredPatchMeta = {
    id,
    baseRomSha1,
    patchSha1,
    filename,
    format,
    size: data.byteLength,
    addedAt: Date.now(),
    title,
  };

  const tx = db.transaction([PATCH_STORE, PATCH_META_STORE], 'readwrite');
  await Promise.all([
    tx.objectStore(PATCH_STORE).put(patch),
    tx.objectStore(PATCH_META_STORE).put(meta),
    tx.done,
  ]);

  return id;
}

export async function getPatch(id: string): Promise<StoredPatch | undefined> {
  const db = await getDb();
  return db.get(PATCH_STORE, id);
}

export async function getPatchMeta(id: string): Promise<StoredPatchMeta | undefined> {
  const db = await getDb();
  return db.get(PATCH_META_STORE, id);
}

export async function listPatchesForRom(baseRomSha1: string): Promise<StoredPatchMeta[]> {
  const db = await getDb();
  return db.getAllFromIndex(PATCH_META_STORE, 'by-base-rom', baseRomSha1);
}

export async function listAllPatches(): Promise<StoredPatchMeta[]> {
  const db = await getDb();
  return db.getAll(PATCH_META_STORE);
}

export async function updatePatchOutputSha1(id: string, outputSha1: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([PATCH_STORE, PATCH_META_STORE], 'readwrite');

  const [patch, meta] = await Promise.all([
    tx.objectStore(PATCH_STORE).get(id) as Promise<StoredPatch | undefined>,
    tx.objectStore(PATCH_META_STORE).get(id) as Promise<StoredPatchMeta | undefined>,
  ]);

  const updates: Promise<unknown>[] = [];
  if (patch) updates.push(tx.objectStore(PATCH_STORE).put({ ...patch, outputSha1 }));
  if (meta) updates.push(tx.objectStore(PATCH_META_STORE).put({ ...meta, outputSha1 }));
  updates.push(tx.done);

  await Promise.all(updates);
}

export async function deletePatch(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction([PATCH_STORE, PATCH_META_STORE], 'readwrite');
  await Promise.all([
    tx.objectStore(PATCH_STORE).delete(id),
    tx.objectStore(PATCH_META_STORE).delete(id),
    tx.done,
  ]);
}
