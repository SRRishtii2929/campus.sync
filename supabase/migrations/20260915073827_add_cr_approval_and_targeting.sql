-- Add student_type and approval_status to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS student_type text DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'approved';

-- Set existing profiles: college_admin and society_admin get 'approved' (society_admin may need re-approval but existing ones keep working)
-- New society_admin registrations get 'pending'
-- We'll handle the logic via the trigger

-- Update handle_new_user to include student_type and approval_status
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, department, branch, year, section, student_type, approval_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'department', 'General'),
    COALESCE(NEW.raw_user_meta_data->>'branch', NULL),
    COALESCE(NEW.raw_user_meta_data->>'year', NULL),
    COALESCE(NEW.raw_user_meta_data->>'section', NULL),
    COALESCE(NEW.raw_user_meta_data->>'student_type', 'regular'),
    CASE
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'student') = 'society_admin' THEN 'pending'
      WHEN COALESCE(NEW.raw_user_meta_data->>'student_type', 'regular') = 'cr' THEN 'pending'
      ELSE 'approved'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add targeting columns to announcements
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS target_branches text[],
  ADD COLUMN IF NOT EXISTS target_years text[];

-- Create cr_updates table
CREATE TABLE IF NOT EXISTS cr_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cr_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch text NOT NULL,
  year text NOT NULL,
  section text NOT NULL,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time,
  subject text NOT NULL,
  location text,
  update_type text NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cr_updates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can SELECT (filtering by branch/year/section done in app)
DROP POLICY IF EXISTS "cr_updates_select" ON cr_updates;
CREATE POLICY "cr_updates_select" ON cr_updates FOR SELECT
  TO authenticated USING (true);

-- Only the CR who created it can INSERT
DROP POLICY IF EXISTS "cr_updates_insert_own" ON cr_updates;
CREATE POLICY "cr_updates_insert_own" ON cr_updates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = cr_id);

-- Only the CR who created it can DELETE
DROP POLICY IF EXISTS "cr_updates_delete_own" ON cr_updates;
CREATE POLICY "cr_updates_delete_own" ON cr_updates FOR DELETE
  TO authenticated USING (auth.uid() = cr_id);

CREATE INDEX IF NOT EXISTS idx_cr_updates_branch_year_section ON cr_updates(branch, year, section);
CREATE INDEX IF NOT EXISTS idx_cr_updates_date ON cr_updates(date);

-- Allow profiles update (for approval_status changes by college admin)
-- Already have RLS on profiles; need UPDATE policy for college_admin
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'college_admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'college_admin'
    )
  );
