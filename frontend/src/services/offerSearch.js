export function matchesOfferSearch(offer, cards, search) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const linkedCards = cards.filter((card) => offer.applicable_master_card_ids?.includes(card.id));
  return [offer.merchant_name, offer.offer_headline, offer.coupon_code, offer.category,
    offer.bank_name, offer.card_name,
    ...linkedCards.flatMap((card) => [card.bank_name, card.card_name]),
  ].some((value) => String(value ?? '').toLowerCase().includes(query));
}
