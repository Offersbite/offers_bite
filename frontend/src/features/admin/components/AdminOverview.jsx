import { Icon } from '../../../components/Brand.jsx';

export function AdminOverview({ summary, onNavigate }) {
  const cardCounts = summary.card_counts || {active: summary.cards, inactive: 0, expired: 0};
  const offerCounts = summary.offer_counts || {active: summary.active_offers, inactive: 0, expired: 0};
  const totals = [
    {label: 'Users', value: summary.users, icon: 'user', page: 'admin-users'},
    {label: 'Cards', value: summary.cards, icon: 'card', page: 'admin-cards'},
    {label: 'Offers', value: summary.offers, icon: 'spark', page: 'admin-offers'},
  ];
  return <div className="admin-overview">
    <header className="page-intro"><div><h1 className="page-title">Overview</h1><p>Your users, card catalogue and offers at a glance.</p></div></header>
    <div className="overview-totals" aria-label="Management totals">
      {totals.map((item) => <button key={item.label} className="overview-total" type="button" onClick={() => onNavigate(item.page)}>
        <span className="overview-total-icon"><Icon name={item.icon} size={20} /></span>
        <span>{item.label}</span><strong>{item.value ?? 0}</strong>
      </button>)}
    </div>
    <div className="overview-user-note"><span className="overview-status-dot" /><strong>{summary.active_users ?? 0}</strong> active users<span className="overview-note-divider" /><span>{Math.max(0, (summary.users || 0) - (summary.active_users || 0))} inactive</span></div>
    <div className="overview-catalogues">
      {[{label:'Cards', title:'Card catalogue', icon:'card', counts:cardCounts, total:summary.cards, page:'admin-cards'},
        {label:'Offers', title:'Merchant offers', icon:'spark', counts:offerCounts, total:summary.offers, page:'admin-offers'}].map((item) => <section key={item.label} className="overview-catalogue" aria-label={`${item.label} status summary`}>
        <div className="overview-catalogue-heading"><span className="overview-total-icon"><Icon name={item.icon} size={20} /></span><div><h2>{item.title}</h2><p>{item.label === 'Cards' ? 'Cards available for household wallets' : 'Offer eligibility and expiry tracking'}</p></div></div>
        <div className="overview-statuses">{['active','inactive','expired'].map((status) => <div key={status} className={`overview-status overview-status-${status}`}><span>{status[0].toUpperCase()+status.slice(1)}</span><strong>{item.counts[status] ?? 0}</strong></div>)}</div>
        <div className="overview-active-bar" role="img" aria-label={`${item.counts.active || 0} of ${item.total || 0} ${item.label.toLowerCase()} active`}><span style={{width:`${item.total ? Math.min(100, (item.counts.active || 0) / item.total * 100) : 0}%`}} /></div>
        <footer><span>{item.label === 'Cards' ? 'Catalogue cards have no expiry date.' : 'Expired offers are archived automatically.'}</span><button type="button" onClick={() => onNavigate(item.page)}>Manage {item.label.toLowerCase()} <Icon name="chevron" size={15} /></button></footer>
      </section>)}
    </div>
  </div>;
}
