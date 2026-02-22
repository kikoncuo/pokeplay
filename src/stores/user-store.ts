'use client'

import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { Tables } from '@/lib/supabase/database.types'

export type Profile = Tables<'profiles'>

interface UserState {
  user: User | null
  profile: Profile | null
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  profile: null,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
}))
