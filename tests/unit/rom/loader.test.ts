/**
 * Unit tests for ROM loader (src/lib/rom/loader.ts).
 *
 * Tests cover:
 * - validateRomFile: extension checks, size limits, empty file rejection
 * - loadRomFile: ArrayBuffer → Uint8Array conversion
 */

import { describe, it, expect } from 'vitest';
import { validateRomFile, loadRomFile } from '@/lib/rom/loader';
import { makeMockFile, MockRomFile, MAX_ROM_SIZE } from '../../fixtures/rom-fixtures';

// ---------------------------------------------------------------------------
// validateRomFile
// ---------------------------------------------------------------------------

describe('validateRomFile — extension validation', () => {
  it('accepts .gb extension', () => {
    const file = makeMockFile('game.gb', 1024);
    expect(validateRomFile(file).valid).toBe(true);
  });

  it('accepts .gbc extension', () => {
    const file = makeMockFile('game.gbc', 1024);
    expect(validateRomFile(file).valid).toBe(true);
  });

  it('accepts .gba extension', () => {
    const file = makeMockFile('game.gba', 1024);
    expect(validateRomFile(file).valid).toBe(true);
  });

  it('accepts .rom extension', () => {
    const file = makeMockFile('game.rom', 1024);
    expect(validateRomFile(file).valid).toBe(true);
  });

  it('rejects .exe extension', () => {
    const file = makeMockFile('game.exe', 1024);
    const result = validateRomFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('.exe');
  });

  it('rejects .txt extension', () => {
    const file = makeMockFile('readme.txt', 1024);
    const result = validateRomFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('.txt');
  });

  it('rejects .zip extension', () => {
    const file = makeMockFile('game.zip', 1024);
    const result = validateRomFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('.zip');
  });

  it('rejects .png extension', () => {
    const file = makeMockFile('screenshot.png', 1024);
    const result = validateRomFile(file);
    expect(result.valid).toBe(false);
  });

  it('rejects file with no extension', () => {
    const file = makeMockFile('noextension', 1024);
    const result = validateRomFile(file);
    expect(result.valid).toBe(false);
  });

  it('handles uppercase extensions (.GB) correctly', () => {
    // The loader uses .toLowerCase() so .GB should map to .gb
    const file = makeMockFile('game.GB', 1024);
    // If loader normalizes to lowercase, this passes; document expected behavior.
    const result = validateRomFile(file);
    // Lowercase normalization is applied — .GB becomes .gb which is valid.
    expect(result.valid).toBe(true);
  });
});

describe('validateRomFile — size validation', () => {
  it('rejects empty files (0 bytes)', () => {
    const file = makeMockFile('game.gb', 0);
    const result = validateRomFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it('accepts file at exactly 1 byte', () => {
    const file = makeMockFile('game.gb', 1);
    expect(validateRomFile(file).valid).toBe(true);
  });

  it('accepts file at exactly 64 MB (the limit)', () => {
    const file = makeMockFile('game.gb', MAX_ROM_SIZE);
    expect(validateRomFile(file).valid).toBe(true);
  });

  it('rejects file at 64 MB + 1 byte', () => {
    const file = makeMockFile('game.gb', MAX_ROM_SIZE + 1);
    const result = validateRomFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });

  it('error message for oversized file includes "64 MB"', () => {
    const file = makeMockFile('game.gba', MAX_ROM_SIZE + 1024);
    const result = validateRomFile(file);
    expect(result.error).toMatch(/64 MB/i);
  });
});

describe('validateRomFile — return type', () => {
  it('returns { valid: true } with no error property for valid files', () => {
    const file = makeMockFile('game.gb', 1024);
    const result = validateRomFile(file);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns { valid: false, error: string } for invalid files', () => {
    const file = makeMockFile('game.exe', 1024);
    const result = validateRomFile(file);
    expect(result.valid).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.error!.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// loadRomFile
// ---------------------------------------------------------------------------

describe('loadRomFile — ArrayBuffer conversion', () => {
  it('converts file to Uint8Array', async () => {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0xff]);
    const file = new MockRomFile('game.gb', data);
    const result = await loadRomFile(file);
    expect(result).toBeInstanceOf(Uint8Array);
  });

  it('preserves all bytes without modification', async () => {
    const data = new Uint8Array([0x00, 0x01, 0xfe, 0xff, 0xab, 0xcd]);
    const file = new MockRomFile('game.gb', data);
    const result = await loadRomFile(file);

    expect(result.length).toBe(data.length);
    for (let i = 0; i < data.length; i++) {
      expect(result[i]).toBe(data[i]);
    }
  });

  it('handles 32 KB save-sized buffer correctly', async () => {
    const data = new Uint8Array(32768).fill(0x42);
    const file = new MockRomFile('game.gb', data);
    const result = await loadRomFile(file);

    expect(result.byteLength).toBe(32768);
    expect(result[0]).toBe(0x42);
    expect(result[32767]).toBe(0x42);
  });
});
