export function isCurrentOffer(offer, now = Date.now()) {
  if (offer.is_archived) return false;
  if (!offer.expires_on) return true;
  const today = new Date(now + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return offer.expires_on.slice(0, 10) >= today;
}
export function nextOfferExpiryCheck(now = Date.now()) {
  const offset = 5.5 * 60 * 60 * 1000;
  return (Math.floor((now + offset) / 86400000) + 1) * 86400000 - offset - now + 1;
}
