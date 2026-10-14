export function CatalogueCounts({ counts, kind }) {
  const statuses = kind === 'Users' ? ['total', 'active', 'inactive'] : ['total', 'active', 'inactive', 'expired'];
  return <div className={`catalogue-counts${kind === 'Users' ? ' catalogue-user-counts' : ''}`} aria-label={`${kind} status totals`}>
    {statuses.map((status) => <span key={status} className={`catalogue-count catalogue-count-${status}`}
      title={kind === 'Cards' && status === 'expired' ? 'Catalogue cards do not store expiry dates.' : undefined}>
      <span>{status === 'total' ? 'Total' : status[0].toUpperCase() + status.slice(1)}</span><strong>{counts?.[status] ?? 0}</strong>
    </span>)}
  </div>;
}

export function countCatalogue(records) {
  return records.reduce((counts, record) => {
    const status = ['active', 'inactive', 'expired'].includes(record.status) ? record.status : 'active';
    counts[status] += 1;
    return counts;
  }, { total: records.length, active: 0, inactive: 0, expired: 0 });
}
