'use client'

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useUserStore } from '@/stores/user-store'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const profileSchema = z.object({
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(40, 'Display name must be 40 characters or fewer'),
})

type ProfileFormValues = z.infer<typeof profileSchema>

const AVATARS_BUCKET = 'avatars'

export default function ProfilePage(): React.ReactElement {
  const user = useUserStore((s) => s.user)
  const profile = useUserStore((s) => s.profile)
  const setProfile = useUserStore((s) => s.setProfile)

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: profile?.display_name ?? '',
    },
  })

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Trainer'
  const initials = displayName.slice(0, 2).toUpperCase()

  async function onSubmit(values: ProfileFormValues): Promise<void> {
    if (!user) return
    const supabase = createClient()

    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: values.display_name, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      toast.error('Failed to update profile')
      return
    }

    setProfile(data)
    toast.success('Profile updated')
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    if (!file || !user) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Avatar must be smaller than 2 MB')
      return
    }

    setAvatarUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const storagePath = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(storagePath, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      toast.error('Avatar upload failed')
      setAvatarUploading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from(AVATARS_BUCKET)
      .getPublicUrl(storagePath)

    const publicUrl = urlData.publicUrl

    const { data, error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single()

    if (profileError) {
      toast.error('Failed to save avatar URL')
    } else {
      setProfile(data)
      setAvatarUrl(publicUrl)
      toast.success('Avatar updated')
    }

    setAvatarUploading(false)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black uppercase tracking-tighter">Profile</h1>
        <p className="text-muted-foreground">Your account and settings</p>
      </div>

      <Separator className="mb-8" />

      <div className="flex max-w-lg flex-col gap-6">
        {/* Avatar */}
        <Card className="border-2 border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wide">Avatar</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <Avatar className="h-16 w-16 border-2 border-border">
              <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback className="text-xl font-black">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={avatarUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUploading ? 'Uploading…' : 'Change Avatar'}
              </Button>
              <p className="text-xs text-muted-foreground">PNG, JPG or GIF · max 2 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Display name */}
        <Card className="border-2 border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wide">
              Display Name
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="display_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="AshKetchum" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="self-start"
                >
                  {form.formState.isSubmitting ? 'Saving…' : 'Save'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Account info (read-only) */}
        <Card className="border-2 border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wide">Account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-mono">{user?.email ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">User ID</span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {user?.id ?? '—'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
