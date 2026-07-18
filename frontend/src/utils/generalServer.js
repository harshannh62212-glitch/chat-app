import { supabase } from '../supabase';

export const GENERAL_SERVER_ID = 1;

/**
 * Ensures the General server exists and the user is added to it.
 * This heals any accidental deletions in the database automatically.
 * 
 * @param {string} userId - The user's UUID.
 * @param {string} username - The user's username.
 * @param {string} avatarUrl - The user's avatar URL.
 */
export async function ensureGeneralServerAndMembership(userId, username, avatarUrl) {
  try {
    // 1. Ensure default "General" server exists
    const { data: srvData } = await supabase
      .from('servers')
      .select('id')
      .eq('id', GENERAL_SERVER_ID)
      .maybeSingle();

    if (!srvData) {
      // Re-create the General server
      await supabase.from('servers').insert({
        id: GENERAL_SERVER_ID,
        name: 'General',
        description: 'Default server for all wired-io members',
        owner_id: userId,
        is_public: true
      });

      // Re-create the general channel inside it
      await supabase.from('chatrooms').insert({
        server_id: GENERAL_SERVER_ID,
        name: 'general',
        is_general: true,
        description: 'General chatroom'
      });
    }

    // 2. Ensure user membership exists
    const { data: memData } = await supabase
      .from('server_members')
      .select('id')
      .eq('user_id', userId)
      .eq('server_id', GENERAL_SERVER_ID)
      .maybeSingle();

    if (!memData) {
      // Re-join the user to General server
      await supabase.from('server_members').insert({
        user_id: userId,
        server_id: GENERAL_SERVER_ID
      });
    }
  } catch (err) {
    console.error('Failed to verify/join General server:', err);
  }
}
