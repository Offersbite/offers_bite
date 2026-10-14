import { useEffect, useRef } from 'react';
import { Icon } from '../../components/Brand.jsx';

export function ProfileMenu({ user, onClose, onLogout }) {
  const panelRef = useRef(null);

  useEffect(() => {
    function handlePointer(event) {
      if (event.target.closest('.swal2-container, .profile-trigger')) return;
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

  return (
    <section className="profile-menu" id="profile-settings" role="dialog" ref={panelRef} aria-label="Profile settings">
      <div className="profile-menu-header">
        <span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong className="verified-user-name">
            <span>{user.name}</span>
            <span className="verified-tick" role="img" aria-label="Email verified" title="Email verified"><Icon name="check" size={11} /></span>
          </strong>
          <span>{user.email}</span>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close profile"><Icon name="close" size={17} /></button>
      </div>
      <button className="profile-logout" onClick={onLogout}><Icon name="logout" size={16} /> Sign out</button>
    </section>
  );
}
