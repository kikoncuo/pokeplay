export type RoomVisibility = 'public' | 'private';

export interface Room {
  id: string;
  name: string;
  hostUserId: string;
  visibility: RoomVisibility;
  maxPlayers: number;
  playerCount: number;
  createdAt: string;
}

export interface RoomMember {
  userId: string;
  username: string;
  joinedAt: number;
  isHost: boolean;
}

export interface RoomPresence {
  userId: string;
  username: string;
  onlineAt: string;
}

export interface CreateRoomInput {
  name: string;
  visibility: RoomVisibility;
  maxPlayers: number;
}
