import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brand, Icon } from '../../components/Brand.jsx';
import { ThemeToggle } from '../../components/ThemeToggle.jsx';
import { ProfileMenu } from '../profile/ProfileMenu.jsx';
import { ProfilePage } from '../profile/ProfilePage.jsx';
import { WalletPanel } from '../wallet/WalletPanel.jsx';
import { OfferCard } from './OfferCard.jsx';
import { AdminPanel } from '../admin/AdminPanel.jsx';
import { Pagination } from '../../components/ListControls.jsx';
import {
  addWalletCard,
  getMasterCards,
  getMatchedOffers,
  getWallet,
  removeWalletCard,
} from '../../services/perksApi.js';
import { logoutAccount } from '../../services/authApi.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CATEGORIES = [
  { id: 'ALL', label: 'All offers', icon: 'spark' },
  { id: 'MOVIES', label: 'Movies', icon: 'movie' },
  { id: 'DINING', label: 'Dining', icon: 'coffee', aliases: ['FOOD'] },
  { id: 'SHOPPING', label: 'Shopping', icon: 'bag' },
  { id: 'GROCERY', label: 'Grocery', icon: 'grocery' },
  { id: 'HOTELS', label: 'Hotels', icon: 'bed' },
  { id: 'TRAVEL', label: 'Travel', icon: 'plane' },
];

function getDashboardSections(role) {
  return role === 'admin'
    ? ['admin-overview', 'admin-users', 'admin-cards', 'admin-offers', 'profile']
    : ['overview', 'wallet', 'offers', 'profile'];
}

function getSavedSection(user) {
  const sections = getDashboardSections(user.role);
  const defaultSection = user.role === 'admin' ? 'admin-overview' : 'overview';
  const storageKey = `offersbite-dashboard-section:${user.email}:${user.role}`;
  const savedSection = window.localStorage.getItem(storageKey);
  return sections.includes(savedSection) ? savedSection : defaultSection;
}

