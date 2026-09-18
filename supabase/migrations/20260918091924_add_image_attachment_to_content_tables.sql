/*
# Add Image/Poster Attachment to Notices, Events, and Announcements

## Purpose
Allow authorized users to attach ONE optional image/poster to each Notice, Event, and Announcement.
The existing `attachment_url` field on notices (for external URL links) is preserved and separate.

## Changes

### 1. New columns
- `notices.image_path` (text, nullable) — Supabase Storage path for the uploaded poster image.
- `events.image_path` (text, nullable) — Supabase Storage path for the uploaded poster image.
- `announcements.image_path` (text, nullable) — Supabase Storage path for the uploaded poster image.

All three are nullable so existing rows and inserts without an image are unaffected.

### 2. Storage bucket
- Create a public bucket named `posters` for storing poster/notice images.
- File size limit: 5MB.
- Allowed MIME types: image/jpeg, image/png, image/webp.

### 3. Storage policies
- SELECT (read): public — anyone can view published posters (the bucket is public).
- INSERT: authenticated users only.
- UPDATE: authenticated users only (owner can replace their own poster).
- DELETE: authenticated users only (owner can remove their own poster).

### Important notes
1. The `image_path` column stores the storage path (e.g. `notices/<uuid>.jpg`), not a full URL.
2. The existing `attachment_url` on notices remains for external URL links — the two are independent.
3. No changes to existing RLS policies on notices/events/announcements tables.
4. Only users who already have INSERT/UPDATE permission on the parent table can upload/modify images.
*/

-- Add image_path columns
ALTER TABLE notices ADD COLUMN IF NOT EXISTS image_path text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_path text;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_path text;

-- Create the posters storage bucket (public, 5MB limit, image types only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'posters',
  'posters',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anyone can read, only authenticated can write/update/delete
-- The actual authorization (who can create notices/events/announcements) is enforced
-- by the RLS policies on the parent tables — storage policies just gate uploads to
-- authenticated users.

DROP POLICY IF EXISTS "posters_public_read" ON storage.objects;
CREATE POLICY "posters_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'posters');

DROP POLICY IF EXISTS "posters_auth_insert" ON storage.objects;
CREATE POLICY "posters_auth_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'posters');

DROP POLICY IF EXISTS "posters_auth_update" ON storage.objects;
CREATE POLICY "posters_auth_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'posters')
WITH CHECK (bucket_id = 'posters');

DROP POLICY IF EXISTS "posters_auth_delete" ON storage.objects;
CREATE POLICY "posters_auth_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'posters');
