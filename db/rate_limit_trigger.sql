-- ========================================================================
-- SUPABASE POSTGRESQL RATE-LIMIT SPAM FILTER
-- ========================================================================
-- Enforces a strict 1 message per second limit for regular users.
-- Admins (users with is_admin = true) are completely exempt.
-- ========================================================================

-- 1. Create function to check insert intervals
CREATE OR REPLACE FUNCTION public.check_message_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  is_sender_admin BOOLEAN;
BEGIN
  -- Fetch the admin status of the sender
  SELECT is_admin INTO is_sender_admin FROM public.users WHERE id = auth.uid();
  
  -- Apply rate limit checks only if the user is not an admin
  IF is_sender_admin = false OR is_sender_admin IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.server_messages 
      WHERE sender_id = auth.uid() 
        AND created_at >= (now() - interval '1 second')
    ) OR EXISTS (
      SELECT 1 FROM public.direct_messages
      WHERE sender_id = auth.uid()
        AND created_at >= (now() - interval '1 second')
    ) THEN
      RAISE EXCEPTION 'Rate limit exceeded: 1 message per second limit';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing triggers if they exist to avoid duplicates
DROP TRIGGER IF EXISTS tr_check_server_msg_rate ON public.server_messages;
DROP TRIGGER IF EXISTS tr_check_dm_rate ON public.direct_messages;

-- 3. Attach trigger to server_messages
CREATE TRIGGER tr_check_server_msg_rate
  BEFORE INSERT ON public.server_messages
  FOR EACH ROW EXECUTE FUNCTION public.check_message_rate_limit();

-- 4. Attach trigger to direct_messages
CREATE TRIGGER tr_check_dm_rate
  BEFORE INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.check_message_rate_limit();
