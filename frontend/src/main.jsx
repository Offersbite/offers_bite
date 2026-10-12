import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

document.documentElement.lang = 'en';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
