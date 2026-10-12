import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/Brand.jsx';
import { ListToolbar, Pagination } from '../../components/ListControls.jsx';
import { Modal } from '../../components/Modal.jsx';

export function WalletPanel({ cards, wallet, loading, saving, error, onAdd, onRemove }) {
  const [masterCardId, setMasterCardId] = useState('');
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
  const availableCards = cards.filter(
    (catalogCard) => !wallet.some((walletCard) =>
      walletCard.master_card_id === catalogCard.id
      && walletCard.cardholder_label === cardholderLabel,
    ),
  );

  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(1, Math.ceil(visibleCards.length / pageSize))));
  }, [visibleCards.length]);

  async function submitCard(event) {
    event.preventDefault();
    if (!masterCardId) return;
    const added = await onAdd({
      masterCardId: Number(masterCardId),
      cardholderLabel,
      customNickname,
    });
    if (!added) return;
    setMasterCardId('');
    setCustomNickname('');
    setAddOpen(false);
  }

  function closeAddModal() {
    setAddOpen(false);
    setMasterCardId('');
    setCustomNickname('');
  }

  return (
    <section className="wallet-page">
      <div className="page-intro">
        <div>
          <h1>Your household wallet</h1>
          <p>Bank and card type only. No card details.</p>
        </div>
        <div className="wallet-page-actions">
          <div className="wallet-count"><Icon name="wallet" size={18} /><strong>{wallet.length}</strong><span>{wallet.length === 1 ? 'card' : 'cards'} added</span></div>
          <button className="button button-primary" type="button" onClick={() => setAddOpen(true)}>
            <Icon name="plus" size={16} /> Add card
          </button>
        </div>
      </div>

      <section className="wallet-list-panel admin-full-list-card" aria-label="Household cards">
        <div className="panel-heading">
          <div><h2>Cards</h2></div>
          <span className="panel-count">{wallet.length}</span>
        </div>
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
                    <button className="remove-card-button" type="button" title="Remove card" aria-label={`Remove ${card.bank_name} ${card.card_name} for ${card.cardholder_label}`} disabled={saving} onClick={() => onRemove(card.id)}>
                      <Icon name="close" size={16} /><span>Remove</span>
                    </button>
                  </article>
                ))}
              </div>
            )}
            <Pagination page={page} pageSize={pageSize} total={visibleCards.length} onPageChange={setPage} />
          </>
        )}
      </section>

      {addOpen && (
        <Modal title="Add a household card" onClose={closeAddModal}>
          <form onSubmit={submitCard} className="wallet-form">
            {error && <div className="admin-alert" role="alert">{error}</div>}
            <div className="field">
              <label htmlFor="holder">Who is the card for?</label>
              <select id="holder" value={cardholderLabel} onChange={(event) => setCardholderLabel(event.target.value)}>
                <option value="Self">My card</option>
                <option value="Spouse">Spouse</option>
                <option value="Family">Family member</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="masterCard">Bank & card variant</label>
              <select id="masterCard" required value={masterCardId} onChange={(event) => setMasterCardId(event.target.value)}>
                <option value="">Choose a card</option>
                {availableCards.map((card) => (
                  <option key={card.id} value={card.id}>{card.bank_name} · {card.card_name}</option>
                ))}
              </select>
              {availableCards.length === 0 && cards.length > 0 && <span className="field-hint">No more cards available for this holder.</span>}
            </div>
            <div className="field">
              <label htmlFor="cardNickname">Nickname <span className="optional-label">OPTIONAL</span></label>
              <input id="cardNickname" value={customNickname} maxLength="100" onChange={(event) => setCustomNickname(event.target.value)} placeholder="e.g. Everyday card" />
            </div>
            <div className="admin-form-actions">
              <button type="button" className="button button-secondary" onClick={closeAddModal} disabled={saving}>Cancel</button>
              <button className="button button-primary" disabled={saving || !masterCardId}>
                {saving ? 'Adding card…' : 'Add card'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
