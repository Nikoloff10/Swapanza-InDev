import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  memo,
  useMemo,
} from "react";
import axios from "axios";
import SwapanzaModal from "./SwapanzaModal";

function ChatModal({ chatId, onClose, onMessagesRead, onNewMessage }) {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const ws = useRef(null);
  const messagesEndRef = useRef(null);
  const [currentUserId, setCurrentUserId] = useState(
    Number(localStorage.getItem("userId") || 0)
  );
  const wsRetryCount = useRef(0);
  const token = localStorage.getItem("token");

  const [swapanzaInvites, setSwapanzaInvites] = useState([]);
  const [swapanzaPartner, setSwapanzaPartner] = useState(null);

  // Swapanza states:

  const [swapanzaDuration, setSwapanzaDuration] = useState(5);
  const [showSwapanzaOptions, setShowSwapanzaOptions] = useState(false);
  const [isSwapanzaRequested, setIsSwapanzaRequested] = useState(false);
  const [swapanzaStartTime, setSwapanzaStartTime] = useState(null);
  const [swapanzaRequestedBy, setSwapanzaRequestedBy] = useState(null);
  const [swapanzaRequestedByUsername, setSwapanzaRequestedByUsername] =
    useState(null);
  const [isSwapanzaActive, setIsSwapanzaActive] = useState(false);
  const [swapanzaEndTime, setSwapanzaEndTime] = useState(null);
  const [userConfirmedSwapanza, setUserConfirmedSwapanza] = useState(false);
  const [showSwapanzaModal, setShowSwapanzaModal] = useState(false);
  const [remainingMessages, setRemainingMessages] = useState(2);
  const [timeLeft, setTimeLeft] = useState(null);

  const swapanzaTimeLeftRef = useRef(null);
  const pendingMessages = useRef([]);
  const [partnerConfirmedSwapanza, setPartnerConfirmedSwapanza] =
    useState(false);
  // Create refs to store function references and avoid circular dependencies
  const setupWebSocketRef = useRef(null);
  const refreshAuthTokenRef = useRef(null);
  const resetSwapanzaRef = useRef(null);
  const startSwapanzaCountdownRef = useRef(null);
  const fetchChatRef = useRef(null);
  const onNewMessageRef = useRef(onNewMessage);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  // Function to reset Swapanza state
  const resetSwapanza = useCallback(() => {
    setIsSwapanzaActive(false);
    setShowSwapanzaModal(false);
    setIsSwapanzaRequested(false);
    setSwapanzaRequestedBy(null);
    setSwapanzaRequestedByUsername(null);
    setUserConfirmedSwapanza(false);
    setPartnerConfirmedSwapanza(false);
    setRemainingMessages(2);
    setSwapanzaEndTime(null);

    if (swapanzaTimeLeftRef.current) {
      clearInterval(swapanzaTimeLeftRef.current);
    }
  }, []);

  // Store in ref
  resetSwapanzaRef.current = resetSwapanza;

  const fetchGlobalSwapanzaState = useCallback(async () => {
    if (!token) return;
  
    try {
      const response = await axios.get("/api/active-swapanza/", {
        headers: { Authorization: `Bearer ${token}` },
        params: { chat_id: chatId } // Add this parameter to specify current chat
      });
  
      if (response.data.active) {
        // Apply Swapanza state regardless of current chat
        setIsSwapanzaActive(true);
        setSwapanzaEndTime(new Date(response.data.ends_at));
        setSwapanzaStartTime(new Date(response.data.started_at));
        
        // Use chat-specific remaining messages count from the API
        setRemainingMessages(response.data.remaining_messages);
  
        setSwapanzaPartner({
          id: response.data.partner_id,
          username: response.data.partner_username,
          profile_image: response.data.partner_profile_image,
        });
  
        // Update the time left
        const now = new Date();
        const endsAt = new Date(response.data.ends_at);
        const diff = Math.max(0, Math.floor((endsAt - now) / 1000));
        setTimeLeft(diff);

        // Start the countdown timer
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
        swapanzaTimeLeftRef.current = setInterval(updateTimeLeft, 1000);
      } else if (!chat?.swapanza_active) {
        // Only reset if we're not in a chat-specific Swapanza
        resetSwapanza();
      }
    } catch (error) {
      console.error("Error checking global Swapanza state:", error);
    }
  }, [token, chatId, chat, resetSwapanza]);

  // Add effect for periodic checking
  useEffect(() => {
    fetchGlobalSwapanzaState();

    // Check every 30 seconds
    const intervalId = setInterval(fetchGlobalSwapanzaState, 30000);

    return () => clearInterval(intervalId);
  }, [fetchGlobalSwapanzaState]);

  useEffect(() => {
    try {
      const storedInvites = JSON.parse(
        localStorage.getItem("swapanzaInvites") || "[]"
      );

      // Filter out invitations older than 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const validInvites = storedInvites.filter((invite) => {
        // Check if timestamp exists and is valid
        if (invite.timestamp) {
          const inviteTime = new Date(invite.timestamp);
          return inviteTime > thirtyMinutesAgo;
        }
        return false; // Remove invites without valid timestamps
      });

      // Update localStorage with cleaned invites
      if (validInvites.length !== storedInvites.length) {
        localStorage.setItem("swapanzaInvites", JSON.stringify(validInvites));
      }

      if (validInvites.length > 0) {
        setSwapanzaInvites(validInvites);
      }
    } catch (e) {
      console.error("Error managing Swapanza invitations:", e);
      // Reset to empty array if there's an error
      localStorage.setItem("swapanzaInvites", JSON.stringify([]));
      setSwapanzaInvites([]);
    }
  }, []);

  useEffect(() => {
    if (isSwapanzaActive && swapanzaEndTime) {
      // Store global active Swapanza state
      localStorage.setItem(
        "activeSwapanza",
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
        localStorage.removeItem("activeSwapanza");
      }, swapanzaEndTime - new Date());

      return () => clearTimeout(cleanupTimeout);
    } else if (!isSwapanzaActive) {
      // Clean up when Swapanza ends manually
      localStorage.removeItem("activeSwapanza");
    }
  }, [isSwapanzaActive, swapanzaEndTime, swapanzaPartner, chatId]);

  const otherParticipant = useMemo(() => {
    if (!chat || !chat.participants || !currentUserId) return null;
    return (
      chat.participants.find((p) => Number(p.id) !== Number(currentUserId)) ||
      null
    );
  }, [chat, currentUserId]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Define the refreshAuthToken function
  const refreshAuthToken = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");

      if (!refreshToken) {
        console.error("No refresh token available");
        return;
      }

      const response = await axios.post("/api/token/refresh/", {
        refresh: refreshToken,
      });

      if (response.data && response.data.access) {
        localStorage.setItem("token", response.data.access);

        if (setupWebSocketRef.current) {
          setupWebSocketRef.current();
        }
      }
    } catch (error) {
      console.error("Error refreshing token:", error);
      window.location.href = "/login";
    }
  }, []);

  // Store in ref
  refreshAuthTokenRef.current = refreshAuthToken;

  // Function to start Swapanza countdown
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

  // Store in ref
  startSwapanzaCountdownRef.current = startSwapanzaCountdown;

  // Function to handle chat messages
  const handleChatMessage = useCallback(
    (message) => {
      if (message && message.id && message.content) {
        console.log("Processing received message:", message);

        setMessages((prevMessages) => {
          let updatedMessages = [...prevMessages];

          // First check if this message already exists by ID
          const existingMessageIndex = updatedMessages.findIndex(
            (m) => m.id === message.id
          );

          if (existingMessageIndex !== -1) {
            // Message already exists, update it
            updatedMessages[existingMessageIndex] = message;
            return updatedMessages;
          }

          // Check if this is a confirmation of a pending message
          // Look for a pending message with matching content
          console.log(
            "Looking for pending message with content:",
            message.content
          );

          const pendingIndex = updatedMessages.findIndex(
            (m) => m.pending === true && m.content === message.content
          );

          console.log("Pending message index:", pendingIndex);

          if (pendingIndex !== -1) {
            // Replace the pending message with the confirmed one
            console.log("Replacing pending message");
            updatedMessages[pendingIndex] = {
              ...message,
              pending: false,
            };

            // Remove from pendingMessages ref
            const pendingMsgIndex = pendingMessages.current.findIndex(
              (pm) => pm.content === message.content
            );

            if (pendingMsgIndex !== -1) {
              pendingMessages.current.splice(pendingMsgIndex, 1);
            }

            return updatedMessages;
          }

          // If no pending message was found, add as a new message
          return [...updatedMessages, message];
        });

        // Update remaining messages count if provided by server
        if (
          message.remaining_messages !== undefined &&
          Number(message.sender) === Number(currentUserId)
        ) {
          // Always use the server-provided remaining count
          setRemainingMessages(message.remaining_messages);
          console.log(
            "Updated remaining messages to:",
            message.remaining_messages
          );
        }

        if (Number(message.sender) !== Number(currentUserId)) {
          console.log("Calling onNewMessage callback");
          onNewMessageRef.current();
        }
      } else {
        console.error("Invalid message format:", message);
      }
    },
    [currentUserId]
  );

  const handleTokenExpiry = useCallback(async () => {
    try {
      console.log("Attempting to refresh token...");
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        console.error("No refresh token available");
        localStorage.clear(); // Clear all tokens
        window.location.href = "/login";
        return false;
      }

      // Try to refresh the token
      const response = await axios.post("/api/token/refresh/", {
        refresh: refreshToken,
      });

      if (response.data && response.data.access) {
        // Update token in localStorage
        localStorage.setItem("token", response.data.access);
        console.log("Token refreshed successfully");

        // If you get a new refresh token too, store it
        if (response.data.refresh) {
          localStorage.setItem("refreshToken", response.data.refresh);
        }

        // Reconnect WebSocket with new token
        if (setupWebSocketRef.current) {
          setupWebSocketRef.current();
        }

        // Refetch chat data
        if (fetchChatRef.current) {
          fetchChatRef.current();
        }

        return true;
      }
      console.error("Token refresh failed - no access token in response");
      localStorage.clear();
      window.location.href = "/login";
      return false;
    } catch (error) {
      console.error("Error refreshing token:", error);
      // Clear all tokens if refresh fails
      localStorage.clear();
      // Show a user-friendly message
      alert("Your session has expired. Please log in again.");
      window.location.href = "/login";
      return false;
    }
  }, []);

  // Function to handle messages read
  const handleMessagesRead = useCallback(
    (data) => {
      console.log("Messages marked as read by user:", data.user_id);
      if (onMessagesRead) {
        console.log("Calling onMessagesRead callback");
        onMessagesRead();
      }
    },
    [onMessagesRead]
  );

  // Function to handle Swapanza request
  const handleSwapanzaRequest = useCallback(
    (data) => {
      const isYou = Number(data.requested_by) === Number(currentUserId);

      setIsSwapanzaRequested(true);
      setSwapanzaDuration(data.duration);
      setSwapanzaRequestedBy(isYou ? "you" : data.requested_by);
      setSwapanzaRequestedByUsername(data.requested_by_username);

      if (!isYou) {
        // Add to swapanza invites if you're the recipient
        const newInvite = {
          id: Date.now(), // temporary ID
          from: data.requested_by_username,
          duration: data.duration,
          timestamp: new Date(),
          chat_id: chatId, // Add the chat ID to the invite
          requested_by: data.requested_by,
        };

        // Use a global state or localStorage to store invitations across components
        const existingInvites = JSON.parse(
          localStorage.getItem("swapanzaInvites") || "[]"
        );
        const updatedInvites = [...existingInvites, newInvite];
        localStorage.setItem("swapanzaInvites", JSON.stringify(updatedInvites));

        setSwapanzaInvites((prev) => [...prev, newInvite]);

        // Show the Swapanza modal automatically when receiving an invitation
        setShowSwapanzaModal(true);

        // If browser notifications are supported and permitted
        if ("Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification("Swapanza Invitation", {
              body: `${data.requested_by_username} has invited you to swap profiles for ${data.duration} minutes!`,
              icon: "/logo.png", // Add your logo
            });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((permission) => {
              if (permission === "granted") {
                new Notification("Swapanza Invitation", {
                  body: `${data.requested_by_username} has invited you to swap profiles for ${data.duration} minutes!`,
                  icon: "/logo.png",
                });
              }
            });
          }
        }
      }
    },
    [currentUserId, chatId]
  );

  // Function to handle Swapanza confirmation
  const handleSwapanzaConfirm = useCallback(
    (data) => {
      console.log("Processing Swapanza confirmation:", data);

      const isCurrentUser = Number(data.user_id) === Number(currentUserId);

      // Update confirmation status
      if (isCurrentUser) {
        setUserConfirmedSwapanza(true);
        // Close the modal when the current user confirms
        setShowSwapanzaModal(false);
      } else {
        setPartnerConfirmedSwapanza(true);
      }

      // If server says all users are confirmed, we can prepare for activation
      if (data.all_confirmed) {
        console.log(
          "Server indicates all users confirmed, awaiting activation message"
        );

        // Both are confirmed - reflects server state
        setUserConfirmedSwapanza(true);
        setPartnerConfirmedSwapanza(true);
        // Ensure modal is closed when all are confirmed
        setShowSwapanzaModal(false);
      }
    },
    [currentUserId]
  );

  // Update the activate_swapanza handler to handle partner info
  const handleSwapanzaActivate = useCallback(
    (data) => {
      console.log("Swapanza activated:", data);

      // Close modal when Swapanza activates
      setShowSwapanzaModal(false);

      const startedAt = new Date(data.started_at);
      const endsAt = new Date(data.ends_at);

      setSwapanzaStartTime(startedAt);
      setSwapanzaEndTime(endsAt);
      setIsSwapanzaActive(true);
      setRemainingMessages(2);

      // Clear confirmation state
      setUserConfirmedSwapanza(false);
      setPartnerConfirmedSwapanza(false);

      // If we have partner info, use it
      if (data.partner_id && data.partner_username) {
        setSwapanzaPartner({
          id: data.partner_id,
          username: data.partner_username,
        });
      } else {
        // Find partner from chat participants
        const partner = chat?.participants?.find((p) => p.id !== currentUserId);
        if (partner) {
          setSwapanzaPartner(partner);
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
        }
      };

      updateTimeLeft();
      swapanzaTimeLeftRef.current = setInterval(updateTimeLeft, 1000);

      // Store minimal state in localStorage
      localStorage.setItem(
        `swapanza_active_${chatId}`,
        JSON.stringify({
          active: true,
          endsAt: endsAt.toISOString(),
        })
      );
    },
    [chat, chatId, currentUserId]
  );

  // Function to handle Swapanza expiration
  const handleSwapanzaExpire = useCallback(() => {
    if (resetSwapanzaRef.current) {
      resetSwapanzaRef.current();
    }
  }, []);

  const handleSwapanzaLogout = useCallback(() => {
    console.log("Received Swapanza logout notification");
    // Clear all local storage and redirect to login
    localStorage.clear();
    alert(
      "Your Swapanza session has expired. You will be redirected to login."
    );
    window.location.href = "/login";
  }, []);

  // Function to handle server errors
  const handleServerError = useCallback((data) => {
    console.error("Error from server:", data.message);
    alert(`Error: ${data.message}`);
  }, []);

  // Set up WebSocket connection to chat
  // Set up WebSocket connection to chat
  useEffect(() => {
    if (!chatId || !token) return;

    // Define the WebSocket setup function
    const setupWebSocket = () => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.close();
      }

      try {
        setConnectionStatus("connecting");
        const host = window.location.hostname;
        const wsUrl = `ws://${host}:8000/ws/chat/${chatId}/?token=${token}`;
        console.log(`Setting up WebSocket connection to: ${wsUrl}`);

        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          console.log("WebSocket connected");
          setConnectionStatus("connected");
          wsRetryCount.current = 0;
          if (onMessagesRead) onMessagesRead();
        };

        ws.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("WebSocket message received:", data);

            switch (data.type) {
              case "chat.message":
                handleChatMessage(data.message || data);
                break;
              case "chat.messages_read":
                handleMessagesRead(data);
                break;

              case "chat.message.error":
                // Handle message validation error
                alert(data.message || "Failed to send message");

                // Remove the pending message from the UI
                setMessages((prevMessages) =>
                  prevMessages.filter(
                    (msg) => !(msg.pending && msg.content === data.content)
                  )
                );

                // Remove from pendingMessages ref
                pendingMessages.current = pendingMessages.current.filter(
                  (msg) => msg.content !== data.content
                );
                break;
              case "swapanza.request":
                handleSwapanzaRequest(data);
                break;
              case "swapanza.confirm":
                handleSwapanzaConfirm(data);
                break;
              case "swapanza.activate":
                console.log("Received swapanza activation message:", data);
                // Clear invitations
                const invites = JSON.parse(
                  localStorage.getItem("swapanzaInvites") || "[]"
                );
                const filteredInvites = invites.filter(
                  (invite) => Number(invite.chat_id) !== Number(chatId)
                );
                localStorage.setItem(
                  "swapanzaInvites",
                  JSON.stringify(filteredInvites)
                );
                setSwapanzaInvites(filteredInvites);

                handleSwapanzaActivate(data);
                break;
              case "swapanza.expire":
                handleSwapanzaExpire();
                break;
              case "swapanza.logout":
                handleSwapanzaLogout();
                break;
              case "error":
                handleServerError(data);
                break;
              default:
                console.warn("Unknown message type:", data.type);
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        ws.current.onclose = (e) => {
          console.log("WebSocket closed:", e);
          setConnectionStatus("disconnected");

          if (e.code !== 1000) {
            const timeout = Math.min(1000 * 2 ** wsRetryCount.current, 30000);
            wsRetryCount.current += 1;

            console.log(`Reconnecting in ${timeout / 1000} seconds...`);
            setTimeout(() => {
              if (document.visibilityState === "visible") {
                if (setupWebSocketRef.current) {
                  setupWebSocketRef.current();
                }
              }
            }, timeout);
          }
        };

        ws.current.onerror = (e) => {
          console.error("WebSocket error:", e);
          setConnectionStatus("error");
          console.log("WebSocket error details:", {
            readyState: ws.current?.readyState,
            chatId,
            userId: currentUserId,
          });
        };
      } catch (error) {
        console.error("WebSocket setup error:", error);
        setConnectionStatus("error");
      }
    };

    // Store the setup function in the ref
    setupWebSocketRef.current = setupWebSocket;

    // Call the setup function
    setupWebSocket();

    // Cleanup function when component unmounts
    return () => {
      if (ws.current) {
        ws.current.close(1000, "Component unmounted");
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
        axios.get("/api/active-swapanza/", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setChat(chatResponse.data);
      setMessages(chatResponse.data.messages || []);

      // Initialize Swapanza request state if there's a pending request
      if (
        chatResponse.data.swapanza_requested_by &&
        !chatResponse.data.swapanza_active
      ) {
        const isCurrentUserRequester =
          Number(chatResponse.data.swapanza_requested_by) ===
          Number(currentUserId);

        setIsSwapanzaRequested(true);
        setSwapanzaDuration(chatResponse.data.swapanza_duration || 5);
        setSwapanzaRequestedBy(
          isCurrentUserRequester
            ? "you"
            : chatResponse.data.swapanza_requested_by
        );

        // Get requester's username if it's not the current user
        if (!isCurrentUserRequester) {
          const requester = chatResponse.data.participants.find(
            (p) =>
              Number(p.id) === Number(chatResponse.data.swapanza_requested_by)
          );
          setSwapanzaRequestedByUsername(requester?.username || "Unknown");
        }

        // Check if current user has already confirmed
        const confirmedUsers = chatResponse.data.swapanza_confirmed_users || [];
        setUserConfirmedSwapanza(
          confirmedUsers.includes(currentUserId.toString())
        );

        // Check if partner has confirmed
        const partner = chat?.participants?.find(
          (p) => Number(p.id) !== Number(currentUserId)
        );
        if (partner) {
          setPartnerConfirmedSwapanza(
            confirmedUsers.includes(partner.id.toString())
          );
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

        // Correctly initialize the remaining messages (2 - count used)
        const remainingMsgs = 2 - swapanzaResponse.data.message_count;
        setRemainingMessages(remainingMsgs);
        console.log("Setting remaining messages to:", remainingMsgs);

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

        // Get message count for current user
        const userId = localStorage.getItem("userId");
        const messageCount =
          chatResponse.data.swapanza_message_count?.[userId] || 0;
        setRemainingMessages(2 - messageCount);

        // Find the other participant to set as swapanzaPartner
        const otherUser = chatResponse.data.participants.find(
          (p) => Number(p.id) !== Number(userId)
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
      console.error("Error fetching chat:", error);
      setError(error.message || "Failed to fetch chat");
      setLoading(false);
    }
  }, [chatId, token, currentUserId, chat?.participants]);

  // Store in ref
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
        ws.current.close(1000, "Component unmounted");
      }

      if (swapanzaTimeLeftRef.current) {
        clearInterval(swapanzaTimeLeftRef.current);
      }
    };
  }, [chatId]);

  useEffect(() => {
    if (chat && chat.participants) {
      const currentUsername = localStorage.getItem("username");

      if (currentUsername) {
        const currentUser = chat.participants.find(
          (p) => p.username === currentUsername
        );

        if (currentUser) {
          console.log("Found current user in participants:", currentUser);
          setCurrentUserId(Number(currentUser.id));
        } else {
          console.warn("Current username not found in chat participants");
        }
      } else {
        console.warn("No username found in localStorage");
      }
    }
  }, [chat]);

  useEffect(() => {
    if (fetchChatRef.current) {
      fetchChatRef.current();
    }

    if (setupWebSocketRef.current) {
      setupWebSocketRef.current();
    }

    return () => {
      if (ws.current) {
        ws.current.close(1000, "Component unmounted");
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

  // Add this function to your ChatModal component

  // Update axios error handling globally
  useEffect(() => {
    // Add a response interceptor to handle 401 errors
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response && error.response.status === 401) {
          console.log("401 error detected, attempting token refresh...");

          // Check if we already tried refreshing
          if (error.config && error.config._retry) {
            console.log(
              "Already tried refreshing token once, redirecting to login"
            );
            localStorage.clear();
            window.location.href = "/login";
            return Promise.reject(error);
          }

          // Try to refresh token
          try {
            const refreshed = await handleTokenExpiry();
            if (refreshed && error.config) {
              // Mark this request as retried
              error.config._retry = true;
              // Retry the original request with new token
              error.config.headers.Authorization = `Bearer ${localStorage.getItem(
                "token"
              )}`;
              return axios(error.config);
            } else {
              // If refresh failed, redirect to login
              localStorage.clear();
              window.location.href = "/login";
              return Promise.reject(error);
            }
          } catch (refreshError) {
            console.error("Error during token refresh:", refreshError);
            localStorage.clear();
            window.location.href = "/login";
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
      alert("A Swapanza request is already pending");
      setShowSwapanzaOptions(false);
      return;
    }

    try {
      // Check if user can start Swapanza first
      const checkResponse = await axios.get("/api/can-start-swapanza/", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (checkResponse.data.error) {
        alert(checkResponse.data.error);
        setShowSwapanzaOptions(false);
        return;
      }

      if (!checkResponse.data.can_start) {
        alert(
          checkResponse.data.reason ||
            "You cannot start a Swapanza at this time"
        );
        setShowSwapanzaOptions(false);
        return;
      }

      // If allowed, proceed with Swapanza request
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({
            type: "swapanza.request",
            duration: swapanzaDuration,
          })
        );

        setShowSwapanzaOptions(false);
        setIsSwapanzaRequested(true);
        setSwapanzaRequestedBy("you");
      }
    } catch (error) {
      console.error("Error checking if user can start Swapanza:", error);
      let errorMessage = "Could not verify if you can start a Swapanza.";
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      alert(errorMessage + " Please try again.");
      setShowSwapanzaOptions(false);
    }
  };

  // Function to confirm participation in a Swapanza
  const confirmSwapanza = () => {
    console.log("Sending Swapanza confirmation");
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: "swapanza.confirm",
        })
      );

      // Let the server update our state
      setUserConfirmedSwapanza(true); // Only update local UI
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || connectionStatus !== "connected") return;

    const messageContent = newMessage.trim();

    // Let the server handle all validation
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: "chat.message",
          content: messageContent,
        })
      );

      // Add a pending message to the UI for immediate feedback
      const pendingMsg = {
        id: `pending-${Date.now()}`,
        content: messageContent,
        sender: currentUserId,
        created_at: new Date().toISOString(),
        pending: true,
        during_swapanza: isSwapanzaActive, // Use current state for UI only
      };

      setMessages((prevMessages) => [...prevMessages, pendingMsg]);
      pendingMessages.current.push(pendingMsg);

      setNewMessage("");
    } else {
      console.error("WebSocket is not connected");
      setConnectionStatus("error");
    }
  };

  // Render a message component with memoization
  // Update the MemoizedMessage component to use swapanzaPartner
  const MemoizedMessage = memo(({ msg, isCurrentUser, chat }) => {
    // Always use the message's during_swapanza property directly
    const isDuringSwapanza = msg.during_swapanza;
    const isPending = msg.pending === true;

    let messageStyle = isCurrentUser
      ? `${
          isDuringSwapanza ? "bg-purple-500" : "bg-blue-500"
        } text-white rounded-l-lg rounded-tr-lg px-4 py-2 max-w-xs break-words`
      : `${
          isDuringSwapanza ? "bg-purple-200" : "bg-gray-200"
        } text-gray-900 rounded-r-lg rounded-tl-lg px-4 py-2 max-w-xs break-words`;

    if (isPending) {
      messageStyle += " opacity-70";
    }

    // Determine which user to show based on message attributes
    let displayUsername, profileImage;

    if (isDuringSwapanza) {
      if (msg.apparent_sender) {
        // Use the apparent_sender from the message itself
        const apparentSender = chat.participants.find(
          (p) => Number(p.id) === Number(msg.apparent_sender)
        );
        displayUsername = apparentSender?.username || "Unknown";
        profileImage = apparentSender?.profile_image_url || null;
      } else {
        // Fall back to swapanzaPartner for backwards compatibility
        displayUsername = isCurrentUser
          ? swapanzaPartner?.username
          : otherParticipant?.username;
        profileImage = isCurrentUser ? null : swapanzaPartner?.profile_image;
      }
    } else {
      // For normal messages, show the actual sender
      const sender = chat.participants.find(
        (p) => Number(p.id) === Number(msg.sender)
      );
      displayUsername = sender?.username || "Unknown";
      profileImage = sender?.profile_image_url || null;
    }

    return (
      <div className="flex items-end">
        {!isCurrentUser && (
          <div className="h-6 w-6 rounded-full bg-gray-300 mr-2 flex-shrink-0 overflow-hidden">
            {profileImage ? (
              <img
                src={profileImage}
                alt={displayUsername}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <span className="text-xs">
                  {displayUsername[0]?.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        )}

        <div className={messageStyle}>
          <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
          <div className="text-xs mt-1 opacity-75 flex justify-between">
            <span>{isCurrentUser ? "You" : displayUsername}</span>
            <span>
              {isPending && (
                <span className="ml-2 text-xs italic">Sending...</span>
              )}
              {isDuringSwapanza && (
                <span className="ml-2 text-xs font-bold">Swapanza</span>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  });
  // Render Swapanza section based on state
  const renderSwapanzaSection = () => {
    if (isSwapanzaActive && swapanzaEndTime) {
      return (
        <div className="border-t p-2 bg-purple-100">
          <div className="text-center text-sm font-semibold text-purple-800">
            <div>
              <span className="font-bold">Swapanza Active!</span>
              {timeLeft !== null && (
                <span className="ml-2">
                  Time Left: {Math.floor(timeLeft / 60)}:
                  {(timeLeft % 60).toString().padStart(2, "0")}
                </span>
              )}
            </div>
            {swapanzaStartTime && (
              <div className="text-xs">
                Started: {new Date(swapanzaStartTime).toLocaleTimeString()}
              </div>
            )}
            <div className="text-xs mt-1">
              You appear as: {swapanzaPartner?.username}
              <span className="mx-2">•</span>
              Messages left: {remainingMessages}
            </div>
          </div>
        </div>
      );
    } else if (swapanzaRequestedByUsername) {
      // Swapanza request pending
      const isCurrentUserRequester =
        Number(swapanzaRequestedBy) === Number(currentUserId);

      return (
        <div className="border-t p-2 bg-yellow-100">
          <div className="text-center text-sm">
            {isCurrentUserRequester ? (
              <span>You requested a Swapanza</span>
            ) : (
              <span>
                <b>{swapanzaRequestedByUsername}</b> invited you to Swapanza
              </span>
            )}

            {!userConfirmedSwapanza && (
              <button
                onClick={confirmSwapanza}
                className="ml-2 px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
              >
                Confirm
              </button>
            )}

            {userConfirmedSwapanza && partnerConfirmedSwapanza ? (
              <span className="block text-xs text-green-600">
                Both confirmed! Starting Swapanza...
              </span>
            ) : userConfirmedSwapanza ? (
              <span className="block text-xs">
                Waiting for partner confirmation...
              </span>
            ) : null}
          </div>
        </div>
      );
    }

    return null;
  };

  const bothUsersConfirmed = userConfirmedSwapanza;

  if (loading)
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        Loading...
      </div>
    );
  if (error)
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        Error: {error}
      </div>
    );
  if (!chat)
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        Chat not found
      </div>
    );

  const allMessages = [...messages];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center">
            {otherParticipant && (
              <div className="h-8 w-8 rounded-full bg-gray-300 mr-2 overflow-hidden">
                {otherParticipant.profile_image_url ? (
                  <img
                    src={otherParticipant.profile_image_url}
                    alt={otherParticipant.username}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <span className="text-sm">
                      {otherParticipant.username[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-col">
              <h2 className="text-xl font-semibold">
                {isSwapanzaActive && swapanzaPartner
                  ? swapanzaPartner.username
                  : otherParticipant
                  ? otherParticipant.username
                  : "Chat"}
              </h2>
              {swapanzaInvites.length > 0 && (
                <div className="flex items-center">
                  <span className="animate-pulse inline-block h-3 w-3 rounded-full bg-purple-600 mr-2"></span>
                  <span className="text-sm text-purple-600 font-medium">
                    {swapanzaInvites.length} Swapanza invitation
                    {swapanzaInvites.length !== 1 ? "s" : ""} pending
                  </span>
                  <button
                    onClick={() => setShowSwapanzaModal(true)}
                    className="ml-2 text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full hover:bg-purple-700"
                  >
                    View
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center">
            {!isSwapanzaActive && (
              <button
                onClick={() => setShowSwapanzaOptions(true)}
                className="mr-3 px-3 py-1 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
                title="Start Swapanza"
              >
                Swapanza
              </button>
            )}
            <span className="mr-2 text-sm">
              {connectionStatus === "connected" ? (
                <span className="text-green-500">●</span>
              ) : connectionStatus === "connecting" ? (
                <span className="text-yellow-500">●</span>
              ) : (
                <span className="text-red-500">●</span>
              )}
            </span>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>
        </div>
        <div
          className="flex-1 overflow-y-auto p-4"
          style={{ maxHeight: "60vh" }}
        >
          {allMessages.length === 0 ? (
            <div className="text-center text-gray-500 my-4">
              No messages yet
            </div>
          ) : (
            allMessages.map((msg) => {
              const isCurrentUser =
                Number(msg.sender) === Number(currentUserId);
              return (
                <div
                  key={msg.id}
                  className={
                    isCurrentUser
                      ? "flex justify-end mb-2"
                      : "flex justify-start mb-2"
                  }
                >
                  <MemoizedMessage
                    msg={msg}
                    isCurrentUser={isCurrentUser}
                    chat={chat}
                  />
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {renderSwapanzaSection()}

        {bothUsersConfirmed && (
          <div className="p-2 bg-green-100 text-center text-green-800 text-sm">
            Both users have confirmed! Starting Swapanza...
          </div>
        )}

        <div className="border-t p-2 flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder={
              isSwapanzaActive
                ? "Max 7 chars, no spaces (2 msgs)"
                : "Type a message..."
            }
            className="flex-1 border rounded-l p-2"
          />
          <button
            onClick={sendMessage}
            disabled={
              !newMessage.trim() ||
              connectionStatus !== "connected" ||
              (isSwapanzaActive && remainingMessages <= 0)
            }
            className={`px-4 py-2 rounded-r ${
              !newMessage.trim() ||
              connectionStatus !== "connected" ||
              (isSwapanzaActive && remainingMessages <= 0)
                ? "bg-gray-300 text-gray-500"
                : isSwapanzaActive
                ? "bg-purple-500 text-white"
                : "bg-blue-500 text-white"
            }`}
          >
            Send
          </button>
        </div>
      </div>

      {showSwapanzaModal && (
        <SwapanzaModal
          isOpen={showSwapanzaModal}
          onClose={() => setShowSwapanzaModal(false)}
          onConfirm={confirmSwapanza}
          requestedBy={swapanzaRequestedBy === "you" ? "you" : "other"}
          requestedByUsername={swapanzaRequestedByUsername}
          duration={swapanzaDuration}
          userConfirmed={userConfirmedSwapanza}
        />
      )}
      {showSwapanzaOptions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80">
            <h3 className="text-lg font-semibold mb-4">Start Swapanza</h3>
            <p className="mb-4 text-sm">
              Swap identities with your chat partner for the specified duration.
              During Swapanza, each user can send up to 2 messages of max 7
              characters with no spaces.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Duration (minutes)
              </label>
              <select
                value={swapanzaDuration}
                onChange={(e) => setSwapanzaDuration(Number(e.target.value))}
                className="w-full p-2 border rounded"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowSwapanzaOptions(false)}
                className="px-4 py-2 border rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={requestSwapanza}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatModal;
