import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../components/Brand.jsx';
import { AdminCardsPage } from './pages/AdminCardsPage.jsx';
import { AdminOffersPage } from './pages/AdminOffersPage.jsx';
import { AdminUsersPage } from './pages/AdminUsersPage.jsx';
import { getAdminSummary } from '../../services/adminApi.js';

const ADMIN_PAGES = {
  'admin-overview': 'Admin overview',
  'admin-users': 'Users',
  'admin-cards': 'Cards',
  'admin-offers': 'Offers',
};

export function AdminPanel({ user, page, onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSummary(await getAdminSummary());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (page === 'admin-overview') loadSummary();
  }, [loadSummary, page]);

  return (
    <section className="admin-page" aria-label={ADMIN_PAGES[page] || 'Administration'}>
      <div className="page-intro section-heading-row admin-page-intro">
        <div><h1>{ADMIN_PAGES[page] || 'Admin overview'}</h1></div>
        {page === 'admin-overview' && (
          <button className="button button-secondary admin-refresh" onClick={loadSummary} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      </div>

      {error && <div className="admin-alert" role="alert">{error}</div>}

      {page === 'admin-overview' ? (
        loading && !summary ? (
          <div className="admin-loading"><span className="wallet-loader" /> Loading…</div>
        ) : summary && (
          <div className="admin-stats" aria-label="Management totals">
            <AdminStat label="Users" value={summary.users} icon="user" onClick={() => onNavigate('admin-users')} />
            <AdminStat label="Active users" value={summary.active_users} icon="check" onClick={() => onNavigate('admin-users')} />
            <AdminStat label="Cards" value={summary.cards} icon="card" onClick={() => onNavigate('admin-cards')} />
            <AdminStat label="Offers" value={summary.offers} icon="spark" onClick={() => onNavigate('admin-offers')} />
          </div>
        )
      ) : page === 'admin-users' ? (
        <AdminUsersPage user={user} onChanged={loadSummary} />
      ) : page === 'admin-cards' ? (
        <AdminCardsPage onChanged={loadSummary} />
      ) : (
        <AdminOffersPage onChanged={loadSummary} />
      )}
    </section>
  );
}

function AdminStat({ label, value, icon, onClick }) {
  return (
    <button className="admin-stat admin-stat-action" type="button" onClick={onClick} aria-label={`Manage ${label.toLowerCase()}: ${value}`}>
      <span className="admin-stat-icon"><Icon name={icon} size={17} /></span>
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </button>
  );
}
