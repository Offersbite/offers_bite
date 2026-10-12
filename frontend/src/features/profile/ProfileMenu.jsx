import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Brand.jsx';
import { updateProfile } from '../../services/authApi.js';

export function ProfileMenu({ user, onUserUpdated, onClose, onLogout }) {
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    function handlePointer(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) onClose();
    }
    function handleEscape(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const updated = await updateProfile({ name });
      onUserUpdated(updated);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="profile-menu" id="profile-settings" role="dialog" ref={panelRef} aria-label="Profile settings">
      <div className="profile-menu-header">
        <span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
        <div><strong>{user.name}</strong><span>{user.email}</span></div>
        <button className="icon-button" onClick={onClose} aria-label="Close profile"><Icon name="close" size={17} /></button>
      </div>
      <div className="profile-verified"><Icon name="check" size={14} /> Email verified</div>
      <form onSubmit={saveProfile} className="profile-edit-form">
        <label htmlFor="profileName">Display name</label>
        <div className="profile-edit-row">
          <input id="profileName" value={name} maxLength="100" required onChange={(event) => setName(event.target.value)} />
          <button className="button button-primary button-small" disabled={busy || name.trim() === user.name}>
            {busy ? 'Saving' : 'Save'}
          </button>
        </div>
        {error && <p className="profile-error" role="alert">{error}</p>}
      </form>
      <button className="profile-logout" onClick={onLogout}><Icon name="logout" size={16} /> Sign out</button>
    </section>
  );
}
