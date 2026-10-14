import { AdminOverview } from './components/AdminOverview.jsx';
import { useActionFeedback } from '../../components/useActionFeedback.js';
import { useCallback, useEffect, useState } from 'react';
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
  useActionFeedback('', error);

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
      {error && <div className="admin-alert" role="alert">{error}</div>}


      {page === 'admin-overview' ? (
        loading && !summary ? (
          <div className="admin-loading"><span className="wallet-loader" /> Loading…</div>
        ) : summary && (
          <AdminOverview summary={summary} onNavigate={onNavigate} />
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
