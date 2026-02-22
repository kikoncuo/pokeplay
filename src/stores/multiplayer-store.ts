import { create } from 'zustand';
import type { PlayerState } from '@/types/multiplayer';
import type { ChatMessage } from '@/components/Multiplayer/ChatPanel';
import type { ChannelStatus } from '@/lib/multiplayer/connection-health';

// Re-export for backwards compat — existing consumers use ConnectionStatus.
export type ConnectionStatus = ChannelStatus | 'error';

export interface MultiplayerStore {
  status: ConnectionStatus;
  localPlayer: PlayerState | null;
  remotePlayers: Record<string, PlayerState>;
  /** Last-seen timestamp (ms) keyed by userId — updated on position or ping. */
  playerLastSeen: Record<string, number>;
  messages: ChatMessage[];
  error: string | null;

  setStatus: (status: ConnectionStatus) => void;
  setLocalPlayer: (player: PlayerState | null) => void;
  upsertRemotePlayer: (player: PlayerState) => void;
  removeRemotePlayer: (userId: string) => void;
  markPlayerSeen: (userId: string, ts: number) => void;
  addMessage: (message: ChatMessage) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const MAX_MESSAGES = 200;

const initialState = {
  status: 'disconnected' as ConnectionStatus,
  localPlayer: null,
  remotePlayers: {},
  playerLastSeen: {},
  messages: [],
  error: null,
};

export const useMultiplayerStore = create<MultiplayerStore>((set) => ({
  ...initialState,

  setStatus: (status) => set({ status }),

  setLocalPlayer: (localPlayer) => set({ localPlayer }),

  upsertRemotePlayer: (player) =>
    set((state) => ({
      remotePlayers: { ...state.remotePlayers, [player.userId]: player },
    })),

  removeRemotePlayer: (userId) =>
    set((state) => {
      const next = { ...state.remotePlayers };
      delete next[userId];
      const nextSeen = { ...state.playerLastSeen };
      delete nextSeen[userId];
      return { remotePlayers: next, playerLastSeen: nextSeen };
    }),

  markPlayerSeen: (userId, ts) =>
    set((state) => ({
      playerLastSeen: { ...state.playerLastSeen, [userId]: ts },
    })),

  addMessage: (message) =>
    set((state) => {
      const messages = [...state.messages, message];
      return { messages: messages.slice(-MAX_MESSAGES) };
    }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
