import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import axios from '../utils/axiosConfig';
import SwapanzaModal from './SwapanzaModal';
import ChatMessage from './ChatMessage';
import ChatHeader from './ChatHeader';
import MessageInput from './MessageInput';
import SwapanzaStatusBar from './SwapanzaStatusBar';
import SwapanzaOptionsModal from './SwapanzaOptionsModal';
import { redirectToLogin } from '../utils/tokenUtils';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import { useChatWebSocket } from '../hooks/useChatWebSocket';
import { useChatMessages } from '../hooks/useChatMessages';
import { useSwapanza } from '../hooks/useSwapanza';
import { SWAPANZA } from '../constants';
import useClickOutside from '../hooks/useClickOutside';
import './styles/ChatModal.css';
import './styles/Modal.css';

function ChatModal({ chatId, onClose, onMessagesRead, onNewMessage, hasPendingSwapanzaInvite }) {
  const { token, userId: currentUserId, username } = useAuth();
  const [newMessage, setNewMessage] = React.useState('');
  const messagesEndRef = useRef(null);
  const onNewMessageRef = useRef(onNewMessage);
  const sendWsMessageRef = useRef(null);
  const modalRef = useRef(null);

  // Close when clicking outside modal or pressing Escape
  useClickOutside(modalRef, onClose);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  // Initialize chat messages hook
  const {
    chat,
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
    clearPendingMessages,
  } = useChatMessages({
    chatId,
    token,
    currentUserId,
  });

  // Initialize swapanza hook
  const swapanza = useSwapanza({
    chatId,
    token,
    currentUserId,
    username,
    chat,
    sendWsMessageRef,
    hasPendingSwapanzaInvite,
  });

  // Handle Swapanza logout - defined early since it's used in handleWsMessage
  const handleSwapanzaLogout = useCallback(() => {
    localStorage.clear();
    toast.info('Your Swapanza session has expired. You will be redirected to login.');
    redirectToLogin();
  }, []);

  // Handle WebSocket messages
  const handleWsMessage = useCallback(
    (data) => {
      switch (data.type) {
        case 'chat.message': {
          const messageData = data.message || data;

          // Update remaining messages during Swapanza
          if (
            swapanza.isSwapanzaActive &&
            messageData.remaining_messages !== undefined &&
            Number(messageData.sender) === Number(currentUserId)
          ) {
            swapanza.updateRemainingMessages(messageData.remaining_messages);
          }

          handleChatMessage(messageData);

          // Notify parent of new message from other user
          if (Number(messageData.sender) !== Number(currentUserId)) {
            onNewMessageRef.current?.();
          }
          break;
        }
        case 'chat.messages_read':
          onMessagesRead?.();
          break;
        case 'chat.message.error':
          toast.error(data.message || 'Failed to send message');
          handleMessageError(data);
          break;
        case 'swapanza.request':
          swapanza.handleSwapanzaRequest(data);
          break;
        case 'swapanza.confirm':
          swapanza.handleSwapanzaConfirm(data);
          break;
        case 'swapanza.activate':
          swapanza.handleSwapanzaActivate(data);
          break;
        case 'swapanza.expire':
        case 'swapanza.cancel':
          swapanza.handleSwapanzaExpire();
          break;
        case 'swapanza.logout':
          handleSwapanzaLogout();
          break;
        case 'error':
          console.error('Error from server:', data.message);
          toast.error(data.message || 'Server error');
          break;
        default:
          console.warn('Unknown message type:', data.type);
      }
    },
    [
      currentUserId,
      handleChatMessage,
      handleMessageError,
      handleSwapanzaLogout,
      onMessagesRead,
      swapanza,
    ]
  );

  // Initialize WebSocket hook
  const {
    connectionStatus,
    sendMessage: sendWsMessage,
    setupWebSocket,
    reconnect,
  } = useChatWebSocket({
    chatId,
    token,
    onMessage: handleWsMessage,
    onMessagesRead,
    onOpen: () => {
      onMessagesRead?.();
    },
  });

  // Keep ref updated with latest sendWsMessage
  useEffect(() => {
    sendWsMessageRef.current = sendWsMessage;
  }, [sendWsMessage]);

  // Handle token refresh
  const handleTokenExpiry = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        redirectToLogin();
        return false;
      }
      const response = await axios.post('/api/token/refresh/', { refresh: refreshToken });
      if (response.data?.access) {
        localStorage.setItem('token', response.data.access);
        if (response.data.refresh) {
          localStorage.setItem('refreshToken', response.data.refresh);
        }
        reconnect();
        fetchChat();
        return true;
      }
      redirectToLogin();
      return false;
    } catch (error) {
      toast.error('Session expired. Please log in again.');
      redirectToLogin();
      return false;
    }
  }, [reconnect, fetchChat]);

  // Axios interceptor for 401 errors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          if (error.config?._retry) {
            localStorage.clear();
            window.location.href = '/login';
            return Promise.reject(error);
          }

          try {
            const refreshed = await handleTokenExpiry();
            if (refreshed && error.config) {
              error.config._retry = true;
              error.config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;
              return axios(error.config);
            }
          } catch (refreshError) {
            localStorage.clear();
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [handleTokenExpiry]);

  // Initialize Swapanza state from fetched chat data
  const initializeSwapanzaFromChat = useCallback(
    (chatData, swapanzaData) => {
      if (!chatData) return;

      // Handle active global Swapanza
      if (swapanzaData?.active) {
        swapanza.handleSwapanzaActivate({
          started_at: swapanzaData.started_at,
          ends_at: swapanzaData.ends_at,
          remaining_messages: swapanzaData.remaining_messages,
          partner_id: swapanzaData.partner_id,
          partner_username: swapanzaData.partner_username,
          partner_profile_image: swapanzaData.partner_profile_image,
          server_time: swapanzaData.server_time,
        });
      }
    },
    [swapanza]
  );

  // Initialize chat data and WebSocket on mount
  useEffect(() => {
    const initChat = async () => {
      const result = await fetchChat();
      if (result) {
        initializeSwapanzaFromChat(result.chat, result.swapanza);
      }
    };

    initChat();
    setupWebSocket();

    return () => {
      clearPendingMessages();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get other participant
  const otherParticipant = useMemo(() => {
    if (!chat?.participants || !currentUserId) return null;
    return chat.participants.find((p) => Number(p.id) !== Number(currentUserId)) || null;
  }, [chat, currentUserId]);

  // Send message handler
  const handleSendMessage = useCallback(() => {
    if (!newMessage.trim() || connectionStatus !== 'connected') return;

    // Use same client_id for both WebSocket message and pending message
    const clientId = crypto.randomUUID();

    const sent = sendWsMessage({
      type: 'chat.message',
      content: newMessage.trim(),
      client_id: clientId,
    });

    if (sent) {
      // Optimistically update remaining messages during Swapanza
      if (swapanza.isSwapanzaActive && swapanza.remainingMessages > 0) {
        swapanza.updateRemainingMessages(swapanza.remainingMessages - 1);
      }

      // Add pending message for immediate feedback
      const pendingMsg = {
        id: clientId, // Use same ID for matching
        client_id: clientId, // Include client_id for server confirmation matching
        content: newMessage.trim(),
        sender: currentUserId,
        created_at: new Date().toISOString(),
        pending: true,
        during_swapanza: swapanza.isSwapanzaActive,
      };
      setMessages((prev) => [...prev, pendingMsg]);
      setNewMessage('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    newMessage,
    connectionStatus,
    sendWsMessage,
    currentUserId,
    swapanza.isSwapanzaActive,
    swapanza.remainingMessages,
    swapanza.updateRemainingMessages,
    setMessages,
  ]);

  // Request Swapanza handler
  const handleRequestSwapanza = useCallback(async () => {
    const result = await swapanza.requestSwapanza();
    if (!result.success) {
      toast.error(result.message);
    }
    swapanza.setShowSwapanzaOptions(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapanza.requestSwapanza, swapanza.setShowSwapanzaOptions]);

  // Cancel Swapanza handler
  const handleCancelSwapanza = useCallback(async () => {
    const result = await swapanza.cancelSwapanza();
    if (result.success) {
      toast.info('Swapanza invitation cancelled');
    } else {
      toast.error(result.message || 'Could not cancel Swapanza invitation');
    }
  }, [swapanza]);

  // Calculate remaining messages for display
  const displayRemainingMessages = useMemo(() => {
    if (!swapanza.isSwapanzaActive) return swapanza.remainingMessages;

    const messagesInChat = messages.filter(
      (m) => m.sender === currentUserId && m.during_swapanza && !m.pending
    ).length;

    const calculatedRemaining =
      messagesInChat === 0
        ? SWAPANZA.MESSAGE_LIMIT
        : Math.max(0, SWAPANZA.MESSAGE_LIMIT - messagesInChat);

    return Math.max(calculatedRemaining, swapanza.remainingMessages ?? 0);
  }, [swapanza.isSwapanzaActive, swapanza.remainingMessages, messages, currentUserId]);

  // Loading state
  if (loading) {
    return (
      <div
        className="modal-overlay"
        data-modal-root
        onClick={(e) => {
          e.stopPropagation();
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={modalRef}
          className="modal-content modal-chat"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-body-center">
            <div className="modal-loading">
              <div className="spinner spinner-large spinner-green" aria-hidden="true"></div>
              <p className="text-success font-medium">Loading chat...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="modal-overlay"
        data-modal-root
        onClick={(e) => {
          e.stopPropagation();
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={modalRef}
          className="modal-content modal-chat"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-body-center">
            <div className="modal-error">
              <h2 className="modal-title">Error Loading Chat</h2>
              <p className="modal-text mb-4">{error}</p>
              <button onClick={onClose} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Chat not found state
  if (!chat) {
    return (
      <div
        className="modal-overlay"
        data-modal-root
        onClick={(e) => {
          e.stopPropagation();
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={modalRef}
          className="modal-content modal-chat"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-body-center">
            <div className="modal-error">
              <h2 className="modal-title">Chat Not Found</h2>
              <p className="modal-text mb-4">The requested chat could not be found.</p>
              <button onClick={onClose} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="modal-overlay"
      data-modal-root
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="modal-content modal-chat"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <ChatHeader
          otherParticipant={otherParticipant}
          connectionStatus={connectionStatus}
          isSwapanzaActive={swapanza.isSwapanzaActive}
          onSwapanzaClick={() => swapanza.setShowSwapanzaOptions(true)}
          onClose={onClose}
        />

        {/* Invitation banner */}
        {swapanza.pendingSwapanzaInvite && !swapanza.showSwapanzaModal && (
          <div className="swapanza-banner">
            <div className="swapanza-banner-inner">
              <div className="swapanza-banner-left">
                <div className="swapanza-banner-title">Swapanza invitation</div>
                <div className="swapanza-banner-sub">
                  {swapanza.swapanzaRequestedByUsername
                    ? `${swapanza.swapanzaRequestedByUsername} invited you`
                    : 'You have a Swapanza invitation'}
                </div>
              </div>
              <button
                onClick={() => {
                  swapanza.setShowSwapanzaModal(true);
                  swapanza.setPendingSwapanzaInvite(false);
                }}
                className="btn-purple"
              >
                View Invitation
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="messages-container">
          {/* Load More Button */}
          {hasMore && messages.length > 0 && (
            <div className="load-more">
              <button onClick={loadMoreMessages} disabled={loadingMore} className="btn-link">
                {loadingMore ? 'Loading...' : 'Load older messages'}
              </button>
            </div>
          )}
          {messages.length === 0 ? (
            <div className="empty-messages">
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isCurrentUser = Number(msg.sender) === Number(currentUserId);
              return (
                <div
                  key={msg.id}
                  className={
                    isCurrentUser
                      ? 'message-row message-row--right'
                      : 'message-row message-row--left'
                  }
                >
                  <ChatMessage
                    message={msg}
                    isCurrentUser={isCurrentUser}
                    participants={chat?.participants}
                    swapanzaPartner={swapanza.swapanzaPartner}
                  />
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Swapanza Status */}
        <div className="status-bar-wrapper">
          <SwapanzaStatusBar
            isSwapanzaActive={swapanza.isSwapanzaActive}
            swapanzaEndTime={swapanza.swapanzaEndTime}
            swapanzaStartTime={swapanza.swapanzaStartTime}
            swapanzaPartner={swapanza.swapanzaPartner}
            timeLeft={swapanza.timeLeft}
            remainingMessages={displayRemainingMessages}
            isSwapanzaRequested={swapanza.isSwapanzaRequested}
            swapanzaRequestedBy={swapanza.swapanzaRequestedBy}
            swapanzaRequestedByUsername={swapanza.swapanzaRequestedByUsername}
            currentUserId={currentUserId}
            userConfirmedSwapanza={swapanza.userConfirmedSwapanza}
            partnerConfirmedSwapanza={swapanza.partnerConfirmedSwapanza}
            onConfirm={swapanza.confirmSwapanza}
            onCancel={handleCancelSwapanza}
          />
        </div>

        {/* Message Input */}
        <MessageInput
          value={newMessage}
          onChange={setNewMessage}
          onSend={handleSendMessage}
          isSwapanzaActive={swapanza.isSwapanzaActive}
          remainingMessages={displayRemainingMessages}
          connectionStatus={connectionStatus}
        />
      </div>

      {/* Swapanza Confirmation Modal */}
      {swapanza.showSwapanzaModal && (
        <SwapanzaModal
          isOpen={swapanza.showSwapanzaModal}
          onClose={handleCancelSwapanza}
          onConfirm={swapanza.confirmSwapanza}
          requestedBy={swapanza.swapanzaRequestedBy}
          requestedByUsername={swapanza.swapanzaRequestedByUsername}
          duration={swapanza.swapanzaDuration}
          userConfirmed={swapanza.userConfirmedSwapanza}
        />
      )}

      {/* Swapanza Options Modal */}
      <SwapanzaOptionsModal
        isOpen={swapanza.showSwapanzaOptions}
        duration={swapanza.swapanzaDuration}
        onDurationChange={swapanza.setSwapanzaDuration}
        onStart={handleRequestSwapanza}
        onClose={() => swapanza.setShowSwapanzaOptions(false)}
      />
    </div>
  );
}

ChatModal.displayName = 'ChatModal';
export default ChatModal;
