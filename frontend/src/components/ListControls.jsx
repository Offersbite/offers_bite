import { useId, useState } from 'react';
import { Icon } from './Brand.jsx';

export function ListToolbar({ search, onSearch, placeholder, filters = [] }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterId = useId();
  const activeFilters = filters.filter((filter) => filter.value).length;
  return (
    <div className="list-toolbar">
      <label className="admin-search list-search">
        <Icon name="search" size={16} />
        <input type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} />
      </label>
      {filters.length > 0 && <button className="mobile-filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls={filterId}
        onClick={() => setFiltersOpen((open) => !open)}><Icon name="filter" size={16} /> Filters{activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}</button>}
      <div id={filterId} className={`list-filter-group${filtersOpen ? ' is-open' : ''}`}>
      {filters.map((filter) => (
        <label className="list-filter" key={filter.label}>
          <span>{filter.label}</span>
          <select aria-label={filter.label} value={filter.value} onChange={(event) => filter.onChange(event.target.value)}>
            <option value="">{filter.allLabel || `All ${filter.label.toLowerCase()}`}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      ))}
      {activeFilters > 0 && <button className="clear-list-filters" type="button" onClick={() => filters.forEach((filter) => filter.onChange(''))}>Clear filters</button>}
      </div>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPageChange }) {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount < 2) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav className="list-pagination" aria-label="List pagination">
      <span>Showing {first}–{last} of {total}</span>
      <div className="pagination-actions">
        <button type="button" className="admin-text-button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
        <span>Page {page} of {pageCount}</span>
        <button type="button" className="admin-text-button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>Next</button>
      </div>
    </nav>
  );
}
