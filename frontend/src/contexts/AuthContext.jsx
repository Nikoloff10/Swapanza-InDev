import React, { createContext, useState, useEffect, useCallback } from 'react';
import { setupTokenExpirationChecker, validateToken } from '../utils/tokenUtils';
import { INTERVALS } from '../constants';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuth, setIsAuth] = useState(false);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Login function - stores credentials and updates state
  const login = useCallback((newToken, newUsername, newUserId) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    localStorage.setItem('userId', newUserId.toString());
    
    setToken(newToken);
    setUsername(newUsername);
    setUserId(Number(newUserId));
    setIsAuth(true);
  }, []);

  // Logout function - clears credentials and resets state
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    
    setToken(null);
    setUsername('');
    setUserId(null);
    setIsAuth(false);
  }, []);

  // Initialize auth state from localStorage on mount
  useEffect(() => {
    const initializeAuth = () => {
      const storedToken = localStorage.getItem('token');
      const storedUsername = localStorage.getItem('username');
      const storedUserId = localStorage.getItem('userId');
      
      const isTokenValid = validateToken();
      
      if (isTokenValid && storedToken) {
        setToken(storedToken);
        setUsername(storedUsername || '');
        setUserId(storedUserId ? Number(storedUserId) : null);
        setIsAuth(true);
      } else {
        // Clear invalid/expired token
        logout();
      }
      
      setIsLoading(false);
    };

    initializeAuth();

    // Set up periodic token checking
    const cleanup = setupTokenExpirationChecker(INTERVALS.TOKEN_CHECK_MS);
    
    return () => cleanup();
  }, [logout]);

  const value = {
    // State
    isAuth,
    username,
    userId,
    token,
    isLoading,
    
    // Actions
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
