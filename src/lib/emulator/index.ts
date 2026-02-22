export { EmulatorManager } from './emulator-manager';
export type { EmulatorConfig, MemoryReader } from './emulator-manager';

export { getCoreConfig, detectSystem, isSupportedRom, ALL_ROM_EXTENSIONS } from './core-config';
export type { CoreConfig, SupportedSystem } from './core-config';

export { GameboyMemoryReader, readGen1GameState } from './memory-reader';
export type { ByteReader, PlayerPosition, BattleState, GameState } from './memory-reader';

export { GbaMemoryReader, readGen3GameState } from './gba-memory-reader';

export { MemoryPoller, MAX_POLL_HZ } from './memory-poller';
export type { MemoryPollerOptions } from './memory-poller';

export { MultiplayerBridge, registerMpUpdatePosition } from './multiplayer-bridge';
export type { BroadcastPlayerState, MpUpdatePositionFn, Generation } from './multiplayer-bridge';

export * as Gen1 from './memory-maps/gen1';
export * as Gen3 from './memory-maps/gen3';
