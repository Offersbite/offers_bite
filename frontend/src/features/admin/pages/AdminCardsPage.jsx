import { CatalogueCounts, countCatalogue } from '../components/CatalogueCounts.jsx';
import { confirmAction } from '../../../services/alerts.js';
import { useActionFeedback } from '../../../components/useActionFeedback.js';
import { BulkUploadPanel } from '../components/BulkUploadPanel.jsx';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../components/Brand.jsx';
import { Modal } from '../../../components/Modal.jsx';
import { ListToolbar, Pagination } from '../../../components/ListControls.jsx';
import {
  createAdminCard,
  deleteAdminCard,
  getAdminCards,
  uploadAdminCards,
  updateAdminCard,
} from '../../../services/adminApi.js';

const EMPTY_CARD = {
  bank_name: '',
  card_name: '',
  card_type: 'CREDIT',
  network: 'VISA',
  tier_category: 'STANDARD',
};

const CARD_TYPES = ['CREDIT', 'DEBIT'];
const CARD_NETWORKS = ['VISA', 'MASTERCARD', 'RUPAY', 'AMEX', 'DINERS', 'OTHER'];
const POPULAR_BANKS = [
  'HDFC Bank',
  'ICICI Bank',
  'SBI Card',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'American Express',
  'IndusInd Bank',
  'RBL Bank',
  'IDFC FIRST Bank',
  'Yes Bank',
];
const POPULAR_TIERS = [
  'STANDARD',
  'PLATINUM',
  'SIGNATURE',
  'INFINITE',
  'GOLD',
  'REWARDS',
  'PREMIUM',
  'TITANIUM',
  'REGALIA',
  'CORAL',
];

