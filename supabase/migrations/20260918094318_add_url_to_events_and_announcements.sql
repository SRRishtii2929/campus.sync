/*
# Add URL field to Events and Announcements

1. New Columns
- `events.registration_url` (text, nullable) — optional external link for event registration or more details.
- `announcements.registration_url` (text, nullable) — optional external link for announcement registration or more details.

2. Important Notes
- Both columns are nullable so existing rows are unaffected.
- No existing columns are modified or removed.
- No RLS policy changes needed — existing policies cover the new columns automatically.
*/

ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_url text;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS registration_url text;
