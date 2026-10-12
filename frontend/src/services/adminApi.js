import { apiRequest } from './api.js';

export const getAdminSummary = () => apiRequest('/api/admin/summary');

export const getAdminUsers = (search = '', offset = 0, role = '', status = '') => {
  const params = new URLSearchParams({ limit: '50', offset: String(offset) });
  if (search) params.set('search', search);
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  return apiRequest(`/api/admin/users?${params.toString()}`);
};

export const createAdminUser = (account) =>
  apiRequest('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(account),
  });

export const updateAdminUser = (userId, changes) =>
  apiRequest(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  });

export const deleteAdminUser = (userId) =>
  apiRequest(`/api/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });

export const getAdminCards = () => apiRequest('/api/admin/cards');

export const createAdminCard = (card) =>
  apiRequest('/api/admin/cards', {
    method: 'POST',
    body: JSON.stringify(card),
  });

export const updateAdminCard = (cardId, card) =>
  apiRequest(`/api/admin/cards/${encodeURIComponent(cardId)}`, {
    method: 'PATCH',
    body: JSON.stringify(card),
  });

export const deleteAdminCard = (cardId) =>
  apiRequest(`/api/admin/cards/${encodeURIComponent(cardId)}`, { method: 'DELETE' });

export const getAdminOffers = () => apiRequest('/api/admin/offers');

export const createAdminOffer = (offer) =>
  apiRequest('/api/admin/offers', {
    method: 'POST',
    body: JSON.stringify(offer),
  });

export const updateAdminOffer = (offerId, offer) =>
  apiRequest(`/api/admin/offers/${encodeURIComponent(offerId)}`, {
    method: 'PATCH',
    body: JSON.stringify(offer),
  });

export const deleteAdminOffer = (offerId) =>
  apiRequest(`/api/admin/offers/${encodeURIComponent(offerId)}`, { method: 'DELETE' });

export const uploadAdminOffers = (file) => {
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/api/admin/offers/bulk-upload', {
    method: 'POST',
    body: form,
  });
};
