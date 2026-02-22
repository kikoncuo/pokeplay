import { create } from 'zustand';
import type { Tables } from '@/lib/supabase/database.types';
import type { RoomMember } from '@/types/room';

type DbRoom = Tables<'rooms'>;

export interface RoomStore {
  rooms: DbRoom[];
  currentRoom: DbRoom | null;
  members: RoomMember[];
  isLoading: boolean;
  error: string | null;

  setRooms: (rooms: DbRoom[]) => void;
  setCurrentRoom: (room: DbRoom | null) => void;
  setMembers: (members: RoomMember[]) => void;
  addMember: (member: RoomMember) => void;
  removeMember: (userId: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  rooms: [],
  currentRoom: null,
  members: [],
  isLoading: false,
  error: null,
};

export const useRoomStore = create<RoomStore>((set) => ({
  ...initialState,

  setRooms: (rooms) => set({ rooms }),

  setCurrentRoom: (room) => set({ currentRoom: room }),

  setMembers: (members) => set({ members }),

  addMember: (member) =>
    set((state) => {
      if (state.members.some((m) => m.userId === member.userId)) return state;
      return { members: [...state.members, member] };
    }),

  removeMember: (userId) =>
    set((state) => ({
      members: state.members.filter((m) => m.userId !== userId),
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
