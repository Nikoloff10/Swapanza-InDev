import { useState, useEffect, useCallback, useRef } from 'react';
import axios from '../utils/axiosConfig';
import { toast } from 'react-toastify';
import { useAuth } from './useAuth';
import { INTERVALS, WS_CODES } from '../constants';

/**
 * Custom hook for managing chat list data, WebSocket, and state
 */
export function useChatListData() {
  const { token, userId: currentUserId, username } = useAuth();

  // WebSocket state
  const [wsConnected, setWsConnected] = useState(false);
  const notificationWsRef = useRef(null);
  const wsErrorShownRef = useRef(false);

  // Chat state
  const [chats, setChats] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  // Closed chats state (persisted to localStorage)
  const [closedChatIds, setClosedChatIds] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem('closedChats') || '[]') || []).map((id) =>
        id.toString()
      );
    } catch (e) {
      console.error('Error reading closedChats from localStorage', e);
      return [];
    }
  });

  // Helper to persist closed chat IDs
  const persistClosedChatIds = useCallback((ids) => {
    const unique = Array.from(new Set((ids || []).map((i) => i.toString())));
    localStorage.setItem('closedChats', JSON.stringify(unique));
    setClosedChatIds(unique);
  }, []);

  // Read closed chat IDs from localStorage
  const getClosedChatIds = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('closedChats') || '[]');
      return (stored || []).map((id) => id.toString());
    } catch (e) {
      return closedChatIds;
    }
  }, [closedChatIds]);

  // Fetch current user profile
  const fetchCurrentUserProfile = useCallback(async () => {
    if (!token || !currentUserId) return;

    try {
      const response = await axios.get(`/api/profile/${currentUserId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCurrentUserProfile(response.data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      toast.error('Error fetching user profile');
    }
  }, [token, currentUserId]);

  // Fetch chats from the backend
  const fetchChats = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get('/api/chats/', {
        headers: { Authorization: `Bearer ${token}` },
        params: { include_closed: true },
      });
      const closed = getClosedChatIds();
      const filtered = (response.data || []).filter((c) => !closed.includes(c.id.toString()));
      setChats(filtered);
    } catch (error) {
      console.error('Error fetching chats:', error);
      toast.error('Error fetching chats');
    }
  }, [token, getClosedChatIds]);

  // Fetch unread message counts
  const fetchUnreadCounts = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get('/api/unread-counts/', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const closed = getClosedChatIds();
      const filteredCounts = {};
      Object.entries(response.data).forEach(([chatId, count]) => {
        if (!closed.includes(chatId.toString()) && count > 0) {
          filteredCounts[chatId] = count;
        }
      });

      setUnreadCounts(filteredCounts);
    } catch (error) {
      console.error('Error fetching unread counts:', error.response || error);
    }
  }, [token, getClosedChatIds]);

  // Remove a chat (mark as closed)
  const removeChat = useCallback(
    (chatId) => {
      const asStr = chatId.toString();
      const closed = getClosedChatIds();
      if (!closed.includes(asStr)) {
        persistClosedChatIds([...closed, asStr]);
      }

      setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));
      setUnreadCounts((prevCounts) => {
        const newCounts = { ...prevCounts };
        delete newCounts[chatId];
        return newCounts;
      });
    },
    [getClosedChatIds, persistClosedChatIds]
  );

  // Close all chats
  const closeAllChats = useCallback(() => {
    const allChatIds = chats.map((chat) => chat.id.toString());
    const existingClosed = getClosedChatIds();
    const combined = Array.from(new Set([...existingClosed, ...allChatIds]));
    persistClosedChatIds(combined);

    setChats([]);
    setUnreadCounts({});
    fetchChats();
    fetchUnreadCounts();
  }, [chats, getClosedChatIds, fetchChats, fetchUnreadCounts, persistClosedChatIds]);

  // Reset all notifications
  const resetAllNotifications = useCallback(async () => {
    try {
      await axios.post(
        '/api/reset-notifications/',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUnreadCounts({});
      fetchUnreadCounts();
    } catch (error) {
      console.error('Error resetting notifications:', error);
    }
  }, [token, fetchUnreadCounts]);

  // Reopen a closed chat
  const reopenChat = useCallback(
    (chatId) => {
      const closed = getClosedChatIds();
      if (closed.includes(chatId.toString())) {
        const remaining = closed.filter((id) => id !== chatId.toString());
        persistClosedChatIds(remaining);
      }
    },
    [getClosedChatIds, persistClosedChatIds]
  );

  // Add a chat to the list
  const addChat = useCallback((chat) => {
    setChats((prevChats) => {
      if (prevChats.some((c) => c.id === chat.id)) {
        return prevChats;
      }
      return [...prevChats, chat];
    });
  }, []);

  // Calculate total unread messages
  const totalUnreadMessages =
    Object.values(unreadCounts).reduce((sum, count) => sum + (count > 0 ? count : 0), 0) || 0;

  // Initial data fetch
  useEffect(() => {
    fetchCurrentUserProfile();
    fetchChats();
    fetchUnreadCounts();
  }, [fetchCurrentUserProfile, fetchChats, fetchUnreadCounts]);

  // Poll if WebSocket is not connected
  useEffect(() => {
    let interval = null;
    if (!wsConnected) {
      interval = setInterval(() => {
        fetchChats();
        fetchUnreadCounts();
      }, INTERVALS.SWAPANZA_STATE_CHECK_MS);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [wsConnected, fetchChats, fetchUnreadCounts]);

  // WebSocket connection
  useEffect(() => {
    if (!token || !currentUserId) return;

    let ws = null;
    let pingInterval = null;
    let pongTimeout = null;
    let reconnectTimeout = null;
    let mountedRef = { current: true };
    let reconnectAttempt = 0;
    let isReconnecting = false;

    const cleanup = () => {
      if (pingInterval) clearInterval(pingInterval);
      if (pongTimeout) clearTimeout(pongTimeout);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        try {
          ws.close();
        } catch (err) {
          console.warn('Error closing websocket:', err);
        }
        ws = null;
      }
    };

    const startPing = () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      if (pingInterval) clearInterval(pingInterval);
      if (pongTimeout) clearTimeout(pongTimeout);

      ws.send(JSON.stringify({ type: 'ping' }));

      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
          pongTimeout = setTimeout(() => {
            console.warn('No pong received in 45s');
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.close(3000, 'No pong received');
            }
          }, 45000);
        }
      }, 60000);
    };

    const handleMessage = (data) => {
      const closed = getClosedChatIds();
      const chatIdStr = data.chat_id?.toString();
      if (chatIdStr && closed.includes(chatIdStr)) {
        return; // Ignore notifications for closed chats
      }

      if (data.type === 'unread_count') {
        setUnreadCounts((prev) => ({ ...prev, [data.chat_id]: data.count }));
      } else if (data.type === 'swapanza_invite') {
        setUnreadCounts((prev) => ({ ...prev, [data.chat_id]: -1 }));
        toast.info(`Swapanza invite from ${data.from}! Click to view.`, {
          autoClose: 6000,
        });
      } else if (data.type === 'swapanza.logout') {
        // Force logout when Swapanza expires - applies to all users in the session
        console.log('Swapanza expired - logging out');
        localStorage.clear();
        toast.info('Your Swapanza session has expired. You will be redirected to login.');
        window.location.href = '/login';
      }
    };

    const connect = () => {
      if (isReconnecting || !mountedRef.current) return;
      isReconnecting = true;

      cleanup();

      try {
        const host = window.location.hostname;
        const wsUrl = `ws://${host}:8000/ws/notifications/?token=${token}`;
        ws = new WebSocket(wsUrl);
        notificationWsRef.current = ws;

        ws.onopen = () => {
          if (!mountedRef.current) return;
          setWsConnected(true);
          wsErrorShownRef.current = false;
          reconnectAttempt = 0;
          isReconnecting = false;
          startPing();
        };

        ws.onclose = (e) => {
          if (!mountedRef.current) return;
          setWsConnected(false);
          cleanup();

          if (e.code !== WS_CODES.NORMAL_CLOSURE && !wsErrorShownRef.current) {
            wsErrorShownRef.current = true;
            if (e.code !== 3000) {
              toast.error('Connection lost. Reconnecting...');
            }
          }

          if (mountedRef.current && e.code !== WS_CODES.NORMAL_CLOSURE) {
            const delay = Math.min(
              WS_CODES.RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt++),
              INTERVALS.WS_MAX_RECONNECT_DELAY_MS
            );
            isReconnecting = false;
            reconnectTimeout = setTimeout(connect, delay);
          }
        };

        ws.onerror = () => {
          // Error handling is done in onclose
        };

        ws.onmessage = (event) => {
          if (!mountedRef.current) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'pong') {
              if (pongTimeout) clearTimeout(pongTimeout);
              return;
            }
            handleMessage(data);
          } catch (err) {
            console.error('Error handling message:', err);
          }
        };
      } catch (err) {
        console.error('Error creating WebSocket:', err);
        isReconnecting = false;
        if (mountedRef.current) {
          const delay = Math.min(
            WS_CODES.RECONNECT_BASE_MS * Math.pow(2, reconnectAttempt++),
            INTERVALS.WS_MAX_RECONNECT_DELAY_MS
          );
          reconnectTimeout = setTimeout(connect, delay);
        }
      }
    };

    mountedRef.current = true;
    setTimeout(connect, 200);

    return () => {
      mountedRef.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentUserId]);

  return {
    // State
    chats,
    unreadCounts,
    currentUserProfile,
    wsConnected,
    totalUnreadMessages,
    currentUserId,
    username,

    // Actions
    fetchChats,
    fetchUnreadCounts,
    removeChat,
    closeAllChats,
    resetAllNotifications,
    reopenChat,
    addChat,
    setChats,
    setUnreadCounts,
    getClosedChatIds,
    persistClosedChatIds,
  };
}

export default useChatListData;
