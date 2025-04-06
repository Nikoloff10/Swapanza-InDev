import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import axios from 'axios';
// Import our configured axios and token utilities
import './utils/axiosConfig';
import { validateToken } from './utils/tokenUtils';

// Set default base URL for all axios requests
// In production, you can leave it empty if your API is served from the same domain
axios.defaults.baseURL = process.env.NODE_ENV === 'production' 
  ? '' 
  : 'http://localhost:8000';

// Check if we're already on an auth page before validating token
const isAuthPage = () => {
  const path = window.location.pathname;
  return path === '/login' || path === '/register' || path === '/';
};

// Only check token validity before rendering if we're not on an auth page
if (!isAuthPage()) {
  validateToken();
}

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);