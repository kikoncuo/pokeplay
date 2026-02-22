import { createClient } from './client'

const IMAGES_BUCKET = 'rom-images'
const ROMS_BUCKET = 'shared-roms'

export async function uploadListingImage(
  userId: string,
  sha1: string,
  file: File
): Promise<string> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${userId}/${sha1}.${ext}`

  const { error } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
    })

  if (error) throw new Error(`Upload image failed: ${error.message}`)

  const { data: urlData } = supabase.storage
    .from(IMAGES_BUCKET)
    .getPublicUrl(path)

  // Append cache-buster to force refresh
  return `${urlData.publicUrl}?t=${Date.now()}`
}

export async function uploadSharedRom(
  userId: string,
  sha1: string,
  data: Uint8Array
): Promise<string> {
  const supabase = createClient()
  const path = `${userId}/${sha1}.bin`

  const { error } = await supabase.storage
    .from(ROMS_BUCKET)
    .upload(path, data, {
      contentType: 'application/octet-stream',
      upsert: true,
    })

  if (error) throw new Error(`Upload ROM failed: ${error.message}`)

  return path
}

export async function downloadSharedRom(storagePath: string): Promise<Uint8Array> {
  const supabase = createClient()

  const { data, error } = await supabase.storage
    .from(ROMS_BUCKET)
    .download(storagePath)

  if (error) throw new Error(`Download ROM failed: ${error.message}`)

  const buffer = await data.arrayBuffer()
  return new Uint8Array(buffer)
}

export async function deleteSharedRom(storagePath: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.storage
    .from(ROMS_BUCKET)
    .remove([storagePath])

  if (error) throw new Error(`Delete ROM failed: ${error.message}`)
}
