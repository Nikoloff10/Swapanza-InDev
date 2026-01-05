import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from '../utils/axiosConfig';
import SwapanzaModal from './SwapanzaModal';
import ChatMessage from './ChatMessage';
import ChatHeader from './ChatHeader';
import MessageInput from './MessageInput';
import SwapanzaStatusBar from './SwapanzaStatusBar';
import SwapanzaOptionsModal from './SwapanzaOptionsModal';
import { redirectToLogin } from '../utils/tokenUtils';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import { SWAPANZA, INTERVALS, WS_CODES } from '../constants';

function ChatModal({ chatId, onClose, onMessagesRead, onNewMessage, hasPendingSwapanzaInvite }) {
  const { token, userId: currentUserId, username } = useAuth();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const ws = useRef(null);
  const messagesEndRef = useRef(null);
  const wsRetryCount = useRef(0);

  const [swapanzaPartner, setSwapanzaPartner] = useState(null);

  const [swapanzaDuration, setSwapanzaDuration] = useState(5);
  const [showSwapanzaOptions, setShowSwapanzaOptions] = useState(false);
  const [isSwapanzaRequested, setIsSwapanzaRequested] = useState(false);
  const [swapanzaStartTime, setSwapanzaStartTime] = useState(null);
  const [swapanzaRequestedBy, setSwapanzaRequestedBy] = useState(null);
  const [swapanzaRequestedByUsername, setSwapanzaRequestedByUsername] = useState(null);
  const [isSwapanzaActive, setIsSwapanzaActive] = useState(false);
  const [swapanzaEndTime, setSwapanzaEndTime] = useState(null);
  const [userConfirmedSwapanza, setUserConfirmedSwapanza] = useState(false);
  const [showSwapanzaModal, setShowSwapanzaModal] = useState(false);
  const [remainingMessages, setRemainingMessages] = useState(2);
  const [timeLeft, setTimeLeft] = useState(null);

  const swapanzaTimeLeftRef = useRef(null);
  const pendingMessages = useRef([]);
  const [partnerConfirmedSwapanza, setPartnerConfirmedSwapanza] = useState(false);

  const setupWebSocketRef = useRef(null);
  const refreshAuthTokenRef = useRef(null);
  const resetSwapanzaRef = useRef(null);
  const startSwapanzaCountdownRef = useRef(null);
  const fetchChatRef = useRef(null);
  const onNewMessageRef = useRef(onNewMessage);
  const [pendingSwapanzaInvite, setPendingSwapanzaInvite] = useState(false);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  const setupSwapanzaTimer = useCallback((endsAt) => {
    if (swapanzaTimeLeftRef.current) {
      clearInterval(swapanzaTimeLeftRef.current);
    }

    const updateTimeLeft = () => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((endsAt - now) / 1000));
      setTimeLeft(diff);

      if (diff <= 0) {
        clearInterval(swapanzaTimeLeftRef.current);
        swapanzaTimeLeftRef.current = null;

        // Reset Swapanza state when timer expires
        if (resetSwapanzaRef.current) {
          resetSwapanzaRef.current();
        }
      }
    };

    updateTimeLeft();
    swapanzaTimeLeftRef.current = setInterval(updateTimeLeft, INTERVALS.COUNTDOWN_TICK_MS);
  }, []);

  const resetSwapanza = useCallback(() => {
    setIsSwapanzaActive(false);
    setShowSwapanzaModal(false);
    setIsSwapanzaRequested(false);
    setSwapanzaRequestedBy(null);
    setSwapanzaRequestedByUsername(null);
    setUserConfirmedSwapanza(false);
    setPartnerConfirmedSwapanza(false);
    setRemainingMessages(SWAPANZA.MESSAGE_LIMIT);
    setSwapanzaEndTime(null);
    // Clear any pending invite flag so UI banners disappear
    setPendingSwapanzaInvite(false);

    if (swapanzaTimeLeftRef.current) {
      clearInterval(swapanzaTimeLeftRef.current);
    }
  }, []);

  // Store in ref
  resetSwapanzaRef.current = resetSwapanza;

  const fetchGlobalSwapanzaState = useCallback(async () => {
    if (!token) return;

    try {
      const response = await axios.get('/api/active-swapanza/', {
        headers: { Authorization: `Bearer ${token}` },
        params: { chat_id: chatId },
      });

      if (response.data.active) {
        // Apply Swapanza state regardless of current chat
        setIsSwapanzaActive(true);
        setSwapanzaEndTime(new Date(response.data.ends_at));
        setSwapanzaStartTime(new Date(response.data.started_at));

        // Use the remaining_messages directly from the API
        if (response.data.remaining_messages !== undefined) {
          setRemainingMessages(response.data.remaining_messages);
          console.log(
            'Setting remaining messages from global state to:',
            response.data.remaining_messages
          );
        }

        setSwapanzaPartner({
          id: response.data.partner_id,
          username: response.data.partner_username,
          profile_image: response.data.partner_profile_image,
        });

        const now = new Date();
        const endsAt = new Date(response.data.ends_at);
        const diff = Math.max(0, Math.floor((endsAt - now) / 1000));
        setTimeLeft(diff);

        if (!swapanzaTimeLeftRef.current) {
          setupSwapanzaTimer(endsAt);
        }
      } else if (!chat?.swapanza_active && !pendingSwapanzaInvite && !isSwapanzaRequested) {
        resetSwapanza();
      }
    } catch (error) {
      console.error('Error checking global Swapanza state:', error);
    }
  }, [
    token,
    chatId,
    chat,
    resetSwapanza,
    setupSwapanzaTimer,
    pendingSwapanzaInvite,
    isSwapanzaRequested,
  ]);

  useEffect(() => {
    fetchGlobalSwapanzaState();

    // Poll periodically while mounted
    const intervalId = setInterval(fetchGlobalSwapanzaState, INTERVALS.SWAPANZA_STATE_CHECK_MS);

    return () => clearInterval(intervalId);
  }, [fetchGlobalSwapanzaState]);

  useEffect(() => {
    if (isSwapanzaActive && swapanzaEndTime) {
      // Store global active Swapanza state
      localStorage.setItem(
        'activeSwapanza',
        JSON.stringify({
          active: true,
          endTime: swapanzaEndTime.toISOString(),
          partnerId: swapanzaPartner?.id,
          partnerUsername: swapanzaPartner?.username,
          chatId: chatId,
        })
      );

      // Clean up when Swapanza expires
      const cleanupTimeout = setTimeout(() => {
        localStorage.removeItem('activeSwapanza');
      }, swapanzaEndTime - new Date());

      return () => clearTimeout(cleanupTimeout);
    } else if (!isSwapanzaActive) {
      localStorage.removeItem('activeSwapanza');
    }
  }, [isSwapanzaActive, swapanzaEndTime, swapanzaPartner, chatId]);

  useEffect(() => {
    if (hasPendingSwapanzaInvite) {
      const fetchSwapanzaInvite = async () => {
        try {
          const response = await axios.get(`/api/chats/${chatId}/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const chat = response.data;
          if (chat.swapanza_requested_by && chat.swapanza_duration) {
            const isCurrentUserRequester = Number(chat.swapanza_requested_by) === currentUserId;

            setIsSwapanzaRequested(true);
            setSwapanzaDuration(chat.swapanza_duration);
            setSwapanzaRequestedBy(chat.swapanza_requested_by);
            // Set username based on whether current user is requester
            if (isCurrentUserRequester) {
              setSwapanzaRequestedByUsername(username || 'You');
            } else {
              const requester = chat.participants.find(
                (p) => Number(p.id) === Number(chat.swapanza_requested_by)
              );
              setSwapanzaRequestedByUsername(requester?.username || 'Unknown');
            }

            // Only show modal if user is recipient of the invite
            if (!isCurrentUserRequester) {
              setShowSwapanzaModal(true);
            }
            setPendingSwapanzaInvite(true);
          }
        } catch (err) {
          console.error('Error fetching Swapanza invite:', err);
          setPendingSwapanzaInvite(false);
        }
      };
      fetchSwapanzaInvite();
    } else {
      setPendingSwapanzaInvite(false);
    }
  }, [hasPendingSwapanzaInvite, chatId, token, currentUserId, username]);

  const otherParticipant = useMemo(() => {
    if (!chat || !chat.participants || !currentUserId) return null;
    return chat.participants.find((p) => Number(p.id) !== Number(currentUserId)) || null;
  }, [chat, currentUserId]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const refreshAuthToken = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        console.error('No refresh token available');
        return;
      }

      const response = await axios.post('/api/token/refresh/', {
        refresh: refreshToken,
      });

      if (response.data && response.data.access) {
        localStorage.setItem('token', response.data.access);

        if (setupWebSocketRef.current) {
          setupWebSocketRef.current();
        }
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      redirectToLogin();
    }
  }, []);

  refreshAuthTokenRef.current = refreshAuthToken;

  const startSwapanzaCountdown = useCallback((endTime) => {
    if (swapanzaTimeLeftRef.current) {
      clearInterval(swapanzaTimeLeftRef.current);
    }

    swapanzaTimeLeftRef.current = setInterval(() => {
      const now = new Date();
      const timeLeft = endTime - now;

      if (timeLeft <= 0) {
        clearInterval(swapanzaTimeLeftRef.current);
        if (resetSwapanzaRef.current) {
          resetSwapanzaRef.current();
        }

        if (refreshAuthTokenRef.current) {
          refreshAuthTokenRef.current();
        }
      }
    }, 1000);
  }, []);

  startSwapanzaCountdownRef.current = startSwapanzaCountdown;

  const handleChatMessage = useCallback(
    (message) => {
      if (message && (message.id || message.content)) {
        setMessages((prevMessages) => {
          let updatedMessages = [...prevMessages];
          // First check if this message already exists by ID
          const existingMessageIndex = updatedMessages.findIndex((m) => m.id === message.id);
          if (existingMessageIndex !== -1) {
            updatedMessages[existingMessageIndex] = { ...message, pending: false };
            return updatedMessages;
          }
          // Check if this is a confirmation of a pending message (match by client_id)
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
          // Otherwise, add as a new message
          return [...updatedMessages, { ...message, pending: false }];
        });
        // Only call onNewMessage if the message is from another user
        if (Number(message.sender) !== Number(currentUserId)) {
          onNewMessageRef.current();
        }
      } else {
        console.error('Invalid message format:', message);
      }
    },
    [currentUserId]
  );

  const handleTokenExpiry = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        redirectToLogin();
        return false;
      }
      const response = await axios.post('/api/token/refresh/', { refresh: refreshToken });
      if (response.data && response.data.access) {
        localStorage.setItem('token', response.data.access);
        if (response.data.refresh) {
          localStorage.setItem('refreshToken', response.data.refresh);
        }
        if (setupWebSocketRef.current) setupWebSocketRef.current();
        if (fetchChatRef.current) fetchChatRef.current();
        return true;
      }
      redirectToLogin();
      return false;
    } catch (error) {
      console.warn('Session expired. Please log in again.');
      toast.error('Session expired. Please log in again.');
      redirectToLogin();
      return false;
    }
  }, []);

  const handleMessagesRead = useCallback(
    (data) => {
      console.log('Messages marked as read by user:', data.user_id);
      if (onMessagesRead) {
        console.log('Calling onMessagesRead callback');
        onMessagesRead();
      }
    },
    [onMessagesRead]
  );

  // Function to handle Swapanza request
  const handleSwapanzaRequest = useCallback(
    (data) => {
      setIsSwapanzaRequested(true);
      setSwapanzaDuration(data.duration);
      setSwapanzaRequestedBy(Number(data.requested_by));
      setSwapanzaRequestedByUsername(data.requested_by_username);
      // Show the Swapanza modal only if the current user is NOT the requester
      if (Number(data.requested_by) !== Number(currentUserId)) {
        setShowSwapanzaModal(true);
      } else {
        setShowSwapanzaModal(false);
      }
    },
    [currentUserId]
  );

  // Function to handle Swapanza confirmation
  const handleSwapanzaConfirm = useCallback(
    (data) => {
      console.log('Processing Swapanza confirmation:', data);
      console.log('Current user ID:', currentUserId, 'Confirming user ID:', data.user_id);

      const isCurrentUser = Number(data.user_id) === Number(currentUserId);

      // Update confirmation status
      if (isCurrentUser) {
        console.log('Current user confirmed, setting userConfirmedSwapanza to true');
        setUserConfirmedSwapanza(true);
        // Close the modal when the current user confirms
        setShowSwapanzaModal(false);
      } else {
        console.log('Partner confirmed, setting partnerConfirmedSwapanza to true');
        setPartnerConfirmedSwapanza(true);
      }

      // If server says all users are confirmed, we can prepare for activation
      if (data.all_confirmed) {
        console.log('Server indicates all users confirmed, preparing for activation');

        // Both are confirmed - reflects server state
        setUserConfirmedSwapanza(true);
        setPartnerConfirmedSwapanza(true);
        // Ensure modal is closed when all are confirmed
        setShowSwapanzaModal(false);
      }
    },
    [currentUserId]
  );

  const handleSwapanzaActivate = useCallback(
    (data) => {
      console.log('Swapanza activated:', data);

      // Close modal when Swapanza activates
      setShowSwapanzaModal(false);

      const startedAt = new Date(data.started_at);
      const endsAt = new Date(data.ends_at);

      setSwapanzaStartTime(startedAt);
      setSwapanzaEndTime(endsAt);
      setIsSwapanzaActive(true);

      // Set remaining messages if provided
      if (data.remaining_messages !== undefined && data.remaining_messages !== null) {
        setRemainingMessages(Math.max(data.remaining_messages, 0));
      } else {
        setRemainingMessages(SWAPANZA.MESSAGE_LIMIT);
      }

      // Clear confirmation state
      setUserConfirmedSwapanza(false);
      setPartnerConfirmedSwapanza(false);

      // Set swapanzaPartner info
      if (data.partner_id && data.partner_username) {
        setSwapanzaPartner({
          id: data.partner_id,
          username: data.partner_username,
          profile_image: data.partner_profile_image || null,
        });
      } else {
        // Find partner from chat participants
        const partner = chat?.participants?.find((p) => Number(p.id) !== Number(currentUserId));
        if (partner) {
          setSwapanzaPartner({
            id: partner.id,
            username: partner.username,
            profile_image: partner.profile_image_url || null,
          });
        }
      }

      // Start countdown timer
      if (swapanzaTimeLeftRef.current) {
        clearInterval(swapanzaTimeLeftRef.current);
      }

      const updateTimeLeft = () => {
        const now = new Date();
        const diff = Math.max(0, Math.floor((endsAt - now) / 1000));
        setTimeLeft(diff);

        if (diff <= 0) {
          clearInterval(swapanzaTimeLeftRef.current);
          swapanzaTimeLeftRef.current = null;

          // Reset Swapanza when timer expires
          if (resetSwapanzaRef.current) {
            resetSwapanzaRef.current();
          }
        }
      };

      updateTimeLeft();
      swapanzaTimeLeftRef.current = setInterval(updateTimeLeft, INTERVALS.COUNTDOWN_TICK_MS);

      // Store minimal state in localStorage
      localStorage.setItem(
        `swapanza_active_${chatId}`,
        JSON.stringify({
          active: true,
          endsAt: endsAt.toISOString(),
          remainingMessages: data.remaining_messages || SWAPANZA.MESSAGE_LIMIT,
        })
      );
    },
    [chat, chatId, currentUserId, resetSwapanzaRef]
  );

  // Function to handle Swapanza expiration
  const handleSwapanzaExpire = useCallback(() => {
    if (resetSwapanzaRef.current) {
      resetSwapanzaRef.current();
    }
  }, []);

  const handleSwapanzaLogout = useCallback(() => {
    console.log('Received Swapanza logout notification - forcing logout');

    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('activeSwapanza');

    // Clear any chat-specific Swapanza data
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith('swapanza_active_')) {
        localStorage.removeItem(key);
      }
    });

    // Show a message (optional)
    console.warn('Your Swapanza session has expired. You will be redirected to login.'); // TODO: Replace with toast notification
    toast.info('Your Swapanza session has expired. You will be redirected to login.');

    // Force a hard redirect to login page (no client-side routing)
    redirectToLogin();
  }, []);

  // Function to handle server errors
  const handleServerError = useCallback((data) => {
    console.error('Error from server:', data.message);
    console.warn(`Error: ${data.message}`); // TODO: Replace with toast notification
    toast.error(data.message || 'Server error');
  }, []);

  // Set up WebSocket connection to chat
  useEffect(() => {
    if (!chatId || !token) return;

    // Define the WebSocket setup function
    const setupWebSocket = () => {
      // Check if token is expired before attempting connection
      try {
        const payloadBase64 = token.split('.')[1];
        if (!payloadBase64) {
          console.log('Invalid token format, redirecting to login');
          window.location.href = '/login';
          return;
        }

        const payload = JSON.parse(atob(payloadBase64));
        if (payload.exp) {
          const expirationTime = payload.exp * 1000;
          const currentTime = Date.now();

          if (currentTime >= expirationTime) {
            console.log('Token expired, redirecting to login');
            localStorage.clear();
            window.location.href = '/login';
            return;
          }
        }
      } catch (e) {
        console.error('Error checking token expiration:', e);

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
        console.log(`Setting up WebSocket connection to: ${wsUrl}`);

        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          console.log('WebSocket connected');
          setConnectionStatus('connected');
          wsRetryCount.current = 0;
          if (onMessagesRead) onMessagesRead();
        };

        ws.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);

            switch (data.type) {
              case 'chat.message': {
                const messageData = data.message || data;

                // Always update remaining messages if this is during Swapanza
                if (
                  isSwapanzaActive &&
                  messageData.remaining_messages !== undefined &&
                  Number(messageData.sender) === Number(currentUserId)
                ) {
                  const remainingMsgs = parseInt(messageData.remaining_messages);
                  setRemainingMessages(isNaN(remainingMsgs) ? 0 : Math.max(0, remainingMsgs));
                  console.log('Updated remaining messages to:', remainingMsgs);
                }

                handleChatMessage(messageData);
                break;
              }
              case 'chat.messages_read':
                handleMessagesRead(data);
                break;
              case 'chat.message.error':
                console.warn(data.message || 'Failed to send message');
                toast.error(data.message || 'Failed to send message');

                setMessages((prevMessages) =>
                  prevMessages.filter((msg) => !(msg.pending && msg.content === data.content))
                );

                pendingMessages.current = pendingMessages.current.filter(
                  (msg) => msg.content !== data.content
                );
                break;
              case 'swapanza.request':
                handleSwapanzaRequest(data);
                break;
              case 'swapanza.confirm':
                handleSwapanzaConfirm(data);
                break;
              case 'swapanza.activate':
                console.log('Received swapanza activation message:', data);
                handleSwapanzaActivate(data);
                break;
              case 'swapanza.expire':
                handleSwapanzaExpire();
                break;
              case 'swapanza.cancel':
                handleSwapanzaExpire();
                break;
              case 'swapanza.logout':
                handleSwapanzaLogout();
                break;
              case 'error':
                handleServerError(data);
                break;
              default:
                console.warn('Unknown message type:', data.type);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.current.onclose = (e) => {
          console.log('WebSocket closed:', e);
          setConnectionStatus('disconnected');

          if (e.code !== WS_CODES.NORMAL_CLOSURE) {
            const timeout = Math.min(
              WS_CODES.RECONNECT_BASE_MS * 2 ** wsRetryCount.current,
              INTERVALS.WS_MAX_RECONNECT_DELAY_MS
            );
            wsRetryCount.current += 1;

            console.log(`Reconnecting in ${timeout / WS_CODES.RECONNECT_BASE_MS} seconds...`);
            setTimeout(() => {
              if (document.visibilityState === 'visible') {
                if (setupWebSocketRef.current) {
                  setupWebSocketRef.current();
                }
              }
            }, timeout);
          }
        };

        ws.current.onerror = (e) => {
          console.error('WebSocket error:', e);
          setConnectionStatus('error');
          console.log('WebSocket error details:', {
            readyState: ws.current?.readyState,
            chatId,
            userId: currentUserId,
          });
        };
      } catch (error) {
        console.error('WebSocket setup error:', error);
        setConnectionStatus('error');
      }
    };

    setupWebSocketRef.current = setupWebSocket;

    // Call the setup function
    setupWebSocket();

    // Cleanup function when component unmounts
    return () => {
      if (ws.current) {
        ws.current.close(WS_CODES.NORMAL_CLOSURE, 'Component unmounted');
      }

      if (swapanzaTimeLeftRef.current) {
        clearInterval(swapanzaTimeLeftRef.current);
      }

      pendingMessages.current = [];
    };
  }, [
    chatId,
    token,
    currentUserId,
    onMessagesRead,
    handleChatMessage,
    handleMessagesRead,
    handleSwapanzaRequest,
    handleSwapanzaConfirm,
    handleSwapanzaActivate,
    handleSwapanzaExpire,
    handleSwapanzaLogout,
    handleServerError,
    isSwapanzaActive,
  ]);

  // Fetch chat details
  const fetchChat = useCallback(async () => {
    if (!chatId || !token) return;

    try {
      setLoading(true);
      const [chatResponse, swapanzaResponse] = await Promise.all([
        axios.get(`/api/chats/${chatId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('/api/active-swapanza/', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setChat(chatResponse.data);
      setMessages(chatResponse.data.messages || []);

      // Initialize Swapanza request state if there's a pending request
      if (chatResponse.data.swapanza_requested_by && !chatResponse.data.swapanza_active) {
        const isCurrentUserRequester =
          Number(chatResponse.data.swapanza_requested_by) === Number(currentUserId);

        setIsSwapanzaRequested(true);
        setSwapanzaDuration(chatResponse.data.swapanza_duration || 5);
        setSwapanzaRequestedBy(
          isCurrentUserRequester ? currentUserId : Number(chatResponse.data.swapanza_requested_by)
        );

        // Get requester's username if it's not the current user
        if (!isCurrentUserRequester) {
          const requester = chatResponse.data.participants.find(
            (p) => Number(p.id) === Number(chatResponse.data.swapanza_requested_by)
          );
          setSwapanzaRequestedByUsername(requester?.username || 'Unknown');
          // Never auto-open the modal when fetching chat details
          setShowSwapanzaModal(false);
        } else {
          // For the requester, set their own username
          setSwapanzaRequestedByUsername(username || 'You');
          setShowSwapanzaModal(false);
        } // Check if current user has already confirmed
        const confirmedUsers = chatResponse.data.swapanza_confirmed_users || [];
        setUserConfirmedSwapanza(confirmedUsers.includes(currentUserId.toString()));

        // Check if partner has confirmed
        const partner = chatResponse.data.participants.find(
          (p) => Number(p.id) !== Number(currentUserId)
        );
        if (partner) {
          setPartnerConfirmedSwapanza(confirmedUsers.includes(partner.id.toString()));
        }
      }

      // Check if chat has active swapanza
      const chatHasActiveSwapanza =
        chatResponse.data.swapanza_active &&
        new Date(chatResponse.data.swapanza_ends_at) > new Date();

      // Handle global Swapanza state
      const hasActiveGlobalSwapanza = swapanzaResponse.data.active;

      if (hasActiveGlobalSwapanza) {
        setIsSwapanzaActive(true);
        setSwapanzaEndTime(new Date(swapanzaResponse.data.ends_at));
        setSwapanzaStartTime(new Date(swapanzaResponse.data.started_at));

        // Correctly initialize the remaining messages (2 - count used)
        const remainingMsgs = swapanzaResponse.data.remaining_messages;
        setRemainingMessages(remainingMsgs);
        console.log('Setting remaining messages to:', remainingMsgs);

        // Store partner info for name swapping
        setSwapanzaPartner({
          id: swapanzaResponse.data.partner_id,
          username: swapanzaResponse.data.partner_username,
          profile_image: swapanzaResponse.data.partner_profile_image,
        });
      } else if (chatHasActiveSwapanza) {
        // If not in global swapanza but this chat has active swapanza
        setIsSwapanzaActive(true);
        setSwapanzaEndTime(new Date(chatResponse.data.swapanza_ends_at));
        setSwapanzaStartTime(new Date(chatResponse.data.swapanza_started_at));

        // Get message count for current user
        const messageCount = chatResponse.data.swapanza_message_count?.[currentUserId] || 0;
        setRemainingMessages(2 - messageCount);

        // Find the other participant to set as swapanzaPartner
        const otherUser = chatResponse.data.participants.find(
          (p) => Number(p.id) !== Number(currentUserId)
        );

        if (otherUser) {
          setSwapanzaPartner({
            id: otherUser.id,
            username: otherUser.username,
            profile_image: otherUser.profile_image_url,
          });
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching chat:', error);
      setError(error.message || 'Failed to fetch chat');
      setLoading(false);
    }
  }, [chatId, token, currentUserId]);

  fetchChatRef.current = fetchChat;

  useEffect(() => {
    if (fetchChatRef.current) {
      fetchChatRef.current();
    }

    if (setupWebSocketRef.current) {
      setupWebSocketRef.current();
    }

    return () => {
      if (ws.current) {
        ws.current.close(WS_CODES.NORMAL_CLOSURE, 'Component unmounted');
      }

      if (swapanzaTimeLeftRef.current) {
        clearInterval(swapanzaTimeLeftRef.current);
      }
    };
  }, [chatId]);

  useEffect(() => {
    if (fetchChatRef.current) {
      fetchChatRef.current();
    }

    if (setupWebSocketRef.current) {
      setupWebSocketRef.current();
    }

    return () => {
      if (ws.current) {
        ws.current.close(WS_CODES.NORMAL_CLOSURE, 'Component unmounted');
      }

      if (swapanzaTimeLeftRef.current) {
        clearInterval(swapanzaTimeLeftRef.current);
      }

      pendingMessages.current = [];
    };
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Add a response interceptor to handle 401 errors
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response && error.response.status === 401) {
          console.log('401 error detected, attempting token refresh...');

          // Check if we already tried refreshing
          if (error.config && error.config._retry) {
            console.log('Already tried refreshing token once, redirecting to login');
            localStorage.clear();
            window.location.href = '/login';
            return Promise.reject(error);
          }

          // Try to refresh token
          try {
            const refreshed = await handleTokenExpiry();
            if (refreshed && error.config) {
              // Mark this request as retried
              error.config._retry = true;
              // Retry the original request with new token
              error.config.headers.Authorization = `Bearer ${localStorage.getItem('token')}`;
              return axios(error.config);
            } else {
              // If refresh failed, redirect to login
              localStorage.clear();
              window.location.href = '/login';
              return Promise.reject(error);
            }
          } catch (refreshError) {
            console.error('Error during token refresh:', refreshError);
            localStorage.clear();
            window.location.href = '/login';
            return Promise.reject(error);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      // Remove interceptor when component unmounts
      axios.interceptors.response.eject(interceptor);
    };
  }, [handleTokenExpiry]);

  // Function to request a Swapanza
  const requestSwapanza = async () => {
    if (isSwapanzaRequested) {
      toast.info('A Swapanza request is already pending');
      setShowSwapanzaOptions(false);
      return;
    }

    try {
      // Check if user can start Swapanza first
      const checkResponse = await axios.get('/api/can-start-swapanza/', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (checkResponse.data.error) {
        toast.error(checkResponse.data.error);
        setShowSwapanzaOptions(false);
        return;
      }

      if (!checkResponse.data.can_start) {
        toast.info(checkResponse.data.reason || 'You cannot start a Swapanza at this time');
        setShowSwapanzaOptions(false);
        return;
      }

      // If allowed, proceed with Swapanza request
      if (ws.current?.readyState === WebSocket.OPEN) {
        const swapanzaMessage = {
          type: 'swapanza.request',
          duration: swapanzaDuration,
        };
        console.log('Sending Swapanza request:', swapanzaMessage);
        ws.current.send(JSON.stringify(swapanzaMessage));

        setShowSwapanzaOptions(false);
        setIsSwapanzaRequested(true);
        setSwapanzaRequestedBy(currentUserId); // Use user ID, not 'you'
        setSwapanzaRequestedByUsername(username || 'You');
      }
    } catch (error) {
      console.error('Error checking if user can start Swapanza:', error);
      let errorMessage = 'Could not verify if you can start a Swapanza.';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      toast.error(errorMessage + ' Please try again.');
      setShowSwapanzaOptions(false);
    }
  };

  // Function to cancel a pending Swapanza request (sender only)
  const cancelSwapanza = useCallback(async () => {
    try {
      // Try websocket first for immediate action
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'swapanza.cancel' }));
      } else {
        // Fallback to HTTP API - assume endpoint exists server-side
        await axios.post(
          '/api/swapanza/cancel/',
          { chat_id: chatId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      // Optimistically clear local Swapanza request state and UI
      setIsSwapanzaRequested(false);
      setShowSwapanzaModal(false);
      setSwapanzaRequestedBy(null);
      setSwapanzaRequestedByUsername(null);
      setPendingSwapanzaInvite(false);
      toast.info('Swapanza invitation cancelled');
    } catch (err) {
      console.error('Error cancelling Swapanza:', err);
      toast.error('Could not cancel Swapanza invitation');
    }
  }, [chatId, token]);

  // Function to confirm participation in a Swapanza
  const confirmSwapanza = () => {
    console.log('Sending Swapanza confirmation');
    if (ws.current?.readyState === WebSocket.OPEN) {
      const confirmMessage = {
        type: 'swapanza.confirm',
      };
      console.log('Sending confirmation message:', confirmMessage);
      ws.current.send(JSON.stringify(confirmMessage));

      setUserConfirmedSwapanza(true);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || connectionStatus !== 'connected') return;

    const messageContent = newMessage.trim();
    const tempId = uuidv4();

    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: 'chat.message',
          content: messageContent,
          client_id: tempId, // Send UUID to backend
        })
      );

      // Add a pending message to the UI for immediate feedback
      const pendingMsg = {
        id: tempId,
        client_id: tempId,
        content: messageContent,
        sender: currentUserId,
        created_at: new Date().toISOString(),
        pending: true,
        during_swapanza: isSwapanzaActive, // Use current state for UI only
      };

      setMessages((prevMessages) => [...prevMessages, pendingMsg]);
      pendingMessages.current.push(pendingMsg);

      setNewMessage('');
    } else {
      console.error('WebSocket is not connected');
      setConnectionStatus('error');
    }
  };

  // Calculate remaining messages for display
  const displayRemainingMessages = useMemo(() => {
    if (!isSwapanzaActive) return remainingMessages;

    // Count actual messages sent during Swapanza in the UI
    const messagesInThisChat = messages.filter(
      (m) => m.sender === currentUserId && m.during_swapanza && !m.pending
    ).length;

    // Calculate display value from what we can see in the UI
    const calculatedRemaining = messagesInThisChat === 0 ? 2 : Math.max(0, 2 - messagesInThisChat);

    // Use the greater of our calculated value or the server-provided value
    return Math.max(
      calculatedRemaining,
      remainingMessages !== null && remainingMessages !== undefined ? remainingMessages : 0
    );
  }, [isSwapanzaActive, messages, currentUserId, remainingMessages]);

  if (loading)
    return (
      <div className="modal-overlay">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 h-[90vh] flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
              <p className="text-green-700 font-medium">Loading chat...</p>
            </div>
          </div>
        </div>
      </div>
    );
  if (error)
    return (
      <div className="modal-overlay">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 h-[90vh] flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center py-12">
              <div className="text-5xl mb-4">❌</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Chat</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <button onClick={onClose} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  if (!chat)
    return (
      <div className="modal-overlay">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 h-[90vh] flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🔍</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Chat Not Found</h2>
              <p className="text-gray-600 mb-4">The requested chat could not be found.</p>
              <button onClick={onClose} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  const allMessages = [...messages];

  return (
    <div className="modal-overlay">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 h-[90vh] flex flex-col">
        {/* Header */}
        <ChatHeader
          otherParticipant={otherParticipant}
          connectionStatus={connectionStatus}
          isSwapanzaActive={isSwapanzaActive}
          onSwapanzaClick={() => setShowSwapanzaOptions(true)}
          onClose={onClose}
        />

        {/* Invitation banner (shows when there is a pending Swapanza invite) */}
        {pendingSwapanzaInvite && !showSwapanzaModal && (
          <div className="border-t p-3 bg-yellow-50 flex-shrink-0">
            <div className="max-w-2xl mx-auto flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div>
                  <div className="font-semibold text-yellow-800">Swapanza invitation</div>
                  <div className="text-sm text-yellow-700">
                    {swapanzaRequestedByUsername
                      ? `${swapanzaRequestedByUsername} invited you`
                      : 'You have a Swapanza invitation'}
                  </div>
                </div>
              </div>
              <div>
                <button
                  onClick={() => {
                    setShowSwapanzaModal(true);
                    setPendingSwapanzaInvite(false);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-150"
                >
                  View Invitation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {allMessages.length === 0 ? (
            <div className="text-center text-gray-500 my-8">
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          ) : (
            allMessages.map((msg) => {
              const isCurrentUser = Number(msg.sender) === Number(currentUserId);
              return (
                <div
                  key={msg.id}
                  className={isCurrentUser ? 'flex justify-end mb-3' : 'flex justify-start mb-3'}
                >
                  <ChatMessage
                    message={msg}
                    isCurrentUser={isCurrentUser}
                    participants={chat?.participants}
                    swapanzaPartner={swapanzaPartner}
                  />
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Swapanza Status Section */}
        <div className="flex-shrink-0">
          <SwapanzaStatusBar
            isSwapanzaActive={isSwapanzaActive}
            swapanzaEndTime={swapanzaEndTime}
            swapanzaStartTime={swapanzaStartTime}
            swapanzaPartner={swapanzaPartner}
            timeLeft={timeLeft}
            remainingMessages={displayRemainingMessages}
            isSwapanzaRequested={isSwapanzaRequested}
            swapanzaRequestedBy={swapanzaRequestedBy}
            swapanzaRequestedByUsername={swapanzaRequestedByUsername}
            currentUserId={currentUserId}
            userConfirmedSwapanza={userConfirmedSwapanza}
            partnerConfirmedSwapanza={partnerConfirmedSwapanza}
            onConfirm={confirmSwapanza}
            onCancel={cancelSwapanza}
          />
        </div>

        {/* Message Input */}
        <MessageInput
          value={newMessage}
          onChange={setNewMessage}
          onSend={sendMessage}
          isSwapanzaActive={isSwapanzaActive}
          remainingMessages={displayRemainingMessages}
          connectionStatus={connectionStatus}
        />
      </div>

      {/* Swapanza Confirmation Modal */}
      {showSwapanzaModal && (
        <SwapanzaModal
          isOpen={showSwapanzaModal}
          onClose={cancelSwapanza}
          onConfirm={confirmSwapanza}
          requestedBy={swapanzaRequestedBy}
          requestedByUsername={swapanzaRequestedByUsername}
          duration={swapanzaDuration}
          userConfirmed={userConfirmedSwapanza}
        />
      )}

      {/* Swapanza Options Modal */}
      <SwapanzaOptionsModal
        isOpen={showSwapanzaOptions}
        duration={swapanzaDuration}
        onDurationChange={setSwapanzaDuration}
        onStart={requestSwapanza}
        onClose={() => setShowSwapanzaOptions(false)}
      />
    </div>
  );
}

ChatModal.displayName = 'ChatModal';
export default ChatModal;