export function DashboardPage({ user, onUserUpdated, onLogout, theme, onToggleTheme }) {
  const [activeSection, setActiveSection] = useState(() => getSavedSection(user));
  const [masterCards, setMasterCards] = useState([]);
  const [wallet, setWallet] = useState([]);
  const [offers, setOffers] = useState([]);
  const [day, setDay] = useState(String(new Date().getDay()));
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [offerCardFilter, setOfferCardFilter] = useState('');
  const [offerPage, setOfferPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const sections = getDashboardSections(user.role);
    if (!sections.includes(activeSection)) {
      setActiveSection(getSavedSection(user));
      return;
    }
    const storageKey = `offersbite-dashboard-section:${user.email}:${user.role}`;
    window.localStorage.setItem(storageKey, activeSection);
  }, [activeSection, user.email, user.role]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogue, currentWallet, matchedOffers] = await Promise.all([
        getMasterCards(),
        getWallet(),
        getMatchedOffers(day),
      ]);
      setMasterCards(catalogue);
      setWallet(currentWallet);
      setOffers(matchedOffers);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 401) onLogout();
    } finally {
      setLoading(false);
    }
  }, [day, onLogout]);

  useEffect(() => {
    if (user.role === 'admin') return undefined;
    loadDashboard();
    return undefined;
  }, [loadDashboard, user.role]);

  const visibleOffers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return offers.filter((offer) => {
      const selectedCategory = CATEGORIES.find((item) => item.id === category);
      const categoryMatch = category === 'ALL'
        || category === offer.category?.toUpperCase()
        || selectedCategory?.aliases?.includes(offer.category?.toUpperCase());
      const cardMatch = !offerCardFilter
        || `${offer.bank_name}::${offer.card_name}` === offerCardFilter;
      const searchMatch = !normalizedSearch || [
        offer.merchant_name,
        offer.category,
        offer.offer_headline,
        offer.bank_name,
        offer.card_name,
        offer.cardholder_label,
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));
      return categoryMatch && cardMatch && searchMatch;
    });
  }, [category, offerCardFilter, offers, search]);

  const offerPageSize = 12;
  const pageOffers = visibleOffers.slice((offerPage - 1) * offerPageSize, offerPage * offerPageSize);
  useEffect(() => {
    setOfferPage((current) => Math.min(current, Math.max(1, Math.ceil(visibleOffers.length / offerPageSize))));
  }, [visibleOffers.length]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const offer of offers) counts[offer.category] = (counts[offer.category] || 0) + 1;
    return counts;
  }, [offers]);

  const bestCap = useMemo(
    () => offers.reduce((best, offer) => Math.max(best, Number(offer.max_discount) || 0), 0),
    [offers],
  );

  async function handleDayChange(event) {
    setDay(event.target.value);
    setOfferPage(1);
  }

  async function handleAddCard(payload) {
    setSaving(true);
    try {
      const result = await addWalletCard(payload);
      await loadDashboard();
      setToast(result.message === 'Already exists' ? 'That card is already in your wallet.' : 'Card added. Your eligible offers are updated.');
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveCard(cardId) {
    setSaving(true);
    try {
      await removeWalletCard(cardId);
      await loadDashboard();
      setToast('Card removed from your household wallet.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      await logoutAccount();
      onLogout();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function navigate(section) {
    setActiveSection(section);
    setCategory('ALL');
    setSearch('');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><Brand /></div>
        <div className="workspace-switch">
          <span className="workspace-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <span className="workspace-copy"><strong>My household</strong><small>Personal space</small></span>
          <span className="workspace-dots" aria-hidden="true">···</span>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          {user.role === 'admin' ? (
            <>
              <div className="sidebar-label admin-sidebar-label">MANAGEMENT</div>
              <NavButton id="admin-overview" active={activeSection} onClick={navigate} icon="grid" label="Overview" />
              <NavButton id="admin-users" active={activeSection} onClick={navigate} icon="user" label="Users" />
              <NavButton id="admin-cards" active={activeSection} onClick={navigate} icon="card" label="Cards" />
              <NavButton id="admin-offers" active={activeSection} onClick={navigate} icon="spark" label="Offers" />
            </>
          ) : (
            <>
              <NavButton id="overview" active={activeSection} onClick={navigate} icon="grid" label="Overview" />
              <NavButton id="wallet" active={activeSection} onClick={navigate} icon="wallet" label="My cards" badge={wallet.length || null} />
              <NavButton id="offers" active={activeSection} onClick={navigate} icon="spark" label="Eligible offers" badge={offers.length || null} />
            </>
          )}
        </nav>

        <div className="sidebar-user">
          <span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <span className="sidebar-user-info"><strong>{user.name}</strong><small>Personal account</small></span>
          <button className="icon-button side-user-menu" aria-label="Open account profile" onClick={() => navigate('profile')}>
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-mobile-heading">
            <Brand compact />
          </div>
          <div className="breadcrumb"><span>My household</span><Icon name="chevron" size={14} /><strong>{sectionTitle(activeSection)}</strong></div>
          <div className="topbar-actions">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <span className="topbar-date">{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span>
            <button className="profile-trigger" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-haspopup="dialog" aria-controls="profile-settings">
              <span className="user-avatar user-avatar-small">{user.name.slice(0, 1).toUpperCase()}</span>
              <span>{user.name.split(' ')[0]}</span>
              <Icon name="chevron" size={15} className="profile-caret" />
            </button>
            {profileOpen && (
              <ProfileMenu
                user={user}
                onUserUpdated={onUserUpdated}
                onClose={() => setProfileOpen(false)}
                onLogout={handleSignOut}
              />
            )}
          </div>
        </header>

        {error && <div className="app-alert" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
        {toast && <div className="toast-message" role="status"><Icon name="check" size={16} />{toast}<button onClick={() => setToast('')} aria-label="Dismiss message">×</button></div>}

        <div className="page-content">
          {activeSection === 'profile' ? (
            <ProfilePage user={user} onUserUpdated={onUserUpdated} onLogout={handleSignOut} />
          ) : user.role === 'admin' && activeSection.startsWith('admin-') ? (
            <AdminPanel user={user} page={activeSection} onNavigate={navigate} />
          ) : activeSection === 'wallet' ? (
            <WalletPanel
              cards={masterCards}
              wallet={wallet}
              loading={loading}
              saving={saving}
              error={error}
              onAdd={handleAddCard}
              onRemove={handleRemoveCard}
            />
          ) : (
            <>
              {activeSection === 'overview' && (
                <DashboardWelcome
                  user={user}
                  walletCount={wallet.length}
                  offerCount={offers.length}
                  bestCap={bestCap}
                  onAddCard={() => navigate('wallet')}
                />
              )}
              <section className="offers-section" aria-labelledby="offers-heading">
                <div className="section-heading-row">
                  <div>
                    <h2 id="offers-heading">{activeSection === 'offers' ? 'All your eligible offers' : 'Offers picked for you'}</h2>
                  </div>
                  <label className="day-select-wrap">
                    <span><Icon name="clock" size={15} /> Valid on</span>
                    <select value={day} onChange={handleDayChange} aria-label="Filter offers by valid day">
                      {DAYS.map((name, index) => <option key={name} value={index}>{name}</option>)}
                    </select>
                  </label>
                </div>

                {wallet.length > 0 && (
                  <div className="wallet-context">
                    <span className="context-check"><Icon name="check" size={14} /></span>
                    <span><strong>{wallet.length}</strong> {wallet.length === 1 ? 'card' : 'cards'}</span>
                    <button onClick={() => navigate('wallet')}>Manage cards <Icon name="chevron" size={14} /></button>
                  </div>
                )}

                <div className="offer-toolbar">
                  <div className="category-tabs" role="tablist" aria-label="Filter eligible offers by category">
                    {CATEGORIES.map((item) => {
                      const categoryCount = item.id === 'ALL'
                        ? offers.length
                        : [item.id, ...(item.aliases || [])].reduce((count, id) => count + (categoryCounts[id] || 0), 0);
                      if (item.id !== 'ALL' && categoryCount === 0) return null;
                      return (
                        <button
                          key={item.id}
                          role="tab"
                          aria-selected={category === item.id}
                          className={`category-tab${category === item.id ? ' active' : ''}`}
                          onClick={() => { setCategory(item.id); setOfferPage(1); }}
                        >
                          <Icon name={item.icon} size={15} />
                          {item.label}
                          <span>{categoryCount}</span>
                        </button>
                      );
                    })}
                  </div>
                  <label className="offer-search">
                    <Icon name="search" size={17} />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => { setSearch(event.target.value); setOfferPage(1); }}
                      placeholder="Search offers"
                      aria-label="Search eligible offers"
                    />
                  </label>
                  {wallet.length > 0 && (
                    <label className="offer-card-filter">
                      <Icon name="card" size={15} />
                      <select
                        value={offerCardFilter}
                        onChange={(event) => { setOfferCardFilter(event.target.value); setOfferPage(1); }}
                        aria-label="Filter offers by card"
                      >
                        <option value="">All cards</option>
                        {Array.from(new Map(wallet.map((card) => [`${card.bank_name}::${card.card_name}`, card])).values()).map((card) => {
                          const cardValue = `${card.bank_name}::${card.card_name}`;
                          return <option key={`${card.master_card_id}-${card.cardholder_label}`} value={cardValue}>{card.bank_name} · {card.card_name}</option>;
                        })}
                      </select>
                    </label>
                  )}
                </div>

                {loading ? (
                  <OfferLoading />
                ) : wallet.length === 0 ? (
                  <EmptyState
                    icon="wallet"
                    title="No cards added"
                    description="Add a card to see matching offers."
                    action="Add card"
                    onAction={() => navigate('wallet')}
                  />
                ) : visibleOffers.length === 0 ? (
                  <EmptyState
                    icon={search || category !== 'ALL' || offerCardFilter ? 'search' : 'spark'}
                    title={search || category !== 'ALL' || offerCardFilter ? 'No matching offers' : `No offers for ${DAYS[Number(day)]}`}
                    description={search || category !== 'ALL' || offerCardFilter ? 'No offers match the selected filters.' : 'No eligible offers are available for this day.'}
                    action={search || category !== 'ALL' || offerCardFilter ? 'Clear filters' : 'Manage cards'}
                    onAction={() => {
                      if (search || category !== 'ALL' || offerCardFilter) {
                        setSearch('');
                        setCategory('ALL');
                        setOfferCardFilter('');
                        setOfferPage(1);
                      } else navigate('wallet');
                    }}
                  />
                ) : (
                  <div className="offer-grid">
                    {pageOffers.map((offer, index) => (
                      <OfferCard key={`${offer.offer_id}-${offer.cardholder_label}-${offer.card_name}`} offer={offer} featured={offerPage === 1 && index === 0 && category === 'ALL' && !search && !offerCardFilter} />
                    ))}
                  </div>
                )}

                {!loading && visibleOffers.length > 0 && (
                  <>
                    <Pagination page={offerPage} pageSize={offerPageSize} total={visibleOffers.length} onPageChange={setOfferPage} />
                    <div className="results-note">
                      <span className="results-dot" />
                      {visibleOffers.length} eligible {visibleOffers.length === 1 ? 'offer' : 'offers'} for {DAYS[Number(day)]}
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </main>
      <MobileNavigation role={user.role} active={activeSection} onNavigate={navigate} />
    </div>
  );
}

function NavButton({ id, active, onClick, icon, label, badge }) {
  return (
    <button className={`nav-item${active === id ? ' active' : ''}`} onClick={() => onClick(id)} aria-current={active === id ? 'page' : undefined}>
      <Icon name={icon} size={18} />
      <span>{label}</span>
      {badge && <span className="nav-badge">{badge}</span>}
    </button>
  );
}

function MobileNavigation({ role, active, onNavigate }) {
  const items = role === 'admin'
    ? [
      { id: 'admin-overview', icon: 'grid', label: 'Overview' },
      { id: 'admin-users', icon: 'user', label: 'Users' },
      { id: 'admin-cards', icon: 'card', label: 'Cards' },
      { id: 'admin-offers', icon: 'spark', label: 'Offers' },
      { id: 'profile', icon: 'user', label: 'Account' },
    ]
    : [
      { id: 'overview', icon: 'grid', label: 'Overview' },
      { id: 'wallet', icon: 'wallet', label: 'Cards' },
      { id: 'offers', icon: 'spark', label: 'Offers' },
      { id: 'profile', icon: 'user', label: 'Account' },
    ];

  return (
    <nav className={`mobile-bottom-nav${role === 'admin' ? ' mobile-bottom-nav-admin' : ''}`} aria-label="Main navigation">
      {items.map((item) => (
        <button
          key={item.id}
          className={`mobile-nav-item${active === item.id ? ' active' : ''}`}
          onClick={() => onNavigate(item.id)}
          aria-current={active === item.id ? 'page' : undefined}
        >
          <Icon name={item.icon} size={21} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function DashboardWelcome({ user, walletCount, offerCount, bestCap, onAddCard }) {
  const firstName = user.name.split(' ')[0];
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <section className="welcome-panel">
      <div className="welcome-copy">
        <h1>{greeting}, {firstName}<span className="welcome-comma">.</span></h1>
        {walletCount === 0 ? (
          <button className="button button-welcome" onClick={onAddCard}>Add card <Icon name="chevron" size={16} /></button>
        ) : null}
      </div>
      <div className="welcome-visual" aria-hidden="true">
        <div className="visual-sun" />
        <div className="floating-card floating-card-back"><span>VISA</span><i /></div>
        <div className="floating-card floating-card-front"><span className="mini-card-chip" /><b>OffersBite</b></div>
        <span className="visual-spark visual-spark-one">✳</span>
        <span className="visual-spark visual-spark-two">✦</span>
        <span className="visual-pill">your cards, your perks</span>
      </div>
      <div className="welcome-stats">
        <Stat icon="wallet" label="Cards" value={walletCount} />
        <Stat icon="spark" label="Eligible offers" value={offerCount} />
        <Stat icon="arrow" label="Highest discount cap" value={bestCap ? `₹${bestCap.toLocaleString('en-IN')}` : '—'} />
      </div>
    </section>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="stat-item">
      <span className="stat-icon"><Icon name={icon} size={17} /></span>
      <div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong></div>
    </div>
  );
}

function EmptyState({ icon, title, description, action, onAction }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      <button className="button button-secondary" onClick={onAction}>{action}<Icon name="chevron" size={15} /></button>
    </div>
  );
}

function OfferLoading() {
  return (
    <div className="offer-grid" aria-label="Loading offers">
      {[0, 1, 2].map((item) => <div className="offer-skeleton" key={item}><span /><span /><span /><span /></div>)}
    </div>
  );
}

function sectionTitle(section) {
  return ({
    overview: 'Overview',
    wallet: 'My cards',
    offers: 'Eligible offers',
    'admin-overview': 'Admin overview',
    'admin-users': 'Users',
    'admin-cards': 'Cards',
    'admin-offers': 'Offers',
    profile: 'Account',
  })[section] || 'Overview';
}
