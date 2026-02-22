import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/Layout/AppNav'
import { UserProvider } from '@/components/Layout/UserProvider'
import type { Profile } from '@/stores/user-store'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}): Promise<React.ReactElement> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data ?? null
  }

  return (
    <UserProvider user={user} profile={profile}>
      <div className="flex min-h-screen">
        <aside className="w-56 shrink-0">
          <AppNav />
        </aside>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </UserProvider>
  )
}
