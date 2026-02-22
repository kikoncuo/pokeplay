/**
 * Client-side BPS and IPS ROM patcher.
 * All patching is done in-browser; no ROM or patch data touches the server.
 *
 * BPS spec: https://www.romhacking.net/documents/746/
 * IPS spec: https://zerosoft.zophar.net/ips.php
 */

export type PatchFormat = 'bps' | 'ips';

export class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatchError';
  }
}

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

const BPS_MAGIC = 0x42505331; // "BPS1"
const IPS_MAGIC = [0x50, 0x41, 0x54, 0x43, 0x48]; // "PATCH"

export function detectPatchFormat(data: Uint8Array): PatchFormat {
  if (data.length < 5) throw new PatchError('File too small to be a valid patch');

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // BPS: first 4 bytes are "BPS1"
  if (data.length >= 4 && view.getUint32(0, false) === BPS_MAGIC) return 'bps';

  // IPS: first 5 bytes are "PATCH"
  if (IPS_MAGIC.every((b, i) => data[i] === b)) return 'ips';

  throw new PatchError('Unknown patch format — only BPS and IPS are supported');
}

// ---------------------------------------------------------------------------
// Variable-length integer decoder (BPS)
// ---------------------------------------------------------------------------

function readVlq(data: Uint8Array, offset: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let i = offset;

  while (true) {
    if (i >= data.length) throw new PatchError('Unexpected end of BPS data reading VLQ');
    const byte = data[i++];
    result += (byte & 0x7f) << shift;
    if (byte & 0x80) break;
    shift += 7;
    result += 1 << shift;
  }

  return { value: result, next: i };
}

// ---------------------------------------------------------------------------
// BPS patcher
// ---------------------------------------------------------------------------

export function applyBpsPatch(source: Uint8Array, patch: Uint8Array): Uint8Array {
  const pv = new DataView(patch.buffer, patch.byteOffset, patch.byteLength);

  // Verify magic
  if (patch.length < 4 || pv.getUint32(0, false) !== BPS_MAGIC) {
    throw new PatchError('Not a valid BPS patch (bad magic)');
  }

  let pos = 4;

  // Read source/target/metadata sizes
  const sourceSize = readVlq(patch, pos);
  pos = sourceSize.next;
  const targetSize = readVlq(patch, pos);
  pos = targetSize.next;
  const metadataSize = readVlq(patch, pos);
  pos = metadataSize.next;

  // Skip metadata
  pos += metadataSize.value;

  const target = new Uint8Array(targetSize.value);
  let sourceRelativeOffset = 0;
  let targetRelativeOffset = 0;
  let outputOffset = 0;

  const ACTION_SOURCE_READ = 0;
  const ACTION_TARGET_READ = 1;
  const ACTION_SOURCE_COPY = 2;
  const ACTION_TARGET_COPY = 3;

  // 12 bytes at the end are checksums (source CRC32, target CRC32, patch CRC32)
  const dataEnd = patch.length - 12;

  while (pos < dataEnd) {
    const { value: data, next } = readVlq(patch, pos);
    pos = next;

    const action = data & 3;
    const length = (data >> 2) + 1;

    switch (action) {
      case ACTION_SOURCE_READ:
        for (let i = 0; i < length; i++) {
          target[outputOffset] = outputOffset < source.length ? source[outputOffset] : 0;
          outputOffset++;
        }
        break;

      case ACTION_TARGET_READ:
        for (let i = 0; i < length; i++) {
          if (pos >= dataEnd) throw new PatchError('BPS: unexpected end of patch data');
          target[outputOffset++] = patch[pos++];
        }
        break;

      case ACTION_SOURCE_COPY: {
        const { value: relOffset, next: n } = readVlq(patch, pos);
        pos = n;
        const negative = relOffset & 1;
        const delta = relOffset >> 1;
        sourceRelativeOffset += negative ? -delta : delta;
        for (let i = 0; i < length; i++) {
          target[outputOffset++] =
            sourceRelativeOffset < source.length ? source[sourceRelativeOffset++] : 0;
        }
        break;
      }

      case ACTION_TARGET_COPY: {
        const { value: relOffset, next: n } = readVlq(patch, pos);
        pos = n;
        const negative = relOffset & 1;
        const delta = relOffset >> 1;
        targetRelativeOffset += negative ? -delta : delta;
        for (let i = 0; i < length; i++) {
          target[outputOffset++] = target[targetRelativeOffset++];
        }
        break;
      }

      default:
        throw new PatchError(`BPS: unknown action ${action}`);
    }
  }

  return target;
}

