import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import './utils/axiosConfig';
import { validateToken } from './utils/tokenUtils';

// Check if already on an auth page before validating token
const isAuthPage = () => {
  const path = window.location.pathname;
  return path === '/login' || path === '/register' || path === '/';
};

if (!isAuthPage()) {
  validateToken();
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
