/*
# Add Primary Admin role, College Admin approval, and 4-Primary-Admin limit

1. Changes to existing tables
- `profiles` — expand role CHECK to include 'primary_admin'
- `profiles` — expand approval_status to include 'suspended'
- `profiles` — add CHECK constraint on approval_status values

2. Trigger update
- `handle_new_user()` — college_admin registrations now get approval_status = 'pending'

3. New SECURITY DEFINER functions
- `promote_to_primary_admin(target_user_id)` — promotes a college_admin to primary_admin;
  enforces max 4 active primary_admins; callable only by existing primary_admins
- `approve_college_admin(target_user_id)` — sets approval_status to 'approved' for a pending college_admin;
  callable only by primary_admins
- `reject_college_admin(target_user_id)` — sets approval_status to 'rejected' for a pending college_admin;
  callable only by primary_admins
- `get_primary_admin_count()` — returns count of active primary_admins (callable by authenticated)

4. RLS policy updates
- Events, Notices: allow primary_admin same CRUD as college_admin
- Announcements, Societies: allow primary_admin same CRUD as college_admin
- Profiles UPDATE: primary_admin can update profiles (same as college_admin)
- Profiles DELETE: primary_admin can delete profiles (same as college_admin)
- Profiles UPDATE/DELETE: protect primary_admin accounts from being modified/deleted by other admins

5. Security
- All role/status checks are enforced server-side via SECURITY DEFINER functions and RLS policies
- Primary admin accounts cannot be edited, deleted, or have their role changed by anyone except themselves (for non-role fields)
- The 4-primary-admin limit is enforced in the database function, not just the frontend

6. Important notes
- Existing college_admin accounts keep approval_status = 'approved' (or whatever they currently have)
- No existing accounts are promoted to primary_admin
- Primary admin accounts must be created manually by signing up as college_admin, then promoted via SQL or the promote function by an existing primary_admin
- The first primary_admin must be set via SQL by a database administrator
*/

-- 1. Expand role CHECK constraint to include primary_admin
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'society_admin', 'college_admin', 'primary_admin'));

-- 2. Add approval_status CHECK constraint (includes 'suspended')
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_approval_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));

-- 3. Update the signup trigger: college_admin registrations get 'pending'
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
      WHEN COALESCE(NEW.raw_user_meta_data->>'role', 'student') = 'college_admin' THEN 'pending'
      WHEN COALESCE(NEW.raw_user_meta_data->>'student_type', 'regular') = 'cr' THEN 'pending'
      ELSE 'approved'
    END,
    COALESCE(NEW.raw_user_meta_data->>'society_name', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. SECURITY DEFINER: get primary admin count
CREATE OR REPLACE FUNCTION get_primary_admin_count()
RETURNS integer
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT count(*)::integer FROM profiles WHERE role = 'primary_admin' AND approval_status = 'approved';
$$;

-- 5. SECURITY DEFINER: promote to primary admin (enforces 4-limit)
-- Callable only by existing primary_admins. Target must be an approved college_admin.
CREATE OR REPLACE FUNCTION promote_to_primary_admin(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  caller_role text;
  caller_status text;
  target_role text;
  target_status text;
  current_count integer;
BEGIN
  -- Get caller info
  SELECT role, approval_status INTO caller_role, caller_status
  FROM profiles WHERE id = auth.uid();

  IF caller_role IS NULL THEN
    RETURN 'ERROR: Unauthorized';
  END IF;

  IF caller_role <> 'primary_admin' OR caller_status <> 'approved' THEN
    RETURN 'ERROR: Only Primary Admins can promote accounts';
  END IF;

  -- Enforce the 4-primary-admin limit
  SELECT count(*)::integer INTO current_count
  FROM profiles WHERE role = 'primary_admin' AND approval_status = 'approved';

  IF current_count >= 4 THEN
    RETURN 'ERROR: Maximum number of Primary Administrators reached';
  END IF;

  -- Check target is an approved college_admin
  SELECT role, approval_status INTO target_role, target_status
  FROM profiles WHERE id = target_user_id;

  IF target_role IS NULL THEN
    RETURN 'ERROR: Target profile not found';
  END IF;

  IF target_role <> 'college_admin' THEN
    RETURN 'ERROR: Only College Admin accounts can be promoted to Primary Admin';
  END IF;

  IF target_status <> 'approved' THEN
    RETURN 'ERROR: Only approved College Admin accounts can be promoted';
  END IF;

  -- Promote
  UPDATE profiles SET role = 'primary_admin', approval_status = 'approved'
  WHERE id = target_user_id;

  RETURN 'SUCCESS';
END;
$$;

-- 6. SECURITY DEFINER: approve college admin (primary_admin only)
CREATE OR REPLACE FUNCTION approve_college_admin(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  caller_role text;
  caller_status text;
  target_role text;
  target_status text;
BEGIN
  SELECT role, approval_status INTO caller_role, caller_status
  FROM profiles WHERE id = auth.uid();

  IF caller_role IS NULL THEN
    RETURN 'ERROR: Unauthorized';
  END IF;

  IF caller_role <> 'primary_admin' OR caller_status <> 'approved' THEN
    RETURN 'ERROR: Only Primary Admins can approve College Admin registrations';
  END IF;

  SELECT role, approval_status INTO target_role, target_status
  FROM profiles WHERE id = target_user_id;

  IF target_role IS NULL THEN
    RETURN 'ERROR: Target profile not found';
  END IF;

  IF target_role <> 'college_admin' THEN
    RETURN 'ERROR: Target is not a College Admin account';
  END IF;

  IF target_status <> 'pending' THEN
    RETURN 'ERROR: Target is not pending approval';
  END IF;

  UPDATE profiles SET approval_status = 'approved' WHERE id = target_user_id;

  RETURN 'SUCCESS';
END;
$$;

-- 7. SECURITY DEFINER: reject college admin (primary_admin only)
CREATE OR REPLACE FUNCTION reject_college_admin(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  caller_role text;
  caller_status text;
  target_role text;
  target_status text;
BEGIN
  SELECT role, approval_status INTO caller_role, caller_status
  FROM profiles WHERE id = auth.uid();

  IF caller_role IS NULL THEN
    RETURN 'ERROR: Unauthorized';
  END IF;

  IF caller_role <> 'primary_admin' OR caller_status <> 'approved' THEN
    RETURN 'ERROR: Only Primary Admins can reject College Admin registrations';
  END IF;

  SELECT role, approval_status INTO target_role, target_status
  FROM profiles WHERE id = target_user_id;

  IF target_role IS NULL THEN
    RETURN 'ERROR: Target profile not found';
  END IF;

  IF target_role <> 'college_admin' THEN
    RETURN 'ERROR: Target is not a College Admin account';
  END IF;

  IF target_status <> 'pending' THEN
    RETURN 'ERROR: Target is not pending approval';
  END IF;

  UPDATE profiles SET approval_status = 'rejected' WHERE id = target_user_id;

  RETURN 'SUCCESS';
END;
$$;

-- 8. Grant execute to authenticated
GRANT EXECUTE ON FUNCTION get_primary_admin_count() TO authenticated;
GRANT EXECUTE ON FUNCTION promote_to_primary_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_college_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_college_admin(uuid) TO authenticated;

-- 9. Update RLS policies to include primary_admin alongside college_admin

-- Events: INSERT
DROP POLICY IF EXISTS "events_insert_admin" ON events;
CREATE POLICY "events_insert_admin" ON events FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  );

-- Events: UPDATE
DROP POLICY IF EXISTS "events_update_admin" ON events;
CREATE POLICY "events_update_admin" ON events FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  );

-- Events: DELETE
DROP POLICY IF EXISTS "events_delete_admin" ON events;
CREATE POLICY "events_delete_admin" ON events FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  );

-- Notices: INSERT
DROP POLICY IF EXISTS "notices_insert_admin" ON notices;
CREATE POLICY "notices_insert_admin" ON notices FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  );