// ---------------------------------------------------------------------------
// IPS patcher
// ---------------------------------------------------------------------------

const IPS_EOF = [0x45, 0x4f, 0x46]; // "EOF"

export function applyIpsPatch(source: Uint8Array, patch: Uint8Array): Uint8Array {
  // Verify magic "PATCH"
  if (!IPS_MAGIC.every((b, i) => patch[i] === b)) {
    throw new PatchError('Not a valid IPS patch (bad magic)');
  }

  // IPS patches can extend the ROM; find the maximum address first
  let maxSize = source.length;
  let scanPos = 5;
  while (scanPos + 3 <= patch.length) {
    if (IPS_EOF.every((b, i) => patch[scanPos + i] === b)) break;
    const offset = (patch[scanPos] << 16) | (patch[scanPos + 1] << 8) | patch[scanPos + 2];
    scanPos += 3;
    const size = (patch[scanPos] << 8) | patch[scanPos + 1];
    scanPos += 2;
    if (size === 0) {
      // RLE record
      const rleLen = (patch[scanPos] << 8) | patch[scanPos + 1];
      scanPos += 3; // 2 len + 1 byte
      maxSize = Math.max(maxSize, offset + rleLen);
    } else {
      maxSize = Math.max(maxSize, offset + size);
      scanPos += size;
    }
  }

  // Copy source into output, extending if needed
  const output = new Uint8Array(maxSize);
  output.set(source);

  let pos = 5;
  while (pos + 3 <= patch.length) {
    // Check for EOF marker
    if (IPS_EOF.every((b, i) => patch[pos + i] === b)) break;

    const offset = (patch[pos] << 16) | (patch[pos + 1] << 8) | patch[pos + 2];
    pos += 3;

    if (pos + 2 > patch.length) throw new PatchError('IPS: unexpected end reading record size');
    const size = (patch[pos] << 8) | patch[pos + 1];
    pos += 2;

    if (size === 0) {
      // RLE: next 2 bytes = run length, 1 byte = fill value
      if (pos + 3 > patch.length) throw new PatchError('IPS: unexpected end reading RLE record');
      const rleLen = (patch[pos] << 8) | patch[pos + 1];
      const fill = patch[pos + 2];
      pos += 3;
      output.fill(fill, offset, offset + rleLen);
    } else {
      if (pos + size > patch.length) throw new PatchError('IPS: unexpected end reading patch data');
      output.set(patch.subarray(pos, pos + size), offset);
      pos += size;
    }
  }

  return output;
}

// ---------------------------------------------------------------------------
// Unified patcher
// ---------------------------------------------------------------------------

export function applyPatch(source: Uint8Array, patch: Uint8Array): Uint8Array {
  const format = detectPatchFormat(patch);
  return format === 'bps' ? applyBpsPatch(source, patch) : applyIpsPatch(source, patch);
}

export function validatePatchFile(file: File): { valid: boolean; error?: string } {
  const ALLOWED = ['.bps', '.ips'];
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (!ALLOWED.includes(ext)) {
    return { valid: false, error: `Invalid patch format "${ext}". Allowed: .bps, .ips` };
  }
  if (file.size === 0) return { valid: false, error: 'Patch file is empty' };
  if (file.size > 32 * 1024 * 1024) {
    return { valid: false, error: 'Patch file too large (max 32 MB)' };
  }
  return { valid: true };
}
