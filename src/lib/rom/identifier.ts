/**
 * ROM Identifier — maps known SHA-1 hashes to game metadata.
 * Only supported Pokémon ROM hacks and base games are recognized.
 */

export type RomRegion = 'USA' | 'Europe' | 'Japan' | 'USA/Europe';
export type RomGeneration = 1 | 2 | 3;
export type RomSystem = 'GB' | 'GBC' | 'GBA';

export interface RomMetadata {
  id: string;
  title: string;
  region: RomRegion;
  generation: RomGeneration;
  system: RomSystem;
  /** Whether this is a ROM hack (vs base game) */
  isHack: boolean;
  baseGame?: string;
}

/** Known ROM hashes → metadata */
const ROM_DATABASE: Record<string, RomMetadata> = {
  // Pokémon Red (USA/Europe)
  '3d45c1ee9abd5738df46d2bdda8b57dc': {
    id: 'pokemon-red',
    title: 'Pokemon Red Version',
    region: 'USA/Europe',
    generation: 1,
    system: 'GB',
    isHack: false,
  },
  // Pokémon Blue (USA/Europe)
  '50927e843568814f7ed45ec4f944bd8b': {
    id: 'pokemon-blue',
    title: 'Pokemon Blue Version',
    region: 'USA/Europe',
    generation: 1,
    system: 'GB',
    isHack: false,
  },
  // Pokémon Yellow (USA/Europe)
  'd9290db87b1f0a23b89f99ee4469e34b': {
    id: 'pokemon-yellow',
    title: 'Pokemon Yellow Version',
    region: 'USA/Europe',
    generation: 1,
    system: 'GBC',
    isHack: false,
  },
  // Pokémon Gold (USA/Europe)
  'd8b8a3600a465308b9953f735c3ef0a5': {
    id: 'pokemon-gold',
    title: 'Pokemon Gold Version',
    region: 'USA/Europe',
    generation: 2,
    system: 'GBC',
    isHack: false,
  },
  // Pokémon Silver (USA/Europe)
  '49b163f7e57702bc939d642a18f591de': {
    id: 'pokemon-silver',
    title: 'Pokemon Silver Version',
    region: 'USA/Europe',
    generation: 2,
    system: 'GBC',
    isHack: false,
  },
  // Pokémon Crystal (USA/Europe)
  'f4cd194bdee0d04ca4eac29e09b8e4e9': {
    id: 'pokemon-crystal',
    title: 'Pokemon Crystal Version',
    region: 'USA/Europe',
    generation: 2,
    system: 'GBC',
    isHack: false,
  },
  // Pokémon FireRed (USA)
  'e26ee0d44e809351c8ce2d73c7400cdd': {
    id: 'pokemon-firered',
    title: 'Pokemon FireRed Version',
    region: 'USA',
    generation: 1,
    system: 'GBA',
    isHack: false,
  },
  // Pokémon LeafGreen (USA)
  '612ca9473451014d4cac1b7da517db7d': {
    id: 'pokemon-leafgreen',
    title: 'Pokemon LeafGreen Version',
    region: 'USA',
    generation: 1,
    system: 'GBA',
    isHack: false,
  },
  // Pokémon Emerald (USA/Europe)
  'f3ae088181bf583e55daf962a92bb46d': {
    id: 'pokemon-emerald',
    title: 'Pokemon Emerald Version',
    region: 'USA/Europe',
    generation: 3,
    system: 'GBA',
    isHack: false,
  },
};

export function identifyRom(sha1Hash: string): RomMetadata | null {
  const normalized = sha1Hash.toLowerCase();
  return ROM_DATABASE[normalized] ?? null;
}

export function createUnknownRomMetadata(filename: string): RomMetadata {
  const ext = filename.toLowerCase();
  const system: RomSystem = ext.endsWith('.gba')
    ? 'GBA'
    : ext.endsWith('.gbc')
      ? 'GBC'
      : 'GB';

  // Infer generation from system
  const generation: RomGeneration = system === 'GBA' ? 3 : system === 'GBC' ? 2 : 1;

  return {
    id: `unknown-${Date.now()}`,
    title: filename.replace(/\.[^.]+$/, ''),
    region: 'USA',
    generation,
    system,
    isHack: false,
  };
}
