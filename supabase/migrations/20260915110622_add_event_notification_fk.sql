/*
# Add event_id FK column to notifications table

1. Modified Tables
- `notifications` — add `event_id` (uuid, references events, ON DELETE CASCADE)
  - Allows notifications to be linked to targeted events, mirroring the existing notice_id and announcement_id FK columns.

2. Notes
- Column is nullable so existing notifications remain valid.
- No existing data is altered or deleted.
*/

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES events(id) ON DELETE CASCADE;
