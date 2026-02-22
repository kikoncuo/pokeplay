/**
 * ROM Loader — converts File API to Uint8Array.
 * ROMs NEVER touch the server; all processing is client-side only.
 */

export async function loadRomFile(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

export function validateRomFile(file: File): { valid: boolean; error?: string } {
  const MAX_ROM_SIZE = 64 * 1024 * 1024; // 64 MB
  const ALLOWED_EXTENSIONS = ['.gb', '.gbc', '.gba', '.rom'];

  const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `Invalid file type "${extension}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
    };
  }

  if (file.size > MAX_ROM_SIZE) {
    return {
      valid: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max: 64 MB`,
    };
  }

  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  return { valid: true };
}
