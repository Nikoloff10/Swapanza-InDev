import { useState, useEffect, useCallback, useRef } from 'react';
import axios from '../utils/axiosConfig';
import { toast } from 'react-toastify';

/**
 * Custom hook for user search functionality
 */
export function useUserSearch(token, currentUserId) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchTimeoutRef = useRef(null);

  // Search users by query
  const searchUsers = useCallback(
    async (query) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        const response = await axios.get(`/api/users/?search=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // Filter out the current user from results
        const filteredResults = response.data.filter(
          (user) => Number(user.id) !== Number(currentUserId)
        );

        setSearchResults(filteredResults);
      } catch (error) {
        console.error('Error searching users:', error);
        toast.error('Error searching users');
        setSearchResults([]);
      }
    },
    [token, currentUserId]
  );

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(searchQuery);
    }, 150);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchUsers]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    clearSearch,
  };
}

export default useUserSearch;
