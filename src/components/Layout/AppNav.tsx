'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUserStore } from '@/stores/user-store'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/hacks', label: 'Library' },
  { href: '/saves', label: 'Saves' },
  { href: '/rooms', label: 'Multiplayer' },
] as const

export function AppNav(): React.ReactElement {
  const pathname = usePathname()
  const router = useRouter()
  const user = useUserStore((s) => s.user)
  const profile = useUserStore((s) => s.profile)

  async function handleSignOut(): Promise<void> {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Trainer'
  const avatarUrl = profile?.avatar_url ?? undefined
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <nav className="flex h-full flex-col border-r-2 border-border bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="px-4 py-5">
        <Link
          href="/dashboard"
          className="font-mono text-xl font-black uppercase tracking-tight text-sidebar-foreground"
        >
          Poke<span className="text-primary">Play</span>
        </Link>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Links */}
      <div className="flex flex-col gap-1 p-3">
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center px-3 py-2 text-sm font-bold uppercase tracking-tight transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                  : 'hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
              ].join(' ')}
            >
              {label}
            </Link>
          )
        })}
      </div>

      {/* User menu */}
      <div className="mt-auto border-t-2 border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 font-bold uppercase"
            >
              <Avatar className="h-6 w-6 border border-sidebar-border">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="truncate">{displayName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/profile">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={handleSignOut}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
