-- Add announcement_id and cr_update_id columns to notifications
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS announcement_id uuid REFERENCES announcements(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cr_update_id uuid REFERENCES cr_updates(id) ON DELETE CASCADE;
