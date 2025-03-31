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

  // Swapanza states:
  const [swapanzaDuration, setSwapanzaDuration] = useState(5);
  const [showSwapanzaOptions, setShowSwapanzaOptions] = useState(false);
  const [isSwapanzaRequested, setIsSwapanzaRequested] = useState(false);
  const [swapanzaRequestedBy, setSwapanzaRequestedBy] = useState(null);
  const [swapanzaRequestedByUsername, setSwapanzaRequestedByUsername] =
    useState(null);
  const [isSwapanzaActive, setIsSwapanzaActive] = useState(false);
  const [swapanzaEndTime, setSwapanzaEndTime] = useState(null);
  const [userConfirmedSwapanza, setUserConfirmedSwapanza] = useState(false);
  const [showSwapanzaModal, setShowSwapanzaModal] = useState(false);
  const [remainingMessages, setRemainingMessages] = useState(2);

  const swapanzaTimeLeftRef = useRef(null);
  const pendingMessages = useRef([]);

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

  const otherParticipant = useMemo(() => {
    if (!chat || !chat.participants || !currentUserId) return null;
    return (
      chat.participants.find(
        (p) => Number(p.id) !== Number(currentUserId)
      ) || null
    );
  }, [chat, currentUserId]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Function to reset Swapanza state
  const resetSwapanza = useCallback(() => {
    setIsSwapanzaActive(false);
    setShowSwapanzaModal(false);
    setIsSwapanzaRequested(false);
    setSwapanzaRequestedBy(null);
    setSwapanzaRequestedByUsername(null);
    setUserConfirmedSwapanza(false);
    setRemainingMessages(2);
    setSwapanzaEndTime(null);

    if (swapanzaTimeLeftRef.current) {
      clearInterval(swapanzaTimeLeftRef.current);
    }
  }, []);

  // Store in ref
  resetSwapanzaRef.current = resetSwapanza;

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
      if (message && message.id && message.content && message.sender) {
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
          // Look for a pending message with matching content and sender
          const pendingIndex = updatedMessages.findIndex(
            (m) => m.pending === true && 
                  m.content === message.content && 
                  Number(m.sender) === Number(message.sender)
          );
  
          console.log("Pending message index:", pendingIndex);
  
          if (pendingIndex !== -1) {
            // Replace the pending message with the confirmed one
            updatedMessages[pendingIndex] = {
              ...message,
              pending: false,
            };
            
            // Also remove from pendingMessages ref
            const pendingMsgIndex = pendingMessages.current.findIndex(
              (pm) => pm.content === message.content && 
                    Number(pm.sender) === Number(message.sender)
            );
            
            if (pendingMsgIndex !== -1) {
              pendingMessages.current.splice(pendingMsgIndex, 1);
            }
            
            return updatedMessages;
          }
  
          // If no pending message was found, add as a new message
          return [...updatedMessages, message];
        });
  
        if (
          isSwapanzaActive &&
          message.during_swapanza &&
          Number(message.sender) === Number(currentUserId)
        ) {
          setRemainingMessages((prev) => Math.max(0, prev - 1));
        }
  
        if (Number(message.sender) !== Number(currentUserId)) {
          console.log("Calling onNewMessage callback");
          onNewMessageRef.current();
        }
      } else {
        console.error("Invalid message format:", message);
      }
    },
    [currentUserId, isSwapanzaActive]
  );

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
      const isCurrentUserRequest =
        Number(data.requested_by) === Number(currentUserId);

      setIsSwapanzaRequested(true);
      setSwapanzaDuration(data.duration);
      setSwapanzaRequestedBy(data.requested_by);
      setSwapanzaRequestedByUsername(data.requested_by_username);

      setShowSwapanzaModal(true);

      if (isCurrentUserRequest) {
        if (ws.current?.readyState === WebSocket.OPEN) {
          ws.current.send(
            JSON.stringify({
              type: "swapanza.confirm",
            })
          );

          setUserConfirmedSwapanza(true);
        }
      }
    },
    [currentUserId]
  );

  // Function to handle Swapanza confirmation
  const handleSwapanzaConfirm = useCallback(
    (data) => {
      const isCurrentUser = Number(data.user_id) === Number(currentUserId);

      if (isCurrentUser) {
        setUserConfirmedSwapanza(true);
      }

      console.log("Swapanza confirmation status:", {
        userConfirmed: isCurrentUser ? true : userConfirmedSwapanza,
        userId: currentUserId,
        confirmingUserId: data.user_id,
      });
    },
    [currentUserId, userConfirmedSwapanza]
  );

  // Function to handle Swapanza activation
  const handleSwapanzaActivate = useCallback(
    (data) => {
      setIsSwapanzaActive(true);
      setShowSwapanzaModal(false);
      setIsSwapanzaRequested(false);
      setUserConfirmedSwapanza(false);
      setRemainingMessages(2);

      const endTime = new Date(data.ends_at);
      setSwapanzaEndTime(endTime);

      if (startSwapanzaCountdownRef.current) {
        startSwapanzaCountdownRef.current(endTime);
      }
    },
    []
  );

  // Function to handle Swapanza expiration
  const handleSwapanzaExpire = useCallback(() => {
    if (resetSwapanzaRef.current) {
      resetSwapanzaRef.current();
    }
  }, []);

  // Function to handle server errors
  const handleServerError = useCallback((data) => {
    console.error("Error from server:", data.message);
    alert(`Error: ${data.message}`);
  }, []);

  // Set up WebSocket connection to chat
  const setupWebSocket = useCallback(() => {
    if (!chatId || !token) return;

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
            case "swapanza.request":
              handleSwapanzaRequest(data);
              break;
            case "swapanza.confirm":
              handleSwapanzaConfirm(data);
              break;
            case "swapanza.activate":
              handleSwapanzaActivate(data);
              break;
            case "swapanza.expire":
              handleSwapanzaExpire();
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
    handleServerError,
  ]);

  // Store in ref
  setupWebSocketRef.current = setupWebSocket;

  // Fetch chat details
  const fetchChat = useCallback(async () => {
    if (!chatId || !token) return;

    try {
      setLoading(true);
      const response = await axios.get(`/api/chats/${chatId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChat(response.data);
      setMessages(response.data.messages || []);

      const userSessionResponse = await axios.get(`/api/active-swapanza/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (userSessionResponse.data && userSessionResponse.data.active) {
        setIsSwapanzaActive(true);
        setSwapanzaDuration(userSessionResponse.data.duration);

        const userMsgCount = userSessionResponse.data.message_count || 0;
        setRemainingMessages(Math.max(0, 2 - userMsgCount));

        const endTime = new Date(userSessionResponse.data.ends_at);
        setSwapanzaEndTime(endTime);
        if (startSwapanzaCountdownRef.current) {
          startSwapanzaCountdownRef.current(endTime);
        }
      } else if (response.data.swapanza_active) {
        setIsSwapanzaActive(true);
        setSwapanzaDuration(response.data.swapanza_duration);

        const userMsgCount =
          response.data.swapanza_message_count?.[currentUserId] || 0;
        setRemainingMessages(Math.max(0, 2 - userMsgCount));

        if (response.data.swapanza_ends_at) {
          const endTime = new Date(response.data.swapanza_ends_at);
          setSwapanzaEndTime(endTime);
          if (startSwapanzaCountdownRef.current) {
            startSwapanzaCountdownRef.current(endTime);
          }
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching chat:", error);
      setError(error.message || "Failed to fetch chat");
      setLoading(false);
    }
  }, [chatId, token, currentUserId]);

  // Store in ref
  fetchChatRef.current = fetchChat;

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

  // Function to request a Swapanza
  const requestSwapanza = () => {
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
  };

  // Function to confirm participation in a Swapanza
  const confirmSwapanza = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      try {
        console.log("Sending Swapanza confirmation");
        ws.current.send(
          JSON.stringify({
            type: "swapanza.confirm",
          })
        );

        setUserConfirmedSwapanza(true);
        console.log("Swapanza confirmation sent and state updated");
      } catch (error) {
        console.error("Error sending Swapanza confirmation:", error);
      }
    } else {
      console.error("Cannot send confirmation: WebSocket not connected");
      alert("Connection issue. Please try again.");
    }
  };

  // Handle sending a new message
  const sendMessage = () => {
    if (!newMessage.trim() || connectionStatus !== "connected") return;
  
    // Existing validation code...
  
    if (ws.current?.readyState === WebSocket.OPEN) {
      const messageContent = newMessage.trim();
  
      // Generate unique ID for pending message
      const pendingId = `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const pendingMsg = {
        id: pendingId,
        content: messageContent,
        sender: currentUserId,
        created_at: new Date().toISOString(),
        during_swapanza: isSwapanzaActive,
        pending: true,
      };
  
      pendingMessages.current.push(pendingMsg);
  
      setMessages((prevMessages) => [...prevMessages, pendingMsg]);
  
      ws.current.send(
        JSON.stringify({
          type: "chat.message",
          content: messageContent,
        })
      );
  
      setNewMessage("");
  
      if (isSwapanzaActive) {
        setRemainingMessages((prev) => Math.max(0, prev - 1));
      }
    } else {
      console.error("WebSocket is not connected");
      setConnectionStatus("error");
    }
  };

  // Render a message component with memoization
  const MemoizedMessage = memo(({ msg, isCurrentUser, chat }) => {
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

    const sender = chat.participants.find(
      (p) => Number(p.id) === Number(msg.sender)
    );
    const senderUsername = sender?.username || "Unknown";

    return (
      <div className="flex items-end">
        {!isCurrentUser && (
          <div className="h-6 w-6 rounded-full bg-gray-300 mr-2 flex-shrink-0 overflow-hidden">
            {sender?.profile_image_url ? (
              <img
                src={sender.profile_image_url}
                alt={senderUsername}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <span className="text-xs">
                  {senderUsername[0]?.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        )}

        <div className={messageStyle}>
          <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
          <div className="text-xs mt-1 opacity-75 flex justify-between">
            <span>{isCurrentUser ? "You" : senderUsername}</span>
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

        {isCurrentUser && (
          <div className="h-6 w-6 rounded-full bg-gray-300 ml-2 flex-shrink-0 overflow-hidden">
            {sender?.profile_image_url ? (
              <img
                src={sender.profile_image_url}
                alt="You"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <span className="text-xs">
                  {senderUsername[0]?.toUpperCase() || "?"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  });

  // Render Swapanza section based on state
  const renderSwapanzaSection = () => {
    if (isSwapanzaActive) {
      const timeLeft = swapanzaEndTime
        ? Math.max(0, Math.floor((swapanzaEndTime - new Date()) / 60000))
        : 0;

      return (
        <div className="p-3 border-t bg-purple-100">
          <div className="flex justify-between items-center">
            <span className="text-purple-800 font-medium">
              Swapanza Active!
            </span>
            <span className="bg-purple-200 text-purple-800 px-2 py-1 rounded text-sm">
              {timeLeft} min left
            </span>
          </div>
          <p className="text-xs text-purple-700 mt-1">
            {remainingMessages}/2 messages left • Max 7 chars • No spaces
          </p>
        </div>
      );
    }

    if (isSwapanzaRequested) {
      return (
        <div className="p-3 border-t bg-purple-50 text-center">
          <p className="text-sm text-purple-700">
            {swapanzaRequestedBy === "you"
              ? `Swapanza invitation sent (${swapanzaDuration} min)`
              : `Swapanza invitation received (${swapanzaDuration} min)`}
          </p>
        </div>
      );
    }

    if (showSwapanzaOptions) {
      return (
        <div className="p-3 border-t bg-purple-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <label className="mr-2 text-sm">Duration (min):</label>
              <input
                type="number"
                min="1"
                max="60"
                value={swapanzaDuration}
                onChange={(e) =>
                  setSwapanzaDuration(
                    Math.max(1, Math.min(60, Number(e.target.value)))
                  )
                }
                className="w-16 p-1 border rounded text-sm"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowSwapanzaOptions(false)}
                className="px-2 py-1 bg-gray-200 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={requestSwapanza}
                className="px-2 py-1 bg-purple-500 text-white rounded text-sm"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-center py-2 border-t">
        <button
          onClick={() => setShowSwapanzaOptions(true)}
          className="px-4 py-1 bg-purple-500 text-white rounded-full hover:bg-purple-600 text-sm"
        >
          Swapanza
        </button>
      </div>
    );
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
            <h2 className="text-xl font-semibold">
              {otherParticipant ? otherParticipant.username : "Chat"}
            </h2>
          </div>
          <div className="flex items-center">
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
    </div>
  );
}

export default ChatModal;
