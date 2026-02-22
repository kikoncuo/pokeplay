export type FacingDirection = 'up' | 'down' | 'left' | 'right';

export interface PlayerState {
  userId: string;
  username: string;
  mapId: number;
  x: number;
  y: number;
  facing: FacingDirection;
  isInBattle: boolean;
  timestamp: number;
}

export interface RoomState {
  roomId: string;
  players: Record<string, PlayerState>;
  createdAt: number;
}

export interface MultiplayerConfig {
  broadcastRateHz: number;
  interpolationMs: number;
  maxPlayers: number;
}

export const DEFAULT_MULTIPLAYER_CONFIG: MultiplayerConfig = {
  broadcastRateHz: 10,
  interpolationMs: 100,
  maxPlayers: 8,
};
