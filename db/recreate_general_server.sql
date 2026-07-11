-- ========================================================================
-- RECREATE GENERAL SERVER & ADD MEMBERS
-- ========================================================================
-- If you accidentally deleted the General server in your Supabase DB,
-- copy and paste this SQL query into your Supabase SQL Editor and click Run.
-- ========================================================================

-- 1. Insert the General server with the static UUID.
-- Note: Replace 'your_admin_user_id' with a valid UUID of any user from your users table.
INSERT INTO public.servers (id, name, description, owner_id, is_public)
VALUES (
  '00000000-0000-0000-0000-000000000000', 
  'General', 
  'Default server for all members', 
  (SELECT id FROM public.users LIMIT 1), -- automatically assigns the first user as the owner
  true
)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert the general channel for the server
INSERT INTO public.chatrooms (server_id, name, is_general, description)
VALUES (
  '00000000-0000-0000-0000-000000000000', 
  'general', 
  true, 
  'General chatroom'
)
ON CONFLICT (server_id, is_general) DO NOTHING;

-- 3. Add all existing registered users back to the General server membership list
INSERT INTO public.server_members (user_id, server_id, username, avatar_url)
SELECT id, '00000000-0000-0000-0000-000000000000', username, COALESCE(avatar_url, '')
FROM public.users
ON CONFLICT (user_id, server_id) DO NOTHING;
