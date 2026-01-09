// Setup axios with interceptors for token handling
import axios from 'axios';
import { isTokenExpired, redirectToLogin } from './tokenUtils';

// Set the base URL for all API requests
// Use VITE_API_URL when present (production or explicit dev), otherwise use empty string
// so requests are made to the same origin and Vite can proxy them to the backend during dev.
const apiUrl = import.meta.env.VITE_API_URL || '';
axios.defaults.baseURL = apiUrl;

// Check if we're already on an auth page (login or register)
const isOnAuthPage = () => {
  const path = window.location.pathname;
  return path === '/login' || path === '/register' || path === '/';
};

// Add a request interceptor to check token expiration before each request
axios.interceptors.request.use(
  (config) => {
    // Skip token check for auth-related endpoints or if we're on auth pages
    const isAuthEndpoint =
      config.url && (config.url.includes('/api/token/') || config.url.includes('/api/register/'));

    if (isAuthEndpoint || isOnAuthPage()) {
      return config;
    }

    // Get the token from localStorage
    const token = localStorage.getItem('token');

    // If there's a token and it's expired, redirect to login
    if (token && isTokenExpired(token)) {
      // Cancel the request
      const error = new Error('Token expired');
      error.isTokenExpired = true;
      return Promise.reject(error);
    }

    // Otherwise, proceed with the request
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle 401 Unauthorized errors
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Don't redirect if we're already on auth pages
    if (isOnAuthPage()) {
      return Promise.reject(error);
    }

    // Skip redirect for auth-related endpoints
    const isAuthEndpoint =
      error.config &&
      error.config.url &&
      (error.config.url.includes('/api/token/') || error.config.url.includes('/api/register/'));

    if (isAuthEndpoint) {
      return Promise.reject(error);
    }

    // Check if the error is a 401 Unauthorized
    if (error.response && error.response.status === 401) {
      // Redirect to login
      redirectToLogin();
    }

    // Handle token expiration error from request interceptor
    if (error.isTokenExpired) {
      redirectToLogin();
    }

    return Promise.reject(error);
  }
);

export default axios;
