import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import axios from 'axios';
// Import our configured axios and token utilities
import './utils/axiosConfig';
import { validateToken } from './utils/tokenUtils';

// Set the base URL for all axios requests.
// In development, this points to the Django backend.
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Configure Axios to handle Django's CSRF protection.
// This ensures that POST, PUT, DELETE requests include the CSRF token.
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
axios.defaults.withCredentials = true;

// Check if we're already on an auth page before validating token
const isAuthPage = () => {
  const path = window.location.pathname;
  return path === '/login' || path === '/register' || path === '/';
};

// Only check token validity before rendering if we're not on an auth page
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