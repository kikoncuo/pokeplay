/**
 * Unit tests for the BPS/IPS ROM patcher.
 *
 * Architecture rule: all patching is client-side, no ROM data touches the server.
 * Tests use synthetic minimal patch buffers — no real ROM files needed.
 */

import { describe, it, expect } from 'vitest';
import {
  detectPatchFormat,
  applyBpsPatch,
  applyIpsPatch,
  applyPatch,
  validatePatchFile,
  PatchError,
} from '@/lib/rom/patcher';

// ---------------------------------------------------------------------------
// Patch buffer helpers
// ---------------------------------------------------------------------------

/** "BPS1" magic bytes in big-endian uint32 */
const BPS_MAGIC = new Uint8Array([0x42, 0x50, 0x53, 0x31]);
/** "PATCH" magic */
const IPS_MAGIC = new Uint8Array([0x50, 0x41, 0x54, 0x43, 0x48]);
/** "EOF" marker */
const IPS_EOF = new Uint8Array([0x45, 0x4f, 0x46]);

/**
 * Encodes a variable-length quantity (BPS VLQ format).
 * Used to construct minimal synthetic BPS patches.
 */
function encodeVlq(value: number): Uint8Array {
  const bytes: number[] = [];
  while (true) {
    const lo7 = value & 0x7f;
    value >>= 7;
    if (value === 0) {
      bytes.push(lo7 | 0x80);
      break;
    }
    bytes.push(lo7);
    value -= 1;
  }
  return new Uint8Array(bytes);
}

/**
 * Builds a minimal valid BPS patch that uses only SourceRead actions.
 * The patch copies `length` bytes verbatim from source starting at offset 0.
 */
function makeBpsPatch(sourceSize: number, targetSize: number): Uint8Array {
  const chunks: Uint8Array[] = [
    BPS_MAGIC,
    encodeVlq(sourceSize),
    encodeVlq(targetSize),
    encodeVlq(0), // metadata length = 0
    // One SourceRead action covering all targetSize bytes
    // action=0 (SourceRead), length = targetSize, encoded as (targetSize-1)<<2 | 0
    encodeVlq(((targetSize - 1) << 2) | 0),
    // 12 bytes of dummy checksums
    new Uint8Array(12).fill(0x00),
  ];
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const buf = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { buf.set(c, pos); pos += c.length; }
  return buf;
}

/**
 * Builds a minimal valid IPS patch with a single data record.
 * Writes `data` bytes at `offset` in the output.
 */
function makeIpsPatch(offset: number, data: Uint8Array): Uint8Array {
  const buf = new Uint8Array(5 + 3 + 2 + data.length + 3);
  let pos = 0;
  buf.set(IPS_MAGIC, pos); pos += 5;
  // Record: 3-byte offset
  buf[pos++] = (offset >> 16) & 0xff;
  buf[pos++] = (offset >> 8) & 0xff;
  buf[pos++] = offset & 0xff;
  // 2-byte size
  buf[pos++] = (data.length >> 8) & 0xff;
  buf[pos++] = data.length & 0xff;
  // data
  buf.set(data, pos); pos += data.length;
  // EOF
  buf.set(IPS_EOF, pos);
  return buf;
}

/**
 * Builds a minimal valid IPS patch with one RLE record.
 * Fills `rleLen` bytes at `offset` with `fill` value.
 */
function makeIpsRlePatch(offset: number, rleLen: number, fill: number): Uint8Array {
  const buf = new Uint8Array(5 + 3 + 2 + 2 + 1 + 3);
  let pos = 0;
  buf.set(IPS_MAGIC, pos); pos += 5;
  buf[pos++] = (offset >> 16) & 0xff;
  buf[pos++] = (offset >> 8) & 0xff;
  buf[pos++] = offset & 0xff;
  // size=0 signals RLE
  buf[pos++] = 0; buf[pos++] = 0;
  // rle length (2 bytes)
  buf[pos++] = (rleLen >> 8) & 0xff;
  buf[pos++] = rleLen & 0xff;
  // fill byte
  buf[pos++] = fill;
  buf.set(IPS_EOF, pos);
  return buf;
}

