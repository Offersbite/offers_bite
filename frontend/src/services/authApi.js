import { apiRequest } from './api.js';

export const getSessionUser = () => apiRequest('/api/auth/me');

export const registerAccount = (details) =>
  apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(details),
  });

export const loginAccount = (credentials) =>
  apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

export const verifyEmailCode = (details) =>
  apiRequest('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(details),
  });

export const resendEmailCode = (email) =>
  apiRequest('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const logoutAccount = () =>
  apiRequest('/api/auth/logout', { method: 'POST' });

export const updateProfile = (details) =>
  apiRequest('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(details),
  });