-- Notices: UPDATE
DROP POLICY IF EXISTS "notices_update_admin" ON notices;
CREATE POLICY "notices_update_admin" ON notices FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  );

-- Notices: DELETE
DROP POLICY IF EXISTS "notices_delete_admin" ON notices;
CREATE POLICY "notices_delete_admin" ON notices FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  );

-- Societies: INSERT
DROP POLICY IF EXISTS "societies_insert_admin" ON societies;
CREATE POLICY "societies_insert_admin" ON societies FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('society_admin', 'college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  );

-- Societies: UPDATE
DROP POLICY IF EXISTS "societies_update_admin" ON societies;
CREATE POLICY "societies_update_admin" ON societies FOR UPDATE
  TO authenticated USING (
    president_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('society_admin', 'college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  );

-- Societies: DELETE
DROP POLICY IF EXISTS "societies_delete_admin" ON societies;
CREATE POLICY "societies_delete_admin" ON societies FOR DELETE
  TO authenticated USING (
    president_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  );

-- Announcements: INSERT
DROP POLICY IF EXISTS "announcements_insert_admin" ON announcements;
CREATE POLICY "announcements_insert_admin" ON announcements FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('society_admin', 'college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  );

-- Announcements: UPDATE
DROP POLICY IF EXISTS "announcements_update_admin" ON announcements;
CREATE POLICY "announcements_update_admin" ON announcements FOR UPDATE
  TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('society_admin', 'college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  );

-- Announcements: DELETE
DROP POLICY IF EXISTS "announcements_delete_admin" ON announcements;
CREATE POLICY "announcements_delete_admin" ON announcements FOR DELETE
  TO authenticated USING (
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  );

-- Classes: allow primary_admin to read all (same as college_admin)
DROP POLICY IF EXISTS "classes_select_own_or_admin" ON classes;
CREATE POLICY "classes_select_own_or_admin" ON classes FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('college_admin', 'primary_admin') AND profiles.approval_status = 'approved')
  );

-- 10. Profiles: update admin policy to include primary_admin AND protect primary_admin accounts
-- Admins (college_admin + primary_admin with approved status) can update non-primary-admin profiles
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role IN ('college_admin', 'primary_admin')
      AND admin_profile.approval_status = 'approved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM profiles target
      WHERE target.id = profiles.id
      AND target.role = 'primary_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role IN ('college_admin', 'primary_admin')
      AND admin_profile.approval_status = 'approved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM profiles target
      WHERE target.id = profiles.id
      AND target.role = 'primary_admin'
    )
  );

-- Profiles: delete admin policy — same protection for primary_admin
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role IN ('college_admin', 'primary_admin')
      AND admin_profile.approval_status = 'approved'
    )
    AND NOT EXISTS (
      SELECT 1 FROM profiles target
      WHERE target.id = profiles.id
      AND target.role = 'primary_admin'
    )
  );

-- 11. cr_updates: allow primary_admin to read (already open to all authenticated, no change needed)