// ---------------------------------------------------------------------------
// detectPatchFormat
// ---------------------------------------------------------------------------

describe('detectPatchFormat', () => {
  it('detects BPS format from magic bytes', () => {
    const patch = makeBpsPatch(8, 8);
    expect(detectPatchFormat(patch)).toBe('bps');
  });

  it('detects IPS format from magic bytes', () => {
    const patch = makeIpsPatch(0, new Uint8Array([0xff]));
    expect(detectPatchFormat(patch)).toBe('ips');
  });

  it('throws PatchError for unknown format', () => {
    const unknown = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00]);
    expect(() => detectPatchFormat(unknown)).toThrowError(PatchError);
  });

  it('throws PatchError for file smaller than 5 bytes', () => {
    expect(() => detectPatchFormat(new Uint8Array([0x42, 0x50, 0x53]))).toThrowError(PatchError);
  });

  it('error message mentions supported formats', () => {
    const unknown = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
    expect(() => detectPatchFormat(unknown)).toThrow(/BPS|IPS/i);
  });
});

// ---------------------------------------------------------------------------
// applyBpsPatch — SourceRead action
// ---------------------------------------------------------------------------

describe('applyBpsPatch', () => {
  it('throws PatchError for bad magic', () => {
    const bad = new Uint8Array(20).fill(0x00);
    expect(() => applyBpsPatch(new Uint8Array(8), bad)).toThrowError(PatchError);
  });

  it('returns Uint8Array of correct target size', () => {
    const source = new Uint8Array(8).fill(0xaa);
    const patch = makeBpsPatch(8, 8);
    const result = applyBpsPatch(source, patch);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(8);
  });

  it('SourceRead copies bytes from source into target', () => {
    const source = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const patch = makeBpsPatch(4, 4);
    const result = applyBpsPatch(source, patch);
    // SourceRead at position 0..3 copies source bytes verbatim
    expect(result[0]).toBe(0x01);
    expect(result[1]).toBe(0x02);
    expect(result[2]).toBe(0x03);
    expect(result[3]).toBe(0x04);
  });

  it('out-of-bounds source read fills with 0x00', () => {
    // target larger than source — out-of-range reads return 0
    const source = new Uint8Array([0xff]);
    const patch = makeBpsPatch(1, 4);
    const result = applyBpsPatch(source, patch);
    expect(result[0]).toBe(0xff);
    expect(result[1]).toBe(0x00);
    expect(result[2]).toBe(0x00);
    expect(result[3]).toBe(0x00);
  });
});

// ---------------------------------------------------------------------------
// applyBpsPatch — TargetRead action
// ---------------------------------------------------------------------------

describe('applyBpsPatch — TargetRead', () => {
  /**
   * Build a BPS patch with one TargetRead action that injects specific bytes.
   * TargetRead action=1: (length-1)<<2 | 1, followed by raw data bytes.
   */
  function makeBpsTargetReadPatch(targetBytes: Uint8Array): Uint8Array {
    const actionVlq = encodeVlq(((targetBytes.length - 1) << 2) | 1);
    const chunks: Uint8Array[] = [
      BPS_MAGIC,
      encodeVlq(0),                    // sourceSize
      encodeVlq(targetBytes.length),   // targetSize
      encodeVlq(0),                    // metadata
      actionVlq,
      targetBytes,
      new Uint8Array(12).fill(0x00),   // checksums
    ];
    const total = chunks.reduce((s, c) => s + c.length, 0);
    const buf = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) { buf.set(c, pos); pos += c.length; }
    return buf;
  }

  it('TargetRead writes patch literal bytes into target', () => {
    const literalBytes = new Uint8Array([0xca, 0xfe, 0xba, 0xbe]);
    const patch = makeBpsTargetReadPatch(literalBytes);
    const result = applyBpsPatch(new Uint8Array(0), patch);
    expect(Array.from(result)).toEqual([0xca, 0xfe, 0xba, 0xbe]);
  });
});

// ---------------------------------------------------------------------------
// applyIpsPatch — data record
// ---------------------------------------------------------------------------

