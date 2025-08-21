import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "../utils/axiosConfig";
import ChatModal from "./ChatModal";
import { useNavigate } from "react-router-dom";
import { FaBell, FaUser, FaSearch, FaTimes, FaPlus } from "react-icons/fa";
import { toast } from 'react-toastify';

function ChatList({ logout, username }) {
  const [wsConnected, setWsConnected] = useState(false);
  const notificationWsRef = useRef(null);
  const token = localStorage.getItem("token");
  const currentUserId = Number(localStorage.getItem("userId") || 0);
  const [chats, setChats] = useState([]);
  // Persist locally-closed chat ids so they don't reappear from the server/ws
  const [closedChatIds, setClosedChatIds] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem("closedChats") || "[]") || []).map((id) => id.toString());
    } catch (e) {
      console.error('Error reading closedChats from localStorage', e);
      return [];
    }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [modalChatId, setModalChatId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [hasPendingSwapanzaInvite, setHasPendingSwapanzaInvite] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const searchTimeoutRef = useRef(null);
  const navigate = useNavigate();
  const wsErrorShownRef = useRef(false);
  
  const handleProfileClick = () => {
    navigate("/profile");
  };

  const fetchCurrentUserProfile = useCallback(async () => {
    if (!token || !currentUserId) return;

    try {
      const response = await axios.get(`/api/profile/${currentUserId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setCurrentUserProfile(response.data);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      toast.error("Error fetching user profile");
    }
  }, [token, currentUserId]);

  useEffect(() => {
    fetchCurrentUserProfile();
  }, [fetchCurrentUserProfile]);

  // Get IDs of closed chats from localStorage
  // Helper to return and persist closed chat IDs
  const persistClosedChatIds = useCallback((ids) => {
    const unique = Array.from(new Set((ids || []).map((i) => i.toString())));
    localStorage.setItem("closedChats", JSON.stringify(unique));
    setClosedChatIds(unique);
  }, []);

  // Read closed chat ids directly from localStorage for immediate consistency
  const getClosedChatIds = useCallback(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("closedChats") || "[]");
      return (stored || []).map((id) => id.toString());
    } catch (e) {
      return closedChatIds;
    }
  }, [closedChatIds]);

  // Fetch unread message counts
  const fetchUnreadCounts = useCallback(async () => {
    if (!token) return;
    try {
      console.log("Fetching unread counts...");
      const response = await axios.get("/api/unread-counts/", {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("Unread counts received:", response.data);

      // Filter out notifications for locally closed chats
      const closed = getClosedChatIds();
      console.log("Closed chat IDs:", closed);

      const filteredCounts = {};
      Object.entries(response.data).forEach(([chatId, count]) => {
        if (!closed.includes(chatId.toString()) && count > 0) {
          filteredCounts[chatId] = count;
        }
      });

      console.log("Filtered unread counts:", filteredCounts);
      setUnreadCounts(filteredCounts);
    } catch (error) {
      console.error("Error fetching unread counts:", error.response || error);
    }
  }, [token, getClosedChatIds]);

  // Function to search users
  const searchUsers = useCallback(
    async (query) => {
      // Only require one character for search
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        console.log("Searching for users with query:", query);
        const response = await axios.get(
          `/api/users/?search=${encodeURIComponent(query)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        console.log("Search results:", response.data);

        // Filter out the current user from results
        const filteredResults = response.data.filter(
          (user) => Number(user.id) !== Number(currentUserId)
        );

        setSearchResults(filteredResults);
      } catch (error) {
        console.error("Error searching users:", error);
        toast.error("Error searching users");
        setSearchResults([]);
      }
    },
    [token, currentUserId]
  );

  const openModal = useCallback((chatId) => {
    setModalChatId(chatId);
    setIsModalOpen(true);
  }, []);

  // enhanced open: sets pending invite flag and removes chat from closed ids if needed
  const openModalEnhanced = useCallback((chatId) => {
    setModalChatId(chatId);
    setIsModalOpen(true);

    // If this chat had a swapanza invite marker (-1) treat it as pending
    const isInvite = unreadCounts[chatId] === -1;
    setHasPendingSwapanzaInvite(!!isInvite);

    // If the chat was locally closed, remove it from closed list so it will appear normally
    const closed = getClosedChatIds();
    if (closed.includes(chatId.toString())) {
      const remaining = closed.filter((id) => id !== chatId.toString());
      persistClosedChatIds(remaining);
    }
  }, [unreadCounts, getClosedChatIds, persistClosedChatIds]);

  // Create a chat with a user
  const createChat = useCallback(
    async (otherUserId) => {
      try {
        console.log("Attempting to create chat with user ID:", otherUserId);

        // Check for existing chat with this user, including closed ones
        let existingChat = null;

        // First check visible chats
        existingChat = chats.find((chat) =>
          chat.participants.some(
            (participant) => Number(participant.id) === Number(otherUserId)
          )
        );

        // If not found in visible chats, check on the server
        if (!existingChat) {
          try {
            const response = await axios.get(
              `/api/chats/find-by-user/${otherUserId}/`,
              { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data && response.data.id) {
              existingChat = response.data;

              // Remove from closed chats in localStorage if it was closed
              const closedChatIds = getClosedChatIds();
              if (closedChatIds.includes(existingChat.id.toString())) {
                const updatedClosedChats = closedChatIds.filter(
                  (id) => id !== existingChat.id.toString()
                );
                localStorage.setItem(
                  "closedChats",
                  JSON.stringify(updatedClosedChats)
                );
              }

              // Add to visible chats if not already there
              if (!chats.some((chat) => chat.id === existingChat.id)) {
                setChats((prevChats) => [...prevChats, existingChat]);
              }
            }
          } catch (error) {
            console.log("No existing chat found on server:", error);
          }
        }

        if (existingChat) {
          console.log(
            "Chat already exists, opening existing chat:",
            existingChat.id
          );

          // Clear search
          setSearchQuery("");
          setSearchResults([]);

          // Open the existing chat
          openModalEnhanced(existingChat.id);
          return;
        }

        console.log("No existing chat found, creating new chat");
        // If no existing chat, create a new one
        const response = await axios.post(
          "/api/chats/",
          { participants: [otherUserId] },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log("New chat created:", response.data);

        // Add the new chat to the list and open it
        setChats((prevChats) => [...prevChats, response.data]);

        // Clear search
        setSearchQuery("");
        setSearchResults([]);

        // Open the chat modal
  openModalEnhanced(response.data.id);
      } catch (error) {
        console.error("Error creating chat:", error);
      }
    },
  [token, chats, openModalEnhanced, getClosedChatIds]
  );

  // Handle search input with debounce
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout with shorter delay (150ms instead of 300ms)
    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(searchQuery);
    }, 150);

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchUsers]);

  // Fetch chats from the backend
  const fetchChats = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get('/api/chats/', {
        headers: { Authorization: `Bearer ${token}` },
        params: { include_closed: true },
      });
  // filter out chats user closed locally
  const closed = getClosedChatIds();
  const filtered = (response.data || []).filter((c) => !closed.includes(c.id.toString()));
  setChats(filtered);
    } catch (error) {
      console.error('Error fetching chats:', error);
      toast.error('Error fetching chats');
    }
  }, [token, getClosedChatIds]);

  // Fetch chats and unread counts once on mount
  useEffect(() => {
    fetchChats();
    fetchUnreadCounts();
  }, [fetchChats, fetchUnreadCounts]);

  // Poll only if wsConnected is false
  useEffect(() => {
    let interval = null;
    if (!wsConnected) {
      interval = setInterval(() => {
        fetchChats();
        fetchUnreadCounts();
      }, 30000);
      console.log('Polling effect: wsConnected = false (polling active)');
    } else {
      console.log('Polling effect: wsConnected = true (no polling)');
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [wsConnected, fetchChats, fetchUnreadCounts]);

  // Handle when messages are read
  const handleMessagesRead = useCallback(() => {
    console.log("Messages read callback triggered");
    // Refresh unread counts when messages are marked as read
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  const handleNewMessage = useCallback(() => {
    console.log("New message callback triggered");
    // Refresh unread counts when a new message arrives
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Remove a chat (mark as closed)
  const removeChat = useCallback(
    (chatId) => {
      // Mark chat as closed locally and remove from UI
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
    // Add all chat IDs to closed chats
    const allChatIds = chats.map((chat) => chat.id.toString());
    const existingClosed = getClosedChatIds();
    const combined = Array.from(new Set([...existingClosed, ...allChatIds]));
    persistClosedChatIds(combined);

    setChats([]);
    setUnreadCounts({});

  // Refresh immediately; fetchChats reads localStorage so new closed IDs are used
  fetchChats();
  fetchUnreadCounts();
  }, [chats, getClosedChatIds, fetchChats, fetchUnreadCounts, persistClosedChatIds]);

  // Reset all notifications
  const resetAllNotifications = useCallback(async () => {
    try {
      await axios.post(
        "/api/reset-notifications/",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Clear notifications
      setUnreadCounts({});

      // Refresh the counts from server
      fetchUnreadCounts();
    } catch (error) {
      console.error("Error resetting notifications:", error);
    }
  }, [token, fetchUnreadCounts]);

  // Calculate total unread messages
  const totalUnreadMessages = Object.values(unreadCounts).reduce((sum, count) => sum + (count > 0 ? count : 0), 0) || 0;

  // WebSocket connection with exponential backoff and proper cleanup
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

      // Send initial ping
      ws.send(JSON.stringify({ type: 'ping' }));
      
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
          pongTimeout = setTimeout(() => {
            console.warn('No pong received in 45s');
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.close(3000, 'No pong received');
            }
          }, 45000); // More forgiving pong timeout
        }
      }, 60000); // Ping every 60s
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
          console.log('WebSocket connected');
          setWsConnected(true);
          wsErrorShownRef.current = false;
          reconnectAttempt = 0;
          isReconnecting = false;
          startPing();
        };

        ws.onclose = (e) => {
          if (!mountedRef.current) return;
          console.log('WebSocket closed:', e.code, e.reason);
          setWsConnected(false);
          cleanup();

          if (e.code !== 1000 && !wsErrorShownRef.current) {
            wsErrorShownRef.current = true;
            if (e.code === 3000) {
              console.log('Reconnecting due to missed pong');
            } else {
              toast.error('Connection lost. Reconnecting...');
            }
          }

          // Only reconnect if not unmounted and connection wasn't closed cleanly
          if (mountedRef.current && e.code !== 1000) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempt++), 30000);
            console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempt})`);
            isReconnecting = false;
            reconnectTimeout = setTimeout(connect, delay);
          }
        };

        ws.onerror = (e) => {
          if (!mountedRef.current) return;
          console.error('WebSocket error:', e);
        };

        ws.onmessage = (event) => {
          if (!mountedRef.current) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'pong') {
              if (pongTimeout) clearTimeout(pongTimeout);
              return;
            }

            // Filter notifications for closed chats
            const closed = getClosedChatIds();
            const chatIdStr = data.chat_id?.toString();
            if (chatIdStr && closed.includes(chatIdStr)) {
              console.log('Ignoring notification for closed chat:', chatIdStr);
              return;
            }

            // Handle notifications
            if (data.type === 'unread_count') {
              setUnreadCounts(prev => ({ ...prev, [data.chat_id]: data.count }));
            } else if (data.type === 'swapanza_invite') {
              setUnreadCounts(prev => ({ ...prev, [data.chat_id]: -1 }));
              toast.info(`Swapanza invite from ${data.from}! Click to view.`, {
                onClick: () => openModalEnhanced(Number(data.chat_id)),
                autoClose: 6000
              });
            }
          } catch (err) {
            console.error('Error handling message:', err);
          }
        };
      } catch (err) {
        console.error('Error creating WebSocket:', err);
        isReconnecting = false;
        if (mountedRef.current) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempt++), 30000);
          reconnectTimeout = setTimeout(connect, delay);
        }
      }
    };

    // Initial connection
    mountedRef.current = true;
    setTimeout(connect, 200);

    // Cleanup function
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [token, currentUserId, openModalEnhanced, getClosedChatIds]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="container py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="card mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Profile Picture */}
                <div
                  className="h-12 w-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white flex items-center justify-center cursor-pointer overflow-hidden ring-2 ring-white shadow-lg"
                  onClick={handleProfileClick}
                >
                  {currentUserProfile?.profile_image_url ? (
                    <img
                      src={currentUserProfile.profile_image_url}
                      alt={username}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xl font-bold">
                      {username ? username[0].toUpperCase() : "?"}
                    </span>
                  )}
                </div>
                
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Chats</h1>
                  <p className="text-gray-600 text-sm">Welcome back, {username}!</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* Profile Button */}
                <button
                  onClick={handleProfileClick}
                  className="p-3 bg-green-100 hover:bg-green-200 rounded-full transition-colors duration-200"
                  title="View Profile"
                >
                  <FaUser className="text-green-600 w-4 h-4" />
                </button>

                {/* Notifications */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-3 bg-green-100 hover:bg-green-200 rounded-full transition-colors duration-200 relative"
                  >
                    <FaBell className="text-green-600 w-4 h-4" />
                    {totalUnreadMessages > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                        {totalUnreadMessages}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl z-20 border border-gray-100">
                      <div className="p-4 border-b border-gray-100 font-semibold flex justify-between items-center">
                        <span className="text-gray-900">Notifications</span>
                        <button
                          onClick={resetAllNotifications}
                          className="text-sm text-green-600 hover:text-green-700 font-medium"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {Object.keys(unreadCounts).length > 0 ? (
                          Object.entries(unreadCounts).map(([chatId, count]) => {
                            const chat = chats.find(
                              (c) => c.id.toString() === chatId
                            );
                            
                            let otherUser = chat?.participants?.find(
                              (p) => Number(p.id) !== Number(currentUserId)
                            );

                            const isSwapanzaInvite = count === -1;

                            return (
                              <div
                                key={chatId}
                                className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                                onClick={() => {
                                  openModal(Number(chatId));
                                  setShowNotifications(false);
                                }}
                              >
                                <div className="flex justify-between items-center">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-sm font-bold">
                                      {otherUser?.username?.[0]?.toUpperCase() || "?"}
                                    </div>
                                    <span className="font-medium text-gray-900">
                                      {otherUser?.username || "Unknown"}
                                    </span>
                                  </div>
                                  <span className={`${
                                    isSwapanzaInvite 
                                      ? 'bg-purple-100 text-purple-800' 
                                      : 'bg-green-100 text-green-800'
                                  } text-xs font-medium px-3 py-1 rounded-full`}>
                                    {isSwapanzaInvite ? 'Swapanza' : `${count} new`}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-8 text-center text-gray-500">
                            <div className="text-4xl mb-2">✨</div>
                            <p>All caught up!</p>
                            <p className="text-sm">No new messages</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Logout Button */}
                <button
                  onClick={logout}
                  className="btn-danger"
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>

          {/* Search Section */}
          <div className="card mb-6">
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search users to start chatting..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-12"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <FaTimes className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => createChat(user.id)}
                    className="flex items-center justify-between p-3 bg-gray-50 hover:bg-green-50 rounded-lg cursor-pointer transition-colors duration-200 border border-gray-100"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-sm font-bold">
                        {user.username[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{user.username}</span>
                    </div>
                    <FaPlus className="text-green-500 w-4 h-4" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          {chats.length > 0 && (
            <div className="mb-6">
              <button
                onClick={closeAllChats}
                className="w-full btn-secondary"
              >
                Close All Chats
              </button>
            </div>
          )}

          {/* Chat List */}
          <div className="space-y-3">
            {chats.length > 0 ? (
              chats.map((chat) => {
                const otherUser = chat.participants.find(
                  (p) => Number(p.id) !== Number(currentUserId)
                );
                const chatName = otherUser ? otherUser.username : "Unknown User";
                const unreadCount = unreadCounts[chat.id] || 0;

                return (
                  <div
                    key={chat.id}
                    onClick={() => openModal(chat.id)}
                    className="card cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-300 to-red-500 flex items-center justify-center text-white text-lg font-bold">
                          {chatName[0].toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{chatName}</h3>
                          <p className="text-sm text-gray-500">Click to open chat</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        {unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-sm rounded-full h-6 w-6 flex items-center justify-center font-bold">
                            {unreadCount}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeChat(chat.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors duration-200"
                          title="Close chat"
                        >
                          <FaTimes className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="card text-center py-12">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No chats yet</h3>
                <p className="text-gray-600 mb-4">Search for users above to start your first conversation!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && modalChatId && (
        <ChatModal
          chatId={modalChatId}
          hasPendingSwapanzaInvite={hasPendingSwapanzaInvite}
          onClose={() => {
            setIsModalOpen(false);
            setHasPendingSwapanzaInvite(false);
            // Fetch chats and unread counts when closing the modal
            fetchChats();
            fetchUnreadCounts();
          }}
          onMessagesRead={handleMessagesRead}
          onNewMessage={handleNewMessage}
        />
      )}
    </div>
  );
}

export default ChatList;
