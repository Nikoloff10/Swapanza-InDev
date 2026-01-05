import { useState, useRef, useCallback, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import { SWAPANZA, INTERVALS } from '../constants';

/**
 * Custom hook to manage Swapanza state and timers
 * Handles countdown, activation, confirmation, and expiration
 */
export function useSwapanza({
  chatId,
  token,
  currentUserId,
  username,
  chat,
  sendWsMessageRef,
  hasPendingSwapanzaInvite,
}) {
  // Swapanza request state
  const [isSwapanzaRequested, setIsSwapanzaRequested] = useState(false);
  const [swapanzaDuration, setSwapanzaDuration] = useState(5);
  const [swapanzaRequestedBy, setSwapanzaRequestedBy] = useState(null);
  const [swapanzaRequestedByUsername, setSwapanzaRequestedByUsername] = useState(null);

  // Swapanza active state
  const [isSwapanzaActive, setIsSwapanzaActive] = useState(false);
  const [swapanzaStartTime, setSwapanzaStartTime] = useState(null);
  const [swapanzaEndTime, setSwapanzaEndTime] = useState(null);
  const [swapanzaPartner, setSwapanzaPartner] = useState(null);

  // Confirmation state
  const [userConfirmedSwapanza, setUserConfirmedSwapanza] = useState(false);
  const [partnerConfirmedSwapanza, setPartnerConfirmedSwapanza] = useState(false);

  // UI state
  const [showSwapanzaModal, setShowSwapanzaModal] = useState(false);
  const [showSwapanzaOptions, setShowSwapanzaOptions] = useState(false);
  const [pendingSwapanzaInvite, setPendingSwapanzaInvite] = useState(false);

  // Message tracking
  const [remainingMessages, setRemainingMessages] = useState(SWAPANZA.MESSAGE_LIMIT);
  const [timeLeft, setTimeLeft] = useState(null);

  // Timer ref
  const swapanzaTimeLeftRef = useRef(null);

  // Reset all Swapanza state
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
    setSwapanzaStartTime(null);
    setPendingSwapanzaInvite(false);
    setTimeLeft(null);

    if (swapanzaTimeLeftRef.current) {
      clearInterval(swapanzaTimeLeftRef.current);
      swapanzaTimeLeftRef.current = null;
    }

    // Clear localStorage
    localStorage.removeItem('activeSwapanza');
    localStorage.removeItem(`swapanza_active_${chatId}`);
  }, [chatId]);

  // Setup countdown timer - uses duration in seconds to avoid clock drift issues
  const setupSwapanzaTimer = useCallback(
    (durationSeconds) => {
      if (swapanzaTimeLeftRef.current) {
        clearInterval(swapanzaTimeLeftRef.current);
      }

      // Start with the server-calculated duration, then count down locally
      let remaining = durationSeconds;
      setTimeLeft(remaining);

      swapanzaTimeLeftRef.current = setInterval(() => {
        remaining -= 1;
        setTimeLeft(Math.max(0, remaining));

        if (remaining <= 0) {
          clearInterval(swapanzaTimeLeftRef.current);
          swapanzaTimeLeftRef.current = null;
          resetSwapanza();
        }
      }, INTERVALS.COUNTDOWN_TICK_MS);
    },
    [resetSwapanza]
  );

  // Handle Swapanza request from WebSocket
  const handleSwapanzaRequest = useCallback(
    (data) => {
      setIsSwapanzaRequested(true);
      setSwapanzaDuration(data.duration);
      setSwapanzaRequestedBy(Number(data.requested_by));
      setSwapanzaRequestedByUsername(data.requested_by_username);

      // Show modal only if current user is NOT the requester
      if (Number(data.requested_by) !== Number(currentUserId)) {
        setShowSwapanzaModal(true);
      } else {
        setShowSwapanzaModal(false);
      }
    },
    [currentUserId]
  );

  // Handle Swapanza confirmation from WebSocket
  const handleSwapanzaConfirm = useCallback(
    (data) => {
      console.log('Processing Swapanza confirmation:', data);
      const isCurrentUser = Number(data.user_id) === Number(currentUserId);

      if (isCurrentUser) {
        setUserConfirmedSwapanza(true);
        setShowSwapanzaModal(false);
      } else {
        setPartnerConfirmedSwapanza(true);
      }

      if (data.all_confirmed) {
        setUserConfirmedSwapanza(true);
        setPartnerConfirmedSwapanza(true);
        setShowSwapanzaModal(false);
      }
    },
    [currentUserId]
  );

  // Handle Swapanza activation from WebSocket
  const handleSwapanzaActivate = useCallback(
    (data) => {
      console.log('Swapanza activated:', data);
      setShowSwapanzaModal(false);

      const startedAt = new Date(data.started_at);
      const endsAt = new Date(data.ends_at);

      // Calculate duration from server times (avoids client/server clock drift)
      const durationSeconds = Math.floor((endsAt - startedAt) / 1000);

      console.log('Timer setup:', {
        rawStartedAt: data.started_at,
        rawEndsAt: data.ends_at,
        durationSeconds,
      });

      setSwapanzaStartTime(startedAt);
      setSwapanzaEndTime(endsAt);
      setIsSwapanzaActive(true);
      setIsSwapanzaRequested(false);

      // Set remaining messages
      if (data.remaining_messages !== undefined && data.remaining_messages !== null) {
        setRemainingMessages(Math.max(data.remaining_messages, 0));
      } else {
        setRemainingMessages(SWAPANZA.MESSAGE_LIMIT);
      }

      // Clear confirmation state
      setUserConfirmedSwapanza(false);
      setPartnerConfirmedSwapanza(false);

      // Set partner info
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

      // Start countdown timer with server-calculated duration
      setupSwapanzaTimer(durationSeconds);

      // Store in localStorage
      localStorage.setItem(
        `swapanza_active_${chatId}`,
        JSON.stringify({
          active: true,
          durationSeconds,
          startedAtClient: Date.now(), // Track when client received activation
          remainingMessages: data.remaining_messages || SWAPANZA.MESSAGE_LIMIT,
        })
      );
    },
    [chat, chatId, currentUserId, setupSwapanzaTimer]
  );

  // Handle Swapanza expiration
  const handleSwapanzaExpire = useCallback(() => {
    resetSwapanza();
  }, [resetSwapanza]);

  // Request a new Swapanza
  const requestSwapanza = useCallback(async () => {
    if (isSwapanzaRequested) {
      return { success: false, message: 'A Swapanza request is already pending' };
    }

    try {
      // Check if user can start Swapanza
      const checkResponse = await axios.get('/api/can-start-swapanza/', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (checkResponse.data.error) {
        return { success: false, message: checkResponse.data.error };
      }

      if (!checkResponse.data.can_start) {
        return {
          success: false,
          message: checkResponse.data.reason || 'You cannot start a Swapanza at this time',
        };
      }

      // Send request via WebSocket
      const sent = sendWsMessageRef?.current?.({
        type: 'swapanza.request',
        duration: swapanzaDuration,
      });

      if (sent) {
        setShowSwapanzaOptions(false);
        setIsSwapanzaRequested(true);
        setSwapanzaRequestedBy(currentUserId);
        setSwapanzaRequestedByUsername(username || 'You');
        return { success: true };
      }

      return { success: false, message: 'Could not send Swapanza request' };
    } catch (error) {
      console.error('Error requesting Swapanza:', error);
      return {
        success: false,
        message: error.response?.data?.error || 'Could not verify if you can start a Swapanza',
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSwapanzaRequested, token, swapanzaDuration, currentUserId, username]);

  // Confirm Swapanza participation
  const confirmSwapanza = useCallback(() => {
    console.log('Sending Swapanza confirmation');
    const sent = sendWsMessageRef?.current?.({ type: 'swapanza.confirm' });
    if (sent) {
      setUserConfirmedSwapanza(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cancel Swapanza request
  const cancelSwapanza = useCallback(async () => {
    try {
      // Try WebSocket first
      const sent = sendWsMessageRef?.current?.({ type: 'swapanza.cancel' });

      if (!sent) {
        // Fallback to HTTP API
        await axios.post(
          '/api/swapanza/cancel/',
          { chat_id: chatId },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      // Clear local state
      setIsSwapanzaRequested(false);
      setShowSwapanzaModal(false);
      setSwapanzaRequestedBy(null);
      setSwapanzaRequestedByUsername(null);
      setPendingSwapanzaInvite(false);

      return { success: true };
    } catch (err) {
      console.error('Error cancelling Swapanza:', err);
      return { success: false, message: 'Could not cancel Swapanza invitation' };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, token]);

  // Update remaining messages (called when receiving message during Swapanza)
  const updateRemainingMessages = useCallback((count) => {
    const remaining = parseInt(count);
    setRemainingMessages(isNaN(remaining) ? 0 : Math.max(0, remaining));
  }, []);

  // Fetch global Swapanza state
  const fetchGlobalSwapanzaState = useCallback(async () => {
    if (!token) return;

    try {
      const response = await axios.get('/api/active-swapanza/', {
        headers: { Authorization: `Bearer ${token}` },
        params: { chat_id: chatId },
      });

      if (response.data.active) {
        const startedAt = new Date(response.data.started_at);
        const endsAt = new Date(response.data.ends_at);

        setIsSwapanzaActive(true);
        setSwapanzaEndTime(endsAt);
        setSwapanzaStartTime(startedAt);

        if (response.data.remaining_messages !== undefined) {
          setRemainingMessages(response.data.remaining_messages);
        }

        setSwapanzaPartner({
          id: response.data.partner_id,
          username: response.data.partner_username,
          profile_image: response.data.partner_profile_image,
        });

        // Calculate remaining time from server timestamps (avoids clock drift)
        const totalDurationSeconds = Math.floor((endsAt - startedAt) / 1000);
        // Get server's current time from response header or estimate
        const serverNow = response.data.server_time
          ? new Date(response.data.server_time)
          : startedAt; // Fallback: assume started just now
        const elapsedSeconds = Math.floor((serverNow - startedAt) / 1000);
        const remainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds);

        setTimeLeft(remainingSeconds);

        if (!swapanzaTimeLeftRef.current) {
          setupSwapanzaTimer(remainingSeconds);
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

  // Poll for global Swapanza state
  useEffect(() => {
    fetchGlobalSwapanzaState();
    const intervalId = setInterval(fetchGlobalSwapanzaState, INTERVALS.SWAPANZA_STATE_CHECK_MS);
    return () => clearInterval(intervalId);
  }, [fetchGlobalSwapanzaState]);

  // Handle pending invite prop
  useEffect(() => {
    if (hasPendingSwapanzaInvite) {
      const fetchSwapanzaInvite = async () => {
        try {
          const response = await axios.get(`/api/chats/${chatId}/`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const chatData = response.data;

          if (chatData.swapanza_requested_by && chatData.swapanza_duration) {
            const isCurrentUserRequester = Number(chatData.swapanza_requested_by) === currentUserId;

            setIsSwapanzaRequested(true);
            setSwapanzaDuration(chatData.swapanza_duration);
            setSwapanzaRequestedBy(chatData.swapanza_requested_by);

            if (isCurrentUserRequester) {
              setSwapanzaRequestedByUsername(username || 'You');
            } else {
              const requester = chatData.participants.find(
                (p) => Number(p.id) === Number(chatData.swapanza_requested_by)
              );
              setSwapanzaRequestedByUsername(requester?.username || 'Unknown');
            }

            // Show modal only if user is recipient
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

  // Store active Swapanza in localStorage
  useEffect(() => {
    if (isSwapanzaActive && swapanzaEndTime) {
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

      const cleanupTimeout = setTimeout(() => {
        localStorage.removeItem('activeSwapanza');
      }, swapanzaEndTime - new Date());

      return () => clearTimeout(cleanupTimeout);
    } else if (!isSwapanzaActive) {
      localStorage.removeItem('activeSwapanza');
    }
  }, [isSwapanzaActive, swapanzaEndTime, swapanzaPartner, chatId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (swapanzaTimeLeftRef.current) {
        clearInterval(swapanzaTimeLeftRef.current);
      }
    };
  }, []);

  return {
    // Request state
    isSwapanzaRequested,
    swapanzaDuration,
    setSwapanzaDuration,
    swapanzaRequestedBy,
    swapanzaRequestedByUsername,

    // Active state
    isSwapanzaActive,
    swapanzaStartTime,
    swapanzaEndTime,
    swapanzaPartner,

    // Confirmation state
    userConfirmedSwapanza,
    partnerConfirmedSwapanza,

    // UI state
    showSwapanzaModal,
    setShowSwapanzaModal,
    showSwapanzaOptions,
    setShowSwapanzaOptions,
    pendingSwapanzaInvite,
    setPendingSwapanzaInvite,

    // Message tracking
    remainingMessages,
    timeLeft,

    // Actions
    requestSwapanza,
    confirmSwapanza,
    cancelSwapanza,
    resetSwapanza,
    updateRemainingMessages,

    // WebSocket handlers
    handleSwapanzaRequest,
    handleSwapanzaConfirm,
    handleSwapanzaActivate,
    handleSwapanzaExpire,
  };
}

export default useSwapanza;