describe('applyIpsPatch', () => {
  it('throws PatchError for bad magic', () => {
    const bad = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x45, 0x4f, 0x46]);
    expect(() => applyIpsPatch(new Uint8Array(8), bad)).toThrowError(PatchError);
  });

  it('copies source into output before applying patch', () => {
    const source = new Uint8Array([0xaa, 0xbb, 0xcc]);
    const patch = makeIpsPatch(10, new Uint8Array([0xff])); // patches offset 10, beyond source
    const result = applyIpsPatch(source, patch);
    expect(result[0]).toBe(0xaa);
    expect(result[1]).toBe(0xbb);
    expect(result[2]).toBe(0xcc);
  });

  it('overwrites bytes at the specified offset', () => {
    const source = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const patch = makeIpsPatch(1, new Uint8Array([0xde, 0xad]));
    const result = applyIpsPatch(source, patch);
    expect(result[0]).toBe(0x00);
    expect(result[1]).toBe(0xde);
    expect(result[2]).toBe(0xad);
    expect(result[3]).toBe(0x00);
  });

  it('extends output beyond source length when patch writes past end', () => {
    const source = new Uint8Array([0x01, 0x02]);
    const patch = makeIpsPatch(4, new Uint8Array([0xff])); // offset 4 > source.length 2
    const result = applyIpsPatch(source, patch);
    expect(result.length).toBeGreaterThan(source.length);
    expect(result[4]).toBe(0xff);
  });

  it('applies RLE record correctly', () => {
    const source = new Uint8Array(10).fill(0x00);
    const patch = makeIpsRlePatch(2, 4, 0xab); // fill 4 bytes at offset 2 with 0xab
    const result = applyIpsPatch(source, patch);
    expect(result[1]).toBe(0x00); // before RLE region
    expect(result[2]).toBe(0xab);
    expect(result[3]).toBe(0xab);
    expect(result[4]).toBe(0xab);
    expect(result[5]).toBe(0xab);
    expect(result[6]).toBe(0x00); // after RLE region
  });
});

// ---------------------------------------------------------------------------
// applyPatch — unified dispatcher
// ---------------------------------------------------------------------------

describe('applyPatch', () => {
  it('dispatches to BPS patcher for BPS patches', () => {
    const source = new Uint8Array([0xaa, 0xbb]);
    const patch = makeBpsPatch(2, 2);
    const result = applyPatch(source, patch);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(2);
  });

  it('dispatches to IPS patcher for IPS patches', () => {
    const source = new Uint8Array([0x00, 0x00, 0x00]);
    const patch = makeIpsPatch(0, new Uint8Array([0x42]));
    const result = applyPatch(source, patch);
    expect(result[0]).toBe(0x42);
  });

  it('throws for unknown format', () => {
    const bad = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
    expect(() => applyPatch(new Uint8Array(8), bad)).toThrowError(PatchError);
  });
});

// ---------------------------------------------------------------------------
// validatePatchFile
// ---------------------------------------------------------------------------

describe('validatePatchFile', () => {
  function makeFile(name: string, size: number): File {
    return new File([new Uint8Array(size)], name, { type: 'application/octet-stream' });
  }

  it('accepts .bps extension', () => {
    expect(validatePatchFile(makeFile('hack.bps', 512)).valid).toBe(true);
  });

  it('accepts .ips extension', () => {
    expect(validatePatchFile(makeFile('hack.ips', 512)).valid).toBe(true);
  });

  it('rejects .zip extension', () => {
    const result = validatePatchFile(makeFile('hack.zip', 512));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('.zip');
  });

  it('rejects .xdelta extension', () => {
    const result = validatePatchFile(makeFile('hack.xdelta', 512));
    expect(result.valid).toBe(false);
  });

  it('rejects empty file', () => {
    const result = validatePatchFile(makeFile('hack.bps', 0));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it('rejects file over 32 MB', () => {
    const result = validatePatchFile(makeFile('hack.bps', 33 * 1024 * 1024));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too large|32 MB/i);
  });

  it('accepts file at exactly 32 MB', () => {
    expect(validatePatchFile(makeFile('hack.bps', 32 * 1024 * 1024)).valid).toBe(true);
  });

  it('returns no error property for valid file', () => {
    const result = validatePatchFile(makeFile('hack.ips', 100));
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
