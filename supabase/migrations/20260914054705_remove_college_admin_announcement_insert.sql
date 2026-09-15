/*
# Remove college_admin INSERT permission on announcements

1. Security Changes
- INSERT policy on `announcements` tightened: only society_admin can create announcements.
- College admins can no longer INSERT announcements. They retain DELETE only.
- Society admin INSERT and UPDATE/DELETE (own) permissions unchanged.
2. Notes
- No existing data is altered or deleted.
- This enforces requirement 3 at the database level.
*/

DROP POLICY IF EXISTS "announcements_insert_admin" ON announcements;
CREATE POLICY "announcements_insert_admin" ON announcements FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'society_admin'));
