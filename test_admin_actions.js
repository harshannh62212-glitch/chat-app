const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function runTest() {
  const client = await pool.connect();
  const userId = 'test-banned-user-uuid-12345';
  const friendId = 'test-friend-user-uuid-67890';
  const serverId = 99999; // Assume dummy server ID (we will seed it)

  try {
    console.log('--- STARTING BAN & ARCHIVE INTEGRATION TEST ---');

    // 0. Cleanup any previous test data
    await client.query('DELETE FROM public.servers WHERE id = $1', [serverId]);
    await client.query('DELETE FROM public.users WHERE id IN ($1, $2)', [userId, friendId]);
    await client.query('DELETE FROM public.archived_users WHERE id IN ($1, $2)', [userId, friendId]);

    // 1. Seed users
    console.log('1. Seeding test users...');
    await client.query(
      `INSERT INTO public.users (id, username, email, password, is_banned) 
       VALUES ($1, 'test_ban_user', 'testban@chat.com', 'pwd_hashed', FALSE)`,
      [userId]
    );
    await client.query(
      `INSERT INTO public.users (id, username, email, password, is_banned) 
       VALUES ($1, 'test_friend_user', 'testfriend@chat.com', 'pwd_hashed', FALSE)`,
      [friendId]
    );

    // Seed server
    console.log('Seeding server...');
    await client.query(
      `INSERT INTO public.servers (id, name, description, owner_id) 
       VALUES ($1, 'Test Server', 'Desc', $2)`,
      [serverId, friendId]
    );

    // Seed server membership for test user
    console.log('Seeding membership...');
    await client.query(
      `INSERT INTO public.server_members (user_id, server_id) 
       VALUES ($1, $2)`,
      [userId, serverId]
    );

    // Seed friendship
    console.log('Seeding friendship...');
    await client.query(
      `INSERT INTO public.friendships (user_id, friend_id, status) 
       VALUES ($1, $2, 'accepted')`,
      [userId, friendId]
    );

    // Verify setup
    const initialUser = await client.query('SELECT * FROM public.users WHERE id = $1', [userId]);
    const initialMember = await client.query('SELECT * FROM public.server_members WHERE user_id = $1', [userId]);
    const initialFriend = await client.query('SELECT * FROM public.friendships WHERE user_id = $1 OR friend_id = $1', [userId]);
    console.log(`Initial Setup: User exists? ${initialUser.rows.length > 0}, Membership exists? ${initialMember.rows.length > 0}, Friendship exists? ${initialFriend.rows.length > 0}`);

    // 2. BAN USER (set is_banned = TRUE)
    console.log('2. Banning user by setting is_banned = TRUE...');
    await client.query('UPDATE public.users SET is_banned = TRUE WHERE id = $1', [userId]);

    // 3. Verify archiving and deletion
    console.log('3. Verifying profile deletion and archiving...');
    const activeUserResult = await client.query('SELECT * FROM public.users WHERE id = $1', [userId]);
    const archivedUserResult = await client.query('SELECT * FROM public.archived_users WHERE id = $1', [userId]);
    const activeMemberResult = await client.query('SELECT * FROM public.server_members WHERE user_id = $1', [userId]);
    const archivedMemberResult = await client.query('SELECT * FROM public.archived_server_members WHERE user_id = $1', [userId]);
    const activeFriendResult = await client.query('SELECT * FROM public.friendships WHERE user_id = $1 OR friend_id = $1', [userId]);
    const archivedFriendResult = await client.query('SELECT * FROM public.archived_friendships WHERE user_id = $1 OR friend_id = $1', [userId]);

    console.log(`- User deleted from active users? ${activeUserResult.rows.length === 0}`);
    console.log(`- User archived in archived_users? ${archivedUserResult.rows.length > 0}`);
    console.log(`- Membership deleted from active server_members? ${activeMemberResult.rows.length === 0}`);
    console.log(`- Membership archived in archived_server_members? ${archivedMemberResult.rows.length > 0}`);
    console.log(`- Friendship deleted from active friendships? ${activeFriendResult.rows.length === 0}`);
    console.log(`- Friendship archived in archived_friendships? ${archivedFriendResult.rows.length > 0}`);

    if (
      activeUserResult.rows.length !== 0 ||
      archivedUserResult.rows.length === 0 ||
      activeMemberResult.rows.length !== 0 ||
      archivedMemberResult.rows.length === 0 ||
      activeFriendResult.rows.length !== 0 ||
      archivedFriendResult.rows.length === 0
    ) {
      throw new Error('Verification of archive phase failed!');
    }
    console.log('>>> Archive verification PASSED!');

    // 4. UNBAN USER
    console.log('4. Unbanning user by executing unban_user function...');
    await client.query('SELECT public.unban_user($1)', [userId]);

    // 5. Verify restoration
    console.log('5. Verifying restoration of profile, memberships, and friendships...');
    const restoredUserResult = await client.query('SELECT * FROM public.users WHERE id = $1', [userId]);
    const clearedArchivedUserResult = await client.query('SELECT * FROM public.archived_users WHERE id = $1', [userId]);
    const restoredMemberResult = await client.query('SELECT * FROM public.server_members WHERE user_id = $1', [userId]);
    const clearedArchivedMemberResult = await client.query('SELECT * FROM public.archived_server_members WHERE user_id = $1', [userId]);
    const restoredFriendResult = await client.query('SELECT * FROM public.friendships WHERE user_id = $1 OR friend_id = $1', [userId]);
    const clearedArchivedFriendResult = await client.query('SELECT * FROM public.archived_friendships WHERE user_id = $1 OR friend_id = $1', [userId]);

    console.log(`- User restored to active users? ${restoredUserResult.rows.length > 0 && restoredUserResult.rows[0].is_banned === false}`);
    console.log(`- User deleted from archived_users? ${clearedArchivedUserResult.rows.length === 0}`);
    console.log(`- Membership restored to active server_members? ${restoredMemberResult.rows.length > 0}`);
    console.log(`- Membership deleted from archived_server_members? ${clearedArchivedMemberResult.rows.length === 0}`);
    console.log(`- Friendship restored to active friendships? ${restoredFriendResult.rows.length > 0}`);
    console.log(`- Friendship deleted from archived_friendships? ${clearedArchivedFriendResult.rows.length === 0}`);

    if (
      restoredUserResult.rows.length === 0 ||
      restoredUserResult.rows[0].is_banned !== false ||
      clearedArchivedUserResult.rows.length !== 0 ||
      restoredMemberResult.rows.length === 0 ||
      clearedArchivedMemberResult.rows.length !== 0 ||
      restoredFriendResult.rows.length === 0 ||
      clearedArchivedFriendResult.rows.length !== 0
    ) {
      throw new Error('Verification of restoration phase failed!');
    }
    console.log('>>> Restoration verification PASSED!');

    // 6. Cleanup
    console.log('6. Cleaning up test data...');
    await client.query('DELETE FROM public.servers WHERE id = $1', [serverId]);
    await client.query('DELETE FROM public.users WHERE id IN ($1, $2)', [userId, friendId]);
    console.log('Cleanup completed successfully.');
    console.log('--- ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ---');

  } catch (err) {
    console.error('TEST FAILED:', err);
    // Cleanup on error
    await client.query('DELETE FROM public.servers WHERE id = $1', [serverId]);
    await client.query('DELETE FROM public.users WHERE id IN ($1, $2)', [userId, friendId]);
    await client.query('DELETE FROM public.archived_users WHERE id IN ($1, $2)', [userId, friendId]);
  } finally {
    client.release();
    await pool.end();
  }
}

runTest();
