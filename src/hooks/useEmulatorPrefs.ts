'use client';

import { useCallback, useEffect, useState } from 'react';

export type SpeedMultiplier = 1 | 2 | 4;

export interface EmulatorPrefs {
  volume: number;       // 0–1
  muted: boolean;
  speed: SpeedMultiplier;
}

const STORAGE_KEY = 'pokeplay:emulator-prefs';

const DEFAULTS: EmulatorPrefs = {
  volume: 0.8,
  muted: false,
  speed: 1,
};

function loadPrefs(): EmulatorPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<EmulatorPrefs>;
    return {
      volume: typeof parsed.volume === 'number' ? Math.min(1, Math.max(0, parsed.volume)) : DEFAULTS.volume,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULTS.muted,
      speed: [1, 2, 4].includes(parsed.speed as number) ? (parsed.speed as SpeedMultiplier) : DEFAULTS.speed,
    };
  } catch {
    return DEFAULTS;
  }
}

function savePrefs(prefs: EmulatorPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable (private browsing quota, etc.) — ignore
  }
}

export function useEmulatorPrefs(): {
  prefs: EmulatorPrefs;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  toggleMuted: () => void;
  setSpeed: (s: SpeedMultiplier) => void;
} {
  const [prefs, setPrefs] = useState<EmulatorPrefs>(DEFAULTS);

  // Load from localStorage on mount (client-only)
  useEffect(() => {
    setPrefs(loadPrefs());
  }, []);

  const update = useCallback((patch: Partial<EmulatorPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  const setVolume = useCallback((v: number) => update({ volume: v, muted: v === 0 }), [update]);
  const setMuted = useCallback((m: boolean) => update({ muted: m }), [update]);
  const toggleMuted = useCallback(() => setPrefs((prev) => {
    const next = { ...prev, muted: !prev.muted };
    savePrefs(next);
    return next;
  }), []);
  const setSpeed = useCallback((s: SpeedMultiplier) => update({ speed: s }), [update]);

  return { prefs, setVolume, setMuted, toggleMuted, setSpeed };
}
