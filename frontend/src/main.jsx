import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

document.documentElement.lang = 'en';
document.documentElement.dataset.theme = window.localStorage.getItem('offersbite-theme-v2') === 'light'
  ? 'light'
  : 'dark';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
