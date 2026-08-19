const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');
const ramCache = require('../utils/ramCache');

const router = express.Router();

// Create a new server
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, password, isPublic } = req.body;
    const ownerId = req.userId;

    if (!name) {
      return res.status(400).json({ error: 'Server name required' });
    }

    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    const serverResult = await query(
      'INSERT INTO servers (name, description, owner_id, password_hash, is_public) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, owner_id',
      [name, description || '', ownerId, passwordHash, isPublic !== false]
    );

    const serverId = serverResult.rows[0].id;

    // Create mandatory general chatroom
    await query(
      'INSERT INTO chatrooms (server_id, name, is_general) VALUES ($1, $2, $3)',
      [serverId, 'general', true]
    );

    // Add owner as member
    await query(
      'INSERT INTO server_members (user_id, server_id) VALUES ($1, $2)',
      [ownerId, serverId]
    );

    ramCache.invalidate('all_servers');
    ramCache.invalidate('all_chatrooms');

    res.status(201).json({ id: serverId, name, owner_id: ownerId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create server' });
  }
});

// Helper to check if a server is the General server
async function isGeneralServer(serverId) {
  if (parseInt(serverId, 10) === 1) return true;
  const srv = await query('SELECT name FROM servers WHERE id = $1', [serverId]);
  return srv.rows.length > 0 && (srv.rows[0].name === 'General' || srv.rows[0].id === 1);
}

// Helper to ensure General server and default general chatroom exist, and enroll user
async function ensureGeneralServerAndMembership(userId) {
  try {
    let generalServer = await query("SELECT id FROM servers WHERE name = 'General' OR id = 1 LIMIT 1");
    let generalServerId;
    if (generalServer.rows.length === 0) {
      const systemUserId = '00000000-0000-0000-0000-000000000000';
      const createRes = await query(
        "INSERT INTO servers (name, description, owner_id, is_public) VALUES ('General', 'Mandatory community hub for all members', $1, true) RETURNING id",
        [systemUserId]
      );
      generalServerId = createRes.rows[0].id;
      await query(
        "INSERT INTO chatrooms (server_id, name, is_general, description) VALUES ($1, 'general', true, 'Mandatory main discussion channel') ON CONFLICT DO NOTHING",
        [generalServerId]
      );
    } else {
      generalServerId = generalServer.rows[0].id;
      // Ensure 'general' chatroom exists inside General server
      const roomCheck = await query("SELECT id FROM chatrooms WHERE server_id = $1 AND (is_general = true OR name = 'general') LIMIT 1", [generalServerId]);
      if (roomCheck.rows.length === 0) {
        await query(
          "INSERT INTO chatrooms (server_id, name, is_general, description) VALUES ($1, 'general', true, 'Mandatory main discussion channel')",
          [generalServerId]
        );
      }
    }

    if (userId) {
      await query(
        "INSERT INTO server_members (user_id, server_id) VALUES ($1, $2) ON CONFLICT (user_id, server_id) DO NOTHING",
        [userId, generalServerId]
      );
    }
    return generalServerId;
  } catch (err) {
    console.error('Error ensuring general server & membership:', err);
  }
}

