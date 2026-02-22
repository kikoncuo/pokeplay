'use client'

import { useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/stores/user-store'
import { useUserStore } from '@/stores/user-store'

interface UserProviderProps {
  user: User | null
  profile: Profile | null
  children: React.ReactNode
}

export function UserProvider({ user, profile, children }: UserProviderProps): React.ReactElement {
  const setUser = useUserStore((s) => s.setUser)
  const setProfile = useUserStore((s) => s.setProfile)

  useEffect(() => {
    setUser(user)
    setProfile(profile)
  }, [user, profile, setUser, setProfile])

  return <>{children}</>
}
