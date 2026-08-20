import React, { useState } from 'react';
import axios from 'axios';
import '../styles/ServerSettings.css';

function MemberProfileCard({
  member,
  server,
  currentUser = {},
  serverRoles = [],
  canManageRoles = false,
  canKickMembers = false,
  onStartDM,
  onRolesUpdated,
  onClose,
  position = { top: '50%', left: '50%' }
}) {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!member) return null;

  const safeServer = server || { id: 1, owner_id: null };
  const assignedRoleIds = Array.isArray(member.roles) ? member.roles.map(r => r?.id).filter(Boolean) : [];
  const availableRolesToAssign = (serverRoles || []).filter(r => r && !assignedRoleIds.includes(r.id));
  const isOwner = member.id === safeServer.owner_id;

  const handleAssignRole = async (roleId) => {
    try {
      setLoading(true);
      await axios.post(`/api/servers/${safeServer.id}/members/${member.id}/roles/${roleId}`);
      setShowRoleDropdown(false);
      if (onRolesUpdated) onRolesUpdated();
    } catch (err) {
      console.error('Failed to assign role:', err);
      alert(err.response?.data?.error || 'Failed to assign role');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRole = async (roleId) => {
    try {
      setLoading(true);
      await axios.delete(`/api/servers/${safeServer.id}/members/${member.id}/roles/${roleId}`);
      if (onRolesUpdated) onRolesUpdated();
    } catch (err) {
      console.error('Failed to remove role:', err);
      alert(err.response?.data?.error || 'Failed to remove role');
    } finally {
      setLoading(false);
    }
  };

  const handleKick = async () => {
    if (!window.confirm(`Are you sure you want to kick @${member.username} from this server?`)) return;
    try {
      setLoading(true);
      await axios.delete(`/api/servers/${safeServer.id}/members/${member.id}`);
      onClose();
      if (onRolesUpdated) onRolesUpdated();
    } catch (err) {
      console.error('Failed to kick member:', err);
      alert(err.response?.data?.error || 'Failed to kick member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="server-settings-backdrop"
      style={{ background: 'transparent' }}
      onClick={onClose}
    >
      <div 
        className="member-popover-card"
        style={{
          top: position.top || '50%',
          left: position.left || '50%',
          transform: position.isFixedCenter ? 'translate(-50%, -50%)' : 'none'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Banner */}
        <div className="member-popover-banner">
          <div className="member-popover-avatar-wrap">
            {member.avatar_url ? (
              <img src={member.avatar_url} alt={member.username} className="member-popover-avatar" />
            ) : (
              <div className="member-popover-avatar-fallback">
                {member.username ? member.username[0].toUpperCase() : '?'}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="member-popover-body">
          <div className="member-popover-username">
            {member.username}
            {isOwner && (
              <span title="Server Owner" style={{ fontSize: '14px', marginLeft: '6px' }}>👑</span>
            )}
          </div>

          {/* About Me / Description Section */}
          <div className="member-popover-divider" />
          <div className="member-popover-section-title">ABOUT ME</div>
          <div style={{
            fontSize: '13px',
            color: member.description || member.bio ? '#dcddde' : '#72767d',
            lineHeight: '1.4',
            wordBreak: 'break-word',
            fontStyle: member.description || member.bio ? 'normal' : 'italic',
            marginBottom: '12px'
          }}>
            {member.description || member.bio || 'No profile description provided yet.'}
          </div>

          <div className="member-popover-divider" />

          {/* Roles Section */}
          <div className="member-popover-section-title">ROLES</div>
          
          <div className="member-roles-chips-grid">
            {Array.isArray(member.roles) && member.roles.length > 0 ? (
              member.roles.map(role => (
                <div key={role.id} className="member-role-chip">
                  <div
                    className="role-color-dot"
                    style={{ backgroundColor: role.color || '#99aab5', width: '8px', height: '8px' }}
                  />
                  <span>{role.name}</span>
                  {canManageRoles && safeServer.id !== 1 && (
                    <button
                      className="role-chip-remove-btn"
                      onClick={() => handleRemoveRole(role.id)}
                      disabled={loading}
                      title="Remove Role"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div style={{ fontSize: '12px', color: '#949ba4' }}>No roles assigned</div>
            )}
          </div>

          {/* Add Role Control for Admins */}
          {canManageRoles && safeServer.id !== 1 && availableRolesToAssign.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                className="add-role-select-btn"
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                disabled={loading}
              >
                ➕ Add Role
              </button>

              {showRoleDropdown && (
                <div className="roles-dropdown-menu">
                  {availableRolesToAssign.map(role => (
                    <button
                      key={role.id}
                      className="role-dropdown-item"
                      onClick={() => handleAssignRole(role.id)}
                    >
                      <div
                        className="role-color-dot"
                        style={{ backgroundColor: role.color || '#99aab5' }}
                      />
                      <span>{role.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="popover-actions">
            {member.id !== currentUser.id && (
              <button
                className="popover-dm-btn"
                onClick={() => {
                  onClose();
                  if (onStartDM) onStartDM(member);
                }}
              >
                💬 Message
              </button>
            )}

            {!isOwner && member.id !== currentUser.id && (canKickMembers || canManageRoles) && safeServer.id !== 1 && (
              <button
                className="popover-dm-btn"
                style={{ background: 'transparent', border: '1px solid #da373c', color: '#da373c' }}
                onClick={handleKick}
                disabled={loading}
              >
                🔨 Kick
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemberProfileCard;

