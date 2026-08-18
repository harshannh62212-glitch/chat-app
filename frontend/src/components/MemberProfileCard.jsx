import React, { useState } from 'react';
import axios from 'axios';
import '../styles/ServerSettings.css';

function MemberProfileCard({
  member,
  server,
  currentUser,
  serverRoles,
  canManageRoles,
  onStartDM,
  onRolesUpdated,
  onClose,
  position = { top: '50%', left: '50%' }
}) {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  const assignedRoleIds = Array.isArray(member.roles) ? member.roles.map(r => r.id) : [];
  const availableRolesToAssign = (serverRoles || []).filter(r => !assignedRoleIds.includes(r.id));

  const handleAssignRole = async (roleId) => {
    try {
      setLoading(true);
      await axios.post(`/api/servers/${server.id}/members/${member.id}/roles/${roleId}`);
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
      await axios.delete(`/api/servers/${server.id}/members/${member.id}/roles/${roleId}`);
      if (onRolesUpdated) onRolesUpdated();
    } catch (err) {
      console.error('Failed to remove role:', err);
      alert(err.response?.data?.error || 'Failed to remove role');
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
          top: position.top,
          left: position.left,
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
            {member.id === server.owner_id && (
              <span title="Server Owner" style={{ fontSize: '14px' }}>👑</span>
            )}
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
                  {canManageRoles && server.id !== 1 && (
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
          {canManageRoles && server.id !== 1 && availableRolesToAssign.length > 0 && (
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
                💬 Send Message
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemberProfileCard;
