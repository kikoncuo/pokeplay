import { getCoreConfig, detectSystem, type SupportedSystem } from './core-config';
import { GameboyMemoryReader, readGen1GameState } from './memory-reader';
import { GbaMemoryReader, readGen3GameState } from './gba-memory-reader';
import { MemoryPoller } from './memory-poller';
import { MultiplayerBridge, type BroadcastPlayerState, type Generation } from './multiplayer-bridge';

export interface EmulatorConfig {
  containerId: string;
  romUrl: string;
  romName: string;
  system?: SupportedSystem;
  onReady?: () => void;
  onStart?: () => void;
  onSaveState?: (state: Uint8Array) => void;
  onLoadState?: () => void;
}

export interface MemoryReader {
  readByte: (address: number) => number;
  readWord: (address: number) => number;
  readBytes: (address: number, length: number) => Uint8Array;
  writeByte: (address: number, value: number) => void;
  writeBytes: (address: number, data: Uint8Array) => void;
}

// EmulatorJS instance type (globally injected by EmulatorJS)
interface EJSEmulator {
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  gameManager?: {
    FS?: {
      analyzePath: (path: string) => { exists: boolean };
      readFile: (path: string, opts: { encoding: 'binary' }) => Uint8Array;
    };
    Module?: {
      HEAPU8?: Uint8Array;
    };
    setFastForwardRatio: (ratio: number) => void;
    toggleFastForward: () => void;
    screenshot: () => string;
    getState: () => Uint8Array;
    loadState: (state: Uint8Array) => void;
    quickSave: () => void;
    supportsStates: () => boolean;
  };
  pause: () => void;
  play: () => void;
  /** Set volume 0–1. Also controls muted state (0 = muted). */
  setVolume: (volume: number) => void;
  muted: boolean;
  volume: number;
  isFastForward: boolean;
}

declare global {
  interface Window {
    EJS_player: string;
    EJS_core: string;
    EJS_gameUrl: string;
    EJS_pathtodata: string;
    EJS_startOnLoaded: boolean;
    EJS_language: string | undefined;
    EJS_gameID: string | undefined;
    EJS_ready: (() => void) | undefined;
    EJS_onGameStart: (() => void) | undefined;
    EJS_onSaveState: ((state: { screenshot: string; state: Uint8Array }) => void) | undefined;
    EJS_onLoadState: (() => void) | undefined;
    EJS_emulator: EJSEmulator | undefined;
    __emulator: EmulatorManager | undefined;
    __memoryReader: MemoryReader | undefined;
  }
}

export class EmulatorManager {
  private config: EmulatorConfig;
  private ejsEmulator: EJSEmulator | null = null;
  private started = false;
  private mpPoller: MemoryPoller | null = null;
  private mpBroadcastCallback: ((state: BroadcastPlayerState) => void) | null = null;

