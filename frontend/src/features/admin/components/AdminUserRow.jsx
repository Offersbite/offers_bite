import { useEffect, useState } from 'react';
import { Icon } from '../../../components/Brand.jsx';

export function AdminUserRow({ user, isSelf, saving, onSave, onDelete }) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [editing, setEditing] = useState(false);
  const dirty = name.trim() !== user.name || role !== user.role || isActive !== user.is_active;

  useEffect(() => {
    setName(user.name);
    setRole(user.role);
    setIsActive(user.is_active);
    setEditing(false);
  }, [user.name, user.role, user.is_active]);

  async function saveChanges() {
    const saved = await onSave(user, isSelf ? { name } : { name, role, is_active: isActive });
    if (saved) setEditing(false);
  }

  return (
    <tr>
      <td data-label="User">
        <div className="admin-user-cell">
          {editing ? (
            <input
              className="admin-inline-name"
              aria-label={`Name for ${user.email}`}
              value={name}
              maxLength="100"
              onChange={(event) => setName(event.target.value)}
              disabled={saving}
            />
          ) : <strong>{user.name}</strong>}
          <span>{user.email}</span>
          {!user.email_verified && <small>Unverified</small>}
        </div>
      </td>
      <td data-label="Joined">{user.created_at ? new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(user.created_at)) : '—'}</td>
      <td data-label="Wallet">{user.wallet_count}</td>
      <td data-label="Role">
        {editing ? (
          <select className="admin-inline-select" value={role} disabled={isSelf || saving} onChange={(event) => setRole(event.target.value)} aria-label={`Role for ${user.email}`}>
            <option value="user">User</option><option value="admin">Admin</option>
          </select>
        ) : <span className="admin-role-label">{role === 'admin' ? 'Admin' : 'User'}</span>}
      </td>
      <td data-label="Status">
        {editing ? (
          <label className="admin-status-toggle">
            <input type="checkbox" checked={isActive} disabled={isSelf || saving} onChange={(event) => setIsActive(event.target.checked)} aria-label={`Active status for ${user.email}`} />
            <span className={`admin-status ${isActive ? 'active' : 'inactive'}`}>{isActive ? 'Active' : 'Suspended'}</span>
          </label>
        ) : <span className={`admin-status ${user.is_active ? 'active' : 'inactive'}`}>{user.is_active ? 'Active' : 'Suspended'}</span>}
      </td>
      <td data-label="Actions" className="admin-actions-cell">
        {editing ? (
          <>
            <button className="admin-icon-action" type="button" title="Save user" aria-label={`Save ${user.email}`} disabled={!dirty || saving} onClick={saveChanges}>
              <Icon name={saving ? 'clock' : 'check'} size={16} />
            </button>
            <button className="admin-icon-action" type="button" title="Cancel edit" aria-label={`Cancel editing ${user.email}`} disabled={saving} onClick={() => {
              setName(user.name);
              setRole(user.role);
              setIsActive(user.is_active);
              setEditing(false);
            }}>
              <Icon name="close" size={16} />
            </button>
          </>
        ) : (
          <button className="admin-icon-action" type="button" title="Edit user" aria-label={`Edit ${user.email}`} disabled={saving} onClick={() => setEditing(true)}>
            <Icon name="edit" size={16} />
          </button>
        )}
        <button className="admin-icon-action danger" type="button" title="Delete user" aria-label={`Delete ${user.email}`} disabled={isSelf || saving} onClick={() => onDelete(user)}>
          <Icon name="trash" size={16} />
        </button>
      </td>
    </tr>
  );
}
