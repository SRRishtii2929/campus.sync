import { supabase } from '@/lib/supabase';

const BUCKET = 'posters';

/**
 * Uploads an image file to the posters bucket.
 * Returns the storage path on success, or null on failure.
 */
export async function uploadImage(file: File, folder: string): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false,
  });

  if (error) return null;
  return fileName;
}

/**
 * Deletes an image from the posters bucket by its storage path.
 * Best-effort — does not throw on failure.
 */
export async function deleteImage(path: string): Promise<void> {
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // best-effort cleanup
  }
}