  constructor(config: EmulatorConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    const system = this.config.system ?? detectSystem(this.config.romName);
    const coreConfig = getCoreConfig(system);

    window.EJS_player = `#${this.config.containerId}`;
    window.EJS_core = coreConfig.core;
    window.EJS_gameUrl = this.config.romUrl;
    window.EJS_pathtodata = coreConfig.dataPath;
    window.EJS_startOnLoaded = true;
    window.EJS_language = 'en-US';
    window.EJS_gameID = this.config.romName;

    window.EJS_ready = () => {
      this.ejsEmulator = window.EJS_emulator ?? null;
      this.registerMemoryReader();
      window.__emulator = this;
      this.config.onReady?.();
    };

    window.EJS_onGameStart = () => {
      this.started = true;
      this.config.onStart?.();
    };

    window.EJS_onSaveState = (data: { screenshot: string; state: Uint8Array }) => {
      this.config.onSaveState?.(data.state);
    };

    window.EJS_onLoadState = () => {
      this.config.onLoadState?.();
    };

    await this.loadScript(`/emulatorjs/data/loader.js`);
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  private registerMemoryReader(): void {
    const reader: MemoryReader = {
      readByte: (address: number): number => {
        const heap = this.ejsEmulator?.gameManager?.Module?.HEAPU8;
        if (!heap) return 0;
        return heap[address] ?? 0;
      },
      readWord: (address: number): number => {
        const lo = reader.readByte(address);
        const hi = reader.readByte(address + 1);
        return (hi << 8) | lo;
      },
      readBytes: (address: number, length: number): Uint8Array => {
        const heap = this.ejsEmulator?.gameManager?.Module?.HEAPU8;
        if (!heap) return new Uint8Array(length);
        return heap.slice(address, address + length);
      },
      writeByte: (address: number, value: number): void => {
        const heap = this.ejsEmulator?.gameManager?.Module?.HEAPU8;
        if (!heap) return;
        heap[address] = value & 0xff;
      },
      writeBytes: (address: number, data: Uint8Array): void => {
        const heap = this.ejsEmulator?.gameManager?.Module?.HEAPU8;
        if (!heap) return;
        heap.set(data, address);
      },
    };

    window.__memoryReader = reader;
  }

  pause(): void {
    this.ejsEmulator?.pause();
  }

  resume(): void {
    this.ejsEmulator?.play();
  }

  /**
   * Set playback speed multiplier. EmulatorJS uses setFastForwardRatio
   * for values > 1. A value of 1 disables fast-forward.
   */
  setSpeed(multiplier: number): void {
    if (!this.ejsEmulator?.gameManager) return;
    const ratio = Math.max(1, multiplier);
    const isCurrentlyFast = this.ejsEmulator.isFastForward;
    this.ejsEmulator.gameManager.setFastForwardRatio(ratio);
    // toggleFastForward flips state — only call when we need to change on/off
    if (ratio > 1 && !isCurrentlyFast) {
      this.ejsEmulator.gameManager.toggleFastForward();
    } else if (ratio <= 1 && isCurrentlyFast) {
      this.ejsEmulator.gameManager.toggleFastForward();
    }
  }

  /**
   * Set volume 0–1. Passing 0 mutes; any positive value unmutes.
   */
  setVolume(volume: number): void {
    const clamped = Math.min(1, Math.max(0, volume));
    try {
      this.ejsEmulator?.setVolume(clamped);
    } catch {
      // EmulatorJS audio context (OpenAL) may not be initialized yet —
      // silently ignore; volume will be applied once audio is ready.
    }
  }

  getVolume(): number {
    return this.ejsEmulator?.volume ?? 1;
  }

  isMuted(): boolean {
    return this.ejsEmulator?.muted ?? false;
  }

  saveState(): Uint8Array | null {
    try {
      return this.ejsEmulator?.gameManager?.getState() ?? null;
    } catch {
      return null;
    }
  }

  loadState(state: Uint8Array): void {
    try {
      this.ejsEmulator?.gameManager?.loadState(state);
    } catch {
      // State format may be incompatible
    }
  }

  getScreenshot(): string {
    try {
      return this.ejsEmulator?.gameManager?.screenshot() ?? '';
    } catch {
      return '';
    }
  }

  isStarted(): boolean {
    return this.started;
  }

  isReady(): boolean {
    return this.ejsEmulator !== null;
  }

  // ---------------------------------------------------------------------------
  // Multiplayer broadcasting
  // ---------------------------------------------------------------------------

  /**
   * Start polling memory and broadcasting local player state changes to the
   * multiplayer system via `window.__mpUpdatePosition`.
   *
   * Safe to call multiple times — stops any previous broadcast session first.
   *
   * @param callback Optional override for where state is delivered.
   *   Defaults to dispatching via `window.__mpUpdatePosition`.
   */
  startMultiplayerBroadcast(callback?: (state: BroadcastPlayerState) => void): void {
    this.stopMultiplayerBroadcast();

    const rawReader = window.__memoryReader;
    if (!rawReader) {
      console.warn('[EmulatorManager] startMultiplayerBroadcast: __memoryReader not yet available');
      return;
    }

    const system = this.config.system ?? detectSystem(this.config.romName);
    const gen: Generation = system === 'gba' ? 3 : 1;

    const bridge = new MultiplayerBridge({
      gen,
      onState: callback,
    });

    this.mpBroadcastCallback = callback ?? null;

    let readState: () => import('./memory-reader').GameState;
    if (gen === 3) {
      const gbaReader = new GbaMemoryReader(rawReader);
      readState = () => readGen3GameState(gbaReader);
    } else {
      const gbReader = new GameboyMemoryReader(rawReader);
      readState = () => readGen1GameState(gbReader);
    }

    this.mpPoller = new MemoryPoller(readState, {
      onStateDiff: (state) => bridge.handleStateDiff(state),
    });
    this.mpPoller.start();
  }

  /** Stop multiplayer broadcasting and destroy the associated poller. */
  stopMultiplayerBroadcast(): void {
    this.mpPoller?.destroy();
    this.mpPoller = null;
    this.mpBroadcastCallback = null;
  }

  destroy(): void {
    this.stopMultiplayerBroadcast();
    window.__emulator = undefined;
    window.__memoryReader = undefined;
    window.EJS_ready = undefined;
    window.EJS_onGameStart = undefined;
    window.EJS_onSaveState = undefined;
    window.EJS_onLoadState = undefined;
    window.EJS_language = undefined;
    window.EJS_gameID = undefined;
    this.ejsEmulator = null;
    this.started = false;
  }
}
