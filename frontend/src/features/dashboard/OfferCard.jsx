import { useState } from 'react';
import { Icon } from '../../components/Brand.jsx';

const categoryIcons = {
  MOVIES: 'movie',
  DINING: 'coffee',
  FOOD: 'coffee',
  SHOPPING: 'bag',
  GROCERY: 'grocery',
  HOTELS: 'bed',
  TRAVEL: 'plane',
};

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const categoryLabels = { FOOD: 'Dining' };

export function OfferCard({ offer, featured = false }) {
  const [copyStatus, setCopyStatus] = useState('');
  const validDays = offer.valid_days || [];
  const applicableDays = validDays.length === 7
    ? ['Every day']
    : validDays.map((day) => weekDays[day]).filter(Boolean);
  const initials = offer.merchant_name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join('')
    .toUpperCase();

  async function copyCoupon() {
    try {
      await navigator.clipboard.writeText(offer.coupon_code);
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Select code');
    }
  }

  return (
    <article className={`offer-card${featured ? ' offer-card-featured' : ''}`}>
      <div className="offer-card-top">
        <span className={`merchant-mark merchant-${(offer.category || 'other').toLowerCase()}`}>{initials}</span>
        <div className="offer-merchant-meta">
          <strong>{offer.merchant_name}</strong>
          <span><Icon name={categoryIcons[offer.category] || 'spark'} size={13} /> {categoryLabels[offer.category] || offer.category}</span>
        </div>
      </div>

      <h3>{offer.offer_headline}</h3>
      <div className="offer-value-row">
        {offer.max_discount ? (
          <>
            <span className="offer-value-label">SAVE UP TO</span>
            <strong className="offer-value">₹{Number(offer.max_discount).toLocaleString('en-IN')}</strong>
          </>
        ) : (
          <span className="offer-value offer-value-text">Offer details</span>
        )}
      </div>

      <div className="offer-details">
        {offer.min_spend > 0 && (
          <div className="offer-detail">
            <span>Min spend</span>
            <strong>₹{Number(offer.min_spend).toLocaleString('en-IN')}</strong>
          </div>
        )}
        {applicableDays.length > 0 && (
          <div className="offer-detail">
            <span>Valid days</span>
            <strong>{applicableDays.join(', ')}</strong>
          </div>
        )}
      </div>

      {offer.coupon_code && (
        <div className="offer-code">
          <div><span>COUPON CODE</span><code>{offer.coupon_code}</code></div>
          <button type="button" onClick={copyCoupon} aria-label={`Copy coupon code ${offer.coupon_code}`}>
            {copyStatus || 'Copy'}
          </button>
        </div>
      )}

      <div className="offer-card-bottom">
        <span className="eligible-card-icon"><Icon name="card" size={15} /></span>
        <div className="eligible-card-copy">
          <strong>{offer.bank_name} {offer.card_name}</strong>
        </div>
        <span className="holder-chip">{offer.cardholder_label}</span>
      </div>
    </article>
  );
}
