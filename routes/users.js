const express = require('express');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');


const router = express.Router();

// Search users
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;

    let result;
    if (!q || q.trim() === '') {
      // Return all users (excluding current user)
      result = await query(
        `SELECT id, username, avatar_url 
         FROM users 
         WHERE id != $1 
         ORDER BY username ASC 
         LIMIT 50`,
        [req.userId]
      );
    } else {
      // Search users matching query (excluding current user)
      result = await query(
        `SELECT id, username, avatar_url 
         FROM users 
         WHERE username ILIKE $1 AND id != $2 
         LIMIT 10`,
        [`%${q}%`, req.userId]
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get user profile
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      'SELECT id, username, avatar_url, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user profile avatar URL
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    await query(
      'UPDATE users SET avatar_url = $1 WHERE id = $2',
      [avatarUrl || null, req.userId]
    );
    res.json({ message: 'Profile updated successfully', avatar_url: avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Send a friend request
router.post('/friends/request', authMiddleware, async (req, res) => {
  try {
    const { friendUsername } = req.body;
    const userId = req.userId;

    if (!friendUsername || !friendUsername.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Find the friend by username
    const friendResult = await query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [friendUsername.trim()]
    );

    if (friendResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const friendId = friendResult.rows[0].id;

    if (friendId === userId) {
      return res.status(400).json({ error: 'You cannot add yourself as a friend' });
    }

    // Check if friendship already exists
    const existResult = await query(
      'SELECT * FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [userId, friendId]
    );

    if (existResult.rows.length > 0) {
      const friendship = existResult.rows[0];
      if (friendship.status === 'accepted') {
        return res.status(400).json({ error: 'You are already friends' });
      } else if (friendship.user_id === userId) {
        return res.status(400).json({ error: 'Friend request already sent' });
      } else {
        // If the other user already sent a request, accept it automatically
        await query(
          "UPDATE friendships SET status = 'accepted' WHERE id = $1",
          [friendship.id]
        );
        return res.json({ message: 'Friend request accepted automatically', status: 'accepted' });
      }
    }

    // Insert new pending friend request
    await query(
      "INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, 'pending')",
      [userId, friendId]
    );

    res.status(201).json({ message: 'Friend request sent', status: 'pending' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Accept a friend request
router.post('/friends/accept', authMiddleware, async (req, res) => {
  try {
    const { requesterId } = req.body;
    const userId = req.userId;

    if (!requesterId) {
      return res.status(400).json({ error: 'Requester ID is required' });
    }

    const result = await query(
      "UPDATE friendships SET status = 'accepted' WHERE user_id = $1 AND friend_id = $2 AND status = 'pending' RETURNING id",
      [requesterId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending friend request not found' });
    }

    res.json({ message: 'Friend request accepted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to accept friend request' });
  }
});

// Decline or remove a friend/request
router.post('/friends/decline', authMiddleware, async (req, res) => {
  try {
    const { otherUserId } = req.body;
    const userId = req.userId;

    if (!otherUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await query(
      'DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)',
      [userId, otherUserId]
    );

    res.json({ message: 'Friendship or request removed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to decline or remove friend' });
  }
});

// Get friends list
router.get('/friends/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const result = await query(
      `SELECT u.id, u.username, u.avatar_url 
       FROM friendships f
       INNER JOIN users u ON (f.user_id = $1 AND f.friend_id = u.id) OR (f.friend_id = $1 AND f.user_id = u.id)
       WHERE f.status = 'accepted'
       ORDER BY u.username ASC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// Get pending friend requests
router.get('/friends/pending', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    // Incoming requests (people who sent requests to current user)
    const incomingResult = await query(
      `SELECT f.id as request_id, u.id as user_id, u.username, u.avatar_url
       FROM friendships f
       INNER JOIN users u ON f.user_id = u.id
       WHERE f.friend_id = $1 AND f.status = 'pending'
       ORDER BY u.username ASC`,
      [userId]
    );

    // Outgoing requests (people current user sent requests to)
    const outgoingResult = await query(
      `SELECT f.id as request_id, u.id as user_id, u.username, u.avatar_url
       FROM friendships f
       INNER JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = $1 AND f.status = 'pending'
       ORDER BY u.username ASC`,
      [userId]
    );

    res.json({
      incoming: incomingResult.rows,
      outgoing: outgoingResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

// Helper function to read Minecraft balance from Essentials userdata
function getMinecraftBalance(username) {
  const dir = process.env.MINECRAFT_USERDATA_PATH || '/minecraft-server/plugins/Essentials/userdata';
  if (!fs.existsSync(dir)) {
    return null;
  }
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (!file.endsWith('.yml')) continue;
    
    try {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      const nameMatch = content.match(/last-account-name:\s*['"]?([^'"\r\n]+)['"]?/i);
      if (nameMatch && nameMatch[1].toLowerCase() === username.toLowerCase()) {
        const moneyMatch = content.match(/money:\s*['"]?([^'"\r\n]+)['"]?/);
        if (moneyMatch) {
          return parseFloat(moneyMatch[1]) || 0;
        }
        return 0;
      }
    } catch (e) {
      console.error(`Error reading/parsing Essentials file ${file}:`, e);
    }
  }
  return null;
}

// Update Minecraft Username Binding
router.put('/minecraft/username', authMiddleware, async (req, res) => {
  try {
    const { minecraftUsername } = req.body;
    if (minecraftUsername === undefined) {
      return res.status(400).json({ error: 'minecraftUsername is required' });
    }

    await query(
      'UPDATE users SET minecraft_username = $1 WHERE id = $2',
      [minecraftUsername || null, req.userId]
    );

    res.json({ success: true, minecraftUsername });
  } catch (err) {
    console.error('Error updating Minecraft username:', err);
    res.status(500).json({ error: 'Failed to update Minecraft username' });
  }
});

// Get Minecraft Balance
router.get('/minecraft/balance', authMiddleware, async (req, res) => {
  try {
    let username = req.query.username;
    if (!username) {
      const userRes = await query('SELECT username, minecraft_username FROM users WHERE id = $1', [req.userId]);
      if (userRes.rows.length > 0) {
        username = userRes.rows[0].minecraft_username || userRes.rows[0].username;
      }
    }
    
    if (!username) {
      return res.status(400).json({ error: 'Username not found' });
    }
    
    const balance = getMinecraftBalance(username);
    if (balance === null) {
      return res.json({ username, balance: null, found: false });
    }
    
    return res.json({ username, balance, found: true });
  } catch (err) {
    console.error('Error fetching Minecraft balance:', err);
    res.status(500).json({ error: 'Failed to fetch Minecraft balance' });
  }
});

module.exports = router;
