'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EmulatorManager } from '@/lib/emulator/emulator-manager';
import { detectSystem, type SupportedSystem } from '@/lib/emulator/core-config';
import { GameboyMemoryReader, type GameState, readGen1GameState } from '@/lib/emulator/memory-reader';
import type { MemoryReader } from '@/lib/emulator/emulator-manager';

export type EmulatorStatus = 'idle' | 'loading' | 'ready' | 'started' | 'error';

export interface UseEmulatorOptions {
  /** DOM element id the emulator mounts into */
  containerId: string;
  /** Blob URL pointing to the ROM data */
  romUrl: string;
  /** Original filename (used to detect system / core) */
  romName: string;
  /** Called when emulator is initialised and ready */
  onReady?: () => void;
  /** Called when the game loop actually starts */
  onStart?: () => void;
  /** Called with raw state bytes after a save-state event */
  onSaveState?: (state: Uint8Array) => void;
  /** Called after a state has been loaded */
  onLoadState?: () => void;
}

export interface UseEmulatorReturn {
  status: EmulatorStatus;
  error: string | null;
  system: SupportedSystem;
  /** Trigger an EJS save-state (fires onSaveState callback with bytes) */
  saveState: () => void;
  /** Feed raw save-state bytes back into the emulator */
  loadState: (state: ArrayBuffer) => void;
  /** Pause emulation */
  pause: () => void;
  /** Resume emulation */
  resume: () => void;
  /** Set playback speed multiplier (1 = normal, 2 = 2×, etc.) */
  setSpeed: (multiplier: number) => void;
  /** Set volume 0–1 */
  setVolume: (volume: number) => void;
  /** Returns base64 screenshot string */
  getScreenshot: () => string;
  /** Low-level memory reader (available after emulator starts) */
  memoryReader: MemoryReader | null;
  /** Gen-1 game state helper (null for non-GB/GBC games or before start) */
  readGen1State: (() => GameState) | null;
}

export function useEmulator(options: UseEmulatorOptions): UseEmulatorReturn {
  const {
    containerId,
    romUrl,
    romName,
    onReady,
    onStart,
    onSaveState,
    onLoadState,
  } = options;

  const system = detectSystem(romName);
  const managerRef = useRef<EmulatorManager | null>(null);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<EmulatorStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [memoryReader, setMemoryReader] = useState<MemoryReader | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    setStatus('loading');
    setError(null);
    setMemoryReader(null);

    const manager = new EmulatorManager({
      containerId,
      romUrl,
      romName,
      system,
      onReady: () => {
        if (!mountedRef.current) return;
        setStatus('ready');
        // Grab the memory reader registered by the manager
        if (window.__memoryReader) setMemoryReader(window.__memoryReader);
        onReady?.();
      },
      onStart: () => {
        if (!mountedRef.current) return;
        setStatus('started');
        // Reader may only be available after the game loop starts
        if (window.__memoryReader) setMemoryReader(window.__memoryReader);
        onStart?.();
      },
      onSaveState,
      onLoadState,
    });

    managerRef.current = manager;

    manager.initialize().catch((err: unknown) => {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to initialise emulator');
      setStatus('error');
    });

    return () => {
      mountedRef.current = false;
      manager.destroy();
      managerRef.current = null;
    };
    // romUrl/romName changes mean a new ROM — full remount is correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [romUrl, romName, containerId]);

  const saveState = useCallback(() => managerRef.current?.saveState(), []);
  const loadState = useCallback(
    (state: ArrayBuffer) => managerRef.current?.loadState(state),
    [],
  );
  const pause = useCallback(() => managerRef.current?.pause(), []);
  const resume = useCallback(() => managerRef.current?.resume(), []);
  const setSpeed = useCallback(
    (multiplier: number) => managerRef.current?.setSpeed(multiplier),
    [],
  );
  const setVolume = useCallback(
    (volume: number) => managerRef.current?.setVolume(volume),
    [],
  );
  const getScreenshot = useCallback(
    () => managerRef.current?.getScreenshot() ?? '',
    [],
  );

  // Build Gen-1 state reader if we have a memory reader and a GB/GBC system
  const readGen1State =
    memoryReader && (system === 'gb' || system === 'gbc')
      ? (): GameState => {
          const gbReader = new GameboyMemoryReader(memoryReader);
          return readGen1GameState(gbReader);
        }
      : null;

  return {
    status,
    error,
    system,
    saveState,
    loadState,
    pause,
    resume,
    setSpeed,
    setVolume,
    getScreenshot,
    memoryReader,
    readGen1State,
  };
}
