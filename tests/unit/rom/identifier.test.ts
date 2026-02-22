/**
 * Unit tests for ROM identifier — SHA-1 hash → game metadata lookup.
 */

import { describe, it, expect } from 'vitest';
import { identifyRom, createUnknownRomMetadata } from '@/lib/rom/identifier';

// ---------------------------------------------------------------------------
// identifyRom — known hashes
// ---------------------------------------------------------------------------

describe('identifyRom — known ROMs', () => {
  it('identifies Pokémon Red by hash', () => {
    const meta = identifyRom('3d45c1ee9abd5738df46d2bdda8b57dc');
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe('pokemon-red');
    expect(meta!.system).toBe('GB');
    expect(meta!.generation).toBe(1);
    expect(meta!.isHack).toBe(false);
  });

  it('identifies Pokémon Blue by hash', () => {
    const meta = identifyRom('50927e843568814f7ed45ec4f944bd8b');
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe('pokemon-blue');
  });

  it('identifies Pokémon Yellow (GBC) by hash', () => {
    const meta = identifyRom('d9290db87b1f0a23b89f99ee4469e34b');
    expect(meta).not.toBeNull();
    expect(meta!.system).toBe('GBC');
    expect(meta!.generation).toBe(1);
  });

  it('identifies Pokémon Gold (Gen 2) by hash', () => {
    const meta = identifyRom('d8b8a3600a465308b9953f735c3ef0a5');
    expect(meta).not.toBeNull();
    expect(meta!.generation).toBe(2);
  });

  it('identifies Pokémon Silver (Gen 2) by hash', () => {
    const meta = identifyRom('49b163f7e57702bc939d642a18f591de');
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe('pokemon-silver');
  });

  it('identifies Pokémon Crystal (Gen 2, GBC) by hash', () => {
    const meta = identifyRom('f4cd194bdee0d04ca4eac29e09b8e4e9');
    expect(meta).not.toBeNull();
    expect(meta!.system).toBe('GBC');
  });

  it('identifies Pokémon FireRed (GBA) by hash', () => {
    const meta = identifyRom('e26ee0d44e809351c8ce2d73c7400cdd');
    expect(meta).not.toBeNull();
    expect(meta!.system).toBe('GBA');
    expect(meta!.region).toBe('USA');
  });

  it('identifies Pokémon LeafGreen (GBA) by hash', () => {
    const meta = identifyRom('612ca9473451014d4cac1b7da517db7d');
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe('pokemon-leafgreen');
  });

  it('identifies Pokémon Emerald (GBA, Gen 3) by hash', () => {
    const meta = identifyRom('f3ae088181bf583e55daf962a92bb46d');
    expect(meta).not.toBeNull();
    expect(meta!.generation).toBe(3);
    expect(meta!.system).toBe('GBA');
  });
});

describe('identifyRom — unknown hashes', () => {
  it('returns null for an unknown hash', () => {
    expect(identifyRom('0000000000000000000000000000000000000000')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(identifyRom('')).toBeNull();
  });

  it('normalizes hash to lowercase before lookup', () => {
    // Pokemon Red hash in uppercase should still resolve
    const result = identifyRom('3D45C1EE9ABD5738DF46D2BDDA8B57DC');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('pokemon-red');
  });

  it('returns null for partial hash', () => {
    expect(identifyRom('3d45c1ee')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createUnknownRomMetadata
// ---------------------------------------------------------------------------

describe('createUnknownRomMetadata', () => {
  it('infers GB system from .gb extension', () => {
    const meta = createUnknownRomMetadata('myhack.gb');
    expect(meta.system).toBe('GB');
    expect(meta.generation).toBe(1);
  });

  it('infers GBC system from .gbc extension', () => {
    const meta = createUnknownRomMetadata('myhack.gbc');
    expect(meta.system).toBe('GBC');
    expect(meta.generation).toBe(2);
  });

  it('infers GBA system from .gba extension', () => {
    const meta = createUnknownRomMetadata('myhack.gba');
    expect(meta.system).toBe('GBA');
    expect(meta.generation).toBe(3);
  });

  it('strips extension from title', () => {
    const meta = createUnknownRomMetadata('pokemon-crystal-clear.gbc');
    expect(meta.title).toBe('pokemon-crystal-clear');
    expect(meta.title).not.toContain('.gbc');
  });

  it('sets isHack to false by default', () => {
    const meta = createUnknownRomMetadata('unknown.gba');
    expect(meta.isHack).toBe(false);
  });

  it('generates a unique id each call', () => {
    const a = createUnknownRomMetadata('a.gb');
    const b = createUnknownRomMetadata('b.gb');
    // Both start with "unknown-" and have different suffixes (timestamp)
    expect(a.id).toMatch(/^unknown-/);
    expect(b.id).toMatch(/^unknown-/);
  });

  it('defaults unknown extensions to GB system', () => {
    const meta = createUnknownRomMetadata('file.rom');
    expect(meta.system).toBe('GB');
  });
});
