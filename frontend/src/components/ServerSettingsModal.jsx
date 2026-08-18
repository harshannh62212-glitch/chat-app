import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/ServerSettings.css';

const DISCORD_COLOR_PALETTE = [
  { name: 'Blurple', color: '#5865F2' },
  { name: 'Green', color: '#57F287' },
  { name: 'Yellow', color: '#FEE75C' },
  { name: 'Fuchsia', color: '#EB459E' },
  { name: 'Red', color: '#ED4245' },
  { name: 'Teal', color: '#1ABC9C' },
  { name: 'Dark Teal', color: '#11806A' },
  { name: 'Purple', color: '#9B59B6' },
  { name: 'Dark Purple', color: '#71368A' },
  { name: 'Pink', color: '#E91E63' },
  { name: 'Orange', color: '#E67E22' },
  { name: 'Sky Blue', color: '#3498DB' },
  { name: 'Grey', color: '#95A5A6' },
  { name: 'Dark Grey', color: '#4E5058' }
];

function ServerSettingsModal({ server, currentUser, onClose }) {
  const [activeTab, setActiveTab] = useState('roles');
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Editable fields for the selected role
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState('#99aab5');
  const [roleHoist, setRoleHoist] = useState(false);
  const [rolePerms, setRolePerms] = useState({
    administrator: false,
    manage_messages: false,
    manage_roles: false,
    manage_channels: false,
    kick_members: false
  });

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/servers/${server.id}/roles`);
      if (res.data) {
        setRoles(res.data);
        if (res.data.length > 0) {
          if (!selectedRole || !res.data.some(r => r.id === selectedRole.id)) {
            loadRoleToEditor(res.data[0]);
          } else {
            const current = res.data.find(r => r.id === selectedRole.id);
            loadRoleToEditor(current);
          }
        } else {
          setSelectedRole(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch server roles:', err);
      setError(err.response?.data?.error || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [server.id]);

  const loadRoleToEditor = (role) => {
    setSelectedRole(role);
    setRoleName(role.name || '');
    setRoleColor(role.color || '#99aab5');
    setRoleHoist(Boolean(role.hoist));
    setRolePerms(role.permissions || {
      administrator: false,
      manage_messages: false,
      manage_roles: false,
      manage_channels: false,
      kick_members: false
    });
    setSuccessMsg('');
    setError(null);
  };

  const handleCreateRole = async () => {
    try {
      setError(null);
      const res = await axios.post(`/api/servers/${server.id}/roles`, {
        name: 'new role',
        color: '#5865F2',
        hoist: false
      });
      if (res.data) {
        await fetchRoles();
        loadRoleToEditor(res.data);
        setSuccessMsg('Role created!');
      }
    } catch (err) {
      console.error('Failed to create role:', err);
      setError(err.response?.data?.error || 'Failed to create role');
    }
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;
    try {
      setSaving(true);
      setError(null);
      const res = await axios.put(`/api/servers/${server.id}/roles/${selectedRole.id}`, {
        name: roleName,
        color: roleColor,
        hoist: roleHoist,
        permissions: rolePerms
      });
      if (res.data) {
        setSuccessMsg('Changes saved!');
        await fetchRoles();
      }
    } catch (err) {
      console.error('Failed to save role:', err);
      setError(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    if (!window.confirm(`Are you sure you want to delete the @${selectedRole.name} role?`)) return;
    try {
      setError(null);
      await axios.delete(`/api/servers/${server.id}/roles/${selectedRole.id}`);
      setSelectedRole(null);
      await fetchRoles();
      setSuccessMsg('Role deleted!');
    } catch (err) {
      console.error('Failed to delete role:', err);
      setError(err.response?.data?.error || 'Failed to delete role');
    }
  };

  const togglePermission = (permKey) => {
    setRolePerms(prev => ({
      ...prev,
      [permKey]: !prev[permKey]
    }));
  };

  return (
    <div className="server-settings-backdrop" onClick={onClose}>
      <div className="server-settings-container" onClick={e => e.stopPropagation()}>
        {/* Left Settings Sidebar */}
        <div className="server-settings-sidebar">
          <div className="server-settings-nav-header">{server.name}</div>
          <button
            className={`server-settings-nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📋 Overview
          </button>
          <button
            className={`server-settings-nav-btn ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            🛡️ Roles
          </button>
        </div>

        {/* Right Settings Content */}
        <div className="server-settings-content">
          <div className="server-settings-header">
            <div className="server-settings-title">
              {activeTab === 'roles' && '🛡️ Server Roles'}
              {activeTab === 'overview' && '📋 Server Overview'}
            </div>
            <button className="server-settings-close-btn" onClick={onClose} title="ESC">
              ✕
            </button>
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Server Name</label>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{server.name}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <div style={{ color: '#dbdee1' }}>{server.description || 'No description provided.'}</div>
              </div>
              <div className="form-group">
                <label className="form-label">Server ID</label>
                <div style={{ fontFamily: 'monospace', color: '#949ba4' }}>#{server.id}</div>
              </div>
            </div>
          )}

          {/* ROLES TAB */}
          {activeTab === 'roles' && (
            <div className="roles-manager-layout">
              {/* Roles List Column */}
              <div className="roles-list-col">
                <button className="create-role-btn" onClick={handleCreateRole}>
                  ➕ Create Role
                </button>

                {loading ? (
                  <div style={{ color: '#949ba4', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                    Loading roles...
                  </div>
                ) : roles.length === 0 ? (
                  <div style={{ color: '#949ba4', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                    No roles created yet.
                  </div>
                ) : (
                  <div className="roles-scroll-list">
                    {roles.map(role => (
                      <div
                        key={role.id}
                        className={`role-list-item ${selectedRole?.id === role.id ? 'selected' : ''}`}
                        onClick={() => loadRoleToEditor(role)}
                      >
                        <div className="role-list-item-left">
                          <div
                            className="role-color-dot"
                            style={{ backgroundColor: role.color || '#99aab5' }}
                          />
                          <span className="role-name-text">{role.name}</span>
                        </div>
                        <span className="role-member-count">{role.member_count || 0}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Role Details Editor Column */}
              {selectedRole ? (
                <div className="role-editor-col">
                  {error && (
                    <div style={{ padding: '10px 14px', background: 'rgba(237, 66, 69, 0.15)', border: '1px solid #ed4245', borderRadius: '6px', color: '#ed4245', fontSize: '13px' }}>
                      {error}
                    </div>
                  )}
                  {successMsg && (
                    <div style={{ padding: '10px 14px', background: 'rgba(35, 165, 90, 0.15)', border: '1px solid #23a55a', borderRadius: '6px', color: '#23a55a', fontSize: '13px' }}>
                      {successMsg}
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Role Name</label>
                    <input
                      type="text"
                      className="role-name-input"
                      value={roleName}
                      onChange={e => setRoleName(e.target.value)}
                      placeholder="e.g. Moderator, VIP, Gamer"
                    />
                  </div>

                  {/* Role Color */}
                  <div className="form-group">
                    <label className="form-label">Role Color</label>
                    <div className="role-colors-grid">
                      {DISCORD_COLOR_PALETTE.map(item => (
                        <button
                          key={item.color}
                          type="button"
                          className={`color-swatch-btn ${roleColor.toLowerCase() === item.color.toLowerCase() ? 'selected' : ''}`}
                          style={{ backgroundColor: item.color }}
                          onClick={() => setRoleColor(item.color)}
                          title={item.name}
                        />
                      ))}
                    </div>
                    <div className="custom-hex-input-wrapper">
                      <input
                        type="color"
                        className="custom-color-picker-input"
                        value={roleColor.startsWith('#') && roleColor.length === 7 ? roleColor : '#5865F2'}
                        onChange={e => setRoleColor(e.target.value)}
                        title="Custom Color"
                      />
                      <input
                        type="text"
                        className="custom-hex-input"
                        value={roleColor}
                        onChange={e => setRoleColor(e.target.value)}
                        placeholder="#5865f2"
                      />
                    </div>
                  </div>

                  {/* Hoist Toggle */}
                  <div className="toggle-setting-row">
                    <div className="toggle-label-wrap">
                      <div className="toggle-title">Display role members separately from online members</div>
                      <div className="toggle-desc">Hoists members with this role into their own section in the member sidebar.</div>
                    </div>
                    <label className="switch-toggle">
                      <input
                        type="checkbox"
                        checked={roleHoist}
                        onChange={e => setRoleHoist(e.target.checked)}
                      />
                      <span className="switch-slider"></span>
                    </label>
                  </div>

                  {/* Permissions Checklist */}
                  <div className="form-group">
                    <label className="form-label">Role Permissions</label>
                    <div className="permissions-grid">
                      <div className="permission-row">
                        <div className="perm-text">
                          <span className="perm-name">👑 Administrator</span>
                          <span className="perm-desc">Grants all server permissions and bypasses channel restrictions.</span>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(rolePerms.administrator)}
                            onChange={() => togglePermission('administrator')}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      <div className="permission-row">
                        <div className="perm-text">
                          <span className="perm-name">🛡️ Manage Roles</span>
                          <span className="perm-desc">Allows creating, editing, and assigning roles lower than this role.</span>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(rolePerms.manage_roles)}
                            onChange={() => togglePermission('manage_roles')}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      <div className="permission-row">
                        <div className="perm-text">
                          <span className="perm-name">💬 Manage Messages</span>
                          <span className="perm-desc">Allows deleting messages sent by other members in chatrooms.</span>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(rolePerms.manage_messages)}
                            onChange={() => togglePermission('manage_messages')}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      <div className="permission-row">
                        <div className="perm-text">
                          <span className="perm-name">🔨 Kick Members</span>
                          <span className="perm-desc">Allows kicking rule-breaking members from the server.</span>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(rolePerms.kick_members)}
                            onChange={() => togglePermission('kick_members')}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="role-editor-footer">
                    <button className="delete-role-btn" onClick={handleDeleteRole}>
                      🗑️ Delete Role
                    </button>
                    <button className="save-role-btn" onClick={handleSaveRole} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#949ba4' }}>
                  Select a role on the left or create a new one.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ServerSettingsModal;
