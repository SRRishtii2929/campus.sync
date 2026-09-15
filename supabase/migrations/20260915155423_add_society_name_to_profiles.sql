/*
# Add society_name to profiles for Society Admin registration

1. Changes to existing tables
- `profiles` — add `society_name` column (text, nullable) for society admin accounts
- Unique constraint on `society_name` so no two society admins can share the same society name

2. Trigger update
- `handle_new_user()` — insert society_name from raw_user_meta_data on signup

3. Security
- No RLS policy changes needed; existing profiles policies remain intact.

4. Notes
- Society Name is used as the identifying name for the Society Admin account instead of an individual person's name.
- The unique constraint is case-insensitive via a unique index on lower(society_name).
- Only non-null society_name values are constrained (students and college admins have NULL society_name).
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS society_name text;

-- Unique index on society_name (only where non-null, case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_society_name_unique
  ON profiles (lower(society_name))
  WHERE society_name IS NOT NULL;

-- Update the trigger function to include society_name
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, department, branch, year, section, student_type, approval_status, society_name)
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
    END,
    COALESCE(NEW.raw_user_meta_data->>'society_name', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow college admin to delete profile rows (for account management)
-- The existing profiles_update_admin policy covers UPDATE, but we need DELETE too
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'college_admin'
    )
  );
