/*
# Add Interest-Based Personalization

1. New Columns
- `profiles.interests` (text[], nullable, default '{}') — stores student interest selections (e.g. ['AI / Machine Learning', 'Music']).
  Only students use this field; society_admin and college_admin profiles leave it empty.
- `notices.target_interests` (text[], nullable, default null) — optional interest tags admins select when creating a notice.
  When null/empty, all eligible students are notified (existing behavior unchanged).
- `events.target_interests` (text[], nullable, default null) — optional interest tags for events.
- `announcements.target_interests` (text[], nullable, default null) — optional interest tags for announcements.

2. Security
- No new policies needed — existing RLS policies on profiles, notices, events, and announcements remain unchanged.
- Students can update their own `interests` via the existing profile UPDATE policy.
- Admins/society admins can set `target_interests` via existing INSERT/UPDATE policies on content tables.

3. Important Notes
- All columns are nullable/defaulted so existing rows and existing users continue working normally.
- The interests array uses a predefined list enforced at the application layer (not a DB constraint) for flexibility.
- No existing columns are modified or removed.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}';
ALTER TABLE notices ADD COLUMN IF NOT EXISTS target_interests text[];
ALTER TABLE events ADD COLUMN IF NOT EXISTS target_interests text[];
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_interests text[];
