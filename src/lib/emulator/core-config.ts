export type SupportedSystem = 'gb' | 'gbc' | 'gba';

export interface CoreConfig {
  system: SupportedSystem;
  core: string;
  dataPath: string;
  /** File extensions accepted by this system (without leading dot). */
  extensions: string[];
}

const DATA_PATH = '/emulatorjs/data/';

const SYSTEM_CORES: Record<SupportedSystem, string> = {
  gb: 'gambatte',
  gbc: 'gambatte',
  gba: 'mgba',
};

const SYSTEM_EXTENSIONS: Record<SupportedSystem, string[]> = {
  gb: ['gb', 'sgb'],
  gbc: ['gbc'],
  gba: ['gba'],
};

export function getCoreConfig(system: SupportedSystem): CoreConfig {
  return {
    system,
    core: SYSTEM_CORES[system],
    dataPath: DATA_PATH,
    extensions: SYSTEM_EXTENSIONS[system],
  };
}

/** All file extensions accepted across every supported system. */
export const ALL_ROM_EXTENSIONS: string[] = Object.values(SYSTEM_EXTENSIONS).flat();

export function detectSystem(fileName: string): SupportedSystem {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.gba')) return 'gba';
  if (lower.endsWith('.gbc')) return 'gbc';
  return 'gb';
}

/** Returns true if the filename has a supported ROM extension. */
export function isSupportedRom(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALL_ROM_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`));
}
