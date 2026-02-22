import { createClient } from './server'

export type AuthResult =
  | { user: import('@supabase/supabase-js').User; error: null }
  | { user: null; error: string }

export async function getUser(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return { user: null, error: error?.message ?? 'Not authenticated' }
  }

  return { user: data.user, error: null }
}

export async function requireUser(): Promise<import('@supabase/supabase-js').User> {
  const { user, error } = await getUser()
  if (!user) {
    throw new Error(error ?? 'Not authenticated')
  }
  return user
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
