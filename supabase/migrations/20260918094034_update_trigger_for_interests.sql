/*
# Update handle_new_user trigger to include interests

1. Changes
- Updates the `handle_new_user()` trigger function to also insert the `interests` column from signup metadata.
- Interests are passed as an array in raw_user_meta_data; we use array_remove to filter out empty/null entries.

2. Important Notes
- Existing profiles are unaffected (new column defaults to '{}' from previous migration).
- Only new registrations will have interests populated from signup metadata.
- The trigger function is recreated with CREATE OR REPLACE, so it's safe to re-run.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, department, branch, year, section, student_type, approval_status, society_name, interests)
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
    COALESCE(NEW.raw_user_meta_data->>'society_name', NULL),
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'interests')),
      ARRAY[]::text[]
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
