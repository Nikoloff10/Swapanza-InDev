import { useState, useCallback, useRef } from 'react';
import axios from '../utils/axiosConfig';

/**
 * Custom hook to manage chat messages with pagination
 * Handles fetching, pagination, sending, and message state
 */
export function useChatMessages({ chatId, token, currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [chat, setChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);

  const pendingMessages = useRef([]);

  // Fetch chat metadata and initial messages
  const fetchChat = useCallback(async () => {
    if (!chatId || !token) return null;

    try {
      setLoading(true);
      const [chatResponse, messagesResponse, swapanzaResponse] = await Promise.all([
        axios.get(`/api/chats/${chatId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`/api/chats/${chatId}/messages/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('/api/active-swapanza/', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setChat(chatResponse.data);

      // Messages come newest-first from API, reverse for chronological display
      const fetchedMessages = messagesResponse.data.results || messagesResponse.data || [];
      setMessages(fetchedMessages.slice().reverse());

      // Handle pagination cursors
      setNextCursor(messagesResponse.data.next || null);
      setHasMore(!!messagesResponse.data.next);

      setLoading(false);

      return {
        chat: chatResponse.data,
        swapanza: swapanzaResponse.data,
      };
    } catch (err) {
      console.error('Error fetching chat:', err);
      setError(err.message || 'Failed to fetch chat');
      setLoading(false);
      return null;
    }
  }, [chatId, token]);

  // Load older messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!nextCursor || loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const response = await axios.get(nextCursor, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const olderMessages = response.data.results || response.data || [];

      // Prepend older messages (reverse since API returns newest-first)
      setMessages((prev) => [...olderMessages.slice().reverse(), ...prev]);

      setNextCursor(response.data.next || null);
      setHasMore(!!response.data.next);
    } catch (err) {
      console.error('Error loading more messages:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, hasMore, token]);

  // Handle incoming chat message from WebSocket
  const handleChatMessage = useCallback((message) => {
    if (!message || (!message.id && !message.content)) {
      console.error('Invalid message format:', message);
      return;
    }

    setMessages((prevMessages) => {
      let updatedMessages = [...prevMessages];

      // Check if message already exists by ID
      const existingIndex = updatedMessages.findIndex((m) => m.id === message.id);
      if (existingIndex !== -1) {
        updatedMessages[existingIndex] = { ...message, pending: false };
        return updatedMessages;
      }

      // Check if this confirms a pending message (match by client_id)
      if (message.client_id) {
        const pendingIndex = updatedMessages.findIndex(
          (m) => m.pending && m.client_id === message.client_id
        );
        if (pendingIndex !== -1) {
          updatedMessages[pendingIndex] = { ...message, pending: false };
          // Remove from pendingMessages ref
          const pendingMsgIndex = pendingMessages.current.findIndex(
            (pm) => pm.client_id === message.client_id
          );
          if (pendingMsgIndex !== -1) {
            pendingMessages.current.splice(pendingMsgIndex, 1);
          }
          return updatedMessages;
        }
      }

      // Add as new message
      return [...updatedMessages, { ...message, pending: false }];
    });
  }, []);

  // Handle message error from WebSocket
  const handleMessageError = useCallback((data) => {
    setMessages((prevMessages) =>
      prevMessages.filter((msg) => !(msg.pending && msg.content === data.content))
    );

    pendingMessages.current = pendingMessages.current.filter((msg) => msg.content !== data.content);
  }, []);

  // Get the other participant in the chat
  const getOtherParticipant = useCallback(() => {
    if (!chat || !chat.participants || !currentUserId) return null;
    return chat.participants.find((p) => Number(p.id) !== Number(currentUserId)) || null;
  }, [chat, currentUserId]);

  // Clear pending messages
  const clearPendingMessages = useCallback(() => {
    pendingMessages.current = [];
  }, []);

  return {
    chat,
    setChat,
    messages,
    setMessages,
    loading,
    loadingMore,
    error,
    hasMore,
    fetchChat,
    loadMoreMessages,
    handleChatMessage,
    handleMessageError,
    getOtherParticipant,
    clearPendingMessages,
  };
}

export default useChatMessages;
