import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

/**
 * Custom hook to access authentication state and actions.
 * Must be used within an AuthProvider.
 * 
 * @returns {{
 *   isAuth: boolean,
 *   username: string,
 *   userId: number | null,
 *   token: string | null,
 *   isLoading: boolean,
 *   login: (token: string, username: string, userId: number) => void,
 *   logout: () => void
 * }}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}
