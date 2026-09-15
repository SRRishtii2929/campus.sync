/*
# Add event detail fields to announcements

1. Modified Tables
- `announcements` — add four nullable columns:
  - `event_date` (date) — optional date of the society event
  - `event_time` (time) — optional time of the society event
  - `registration_deadline` (date) — optional registration cutoff date
  - `event_location` (text) — optional event location/venue
2. Security
- No RLS policy changes. Existing policies still apply.
3. Notes
- All new columns are nullable so existing announcements remain valid.
- No existing data is altered or deleted.
*/

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS event_time time,
  ADD COLUMN IF NOT EXISTS registration_deadline date,
  ADD COLUMN IF NOT EXISTS event_location text;

/*
# Remove college_admin edit permission from announcements

1. Security Changes
- UPDATE policy on `announcements` tightened: only the original creator (society_admin) can edit.
- College admins can no longer UPDATE announcements. They retain INSERT and DELETE.
- DELETE policy unchanged (college_admin can still delete).
2. Notes
- This enforces requirement 3 at the database level.
*/

DROP POLICY IF EXISTS "announcements_update_admin" ON announcements;
CREATE POLICY "announcements_update_admin" ON announcements FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
