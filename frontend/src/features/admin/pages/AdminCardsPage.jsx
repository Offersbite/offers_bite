import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../components/Brand.jsx';
import { Modal } from '../../../components/Modal.jsx';
import { ListToolbar, Pagination } from '../../../components/ListControls.jsx';
import {
  createAdminCard,
  deleteAdminCard,
  getAdminCards,
  updateAdminCard,
} from '../../../services/adminApi.js';
import { AdminInput, AdminSelect } from '../components/AdminFormField.jsx';

const EMPTY_CARD = { bank_name: '', card_name: '', card_type: 'CREDIT', network: 'VISA' };
const CARD_TYPES = ['CREDIT', 'DEBIT'];
const CARD_NETWORKS = ['VISA', 'MASTERCARD', 'RUPAY', 'AMEX', 'DINERS', 'OTHER'];

export function AdminCardsPage({ onChanged }) {
  const [cards, setCards] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_CARD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [cardType, setCardType] = useState('');
  const [network, setNetwork] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const visibleCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cards.filter((card) => {
      const matchesSearch = !query || [card.bank_name, card.card_name, card.network, card.card_type]
        .some((value) => value?.toLowerCase().includes(query));
      return matchesSearch
        && (!cardType || card.card_type === cardType)
        && (!network || card.network === network);
    });
  }, [cardType, cards, network, search]);
  const pageCards = visibleCards.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(visibleCards.length / pageSize))));
  }, [visibleCards.length]);

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCards(await getAdminCards());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  function editCard(card = null) {
    setEditingId(card?.id ?? null);
    setForm(card ? {
      bank_name: card.bank_name,
      card_name: card.card_name,
      card_type: card.card_type,
      network: card.network,
    } : EMPTY_CARD);
    setEditorOpen(true);
    setError('');
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
    setForm(EMPTY_CARD);
  }

  async function submitCard(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (editingId === null) {
        await createAdminCard(form);
        setMessage('Card added.');
      } else {
        await updateAdminCard(editingId, form);
        setMessage('Card updated.');
      }
      closeEditor();
      await loadCards();
      onChanged();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeCard(card) {
    if (!window.confirm(`Delete ${card.bank_name} ${card.card_name}?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deleteAdminCard(card.id);
      await loadCards();
      onChanged();
      setMessage('Card deleted.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-page-section" aria-label="Card catalogue management">
      {error && !editorOpen && <div className="admin-alert" role="alert">{error}</div>}
      {message && <div className="admin-success" role="status">{message}</div>}
      <section className="admin-panel-card admin-full-list-card">
        <div className="admin-panel-heading">
          <h2>Cards</h2>
          <button className="button button-primary" type="button" onClick={() => editCard()}>
            <Icon name="plus" size={16} /> Add card
          </button>
        </div>
        <ListToolbar
          search={search}
          onSearch={(value) => { setSearch(value); setPage(1); }}
          placeholder="Search bank or card"
          filters={[
            { label: 'Type', value: cardType, options: [{ value: 'CREDIT', label: 'Credit' }, { value: 'DEBIT', label: 'Debit' }], onChange: (value) => { setCardType(value); setPage(1); } },
            { label: 'Network', value: network, options: CARD_NETWORKS.map((value) => ({ value, label: value })), onChange: (value) => { setNetwork(value); setPage(1); } },
          ]}
        />
        {loading ? (
          <div className="admin-loading"><span className="wallet-loader" /> Loading…</div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>Bank</th><th>Card</th><th>Type</th><th>Network</th><th>Actions</th></tr></thead>
              <tbody>
                {pageCards.map((card) => (
                  <tr key={card.id}>
                    <td data-label="Bank">{card.bank_name}</td>
                    <td data-label="Card">{card.card_name}</td>
                    <td data-label="Type">{card.card_type}</td>
                    <td data-label="Network">{card.network}</td>
                    <td data-label="Actions" className="admin-actions-cell">
                      <button className="admin-icon-action" type="button" title="Edit card" aria-label={`Edit ${card.bank_name} ${card.card_name}`} disabled={saving} onClick={() => editCard(card)}><Icon name="edit" size={16} /></button>
                      <button className="admin-icon-action danger" type="button" title="Delete card" aria-label={`Delete ${card.bank_name} ${card.card_name}`} disabled={saving} onClick={() => removeCard(card)}><Icon name="trash" size={16} /></button>
                    </td>
                  </tr>
                ))}
                {visibleCards.length === 0 && <tr><td colSpan="5" className="admin-empty">{cards.length ? 'No cards match these filters.' : 'No cards.'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={visibleCards.length} onPageChange={setPage} />
      </section>

      {editorOpen && (
        <Modal title={editingId === null ? 'Add card' : 'Edit card'} onClose={closeEditor}>
          <form className="admin-form admin-editor-form" onSubmit={submitCard}>
            {error && <div className="admin-alert" role="alert">{error}</div>}
            <AdminInput label="Bank" value={form.bank_name} onChange={(bank_name) => setForm({ ...form, bank_name })} required />
            <AdminInput label="Card name" value={form.card_name} onChange={(card_name) => setForm({ ...form, card_name })} required />
            <div className="admin-form-row">
              <AdminSelect label="Card type" value={form.card_type} options={CARD_TYPES} onChange={(card_type) => setForm({ ...form, card_type })} />
              <AdminSelect label="Network" value={form.network} options={CARD_NETWORKS} onChange={(network) => setForm({ ...form, network })} />
            </div>
            <div className="admin-form-actions">
              <button type="button" className="button button-secondary" onClick={closeEditor} disabled={saving}>Cancel</button>
              <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : editingId === null ? 'Add card' : 'Save changes'}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
