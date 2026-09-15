/*
# Create chatbot_history table for per-user Campus Buddy conversations

1. New Tables
- `chatbot_history`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users ON DELETE CASCADE)
  - `role` (text, not null — 'user' or 'buddy')
  - `text` (text, not null — the message content)
  - `action_path` (text, nullable — navigation path if the response includes an action)
  - `action_highlight` (text, nullable — highlight target for the action)
  - `action_label` (text, nullable — label for the action button)
  - `created_at` (timestamptz, defaults to now())

2. Security
- Enable RLS on `chatbot_history`.
- Owner-scoped CRUD: each authenticated user can only read, insert, and delete their own chat messages.
- No anon access — only authenticated users (the app requires sign-in).

3. Notes
- Each user sees only their own chat history. No cross-user visibility.
- Messages are ordered by created_at to reconstruct conversation flow.
*/

CREATE TABLE IF NOT EXISTS chatbot_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'buddy')),
  text text NOT NULL,
  action_path text,
  action_highlight text,
  action_label text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chatbot_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chatbot_history" ON chatbot_history;
CREATE POLICY "select_own_chatbot_history" ON chatbot_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_chatbot_history" ON chatbot_history;
CREATE POLICY "insert_own_chatbot_history" ON chatbot_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_chatbot_history" ON chatbot_history;
CREATE POLICY "delete_own_chatbot_history" ON chatbot_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chatbot_history_user_created ON chatbot_history(user_id, created_at);
