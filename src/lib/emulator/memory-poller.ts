/**
 * Memory poller — reads player state at 10 Hz maximum.
 *
 * Architecture rule (CLAUDE.md): memory polling is 10 Hz maximum.
 *
 * The poller is decoupled from the specific game generation: callers supply a
 * `readState` function that returns a GameState. Use `readGen1GameState` for
 * GB/GBC or `readGen3GameState` for GBA.
 */

import type { GameState } from './memory-reader';

export type { GameState };

/** Maximum polling rate enforced by architecture rules. */
export const MAX_POLL_HZ = 10;
const POLL_INTERVAL_MS = 1000 / MAX_POLL_HZ; // 100 ms

type StateCallback = (state: GameState) => void;
type ReadStateFn = () => GameState;

/** Returns true when two GameStates differ in any field relevant to multiplayer. */
function hasStateChanged(prev: GameState, next: GameState): boolean {
  return (
    prev.position.mapId !== next.position.mapId ||
    prev.position.x !== next.position.x ||
    prev.position.y !== next.position.y ||
    prev.position.facing !== next.position.facing ||
    prev.battleState !== next.battleState ||
    prev.partyCount !== next.partyCount
  );
}

export interface MemoryPollerOptions {
  /**
   * Called on every poll tick with the current GameState, regardless of
   * whether state changed. This drives render/broadcast subscribers.
   */
  onStateChange?: (state: GameState) => void;
  /**
   * Called only when one or more fields differ from the previous tick.
   * More efficient for network-bound consumers (e.g. multiplayer broadcaster).
   */
  onStateDiff?: (state: GameState) => void;
}

/**
 * MemoryPoller calls a user-supplied `readState` function at 10 Hz and
 * notifies subscribers with the resulting GameState.
 *
 * - `subscribe()` — receives every tick (all subscribers)
 * - `onStateChange` option — same as subscribe, fired every tick
 * - `onStateDiff` option — fired only when state differs from previous tick
 *
 * Usage (Gen 1):
 * ```ts
 * const gbReader = new GameboyMemoryReader(rawReader);
 * const poller = new MemoryPoller(() => readGen1GameState(gbReader), {
 *   onStateDiff: (state) => broadcaster.update(state),
 * });
 * ```
 *
 * Usage (Gen 3 / GBA):
 * ```ts
 * const gbaReader = new GbaMemoryReader(rawReader);
 * const poller = new MemoryPoller(() => readGen3GameState(gbaReader));
 * ```
 */
export class MemoryPoller {
  private timerId: ReturnType<typeof setInterval> | null = null;
  private readonly readState: ReadStateFn;
  private readonly callbacks: Set<StateCallback> = new Set();
  private lastState: GameState | null = null;
  private readonly onStateChange?: (state: GameState) => void;
  private readonly onStateDiff?: (state: GameState) => void;

  constructor(readState: ReadStateFn, options: MemoryPollerOptions = {}) {
    this.readState = readState;
    this.onStateChange = options.onStateChange;
    this.onStateDiff = options.onStateDiff;
  }

  /**
   * Subscribe to every poll tick. Polling starts automatically on the first
   * subscriber and stops when the last subscriber unsubscribes.
   *
   * @returns Unsubscribe function — call it to stop receiving updates.
   */
  subscribe(callback: StateCallback): () => void {
    this.callbacks.add(callback);
    this.startInterval();
    return () => {
      this.callbacks.delete(callback);
      if (this.callbacks.size === 0 && !this.onStateChange && !this.onStateDiff) {
        this.stopInterval();
      }
    };
  }

  /** Current cached state (null before first poll tick). */
  getLastState(): GameState | null {
    return this.lastState;
  }

  /** Force an immediate read and notify all subscribers and option callbacks. */
  poll(): void {
    const next = this.readState();
    const prev = this.lastState;

    // Notify all-tick subscribers
    this.callbacks.forEach((cb) => cb(next));
    this.onStateChange?.(next);

    // Notify diff-only subscriber when something changed
    if (this.onStateDiff && (prev === null || hasStateChanged(prev, next))) {
      this.onStateDiff(next);
    }

    this.lastState = next;
  }

  private startInterval(): void {
    if (this.timerId !== null) return;
    this.timerId = setInterval(() => this.poll(), POLL_INTERVAL_MS);
  }

  private stopInterval(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Explicitly start polling. Useful when `onStateChange`/`onStateDiff` options
   * are used without any `subscribe()` calls.
   */
  start(): void {
    this.startInterval();
  }

  /** Stop the poll interval without removing subscribers. */
  stop(): void {
    this.stopInterval();
  }

  /** Stop polling and remove all subscribers. */
  destroy(): void {
    this.stopInterval();
    this.callbacks.clear();
    this.lastState = null;
  }
}
