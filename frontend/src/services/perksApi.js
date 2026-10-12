import { apiRequest } from './api.js';

export const getMasterCards = () => apiRequest('/api/cards/master');

export const getWallet = () => apiRequest('/api/wallet');

export const addWalletCard = (card) =>
  apiRequest('/api/wallet', {
    method: 'POST',
    body: JSON.stringify(card),
  });

export const removeWalletCard = (cardId) =>
  apiRequest(`/api/wallet/${encodeURIComponent(cardId)}`, { method: 'DELETE' });

export const getMatchedOffers = (day) =>
  apiRequest(`/api/offers/matched?day=${encodeURIComponent(day)}`);
