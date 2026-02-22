/**
 * ROM Hasher — computes SHA-1 hash using hash-wasm.
 * Used to identify ROMs without storing or transmitting ROM data.
 */

import { sha1 } from 'hash-wasm';

export async function hashRom(data: Uint8Array): Promise<string> {
  return sha1(data);
}

export function formatHash(hash: string): string {
  return hash.toLowerCase();
}
