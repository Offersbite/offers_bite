import { useState } from 'react';
import { Icon } from '../../components/Brand.jsx';
import { updateProfile } from '../../services/authApi.js';

export function ProfilePage({ user, onUserUpdated, onLogout }) {
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const updated = await updateProfile({ name });
      onUserUpdated(updated);
      setName(updated.name);
      setSaved(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="profile-page" aria-labelledby="profile-page-title">
      <header className="profile-page-heading">
        <span className="eyebrow"><span className="eyebrow-dot" /> ACCOUNT</span>
        <h1 id="profile-page-title">Your profile</h1>
        <p>Manage your account details and sign-in.</p>
      </header>

      <div className="profile-page-card">
        <div className="profile-page-identity">
          <span className="user-avatar profile-page-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <div><strong>{user.name}</strong><span>{user.email}</span></div>
          <span className="profile-verified"><Icon name="check" size={14} /> Verified</span>
        </div>

        <form onSubmit={saveProfile} className="profile-page-form">
          <label htmlFor="accountDisplayName">Display name</label>
          <input
            id="accountDisplayName"
            value={name}
            maxLength="100"
            required
            onChange={(event) => { setName(event.target.value); setSaved(false); }}
          />
          {error && <p className="profile-error" role="alert">{error}</p>}
          {saved && <p className="profile-saved" role="status">Profile updated.</p>}
          <button
            className="button button-primary"
            disabled={busy || name.trim() === user.name}
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        <div className="profile-page-email">
          <Icon name="mail" size={17} />
          <div><strong>Email address</strong><span>{user.email}</span></div>
        </div>

        <button className="profile-page-signout" onClick={onLogout}>
          <Icon name="logout" size={17} /> Sign out
        </button>
      </div>
    </section>
  );
}
