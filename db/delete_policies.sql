-- ========================================================================
-- SUPABASE POSTGRESQL DELETE POLICIES
-- ========================================================================
-- Enables message deletion for message senders and global admins.
-- Run this script in your Supabase SQL Editor.
-- ========================================================================

-- 1. Enable Delete for server_messages
CREATE POLICY "Allow users to delete their own messages or admins to delete any" 
  ON public.server_messages FOR DELETE USING (
    auth.uid() = sender_id OR 
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
  );

-- 2. Enable Delete for direct_messages
CREATE POLICY "Allow users to delete their own messages or admins to delete any" 
  ON public.direct_messages FOR DELETE USING (
    auth.uid() = sender_id OR 
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = true
  );
