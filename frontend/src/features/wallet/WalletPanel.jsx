import { confirmAction } from '../../services/alerts.js';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/Brand.jsx';
import { ListToolbar, Pagination } from '../../components/ListControls.jsx';
import { Modal } from '../../components/Modal.jsx';

const CARD_TYPES = ['CREDIT', 'DEBIT'];
const CARD_NETWORKS = ['VISA', 'MASTERCARD', 'RUPAY', 'AMEX', 'DINERS', 'OTHER'];

export function WalletPanel({ cards, wallet, loading, saving, error, onAdd, onEdit, onRemove }) {
  const [cardholderLabel, setCardholderLabel] = useState('Self');
  const [customNickname, setCustomNickname] = useState('');
  const [search, setSearch] = useState('');
  const [cardType, setCardType] = useState('');
  const [bank, setBank] = useState('');
  const [network, setNetwork] = useState('');
  const [holder, setHolder] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const pageSize = 10;
  const [editingId, setEditingId] = useState(null);

  // Add Card Modal state
  const [selectedCardId, setSelectedCardId] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const [cardNameSearch, setCardNameSearch] = useState('');
  const [formCardType, setFormCardType] = useState('');
  const [formNetwork, setFormNetwork] = useState('');
  const [formTier, setFormTier] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  // Custom card fields
  const [customBankName, setCustomBankName] = useState('');
  const [customCardName, setCustomCardName] = useState('');
  const [customCardType, setCustomCardType] = useState('CREDIT');
  const [customNetwork, setCustomNetwork] = useState('VISA');
  const [customTierCategory, setCustomTierCategory] = useState('STANDARD');

  const visibleCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return wallet.filter((card) => {
      const matchesSearch = !query || [
        card.bank_name,
        card.card_name,
        card.card_type,
        card.network,
        card.cardholder_label,
        card.custom_nickname,
      ].some((value) => value?.toLowerCase().includes(query));
      return matchesSearch
        && (!cardType || card.card_type === cardType)
        && (!bank || card.bank_name === bank)
        && (!network || card.network === network)
        && (!holder || card.cardholder_label === holder);
    });
  }, [bank, cardType, holder, network, search, wallet]);
  const pageCards = visibleCards.slice((page - 1) * pageSize, page * pageSize);

  const availableCards = useMemo(() => {
    return cards.filter(
      (catalogCard) => !wallet.some((walletCard) =>
        walletCard.id !== editingId
        && walletCard.master_card_id === catalogCard.id
        && walletCard.cardholder_label === cardholderLabel,
      ),
    );
  }, [cards, wallet, cardholderLabel, editingId]);

  // Distinct banks in available catalogue
  const availableBanks = useMemo(() => {
    return [...new Set(availableCards.map((c) => c.bank_name))].sort();
  }, [availableCards]);

  // Distinct tiers in available catalogue
  const availableTiers = useMemo(() => {
    return [...new Set(availableCards.map((c) => c.tier_category).filter(Boolean))].sort();
  }, [availableCards]);

  // Filtered available catalogue cards for the Add Modal
  const modalFilteredCards = useMemo(() => {
    const bQuery = bankSearch.trim().toLowerCase();
    const cQuery = cardNameSearch.trim().toLowerCase();

    return availableCards.filter((card) => {
      const matchBank = !bQuery || card.bank_name?.toLowerCase().includes(bQuery);
      const matchName = !cQuery || card.card_name?.toLowerCase().includes(cQuery);
      const matchType = !formCardType || card.card_type === formCardType;
      const matchNet = !formNetwork || card.network === formNetwork;
      const matchTier = !formTier || card.tier_category === formTier;
      return matchBank && matchName && matchType && matchNet && matchTier;
    });
  }, [availableCards, bankSearch, cardNameSearch, formCardType, formNetwork, formTier]);

  useEffect(() => {
    setCatalogPage(1);
  }, [bankSearch, cardNameSearch, formCardType, formNetwork, formTier, cardholderLabel]);

  const selectedCard = useMemo(() => {
    return availableCards.find((c) => String(c.id) === String(selectedCardId)) || null;
  }, [availableCards, selectedCardId]);

  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(visibleCards.length / pageSize))));
  }, [visibleCards.length]);

  function closeAddModal() {
    if (saving) return;
    setAddOpen(false);
    setEditingId(null);
    setCatalogPage(1);
    setSelectedCardId('');
    setBankSearch('');
    setCardNameSearch('');
    setFormCardType('');
    setFormNetwork('');
    setFormTier('');
    setCustomNickname('');
    setIsCustomMode(false);
    setCustomBankName('');
    setCustomCardName('');
    setCustomCardType('CREDIT');
    setCustomNetwork('VISA');
    setCustomTierCategory('STANDARD');
  }

  async function submitCard(event) {
    event.preventDefault();

    if (isCustomMode) {
      if (!customBankName.trim() || !customCardName.trim()) return;
      const payload = {
        bankName: customBankName.trim(),
        cardName: customCardName.trim(),
        cardType: customCardType,
        network: customNetwork,
        tierCategory: (customTierCategory || 'STANDARD').trim().toUpperCase(),
        cardholderLabel,
        customNickname: customNickname.trim() || undefined,
      };
      const added = editingId ? await onEdit(editingId, payload) : await onAdd(payload);
      if (added) closeAddModal();
      return;
    }

    if (!selectedCardId) return;
    const payload = {
      masterCardId: Number(selectedCardId),
      cardholderLabel,
      customNickname: customNickname.trim() || undefined,
    };
    const added = editingId ? await onEdit(editingId, payload) : await onAdd(payload);
    if (added) closeAddModal();
  }

  async function openEditCard(card) {
    if (!await confirmAction({ title: 'Edit wallet card?', text: `Edit ${card.bank_name} ${card.card_name}?`, confirmText: 'Edit card' })) return;
    setEditingId(card.id);
    setCardholderLabel(card.cardholder_label);
    setCustomNickname(card.custom_nickname || '');
    setIsCustomMode(card.is_custom);
    if (card.is_custom) {
      setCustomBankName(card.bank_name);
      setCustomCardName(card.card_name);
      setCustomCardType(card.card_type);
      setCustomNetwork(card.network);
      setCustomTierCategory(card.tier_category || 'STANDARD');
    } else {
      handleSelectCard(cards.find((item) => item.id === card.master_card_id) || { ...card, id: card.master_card_id });
    }
    setAddOpen(true);
  }

  function handleSelectCard(card) {
    setSelectedCardId(String(card.id));
    setBankSearch(card.bank_name);
    setCardNameSearch(card.card_name);
    setFormCardType(card.card_type);
    setFormNetwork(card.network);
    setFormTier(card.tier_category || '');
  }

  function handleClearSelection() {
    setSelectedCardId('');
  }

  return (
    <section className="wallet-page">
      <div className="page-intro">
        <div>
          <h1 className="page-title">Your household wallet</h1>
          <p>Bank and card type only. No card details or numbers stored.</p>
        </div>
        <div className="wallet-page-actions">
          <div className="wallet-count">
            <Icon name="wallet" size={18} />
            <strong>{wallet.length}</strong>
            <span>{wallet.length === 1 ? 'card' : 'cards'} added</span>
          </div>
          <button className="button button-primary" type="button" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={16} /> Add card
          </button>
        </div>
      </div>

      <section className="wallet-list-panel admin-full-list-card" aria-label="Household cards">
        {!loading && wallet.length > 0 && (
          <ListToolbar
            search={search}
            onSearch={(value) => { setSearch(value); setPage(1); }}
            placeholder="Search bank, card or holder"
            filters={[
              { label: 'Type', value: cardType, allLabel: 'All types', options: [{ value: 'CREDIT', label: 'Credit' }, { value: 'DEBIT', label: 'Debit' }], onChange: (value) => { setCardType(value); setPage(1); } },
              { label: 'Bank', value: bank, allLabel: 'All banks', options: [...new Set(wallet.map((card) => card.bank_name))].sort().map((value) => ({ value, label: value })), onChange: (value) => { setBank(value); setPage(1); } },
              { label: 'Network', value: network, allLabel: 'All networks', options: [...new Set(wallet.map((card) => card.network))].sort().map((value) => ({ value, label: value })), onChange: (value) => { setNetwork(value); setPage(1); } },
              { label: 'Holder', value: holder, allLabel: 'All holders', options: [...new Set(wallet.map((card) => card.cardholder_label))].sort().map((value) => ({ value, label: value })), onChange: (value) => { setHolder(value); setPage(1); } },
            ]}
          />
        )}
        {loading ? (
          <div className="wallet-empty"><span className="wallet-loader" /><span>Loading your cards…</span></div>
        ) : wallet.length === 0 ? (
          <div className="wallet-empty">
            <span className="empty-icon"><Icon name="card" size={23} /></span>
            <strong>No cards added</strong>
            <p>Add your cards to match eligible merchant offers automatically.</p>
          </div>
        ) : (
          <>
            {visibleCards.length === 0 ? (
              <div className="wallet-empty"><strong>No cards match these filters.</strong></div>
            ) : (
              <div className="wallet-card-list">
                {pageCards.map((card, index) => (
                  <article className="wallet-card-row" key={card.id}>
                    <div className={`wallet-card-art wallet-art-${index % 4}`}>
                      <span className="wallet-art-chip" />
                      <span className="wallet-art-network">{card.network?.toUpperCase() === 'MASTERCARD' ? 'MASTER' : card.network}</span>
                      <strong>{card.bank_name}</strong>
                      <small>{card.card_type}</small>
                    </div>
                    <div className="wallet-card-info">
                      <span className="wallet-person"><Icon name="user" size={13} /> {card.cardholder_label}</span>
                      <h3>{card.card_name}</h3>
                      <span>{card.custom_nickname || card.bank_name}</span>
                    </div>
                    <div className="wallet-card-actions">
                    <button className="remove-card-button wallet-edit-button" type="button" title="Edit card" disabled={saving}
                      aria-label={`Edit ${card.bank_name} ${card.card_name} for ${card.cardholder_label}`} onClick={() => openEditCard(card)}>
                      <Icon name="edit" size={16} /><span>Edit</span>
                    </button>
                    <button
                      className="remove-card-button"
                      type="button"
                      title="Remove card"
                      aria-label={`Remove ${card.bank_name} ${card.card_name} for ${card.cardholder_label}`}
                      disabled={saving}
                      onClick={() => onRemove(card.id)}
                    >
                      <Icon name="trash" size={16} /><span>Remove</span>
                    </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <Pagination page={page} pageSize={pageSize} total={visibleCards.length} onPageChange={setPage} />
          </>
        )}
      </section>

      {addOpen && (
        <Modal title={editingId ? "Edit your wallet card" : "Add a card to your wallet"} onClose={closeAddModal}>
          <form onSubmit={submitCard} className="wallet-form user-add-card-form">
            {error && <div className="admin-alert" role="alert">{error}</div>}

            {/* Who is the card for? */}
            <div className="field">
              <label htmlFor="holder">
                <strong>Who is the card for?</strong>
              </label>
              <select id="holder" value={cardholderLabel} onChange={(event) => { setCardholderLabel(event.target.value); setSelectedCardId(''); }}>
                <option value="Self">My card (Self)</option>
                <option value="Spouse">Spouse</option>
                <option value="Family">Family member</option>
              </select>
            </div>

            {/* Mode switch */}
            <div className="user-form-mode-switch">
              <button
                type="button"
                className={`mode-btn${!isCustomMode ? ' active' : ''}`}
                onClick={() => setIsCustomMode(false)}
              >
                Choose from catalogue
              </button>
              <button
                type="button"
                className={`mode-btn${isCustomMode ? ' active' : ''}`}
                onClick={() => setIsCustomMode(true)}
              >
                Custom card details
              </button>
            </div>

            {!isCustomMode ? (
              <>
                {/* Card name selection fills the bank and card details */}
                <div className="field">
                  <label htmlFor="userCardNameSearch">
                    <strong>Card_Name</strong> <span className="field-hint-inline">Search card variant</span>
                  </label>
                  <div className="input-search-wrap">
                    <Icon name="search" size={15} />
                    <input
                      id="userCardNameSearch"
                      list="catalogNameSuggestions"
                      autoComplete="off"
                      type="search"
                      placeholder="Search Card_Name (e.g. Regalia, Millennia, Coral, SimplyCLICK)..."
                      value={cardNameSearch}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCardNameSearch(value);
                        setSelectedCardId('');
                        const exactMatches = availableCards.filter((card) =>
                          card.card_name.toLowerCase() === value.trim().toLowerCase()
                          && (!bankSearch.trim() || card.bank_name.toLowerCase().includes(bankSearch.trim().toLowerCase()))
                          && (!formCardType || card.card_type === formCardType)
                          && (!formNetwork || card.network === formNetwork)
                          && (!formTier || card.tier_category === formTier));
                        if (exactMatches.length === 1) handleSelectCard(exactMatches[0]);
                      }}
                    />
                    {cardNameSearch && (
                      <button
                        type="button"
                        className="input-clear-btn"
                        onClick={() => { setCardNameSearch(''); setSelectedCardId(''); }}
                        aria-label="Clear card search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                <datalist id="catalogNameSuggestions">
                  {[...new Set(availableCards.filter((card) =>
                    (!bankSearch.trim() || card.bank_name.toLowerCase().includes(bankSearch.trim().toLowerCase()))
                    && (!formCardType || card.card_type === formCardType)
                    && (!formNetwork || card.network === formNetwork)
                    && (!formTier || card.tier_category === formTier)
                  ).map((card) => card.card_name))].map((name) => <option key={name} value={name} />)}
                </datalist>
                {/* 1. Bank Name Field with Search Bar */}
                <div className="field">
                  <label htmlFor="userBankNameSearch">
                    <strong>Bank Name</strong> <span className="field-hint-inline">Search or select bank</span>
                  </label>
                  <div className="input-search-wrap">
                    <Icon name="search" size={15} />
                    <input
                      id="userBankNameSearch"
                      list="catalogBankSuggestions"
                      autoComplete="off"
                      type="search"
                      placeholder="Search Bank Name (e.g. HDFC, ICICI, SBI, Axis)..."
                      value={bankSearch}
                      onChange={(e) => { setBankSearch(e.target.value); setSelectedCardId(''); }}
                    />
                    {bankSearch && (
                      <button
                        type="button"
                        className="input-clear-btn"
                        onClick={() => { setBankSearch(''); setSelectedCardId(''); }}
                        aria-label="Clear bank search"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <datalist id="catalogBankSuggestions">
                    {availableBanks.map((name) => <option key={name} value={name} />)}
                  </datalist>
                  {/* Popular Bank Chips */}
                  <div className="chip-suggestion-wrap user-chip-wrap">
                    <span className="chip-prompt">Top banks:</span>
                    {availableBanks.slice(0, 6).map((b) => (
                      <button
                        key={b}
                        type="button"
                        className={`chip-pill${bankSearch.toLowerCase() === b.toLowerCase() ? ' selected' : ''}`}
                        onClick={() => { setBankSearch(b); setSelectedCardId(''); }}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Card_Type and 3. Network Filter Options */}
                <div className="admin-form-row user-card-options-row">
                  <div className="field">
                    <label htmlFor="userCardType">
                      <strong>Card_Type</strong>
                    </label>
                    <div className="toggle-group-row">
                      <button
                        type="button"
                        className={`toggle-option-btn${formCardType === '' ? ' active' : ''}`}
                        onClick={() => { setFormCardType(''); setSelectedCardId(''); }}
                      >
                        All
                      </button>
                      {CARD_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`toggle-option-btn${formCardType === t ? ' active' : ''}`}
                          onClick={() => { setFormCardType(t); setSelectedCardId(''); }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="userNetwork">
                      <strong>Network</strong>
                    </label>
                    <select
                      id="userNetwork"
                      value={formNetwork}
                      onChange={(e) => { setFormNetwork(e.target.value); setSelectedCardId(''); }}
                    >
                      <option value="">All networks</option>
                      {CARD_NETWORKS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. Tier_Category Option */}
                {availableTiers.length > 0 && (
                  <div className="field">
                    <label htmlFor="userTier">
                      <strong>Tier_Category</strong>
                    </label>
                    <select
                      id="userTier"
                      value={formTier}
                      onChange={(e) => { setFormTier(e.target.value); setSelectedCardId(''); }}
                    >
                      <option value="">All tier categories</option>
                      {availableTiers.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Selected Card Badge / Confirmation */}
                {selectedCard ? (
                  <div className="user-selected-card-banner">
                    <div className="selected-card-content">
                      <span className="selected-tag">Selected Card</span>
                      <strong className="selected-card-title">{selectedCard.card_name}</strong>
                      <div className="selected-card-meta">
                        <span><strong>Bank Name:</strong> {selectedCard.bank_name}</span>
                        <span><strong>Card_Type:</strong> {selectedCard.card_type}</span>
                        <span><strong>Network:</strong> {selectedCard.network}</span>
                        <span><strong>Tier_Category:</strong> {selectedCard.tier_category || 'STANDARD'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="button button-secondary button-sm"
                      onClick={handleClearSelection}
                    >
                      Change card
                    </button>
                  </div>
                ) : (
                  <div className="field">
                    <label>
                      <strong>Matching cards ({modalFilteredCards.length})</strong>
                    </label>
                    <div className="user-card-results-list" role="group" aria-label="Available cards" aria-live="polite">
                      {modalFilteredCards.slice((catalogPage - 1) * 15, catalogPage * 15).map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          className="user-card-result-item"
                          onClick={() => handleSelectCard(card)}
                        >
                          <div className="result-card-main">
                            <span className="result-card-bank">{card.bank_name}</span>
                            <strong className="result-card-name">{card.card_name}</strong>
                          </div>
                          <div className="result-card-tags">
                            <span className={`tag-pill ${card.card_type === 'CREDIT' ? 'pill-credit' : 'pill-debit'}`}>
                              {card.card_type}
                            </span>
                            <span className="tag-pill pill-network">{card.network}</span>
                            {card.tier_category && (
                              <span className="tag-pill pill-tier">{card.tier_category}</span>
                            )}
                          </div>
                        </button>
                      ))}

                      {modalFilteredCards.length === 0 && (
                        <div className="user-card-empty-result">
                          <p>No matching cards found for your search/filters.</p>
                          <button
                            type="button"
                            className="button button-secondary button-sm"
                            onClick={() => {
                                                        setBankSearch('');
                              setCardNameSearch('');
                              setFormCardType('');
                              setFormNetwork('');
                              setFormTier('');
                            }}
                          >
                            Reset filters
                          </button>
                          <button
                            type="button"
                            className="button button-primary button-sm"
                            onClick={() => setIsCustomMode(true)}
                          >
                            Add as custom card instead
                          </button>
                        </div>
                      )}
                    </div>
                    <Pagination page={catalogPage} pageSize={15} total={modalFilteredCards.length} onPageChange={setCatalogPage} />
                  </div>
                )}
              </>
            ) : (
              /* Custom Card Mode using exact column names */
              <div className="custom-card-inputs-panel">
                <div className="field">
                  <label htmlFor="customName">
                    <strong>Card_Name</strong> <span className="field-required">*</span>
                  </label>
                  <input
                    id="customName"
                    type="text"
                    required
                    placeholder="e.g. Regalia Gold, Coral Debit"
                    value={customCardName}
                    onChange={(e) => setCustomCardName(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label htmlFor="customBank">
                    <strong>Bank Name</strong> <span className="field-required">*</span>
                  </label>
                  <input
                    id="customBank"
                    type="text"
                    required
                    placeholder="e.g. HDFC Bank, ICICI Bank"
                    value={customBankName}
                    onChange={(e) => setCustomBankName(e.target.value)}
                  />
                </div>

                <div className="admin-form-row">
                  <div className="field">
                    <label htmlFor="customType">
                      <strong>Card_Type</strong> <span className="field-required">*</span>
                    </label>
                    <select
                      id="customType"
                      value={customCardType}
                      onChange={(e) => setCustomCardType(e.target.value)}
                    >
                      <option value="CREDIT">CREDIT</option>
                      <option value="DEBIT">DEBIT</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="customNet">
                      <strong>Network</strong> <span className="field-required">*</span>
                    </label>
                    <select
                      id="customNet"
                      value={customNetwork}
                      onChange={(e) => setCustomNetwork(e.target.value)}
                    >
                      {CARD_NETWORKS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="customTier">
                    <strong>Tier_Category</strong>
                  </label>
                  <input
                    id="customTier"
                    type="text"
                    placeholder="e.g. PLATINUM, REGALIA, STANDARD"
                    value={customTierCategory}
                    onChange={(e) => setCustomTierCategory(e.target.value)}
                  />
                </div>

              </div>
            )}

            {/* Nickname (Optional) */}
            <div className="field">
              <label htmlFor="cardNickname">
                Nickname <span className="optional-label">OPTIONAL</span>
              </label>
              <input
                id="cardNickname"
                value={customNickname}
                maxLength="100"
                onChange={(event) => setCustomNickname(event.target.value)}
                placeholder="e.g. Everyday card, Dining card"
              />
            </div>

            <div className="admin-form-actions">
              <button type="button" className="button button-secondary" onClick={closeAddModal} disabled={saving}>
                Cancel
              </button>
              <button
                className="button button-primary"
                disabled={
                  saving ||
                  (!isCustomMode && !selectedCardId) ||
                  (isCustomMode && (!customBankName.trim() || !customCardName.trim()))
                }
              >
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Add card'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
