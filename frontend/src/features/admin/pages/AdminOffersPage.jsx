import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../../components/Brand.jsx';
import {
  createAdminOffer,
  deleteAdminOffer,
  getAdminCards,
  getAdminOffers,
  updateAdminOffer,
  uploadAdminOffers,
} from '../../../services/adminApi.js';
import { AdminInput, toggleNumber, toDateInput } from '../components/AdminFormField.jsx';
import { ListToolbar, Pagination } from '../../../components/ListControls.jsx';
import { Modal } from '../../../components/Modal.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EMPTY_OFFER = {
  merchant_name: '',
  category: 'DINING',
  offer_headline: '',
  coupon_code: '',
  min_spend: '0',
  max_discount: '',
  valid_days: [0, 1, 2, 3, 4, 5, 6],
  applicable_master_card_ids: [],
  expires_on: '',
  is_matchable: true,
};

export function AdminOffersPage({ onChanged }) {
  const [offers, setOffers] = useState([]);
  const [cards, setCards] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_OFFER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [search, setSearch] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [merchantFilter, setMerchantFilter] = useState('');
  const [cardFilter, setCardFilter] = useState('');
  const [validDay, setValidDay] = useState('');
  const [page, setPage] = useState(1);
  const fileInput = useRef(null);
  const pageSize = 10;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextOffers, nextCards] = await Promise.all([getAdminOffers(), getAdminCards()]);
      setOffers(nextOffers);
      setCards(nextCards);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleOffers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selectedBankCardIds = new Set(cards
      .filter((card) => !bankFilter || card.bank_name === bankFilter)
      .map((card) => String(card.id)));
    return offers.filter((offer) => {
      const matchesSearch = !query || [
        offer.merchant_name,
        offer.offer_headline,
        offer.coupon_code,
        offer.category,
      ].some((value) => value?.toLowerCase().includes(query));
      const matchesCard = !cardFilter || offer.applicable_master_card_ids
        ?.some((id) => String(id) === cardFilter);
      const matchesBank = !bankFilter || offer.applicable_master_card_ids
        ?.some((id) => selectedBankCardIds.has(String(id)));
      const matchesMerchant = !merchantFilter || offer.merchant_name === merchantFilter;
      const matchesDay = !validDay || offer.valid_days?.includes(Number(validDay));
      return matchesSearch && matchesCard && matchesBank && matchesMerchant && matchesDay;
    });
  }, [bankFilter, cardFilter, cards, merchantFilter, offers, search, validDay]);
  const pageOffers = visibleOffers.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(visibleOffers.length / pageSize))));
  }, [visibleOffers.length]);

  function editOffer(offer = null) {
    setEditingId(offer?.id ?? null);
    setForm(offer ? {
      merchant_name: offer.merchant_name,
      category: offer.category,
      offer_headline: offer.offer_headline,
      coupon_code: offer.coupon_code || '',
      min_spend: String(offer.min_spend ?? 0),
      max_discount: offer.max_discount == null ? '' : String(offer.max_discount),
      valid_days: offer.valid_days,
      applicable_master_card_ids: offer.applicable_master_card_ids,
      expires_on: toDateInput(offer.expires_on),
      is_matchable: offer.is_matchable !== false,
    } : EMPTY_OFFER);
    setEditorOpen(true);
    setError('');
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
    setForm(EMPTY_OFFER);
  }

  async function uploadWorkbook(event) {
    const [file] = event.target.files || [];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    setMessage('');
    setUploadResult(null);
    try {
      const result = await uploadAdminOffers(file);
      setUploadResult(result);
      setMessage(`Imported ${result.rows_imported} rows from ${file.name}.`);
      await loadData();
      onChanged();
    } catch (requestError) {
      setError(requestError.message);
      const details = requestError.details;
      if (details?.result) setUploadResult(details.result);
      else if (details?.errors?.length) setUploadResult({ errors: details.errors });
    } finally {
      setUploading(false);
    }
  }

  async function submitOffer(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        ...form,
        min_spend: Number(form.min_spend),
        max_discount: form.max_discount === '' ? null : Number(form.max_discount),
        expires_on: form.expires_on ? new Date(`${form.expires_on}T23:59:59.999Z`).toISOString() : null,
      };
      if (editingId === null) {
        await createAdminOffer(payload);
        setMessage('Offer added.');
      } else {
        await updateAdminOffer(editingId, payload);
        setMessage('Offer updated.');
      }
      closeEditor();
      await loadData();
      onChanged();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeOffer(offer) {
    if (!window.confirm(`Delete the ${offer.merchant_name} offer?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deleteAdminOffer(offer.id);
      await loadData();
      onChanged();
      setMessage('Offer deleted.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const bankNames = [...new Set(cards.map((card) => card.bank_name))].sort();
  const merchantNames = [...new Set(offers.map((offer) => offer.merchant_name))].sort();

  return (
    <section className="admin-page-section" aria-label="Offer management">
      {error && !editorOpen && <div className="admin-alert" role="alert">{error}</div>}
      {message && <div className="admin-success" role="status">{message}</div>}
      <section className="admin-panel-card admin-full-list-card">
        <div className="admin-panel-heading">
          <h2>Offers</h2>
          <div className="admin-list-actions">
            <button type="button" className="button button-secondary" onClick={() => fileInput.current?.click()} disabled={uploading || saving}>
              {uploading ? 'Uploading…' : 'Bulk upload Excel'}
            </button>
            <button type="button" className="button button-primary" onClick={() => editOffer()}>
              <Icon name="plus" size={16} /> Add offer
            </button>
            <input
              ref={fileInput}
              className="admin-file-input"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={uploadWorkbook}
            />
          </div>
        </div>
        <ListToolbar
          search={search}
          onSearch={(value) => { setSearch(value); setPage(1); }}
          placeholder="Search merchant or offer"
          filters={[
            { label: 'Bank', value: bankFilter, options: bankNames.map((value) => ({ value, label: value })), onChange: (value) => { setBankFilter(value); setPage(1); } },
            { label: 'Merchant', value: merchantFilter, options: merchantNames.map((value) => ({ value, label: value })), onChange: (value) => { setMerchantFilter(value); setPage(1); } },
            { label: 'Card', value: cardFilter, options: cards.map((card) => ({ value: String(card.id), label: `${card.bank_name} · ${card.card_name}` })), onChange: (value) => { setCardFilter(value); setPage(1); } },
            { label: 'Day', value: validDay, options: WEEKDAYS.map((label, value) => ({ value: String(value), label })), onChange: (value) => { setValidDay(value); setPage(1); } },
          ]}
        />
        {uploadResult && (
          <div className="admin-import-result" role="status">
            {uploadResult.rows_imported != null ? (
              <>
                <strong>{uploadResult.rows_imported} / {uploadResult.rows_total} rows saved</strong>
                <span>{uploadResult.cards_created} cards added · {uploadResult.card_matchable_rows} rows linked · {uploadResult.unmatched_rows} excluded from matching · {uploadResult.rows_without_expiry} without expiry</span>
                {uploadResult.missing_rows?.length > 0 && <span>Missing rows: {uploadResult.missing_rows.map((row) => `${row.sheet} #${row.row}`).join(', ')}</span>}
                {uploadResult.errors?.map((item, index) => <span key={`${item.sheet}-${item.row}-${index}`}>{item.sheet ? `${item.sheet}, row ${item.row}: ` : ''}{item.message}</span>)}
              </>
            ) : (
              uploadResult.errors?.map((item, index) => <span key={`${item.sheet}-${item.row}-${index}`}>{item.sheet ? `${item.sheet}, row ${item.row}: ` : ''}{item.message}</span>)
            )}
          </div>
        )}
        {loading ? (
          <div className="admin-loading"><span className="wallet-loader" /> Loading…</div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th>Merchant</th><th>Category</th><th>Coupon</th><th>Bank / card</th><th>Valid days</th><th>Expires</th><th>Actions</th></tr></thead>
              <tbody>
                {pageOffers.map((offer) => {
                  const eligibleCards = cards.filter((card) => offer.applicable_master_card_ids?.includes(card.id));
                  const offerDays = offer.valid_days?.length === 7
                    ? 'Every day'
                    : offer.valid_days?.map((day) => WEEKDAYS[day]).filter(Boolean).join(', ') || '—';
                  return (
                    <tr key={offer.id}>
                      <td data-label="Merchant"><strong>{offer.merchant_name}</strong><small>{offer.offer_headline}</small></td>
                      <td data-label="Category">{offer.category}</td>
                      <td data-label="Coupon">{offer.coupon_code || '—'}</td>
                      <td data-label="Bank / card">{eligibleCards.length ? eligibleCards.map((card) => `${card.bank_name} · ${card.card_name}`).join(', ') : '—'}</td>
                      <td data-label="Valid days">{offerDays}</td>
                      <td data-label="Expires">{toDateInput(offer.expires_on) || 'No expiry'}</td>
                      <td data-label="Actions" className="admin-actions-cell">
                        <button className="admin-icon-action" type="button" title="Edit offer" aria-label={`Edit ${offer.merchant_name} offer`} disabled={saving} onClick={() => editOffer(offer)}><Icon name="edit" size={16} /></button>
                        <button className="admin-icon-action danger" type="button" title="Delete offer" aria-label={`Delete ${offer.merchant_name} offer`} disabled={saving} onClick={() => removeOffer(offer)}><Icon name="trash" size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
                {visibleOffers.length === 0 && <tr><td colSpan="7" className="admin-empty">{offers.length ? 'No offers match these filters.' : 'No offers.'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} total={visibleOffers.length} onPageChange={setPage} />
      </section>

      {editorOpen && (
        <Modal title={editingId === null ? 'Add offer' : 'Edit offer'} onClose={closeEditor} wide>
          <form className="admin-form admin-editor-form" onSubmit={submitOffer}>
            {error && <div className="admin-alert" role="alert">{error}</div>}
            <AdminInput label="Merchant" value={form.merchant_name} onChange={(merchant_name) => setForm({ ...form, merchant_name })} required />
            <AdminInput label="Offer headline" value={form.offer_headline} onChange={(offer_headline) => setForm({ ...form, offer_headline })} required />
            <div className="admin-form-row">
              <AdminInput label="Category" value={form.category} onChange={(category) => setForm({ ...form, category: category.toUpperCase() })} required />
              <AdminInput label="Coupon code" value={form.coupon_code} onChange={(coupon_code) => setForm({ ...form, coupon_code })} />
            </div>
            <div className="admin-form-row">
              <AdminInput label="Minimum spend (₹)" type="number" min="0" step="0.01" value={form.min_spend} onChange={(min_spend) => setForm({ ...form, min_spend })} required />
              <AdminInput label="Maximum discount (₹)" type="number" min="0" step="0.01" value={form.max_discount} onChange={(max_discount) => setForm({ ...form, max_discount })} />
            </div>
            <AdminInput label="Expires on" type="date" value={form.expires_on} onChange={(expires_on) => setForm({ ...form, expires_on })} />
            <fieldset className="admin-fieldset">
              <legend>Valid days</legend>
              <div className="admin-check-options">
                {WEEKDAYS.map((name, day) => (
                  <label key={name}><input type="checkbox" checked={form.valid_days.includes(day)} onChange={() => setForm({ ...form, valid_days: toggleNumber(form.valid_days, day) })} />{name}</label>
                ))}
              </div>
            </fieldset>
            <fieldset className="admin-fieldset">
              <legend>Eligible cards</legend>
              <div className="admin-card-options">
                {cards.map((card) => (
                  <label key={card.id}>
                    <input type="checkbox" checked={form.applicable_master_card_ids.includes(card.id)} onChange={() => setForm({ ...form, applicable_master_card_ids: toggleNumber(form.applicable_master_card_ids, card.id) })} />
                    <span>{card.bank_name} · {card.card_name}</span>
                  </label>
                ))}
                {!loading && cards.length === 0 && <small>Add cards first.</small>}
              </div>
            </fieldset>
            <label className="admin-match-toggle">
              <input
                type="checkbox"
                checked={form.is_matchable}
                disabled={!form.applicable_master_card_ids.length}
                onChange={(event) => setForm({ ...form, is_matchable: event.target.checked })}
              />
              Match this offer to household cards
            </label>
            <div className="admin-form-actions">
              <button type="button" className="button button-secondary" onClick={closeEditor} disabled={saving}>Cancel</button>
              <button className="button button-primary" disabled={saving || loading || !cards.length}>{saving ? 'Saving…' : editingId === null ? 'Add offer' : 'Save changes'}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
