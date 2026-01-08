import { useState, useRef, useCallback, useEffect } from 'react';
import { WS_CODES, INTERVALS } from '../constants';

/**
 * Custom hook to manage WebSocket connection for chat
 * Handles connection, reconnection, and message sending
 */
export function useChatWebSocket({ chatId, token, onMessage, onMessagesRead, onOpen }) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const ws = useRef(null);
  const wsRetryCount = useRef(0);
  const setupWebSocketRef = useRef(null);

  // Check if token is expired
  const isTokenExpired = useCallback((tokenStr) => {
    try {
      const payloadBase64 = tokenStr.split('.')[1];
      if (!payloadBase64) return true;

      const payload = JSON.parse(atob(payloadBase64));
      if (payload.exp) {
        return Date.now() >= payload.exp * 1000;
      }
      return false;
    } catch (e) {
      console.error('Error checking token expiration:', e);
      return true;
    }
  }, []);

  // Setup WebSocket connection
  const setupWebSocket = useCallback(() => {
    if (!chatId || !token) return;

    if (isTokenExpired(token)) {
      localStorage.clear();
      window.location.href = '/login';
      return;
    }

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.close();
    }

    try {
      setConnectionStatus('connecting');
      const host = window.location.hostname;
      const wsUrl = `ws://${host}:8000/ws/chat/${chatId}/?token=${token}`;

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setConnectionStatus('connected');
        wsRetryCount.current = 0;
        onOpen?.();
        onMessagesRead?.();
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (error) {
          // Failed to parse WebSocket message
        }
      };

      ws.current.onclose = (e) => {
        setConnectionStatus('disconnected');

        if (e.code !== WS_CODES.NORMAL_CLOSURE) {
          const timeout = Math.min(
            WS_CODES.RECONNECT_BASE_MS * 2 ** wsRetryCount.current,
            INTERVALS.WS_MAX_RECONNECT_DELAY_MS
          );
          wsRetryCount.current += 1;

          setTimeout(() => {
            if (document.visibilityState === 'visible') {
              setupWebSocketRef.current?.();
            }
          }, timeout);
        }
      };

      ws.current.onerror = () => {
        if (ws.current?.readyState !== WebSocket.CLOSED) {
          setConnectionStatus('error');
        }
      };
    } catch (error) {
      console.error('WebSocket setup error:', error);
      setConnectionStatus('error');
    }
  }, [chatId, token, isTokenExpired, onMessage, onMessagesRead, onOpen]);

  // Store setup function in ref for reconnection
  setupWebSocketRef.current = setupWebSocket;

  // Send a message through WebSocket
  const sendMessage = useCallback((message) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
      return true;
    }
    setConnectionStatus('error');
    return false;
  }, []);

  // Close WebSocket connection
  const close = useCallback((reason = 'Manual close') => {
    if (ws.current) {
      ws.current.close(WS_CODES.NORMAL_CLOSURE, reason);
    }
  }, []);

  // Reconnect WebSocket
  const reconnect = useCallback(() => {
    setupWebSocketRef.current?.();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ws.current) {
        ws.current.close(WS_CODES.NORMAL_CLOSURE, 'Component unmounted');
      }
    };
  }, []);

  return {
    connectionStatus,
    sendMessage,
    close,
    reconnect,
    setupWebSocket,
    isConnected: connectionStatus === 'connected',
  };
}

export default useChatWebSocket;
