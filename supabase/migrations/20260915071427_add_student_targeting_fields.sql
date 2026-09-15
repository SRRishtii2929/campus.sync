/*
# Add student targeting fields and notice targeting columns

1. Modified Tables
- `profiles` — add three nullable columns for student targeting:
  - `branch` (text) — student's branch (e.g. CSE, CSAI, etc.)
  - `year` (text) — student's year (e.g. 1st Year, 2nd Year, etc.)
  - `section` (text) — student's section (e.g. 1, 2, 3)
- `notices` — add two nullable columns for notice targeting:
  - `target_branches` (text[]) — array of target branches; null means general/all
  - `target_years` (text[]) — array of target years; null means general/all

2. New Tables
- `notifications` — stores per-user notifications for targeted notices:
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, NOT NULL)
  - `notice_id` (uuid, references notices, ON DELETE CASCADE)
  - `title` (text, NOT NULL)
  - `description` (text, NOT NULL)
  - `read` (boolean, default false)
  - `created_at` (timestamptz, default now())

3. Security
- RLS enabled on `notifications`.
- Each authenticated user can SELECT, UPDATE only their own notifications.
- INSERT/DELETE not allowed from the client (managed by edge function / server).

4. Notes
- All new columns are nullable so existing profiles and notices remain valid.
- No existing data is altered or deleted.
- The trigger function `handle_new_user` is updated to also store branch, year, section from signup metadata.
*/

-- Add student targeting columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS branch text,
  ADD COLUMN IF NOT EXISTS year text,
  ADD COLUMN IF NOT EXISTS section text;

-- Add targeting columns to notices
ALTER TABLE notices
  ADD COLUMN IF NOT EXISTS target_branches text[],
  ADD COLUMN IF NOT EXISTS target_years text[];

-- Update the trigger function to include branch, year, section
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, department, branch, year, section)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'department', 'General'),
    COALESCE(NEW.raw_user_meta_data->>'branch', NULL),
    COALESCE(NEW.raw_user_meta_data->>'year', NULL),
    COALESCE(NEW.raw_user_meta_data->>'section', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notice_id uuid REFERENCES notices(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_notice_id ON notifications(notice_id);