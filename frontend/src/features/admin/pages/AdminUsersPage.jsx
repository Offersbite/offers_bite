import { useCallback, useEffect, useState } from 'react';
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUsers,
  updateAdminUser,
} from '../../../services/adminApi.js';
import { AdminInput } from '../components/AdminFormField.jsx';
import { AdminUserRow } from '../components/AdminUserRow.jsx';
import { ListToolbar, Pagination } from '../../../components/ListControls.jsx';
import { Modal } from '../../../components/Modal.jsx';
import { Icon } from '../../../components/Brand.jsx';

export function AdminUsersPage({ user: currentAdmin, onChanged }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getAdminUsers(search, offset, role, status);
      setUsers(result.items);
      setTotal(result.total);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [offset, role, search, status]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function saveUser(user, changes) {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateAdminUser(user.id, changes);
      await loadUsers();
      onChanged();
      setMessage('Account updated.');
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submitNewUser(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await createAdminUser(newUser);
      closeCreate();
      await loadUsers();
      onChanged();
      setMessage('Verification email sent.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function closeCreate() {
    setCreateOpen(false);
    setNewUser({ name: '', email: '', password: '' });
  }

  async function removeUser(user) {
    if (!window.confirm(`Permanently delete ${user.email} and their account data?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deleteAdminUser(user.id);
      await loadUsers();
      onChanged();
      setMessage('Account deleted.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-panel-card" aria-label="User management">
      <div className="admin-panel-heading">
        <h2>Users</h2>
        <button className="button button-primary" onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> Add user</button>
      </div>

      <ListToolbar
        search={search}
        onSearch={(value) => { setSearch(value); setOffset(0); }}
        placeholder="Search name or email"
        filters={[
          { label: 'Role', value: role, options: [{ value: 'admin', label: 'Admin' }, { value: 'user', label: 'User' }], onChange: (value) => { setRole(value); setOffset(0); } },
          { label: 'Status', value: status, options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }], onChange: (value) => { setStatus(value); setOffset(0); } },
        ]}
      />
      {error && !createOpen && <div className="admin-alert" role="alert">{error}</div>}
      {message && <div className="admin-success" role="status">{message}</div>}

      {loading ? (
        <div className="admin-loading"><span className="wallet-loader" /> Loading…</div>
      ) : (
        <>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>User</th><th>Joined</th><th>Wallet</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {users.map((account) => (
                  <AdminUserRow key={account.id} user={account} isSelf={account.id === currentAdmin.id} saving={saving} onSave={saveUser} onDelete={removeUser} />
                ))}
                {users.length === 0 && <tr><td colSpan="6" className="admin-empty">No users found.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination
            page={Math.floor(offset / 50) + 1}
            pageSize={50}
            total={total}
            onPageChange={(nextPage) => setOffset((nextPage - 1) * 50)}
          />
        </>
      )}
      {createOpen && (
        <Modal title="Add user" onClose={closeCreate}>
          <form className="admin-form admin-editor-form" onSubmit={submitNewUser}>
            {error && <div className="admin-alert" role="alert">{error}</div>}
            <AdminInput label="Name" value={newUser.name} onChange={(name) => setNewUser({ ...newUser, name })} maxLength="100" required />
            <AdminInput label="Email" type="email" value={newUser.email} onChange={(email) => setNewUser({ ...newUser, email })} maxLength="100" required />
            <AdminInput label="Temporary password" type="password" value={newUser.password} onChange={(password) => setNewUser({ ...newUser, password })} minLength="8" maxLength="128" required />
            <div className="admin-form-actions">
              <button type="button" className="button button-secondary" onClick={closeCreate} disabled={saving}>Cancel</button>
              <button className="button button-primary" disabled={saving}>{saving ? 'Sending…' : 'Create user'}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