// Get user's servers (default root GET /api/servers)
router.get('/', authMiddleware, async (req, res) => {
  try {
    await ensureGeneralServerAndMembership(req.userId);

    const cacheKey = `user_servers_${req.userId}`;
    const cached = ramCache.get(cacheKey);
    if (cached) return res.json(cached);

    const result = await query(
      `SELECT s.id, s.name, s.description, s.owner_id, s.is_public, s.avatar_url, s.created_at
       FROM servers s
       INNER JOIN server_members sm ON s.id = sm.server_id
       WHERE sm.user_id = $1
       ORDER BY (CASE WHEN s.name = 'General' OR s.id = 1 THEN 0 ELSE 1 END), s.created_at DESC`,
      [req.userId]
    );
    ramCache.set(cacheKey, result.rows, 60000);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Get all public servers (discovery page)
router.get('/discovery', async (req, res) => {
  try {
    await ensureGeneralServerAndMembership(null);

    const cached = ramCache.get('public_discovery_servers');
    if (cached) return res.json(cached);

    const result = await query(
      `SELECT id, name, description, owner_id, is_public, avatar_url, created_at 
       FROM servers 
       WHERE is_public = true 
       ORDER BY (CASE WHEN name = 'General' OR id = 1 THEN 0 ELSE 1 END), created_at DESC`
    );
    ramCache.set('public_discovery_servers', result.rows, 120000);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Get user's servers
router.get('/my-servers', authMiddleware, async (req, res) => {
  try {
    await ensureGeneralServerAndMembership(req.userId);

    const result = await query(
      `SELECT s.id, s.name, s.description, s.owner_id, s.is_public, s.avatar_url, s.created_at
       FROM servers s
       INNER JOIN server_members sm ON s.id = sm.server_id
       WHERE sm.user_id = $1
       ORDER BY (CASE WHEN s.name = 'General' OR s.id = 1 THEN 0 ELSE 1 END), s.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

// Get server details
router.get('/:serverId', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const serverResult = await query(
      'SELECT * FROM servers WHERE id = $1',
      [serverId]
    );

    if (serverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json(serverResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch server' });
  }
});

// Join server
router.post('/:serverId/join', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { password } = req.body;
    const userId = req.userId;

    const serverResult = await query('SELECT * FROM servers WHERE id = $1', [serverId]);
    if (serverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const server = serverResult.rows[0];

    // Check if user is an admin
    const userResult = await query('SELECT is_admin, username FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];
    const isAdmin = user && (user.is_admin || user.username === 'Nxghtmare3621');

    // Check password if required, unless the user is an admin
    if (server.password_hash && !isAdmin) {
      if (!password) {
        return res.status(403).json({ error: 'Server password required' });
      }
      const passwordMatch = await bcrypt.compare(password, server.password_hash);
      if (!passwordMatch) {
        return res.status(403).json({ error: 'Incorrect password' });
      }
    }

    // Check if already member
    const memberResult = await query(
      'SELECT * FROM server_members WHERE user_id = $1 AND server_id = $2',
      [userId, serverId]
    );

    if (memberResult.rows.length > 0) {
      return res.status(400).json({ error: 'Already a member' });
    }

    // Add as member
    await query(
      'INSERT INTO server_members (user_id, server_id) VALUES ($1, $2)',
      [userId, serverId]
    );

    ramCache.invalidate(`user_servers_${userId}`);

    res.json({ message: 'Successfully joined server' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join server' });
  }
});

// Leave a server
router.delete('/:serverId/leave', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    const userId = req.userId;

    if (await isGeneralServer(serverId)) {
      return res.status(403).json({ error: 'Cannot leave the General server.' });
    }

    const serverResult = await query('SELECT id, name, owner_id FROM servers WHERE id = $1', [serverId]);
    if (serverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    const server = serverResult.rows[0];
    if (server.owner_id === userId) {
      return res.status(400).json({ error: 'Server owners cannot leave their own server' });
    }

    await query('DELETE FROM server_member_roles WHERE server_id = $1 AND user_id = $2', [serverId, userId]);
    await query('DELETE FROM server_members WHERE server_id = $1 AND user_id = $2', [serverId, userId]);

    ramCache.invalidate(`user_servers_${userId}`);

    const io = req.app.get('io');
    if (io) {
      io.to('server-' + serverId).emit('member-left', { serverId, userId });
    }

    res.json({ message: 'Successfully left server' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to leave server' });
  }
});

// Helper to check any server permission (administrator or server owner bypasses all)
async function hasServerPermission(userId, serverId, permissionKey) {
  if (parseInt(serverId, 10) === 1 && permissionKey === 'manage_roles') return false; // General server excluded from role customization
  
  // 1. Check if server owner
  const srvRes = await query('SELECT owner_id FROM servers WHERE id = $1', [serverId]);
  if (srvRes.rows.length === 0) return false;
  if (srvRes.rows[0].owner_id === userId) return true;

  // 2. Check if user is global platform admin
  const userRes = await query('SELECT is_admin, username FROM users WHERE id = $1', [userId]);
  if (userRes.rows.length > 0 && (userRes.rows[0].is_admin || userRes.rows[0].username === 'Nxghtmare3621')) {
    return true;
  }

  // 3. Check if user has a role with administrator or specific permission in this server
  const roleRes = await query(`
    SELECT sr.permissions
    FROM server_member_roles smr
    JOIN server_roles sr ON smr.role_id = sr.id
    WHERE smr.server_id = $1 AND smr.user_id = $2
  `, [serverId, userId]);

  return roleRes.rows.some(r => {
    const p = r.permissions || {};
    return p.administrator === true || (permissionKey && p[permissionKey] === true);
  });
}

// Alias for backward compatibility
const canManageServerRoles = (userId, serverId) => hasServerPermission(userId, serverId, 'manage_roles');

// Get server members with assigned roles
router.get('/:serverId/members', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const result = await query(
      `SELECT u.id, u.username, u.avatar_url, sm.joined_at,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object('id', sr.id, 'name', sr.name, 'color', sr.color, 'hoist', sr.hoist, 'position', sr.position)
              ORDER BY sr.position DESC, sr.id ASC
            )
            FROM server_member_roles smr
            JOIN server_roles sr ON smr.role_id = sr.id
            WHERE smr.server_id = $1 AND smr.user_id = u.id
          ), '[]'::json
        ) as roles
       FROM users u
       INNER JOIN server_members sm ON u.id = sm.user_id
       WHERE sm.server_id = $1
       ORDER BY u.username ASC`,
      [serverId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Get all roles for a server
router.get('/:serverId/roles', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;

    if (parseInt(serverId, 10) === 1) {
      return res.json([]); // General server is excluded from custom roles
    }

    const result = await query(
      `SELECT sr.id, sr.server_id, sr.name, sr.color, sr.hoist, sr.position, sr.permissions, sr.created_at,
              COUNT(smr.user_id)::int as member_count
       FROM server_roles sr
       LEFT JOIN server_member_roles smr ON sr.id = smr.role_id
       WHERE sr.server_id = $1
       GROUP BY sr.id
       ORDER BY sr.position DESC, sr.id ASC`,
      [serverId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Create a new role in a server
router.post('/:serverId/roles', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    const userId = req.userId;

    if (parseInt(serverId, 10) === 1) {
      return res.status(403).json({ error: 'General server is excluded from custom roles' });
    }

    const authorized = await canManageServerRoles(userId, serverId);
    if (!authorized) {
      return res.status(403).json({ error: 'Only server admins and owners can create roles' });
    }

    const { name, color, hoist, permissions } = req.body;

    // Get next position
    const posRes = await query('SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM server_roles WHERE server_id = $1', [serverId]);
    const nextPos = posRes.rows[0].next_pos || 1;

    const defaultPerms = permissions || {
      administrator: false,
      manage_messages: false,
      manage_roles: false,
      manage_channels: false,
      kick_members: false
    };

    const newRole = await query(
      `INSERT INTO server_roles (server_id, name, color, hoist, position, permissions)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [serverId, name || 'new role', color || '#99aab5', hoist || false, nextPos, JSON.stringify(defaultPerms)]
    );

    const io = req.app.get('io');
    if (io) {
      io.to('server-' + serverId).emit('server-roles-updated', { serverId });
    }

    res.status(201).json(newRole.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// Update a role
router.put('/:serverId/roles/:roleId', authMiddleware, async (req, res) => {
  try {
    const { serverId, roleId } = req.params;
    const userId = req.userId;

    if (parseInt(serverId, 10) === 1) {
      return res.status(403).json({ error: 'General server is excluded from custom roles' });
    }

    const authorized = await canManageServerRoles(userId, serverId);
    if (!authorized) {
      return res.status(403).json({ error: 'Only server admins and owners can edit roles' });
    }

    const { name, color, hoist, position, permissions } = req.body;

    const currentRole = await query('SELECT * FROM server_roles WHERE id = $1 AND server_id = $2', [roleId, serverId]);
    if (currentRole.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const updatedName = name !== undefined ? name : currentRole.rows[0].name;
    const updatedColor = color !== undefined ? color : currentRole.rows[0].color;
    const updatedHoist = hoist !== undefined ? hoist : currentRole.rows[0].hoist;
    const updatedPos = position !== undefined ? position : currentRole.rows[0].position;
    const updatedPerms = permissions !== undefined ? JSON.stringify(permissions) : JSON.stringify(currentRole.rows[0].permissions);

    const updated = await query(
      `UPDATE server_roles
       SET name = $1, color = $2, hoist = $3, position = $4, permissions = $5
       WHERE id = $6 AND server_id = $7
       RETURNING *`,
      [updatedName, updatedColor, updatedHoist, updatedPos, updatedPerms, roleId, serverId]
    );

    const io = req.app.get('io');
    if (io) {
      io.to('server-' + serverId).emit('server-roles-updated', { serverId });
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete a role
router.delete('/:serverId/roles/:roleId', authMiddleware, async (req, res) => {
  try {
    const { serverId, roleId } = req.params;
    const userId = req.userId;

    if (parseInt(serverId, 10) === 1) {
      return res.status(403).json({ error: 'General server is excluded from custom roles' });
    }

    const authorized = await canManageServerRoles(userId, serverId);
    if (!authorized) {
      return res.status(403).json({ error: 'Only server admins and owners can delete roles' });
    }

    await query('DELETE FROM server_member_roles WHERE role_id = $1 AND server_id = $2', [roleId, serverId]);
    const deleted = await query('DELETE FROM server_roles WHERE id = $1 AND server_id = $2 RETURNING id', [roleId, serverId]);

    if (deleted.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to('server-' + serverId).emit('server-roles-updated', { serverId });
    }

    res.json({ message: 'Role deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

// Assign a role to a member
router.post('/:serverId/members/:targetUserId/roles/:roleId', authMiddleware, async (req, res) => {
  try {
    const { serverId, targetUserId, roleId } = req.params;
    const userId = req.userId;

    if (parseInt(serverId, 10) === 1) {
      return res.status(403).json({ error: 'General server is excluded from custom roles' });
    }

    const authorized = await canManageServerRoles(userId, serverId);
    if (!authorized) {
      return res.status(403).json({ error: 'Only server admins and owners can assign roles' });
    }

    // Verify role belongs to this server
    const roleCheck = await query('SELECT id FROM server_roles WHERE id = $1 AND server_id = $2', [roleId, serverId]);
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found in this server' });
    }

    await query(
      `INSERT INTO server_member_roles (server_id, user_id, role_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (server_id, user_id, role_id) DO NOTHING`,
      [serverId, targetUserId, roleId]
    );

    const io = req.app.get('io');
    if (io) {
      io.to('server-' + serverId).emit('member-roles-updated', { serverId, userId: targetUserId, roleId });
    }

    res.json({ message: 'Role assigned successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

// Remove a role from a member
router.delete('/:serverId/members/:targetUserId/roles/:roleId', authMiddleware, async (req, res) => {
  try {
    const { serverId, targetUserId, roleId } = req.params;
    const userId = req.userId;

    if (parseInt(serverId, 10) === 1) {
      return res.status(403).json({ error: 'General server is excluded from custom roles' });
    }

    const authorized = await canManageServerRoles(userId, serverId);
    if (!authorized) {
      return res.status(403).json({ error: 'Only server admins and owners can remove roles' });
    }

    await query(
      'DELETE FROM server_member_roles WHERE server_id = $1 AND user_id = $2 AND role_id = $3',
      [serverId, targetUserId, roleId]
    );

    const io = req.app.get('io');
    if (io) {
      io.to('server-' + serverId).emit('member-roles-updated', { serverId, userId: targetUserId, roleId });
    }

    res.json({ message: 'Role removed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

// Kick a member from the server
router.delete('/:serverId/members/:targetUserId', authMiddleware, async (req, res) => {
  try {
    const { serverId, targetUserId } = req.params;
    const userId = req.userId;

    if (await isGeneralServer(serverId)) {
      return res.status(403).json({ error: 'Cannot kick members from the General server' });
    }

    const authorized = await hasServerPermission(userId, serverId, 'kick_members');
    if (!authorized) {
      return res.status(403).json({ error: 'You do not have permission to kick members' });
    }

    // Server owner cannot be kicked
    const srv = await query('SELECT owner_id FROM servers WHERE id = $1', [serverId]);
    if (srv.rows.length > 0 && srv.rows[0].owner_id === targetUserId) {
      return res.status(400).json({ error: 'Server owner cannot be kicked' });
    }

    // Remove member and all their server member roles
    await query('DELETE FROM server_member_roles WHERE server_id = $1 AND user_id = $2', [serverId, targetUserId]);
    await query('DELETE FROM server_members WHERE server_id = $1 AND user_id = $2', [serverId, targetUserId]);

    const io = req.app.get('io');
    if (io) {
      io.to('server-' + serverId).emit('member-kicked', { serverId, userId: targetUserId });
      io.to('server-' + serverId).emit('member-roles-updated', { serverId, userId: targetUserId });
    }

    res.json({ message: 'Member kicked successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to kick member' });
  }
});

// Create chatroom in server
router.post('/:serverId/chatrooms', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    const { name, description } = req.body;
    const userId = req.userId;

    const authorized = await hasServerPermission(userId, serverId, 'manage_channels');
    if (!authorized) {
      return res.status(403).json({ error: 'You do not have permission to create channels' });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Channel name is required' });
    }

    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '-');
    const result = await query(
      'INSERT INTO chatrooms (server_id, name, is_general, description) VALUES ($1, $2, false, $3) RETURNING *',
      [serverId, cleanName, description || null]
    );

    const io = req.app.get('io');
    if (io) {
      io.to('server-' + serverId).emit('chatroom-created', { serverId, chatroom: result.rows[0] });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create chatroom' });
  }
});

// Delete chatroom in server
router.delete('/:serverId/chatrooms/:chatroomId', authMiddleware, async (req, res) => {
  try {
    const { serverId, chatroomId } = req.params;
    const userId = req.userId;

    const authorized = await hasServerPermission(userId, serverId, 'manage_channels');
    if (!authorized) {
      return res.status(403).json({ error: 'You do not have permission to delete channels' });
    }

    const roomCheck = await query('SELECT is_general FROM chatrooms WHERE id = $1 AND server_id = $2', [chatroomId, serverId]);
    if (roomCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (roomCheck.rows[0].is_general) {
      return res.status(400).json({ error: 'Cannot delete the mandatory general channel' });
    }

    await query('DELETE FROM server_messages WHERE chatroom_id = $1', [chatroomId]);
    await query('DELETE FROM chatrooms WHERE id = $1 AND server_id = $2', [chatroomId, serverId]);

    const io = req.app.get('io');
    if (io) {
      io.to('server-' + serverId).emit('chatroom-deleted', { serverId, chatroomId: parseInt(chatroomId, 10) });
    }

    res.json({ message: 'Channel deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// Get chatrooms in server
router.get('/:serverId/chatrooms', authMiddleware, async (req, res) => {
  try {
    const { serverId } = req.params;
    
    const result = await query(
      'SELECT id, name, is_general, description FROM chatrooms WHERE server_id = $1 ORDER BY is_general DESC, created_at ASC',
      [serverId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch chatrooms' });
  }
});

router.hasServerPermission = hasServerPermission;
module.exports = router;
