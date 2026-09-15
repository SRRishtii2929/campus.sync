/*
# Campus Sync - Complete Database Schema

Creates the full schema for the Campus Sync college management platform.

1. New Tables
- `profiles` — extends auth.users with role (student, society_admin, college_admin), full_name, department
- `classes` — student timetable entries with day, start_time, end_time, subject, room
- `events` — college events with title, description, date, start_time, end_time, location, organizer
- `notices` — official college notices with title, description, date, department, deadline, attachment_url
- `announcements` — society announcements with title, content, society_name, date
- `societies` — student societies with name, description, president_id

2. Security
- RLS enabled on all tables
- Profiles: users can read all profiles, update only their own
- Classes: students CRUD their own classes; college_admin can read all
- Events: all authenticated can read; college_admin can CRUD
- Notices: all authenticated can read; college_admin can CRUD
- Announcements: all authenticated can read; society_admin can CRUD their own
- Societies: all authenticated can read; society_admin can CRUD their own

3. Role-based access
- Roles stored in profiles.role column
- College admin can manage events and notices
- Society admin can manage announcements and societies
- Students can manage their own classes/timetable
*/

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'society_admin', 'college_admin')),
  department text DEFAULT 'General',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Classes table (student timetable)
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  day_of_week text NOT NULL CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  date date,
  start_time time NOT NULL,
  end_time time NOT NULL,
  room text DEFAULT 'TBD',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "classes_select_own_or_admin" ON classes;
CREATE POLICY "classes_select_own_or_admin" ON classes FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'college_admin'));

DROP POLICY IF EXISTS "classes_insert_own" ON classes;
CREATE POLICY "classes_insert_own" ON classes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "classes_update_own" ON classes;
CREATE POLICY "classes_update_own" ON classes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "classes_delete_own" ON classes;
CREATE POLICY "classes_delete_own" ON classes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_classes_user_id ON classes(user_id);
CREATE INDEX IF NOT EXISTS idx_classes_date ON classes(date);

-- Events table (college events)
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text DEFAULT 'TBD',
  organizer text DEFAULT 'College Administration',
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select_all" ON events;
CREATE POLICY "events_select_all" ON events FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "events_insert_admin" ON events;
CREATE POLICY "events_insert_admin" ON events FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'college_admin'));

DROP POLICY IF EXISTS "events_update_admin" ON events;
CREATE POLICY "events_update_admin" ON events FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'college_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'college_admin'));

DROP POLICY IF EXISTS "events_delete_admin" ON events;
CREATE POLICY "events_delete_admin" ON events FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'college_admin'));

CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- Notices table (official college notices)
CREATE TABLE IF NOT EXISTS notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  date date NOT NULL,
  department text NOT NULL DEFAULT 'All',
  deadline date,
  attachment_url text,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notices_select_all" ON notices;
CREATE POLICY "notices_select_all" ON notices FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "notices_insert_admin" ON notices;
CREATE POLICY "notices_insert_admin" ON notices FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'college_admin'));

DROP POLICY IF EXISTS "notices_update_admin" ON notices;
CREATE POLICY "notices_update_admin" ON notices FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'college_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'college_admin'));

DROP POLICY IF EXISTS "notices_delete_admin" ON notices;
CREATE POLICY "notices_delete_admin" ON notices FOR DELETE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'college_admin'));

CREATE INDEX IF NOT EXISTS idx_notices_date ON notices(date);

-- Societies table
CREATE TABLE IF NOT EXISTS societies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  president_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE societies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "societies_select_all" ON societies;
CREATE POLICY "societies_select_all" ON societies FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "societies_insert_admin" ON societies;
CREATE POLICY "societies_insert_admin" ON societies FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('society_admin', 'college_admin')));

DROP POLICY IF EXISTS "societies_update_admin" ON societies;
CREATE POLICY "societies_update_admin" ON societies FOR UPDATE
  TO authenticated USING (
    president_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'college_admin')
  )
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('society_admin', 'college_admin')));

DROP POLICY IF EXISTS "societies_delete_admin" ON societies;
CREATE POLICY "societies_delete_admin" ON societies FOR DELETE
  TO authenticated USING (
    president_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'college_admin')
  );

-- Announcements table (society announcements)
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  society_name text NOT NULL,
  date date NOT NULL,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_select_all" ON announcements;
CREATE POLICY "announcements_select_all" ON announcements FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "announcements_insert_admin" ON announcements;
CREATE POLICY "announcements_insert_admin" ON announcements FOR INSERT
  TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('society_admin', 'college_admin')));

DROP POLICY IF EXISTS "announcements_update_admin" ON announcements;
CREATE POLICY "announcements_update_admin" ON announcements FOR UPDATE
  TO authenticated USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'college_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('society_admin', 'college_admin')));

DROP POLICY IF EXISTS "announcements_delete_admin" ON announcements;
CREATE POLICY "announcements_delete_admin" ON announcements FOR DELETE
  TO authenticated USING (created_by = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'college_admin'));

CREATE INDEX IF NOT EXISTS idx_announcements_date ON announcements(date);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, department)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'), COALESCE(NEW.raw_user_meta_data->>'role', 'student'), COALESCE(NEW.raw_user_meta_data->>'department', 'General'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();