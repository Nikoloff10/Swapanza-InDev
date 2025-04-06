// Token management utilities

// Check if token is expired by attempting to decode the JWT
export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    // JWT tokens consist of three parts: header.payload.signature
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return true;
    
    // Decode the base64 payload
    const payload = JSON.parse(atob(payloadBase64));
    
    // Check if token has expiration claim
    if (!payload.exp) return false;
    
    // Convert exp to milliseconds and compare with current time
    const expirationTime = payload.exp * 1000; // Convert seconds to milliseconds
    const currentTime = Date.now();
    
    return currentTime >= expirationTime;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true; // If there's an error, assume token is expired
  }
};

// Check if we're already on an auth page (login or register)
const isOnAuthPage = () => {
  const path = window.location.pathname;
  return path === '/login' || path === '/register' || path === '/';
};

// Redirect to login when token is expired
export const redirectToLogin = () => {
  // Don't redirect if we're already on the login page
  if (isOnAuthPage()) {
    console.log('Already on auth page, clearing token without redirect');
    // Just clear the tokens without redirecting
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    return;
  }
  
  console.log('Token expired, redirecting to login page');
  
  // Clear all auth data
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('username');
  localStorage.removeItem('userId');
  
  // Redirect to login page
  window.location.href = '/login';
};

// Check token and redirect if expired
export const validateToken = () => {
  // Skip validation if we're already on an auth page
  if (isOnAuthPage()) {
    return true;
  }
  
  const token = localStorage.getItem('token');
  
  if (isTokenExpired(token)) {
    redirectToLogin();
    return false;
  }
  return true;
};

// Setup periodic token validation with smart handling for auth pages
export const setupTokenExpirationChecker = (intervalMs = 30000) => {
  // Run once immediately, but only if we're not on an auth page
  if (!isOnAuthPage()) {
    validateToken();
  }
  
  // Then set up interval that checks current page before validating
  const intervalId = setInterval(() => {
    // Only validate if not on auth pages
    if (!isOnAuthPage()) {
      validateToken();
    }
  }, intervalMs);
  
  return () => clearInterval(intervalId);
};