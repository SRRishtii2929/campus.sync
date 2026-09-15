/*
# Add targeting columns to events table

1. Modified Tables
- `events` — add two nullable columns for event targeting:
  - `target_branches` (text[]) — array of target branches; null means general/all
  - `target_years` (text[]) — array of target years; null means general/all

2. Notes
- All new columns are nullable so existing events remain valid.
- No existing data is altered or deleted.
- Mirrors the same targeting pattern already used on notices and announcements.
*/

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS target_branches text[],
  ADD COLUMN IF NOT EXISTS target_years text[];