export function AdminCardsPage({ onChanged }) {
  const [cards, setCards] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_CARD);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [cardType, setCardType] = useState('');
  const [network, setNetwork] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  useActionFeedback(message, error);

  const visibleCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cards.filter((card) => {
      const matchesSearch = !query || [
        card.bank_name,
        card.card_name,
        card.network,
        card.card_type,
        card.tier_category,
      ].some((value) => value?.toLowerCase().includes(query));
      return matchesSearch
        && (!cardType || card.card_type === cardType)
        && (!network || card.network === network)
        && (!tierFilter || card.tier_category === tierFilter);
    });
  }, [cardType, cards, network, search, tierFilter]);
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

  async function editCard(card = null) {
    if (card && !await confirmAction({ title: 'Edit card?', text: `Open ${card.bank_name} ${card.card_name} for editing?`, confirmText: 'Edit card' })) return;
    setEditingId(card?.id ?? null);
    setForm(card ? {
      bank_name: card.bank_name || '',
      card_name: card.card_name || '',
      card_type: card.card_type || 'CREDIT',
      network: card.network || 'VISA',
      tier_category: card.tier_category || 'STANDARD',
    } : EMPTY_CARD);
    setStep(1);
    setEditorOpen(true);
    setError('');
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
    setForm(EMPTY_CARD);
    setStep(1);
  }

  function handleNextStep(e) {
    e?.preventDefault();
    if (step === 1) {
      if (!form.bank_name.trim()) {
        setError('Please enter or select a Bank Name.');
        return;
      }
      setError('');
      setStep(2);
    } else if (step === 2) {
      if (!form.tier_category.trim()) {
        setForm((prev) => ({ ...prev, tier_category: 'STANDARD' }));
      }
      setError('');
      setStep(3);
    }
  }

  function handlePrevStep() {
    setError('');
    setStep((current) => Math.max(1, current - 1));
  }

  async function submitCard(event) {
    event.preventDefault();
    if (!form.bank_name.trim()) {
      setStep(1);
      setError('Please provide Bank Name.');
      return;
    }
    if (!form.card_name.trim()) {
      setStep(3);
      setError('Please provide Card_Name.');
      return;
    }

    const addAnother = editingId === null
      && event.nativeEvent.submitter?.value === 'add-another';
    if (!await confirmAction({ title: editingId === null ? 'Add card?' : 'Save card changes?', text: `${form.bank_name} - ${form.card_name}`, confirmText: editingId === null ? 'Add card' : 'Save changes' })) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        bank_name: form.bank_name.trim(),
        card_name: form.card_name.trim(),
        card_type: form.card_type,
        network: form.network,
        tier_category: (form.tier_category || 'STANDARD').trim().toUpperCase(),
      };
      if (editingId === null) {
        await createAdminCard(payload);
        setMessage(addAnother ? 'Card added. You can add another.' : 'Card added successfully.');
      } else {
        await updateAdminCard(editingId, payload);
        setMessage('Card updated successfully.');
      }
      if (addAnother) {
        setForm(EMPTY_CARD);
        setStep(1);
      } else {
        closeEditor();
      }
      await loadCards();
      onChanged();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function downloadTemplate() {
    const content = [
      'Bank Name,Card_Type,Network,Tier_Category,Card_Name',
      'HDFC Bank,CREDIT,VISA,REGALIA,Regalia Gold',
      'SBI Card,CREDIT,MASTERCARD,SIMPLICLICK,SimplyCLICK',
      'ICICI Bank,DEBIT,RUPAY,CORAL,Coral Debit Card',
      'Axis Bank,CREDIT,VISA,MAGNUS,Magnus',
      'American Express,CREDIT,AMEX,PLATINUM,Platinum Travel',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'offersbite-card-catalogue-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function removeCard(card) {
    if (!await confirmAction({ title: 'Delete card?', text: `Delete ${card.bank_name} ${card.card_name}? This action cannot be undone.`, confirmText: 'Delete card', danger: true })) return;
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

  const distinctTiers = useMemo(() => {
    return [...new Set(cards.map((c) => c.tier_category).filter(Boolean))].sort();
  }, [cards]);

  return (
    <section className="admin-page-section" aria-label="Card catalogue management">
      {error && !editorOpen && <div className="admin-alert" role="alert">{error}</div>}
      {message && <div className="admin-success" role="status">{message}</div>}

      <section className="admin-panel-card admin-full-list-card">
        <div className="admin-panel-heading">
          <div className="catalogue-heading"><h1 className="page-title">Cards</h1>{!loading && <CatalogueCounts kind="Cards" counts={countCatalogue(cards)} />}</div>
          <div className="admin-card-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setUploadOpen((open) => !open)}
              aria-expanded={uploadOpen}
              aria-controls="cards-bulk-upload"
              disabled={uploadBusy}
            >
              <Icon name="upload" size={16} /> Bulk upload
            </button>
            <button className="button button-primary" type="button" onClick={() => editCard()}>
              <Icon name="plus" size={16} /> Add card
            </button>
          </div>
        </div>

        {uploadOpen && (
          <BulkUploadPanel onBusyChange={setUploadBusy} kind="cards" onUpload={uploadAdminCards} onComplete={async () => { await loadCards(); onChanged(); }} onDownloadTemplate={downloadTemplate}>
            <p>One card per row, with these column headers:</p>
            <div className="card-bulk-columns">{['Bank Name', 'Card_Name', 'Card_Type', 'Network'].map((name) => <code key={name}>{name}</code>)}</div>
            <p><code>Tier_Category</code> is optional and defaults to STANDARD.</p>
            <p>Card type: CREDIT or DEBIT.<br />Networks: {CARD_NETWORKS.join(', ')}.</p>
            <span className="card-bulk-duplicate-note"><Icon name="check" size={15} /> Existing cards are skipped automatically.</span>
          </BulkUploadPanel>
        )}

        <ListToolbar
          search={search}
          onSearch={(value) => { setSearch(value); setPage(1); }}
          placeholder="Search bank, card, type or network"
          filters={[
            {
              label: 'Card_Type',
              value: cardType,
              options: [
                { value: 'CREDIT', label: 'Credit' },
                { value: 'DEBIT', label: 'Debit' },
              ],
              onChange: (value) => { setCardType(value); setPage(1); },
            },
            {
              label: 'Network',
              value: network,
              options: CARD_NETWORKS.map((value) => ({ value, label: value })),
              onChange: (value) => { setNetwork(value); setPage(1); },
            },
            {
              label: 'Tier_Category',
              value: tierFilter,
              options: distinctTiers.map((value) => ({ value, label: value })),
              onChange: (value) => { setTierFilter(value); setPage(1); },
            },
          ]}
        />

        {loading ? (
          <div className="admin-loading"><span className="wallet-loader" /> Loading…</div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table admin-cards-table">
              <thead>
                <tr>
                  <th>Bank Name</th>
                  <th>Card_Type</th>
                  <th>Network</th>
                  <th>Tier_Category</th>
                  <th>Card_Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageCards.map((card) => (
                  <tr key={card.id}>
                    <td data-label="Bank"><div className="admin-cell-value">{card.bank_name}</div></td>
                    <td data-label="Type"><div className="admin-cell-value">
                      <span className={`tag-pill ${card.card_type === 'CREDIT' ? 'pill-credit' : 'pill-debit'}`}>
                        {card.card_type}
                      </span>
                    </div></td>
                    <td data-label="Network"><div className="admin-cell-value">{card.network}</div></td>
                    <td data-label="Tier"><div className="admin-cell-value">{card.tier_category || 'STANDARD'}</div></td>
                    <td data-label="Card name"><div className="admin-cell-value"><strong>{card.card_name}</strong></div></td>
                    <td data-label="Actions" className="admin-actions-cell">
                      <button
                        className="admin-icon-action"
                        type="button"
                        title="Edit card"
                        aria-label={`Edit ${card.bank_name} ${card.card_name}`}
                        disabled={saving}
                        onClick={() => editCard(card)}
                      >
                        <Icon name="edit" size={16} /><span className="responsive-action-label">Edit</span>
                      </button>
                      <button
                        className="admin-icon-action danger"
                        type="button"
                        title="Delete card"
                        aria-label={`Delete ${card.bank_name} ${card.card_name}`}
                        disabled={saving}
                        onClick={() => removeCard(card)}
                      >
                        <Icon name="trash" size={16} /><span className="responsive-action-label">Delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleCards.length === 0 && (
                  <tr>
                    <td colSpan="6" className="admin-empty">
                      {cards.length ? 'No cards match these filters.' : 'No cards found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination page={page} pageSize={pageSize} total={visibleCards.length} onPageChange={setPage} />
      </section>

      {editorOpen && (
        <Modal
          title={editingId === null ? 'Add card (Step by step)' : 'Edit card'}
          onClose={closeEditor}
        >
          <div className="step-wizard-container">
            {/* Step Wizard Navigation Header */}
            <div className="step-stepper" role="tablist" aria-label="Add card steps">
              <button
                type="button"
                className={`step-stepper-btn${step === 1 ? ' active' : ''}${step > 1 ? ' completed' : ''}`}
                onClick={() => setStep(1)}
              >
                <span className="step-num">{step > 1 ? '✓' : '1'}</span>
                <span className="step-label">Bank &amp; Type</span>
              </button>
              <span className="step-divider" />
              <button
                type="button"
                className={`step-stepper-btn${step === 2 ? ' active' : ''}${step > 2 ? ' completed' : ''}`}
                onClick={() => { if (form.bank_name.trim()) setStep(2); }}
                disabled={!form.bank_name.trim()}
              >
                <span className="step-num">{step > 2 ? '✓' : '2'}</span>
                <span className="step-label">Network &amp; Tier</span>
              </button>
              <span className="step-divider" />
              <button
                type="button"
                className={`step-stepper-btn${step === 3 ? ' active' : ''}`}
                onClick={() => { if (form.bank_name.trim()) setStep(3); }}
                disabled={!form.bank_name.trim()}
              >
                <span className="step-num">3</span>
                <span className="step-label">Card Name &amp; Review</span>
              </button>
            </div>

            <form className="admin-form admin-editor-form" onSubmit={submitCard}>
              {error && <div className="admin-alert" role="alert">{error}</div>}

              {/* Step 1: Bank Name and Card_Type */}
              {step === 1 && (
                <div className="step-panel">
                  <div className="field">
                    <label htmlFor="adminBankName">
                      <strong>Bank Name</strong> <span className="field-required">*</span>
                    </label>
                    <input
                      id="adminBankName"
                      type="text"
                      required
                      placeholder="e.g. HDFC Bank, ICICI Bank, SBI Card"
                      value={form.bank_name}
                      onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                    />
                    <div className="chip-suggestion-wrap">
                      <span className="chip-prompt">Popular banks:</span>
                      {POPULAR_BANKS.map((b) => (
                        <button
                          key={b}
                          type="button"
                          className={`chip-pill${form.bank_name === b ? ' selected' : ''}`}
                          onClick={() => setForm({ ...form, bank_name: b })}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="adminCardType">
                      <strong>Card_Type</strong> <span className="field-required">*</span>
                    </label>
                    <div className="toggle-group-row">
                      {CARD_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`toggle-option-btn${form.card_type === t ? ' active' : ''}`}
                          onClick={() => setForm({ ...form, card_type: t })}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="admin-form-actions step-actions">
                    <button type="button" className="button button-secondary" onClick={closeEditor} disabled={saving}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="button button-primary"
                      onClick={handleNextStep}
                      disabled={!form.bank_name.trim()}
                    >
                      Next: Network &amp; Tier →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Network and Tier_Category */}
              {step === 2 && (
                <div className="step-panel">
                  <div className="field">
                    <label htmlFor="adminNetwork">
                      <strong>Network</strong> <span className="field-required">*</span>
                    </label>
                    <div className="toggle-group-row network-toggle-row">
                      {CARD_NETWORKS.map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`toggle-option-btn${form.network === n ? ' active' : ''}`}
                          onClick={() => setForm({ ...form, network: n })}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="adminTierCategory">
                      <strong>Tier_Category</strong>
                    </label>
                    <input
                      id="adminTierCategory"
                      type="text"
                      placeholder="e.g. REGALIA, PLATINUM, SIGNATURE, STANDARD"
                      value={form.tier_category}
                      onChange={(e) => setForm({ ...form, tier_category: e.target.value.toUpperCase() })}
                    />
                    <div className="chip-suggestion-wrap">
                      <span className="chip-prompt">Common tiers:</span>
                      {POPULAR_TIERS.map((tier) => (
                        <button
                          key={tier}
                          type="button"
                          className={`chip-pill${form.tier_category === tier ? ' selected' : ''}`}
                          onClick={() => setForm({ ...form, tier_category: tier })}
                        >
                          {tier}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="admin-form-actions step-actions">
                    <button type="button" className="button button-secondary" onClick={handlePrevStep}>
                      ← Back
                    </button>
                    <button type="button" className="button button-primary" onClick={handleNextStep}>
                      Next: Card Name &amp; Review →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Card_Name and Review */}
              {step === 3 && (
                <div className="step-panel">
                  <div className="field">
                    <label htmlFor="adminCardName">
                      <strong>Card_Name</strong> <span className="field-required">*</span>
                    </label>
                    <input
                      id="adminCardName"
                      type="text"
                      required
                      placeholder="e.g. Regalia Gold, Millennia, SimplyCLICK, Coral"
                      value={form.card_name}
                      onChange={(e) => setForm({ ...form, card_name: e.target.value })}
                    />
                  </div>

                  {/* Card Visual Preview */}
                  <div className="card-editor-preview">
                    <span className="preview-heading">Card Preview</span>
                    <div className="card-mock-visual">
                      <div className="card-mock-top">
                        <span className="card-mock-bank">{form.bank_name || 'Bank Name'}</span>
                        <span className="card-mock-network">{form.network}</span>
                      </div>
                      <div className="card-mock-chip" />
                      <div className="card-mock-body">
                        <strong className="card-mock-name">{form.card_name || 'Card_Name'}</strong>
                        <div className="card-mock-badges">
                          <span className="card-mock-type">{form.card_type}</span>
                          <span className="card-mock-tier">{form.tier_category || 'STANDARD'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary of Columns */}
                  <div className="card-summary-table">
                    <div className="summary-row">
                      <span>Bank Name:</span>
                      <strong>{form.bank_name || '—'}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Card_Type:</span>
                      <strong>{form.card_type}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Network:</span>
                      <strong>{form.network}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Tier_Category:</span>
                      <strong>{form.tier_category || 'STANDARD'}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Card_Name:</span>
                      <strong>{form.card_name || '—'}</strong>
                    </div>
                  </div>

                  <div className="admin-form-actions step-actions">
                    <button type="button" className="button button-secondary" onClick={handlePrevStep} disabled={saving}>
                      ← Back
                    </button>
                    {editingId === null ? (
                      <>
                        <button
                          className="button button-primary"
                          name="submitAction"
                          value="add"
                          disabled={saving || !form.card_name.trim()}
                        >
                          {saving ? 'Adding card…' : 'Add card'}
                        </button>
                        <button
                          className="button button-secondary"
                          name="submitAction"
                          value="add-another"
                          disabled={saving || !form.card_name.trim()}
                        >
                          Add &amp; add another
                        </button>
                      </>
                    ) : (
                      <button
                        className="button button-primary"
                        disabled={saving || !form.card_name.trim()}
                      >
                        {saving ? 'Saving changes…' : 'Save changes'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>
        </Modal>
      )}
    </section>
  );
}
