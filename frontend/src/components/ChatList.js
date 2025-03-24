import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import ChatModal from "./ChatModal";
import { useNavigate } from 'react-router-dom';
import { FaBell, FaUser } from "react-icons/fa";

function ChatList({ logout, username }) {
  const token = localStorage.getItem("token");
  const currentUserId = Number(localStorage.getItem("userId") || 0);
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [modalChatId, setModalChatId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const searchTimeoutRef = useRef(null);
  const navigate = useNavigate();

  const handleProfileClick = () => {
    navigate('/profile');
  };
  
  const fetchCurrentUserProfile = useCallback(async () => {
    if (!token || !currentUserId) return;
    
    try {
      const response = await axios.get(`/api/profile/${currentUserId}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setCurrentUserProfile(response.data);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  }, [token, currentUserId]);

  useEffect(() => {
    fetchCurrentUserProfile();
  }, [fetchCurrentUserProfile]);

  // Get IDs of closed chats from localStorage
  const getClosedChatIds = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem("closedChats") || "[]").map((id) =>
        id.toString()
      );
    } catch (e) {
      console.error("Error parsing closedChats from localStorage:", e);
      return [];
    }
  }, []);

  // Fetch unread message counts
  const fetchUnreadCounts = useCallback(async () => {
    if (!token) return;
    try {
      console.log("Fetching unread counts...");
      const response = await axios.get("/api/unread-counts/", {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("Unread counts received:", response.data);

      // Get closed chats
      const closedChatIds = getClosedChatIds();
      console.log("Closed chat IDs:", closedChatIds);

      // Filter out notifications for closed chats
      const filteredCounts = {};
      Object.entries(response.data).forEach(([chatId, count]) => {
        if (!closedChatIds.includes(chatId.toString()) && count > 0) {
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
        setSearchResults([]);
      }
    },
    [token, currentUserId]
  );

  const openModal = useCallback((chatId) => {
    setModalChatId(chatId);
    setIsModalOpen(true);
  }, []);

  // Create a chat with a user
  const createChat = useCallback(async (otherUserId) => {
    try {
      console.log('Attempting to create chat with user ID:', otherUserId);
      
      // Check for existing chat with this user, including closed ones
      let existingChat = null;
      
      // First check visible chats
      existingChat = chats.find(chat => 
        chat.participants.some(participant => 
          Number(participant.id) === Number(otherUserId)
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
                id => id !== existingChat.id.toString()
              );
              localStorage.setItem("closedChats", JSON.stringify(updatedClosedChats));
            }
            
            // Add to visible chats if not already there
            if (!chats.some(chat => chat.id === existingChat.id)) {
              setChats(prevChats => [...prevChats, existingChat]);
            }
          }
        } catch (error) {
          console.log('No existing chat found on server:', error);
        }
      }
      
      if (existingChat) {
        console.log('Chat already exists, opening existing chat:', existingChat.id);
        
        // Clear search
        setSearchQuery('');
        setSearchResults([]);
        
        // Open the existing chat
        openModal(existingChat.id);
        return;
      }
      
      console.log('No existing chat found, creating new chat');
      // If no existing chat, create a new one
      const response = await axios.post(
        '/api/chats/',
        { participants: [otherUserId] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      console.log('New chat created:', response.data);
      
      // Add the new chat to the list and open it
      setChats(prevChats => [...prevChats, response.data]);
      
      // Clear search
      setSearchQuery('');
      setSearchResults([]);
      
      // Open the chat modal
      openModal(response.data.id);
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  }, [token, chats, openModal, getClosedChatIds]);

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

  // Fetch chats on mount and when token changes
  const fetchChats = useCallback(async () => {
    if (!token) return;

    try {
      const response = await axios.get("/api/chats/", {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Get closed chats
      const closedChatIds = getClosedChatIds();

      // Filter out closed chats
      const filteredChats = response.data.filter(
        (chat) => !closedChatIds.includes(chat.id.toString())
      );

      setChats(filteredChats);
    } catch (error) {
      console.error("Error fetching chats:", error);
    }
  }, [token, getClosedChatIds]);

  useEffect(() => {
    fetchChats();
    fetchUnreadCounts();

    // Refresh data periodically
    const interval = setInterval(() => {
      fetchUnreadCounts();
    }, 10000); // every 10 seconds

    return () => clearInterval(interval);
  }, [fetchChats, fetchUnreadCounts]);

  // Function to open chat modal

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
      // Just hide the chat, don't delete it
      const closedChatIds = getClosedChatIds();
      if (!closedChatIds.includes(chatId.toString())) {
        localStorage.setItem(
          "closedChats",
          JSON.stringify([...closedChatIds, chatId.toString()])
        );
      }
  
      // Remove from UI
      setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));
  
      // Update unread counts
      setUnreadCounts((prevCounts) => {
        const newCounts = { ...prevCounts };
        delete newCounts[chatId];
        return newCounts;
      });
    },
    [getClosedChatIds]
  );

  // Close all chats
  const closeAllChats = useCallback(() => {
    // Add all chat IDs to closed chats
    const allChatIds = chats.map((chat) => chat.id.toString());

    // Store in localStorage
    const existingClosedChats = getClosedChatIds();
    const combinedClosedChats = [
      ...new Set([...existingClosedChats, ...allChatIds]),
    ];
    localStorage.setItem("closedChats", JSON.stringify(combinedClosedChats));

    // Clear UI state
    setChats([]);
    setUnreadCounts({});

    // Force refresh data from server to ensure UI is correct
    setTimeout(() => {
      fetchChats();
      fetchUnreadCounts();
    }, 300);
  }, [chats, getClosedChatIds, fetchChats, fetchUnreadCounts]);

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
  const totalUnreadMessages =
    Object.values(unreadCounts).reduce((sum, count) => sum + count, 0) || 0;

    return (
      <div className="max-w-md mx-auto p-4 bg-white rounded shadow">
        <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
            {/* Profile Picture (circular) */}
            <div 
              className="h-10 w-10 rounded-full bg-blue-500 text-white flex items-center justify-center mr-3 cursor-pointer overflow-hidden"
              onClick={handleProfileClick}
            >
              {currentUserProfile?.profile_image_url ? (
                <img 
                  src={currentUserProfile.profile_image_url} 
                  alt={username} 
                  className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-lg font-bold">{username ? username[0].toUpperCase() : '?'}</span>
          )}
        </div>
        <h1 className="text-2xl font-bold">Chats</h1>
      </div>
          
          <div className="flex items-center">
            {/* Profile button */}
            <button
              onClick={handleProfileClick}
              className="mr-3 p-2 bg-blue-100 rounded-full hover:bg-blue-200 focus:outline-none"
              title="View Profile"
            >
              <FaUser className="text-blue-600" />
            </button>
            
            {/* Notifications */}
            <div className="relative mr-4">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 bg-blue-100 rounded-full hover:bg-blue-200 focus:outline-none"
              >
                <FaBell className="text-blue-600" />
                {totalUnreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {totalUnreadMessages}
                  </span>
                )}
              </button>
    
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl z-10 border border-gray-200">
                  <div className="p-3 border-b border-gray-200 font-medium flex justify-between items-center">
                    <span>Notifications</span>
                    <button
                      onClick={resetAllNotifications}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      Reset All
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {Object.keys(unreadCounts).length > 0 ? (
                      Object.entries(unreadCounts).map(([chatId, count]) => {
                        // Find chat info to display name
                        const chat = chats.find(
                          (c) => c.id.toString() === chatId
                        );
                        const otherUser = chat?.participants?.find(
                          (p) => Number(p.id) !== Number(currentUserId)
                        );
    
                        return (
                          <div
                            key={chatId}
                            className="p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                            onClick={() => {
                              openModal(Number(chatId));
                              setShowNotifications(false);
                            }}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">
                                {otherUser?.username || "Unknown"}
                              </span>
                              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                                {count} {count === 1 ? "message" : "messages"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-gray-500 text-center">
                        No new messages
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Logout button */}
            <button
              onClick={logout}
              className="px-3 py-1 bg-red-500 text-white rounded"
            >
              Logout
            </button>
          </div>
        </div>
    
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 border rounded"
          />
          {searchResults.length > 0 && (
            <div className="mt-2 border border-gray-200 rounded shadow">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  onClick={() => createChat(user.id)}
                  className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                >
                  {user.username}
                </div>
              ))}
            </div>
          )}
        </div>
    
        <div className="mb-4">
          <button
            onClick={closeAllChats}
            className="w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Close All Chats
          </button>
        </div>
    
        <div className="space-y-2">
          {chats.map((chat) => {
            // Find the other participant (assuming 2-person chats)
            const otherUser = chat.participants.find(
              (p) => Number(p.id) !== Number(currentUserId)
            );
            const chatName = otherUser ? otherUser.username : "Unknown User";
            const unreadCount = unreadCounts[chat.id] || 0;
    
            return (
              <div
                key={chat.id}
                onClick={() => openModal(chat.id)}
                className="p-4 border rounded cursor-pointer hover:bg-gray-100 flex justify-between items-center"
              >
                <div className="flex items-center">
                  <span>{chatName}</span>
                  {unreadCount > 0 && (
                    <span className="ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeChat(chat.id);
                  }}
                  className="ml-2 px-2 py-1 bg-gray-300 rounded hover:bg-gray-400 text-sm"
                >
                  Close
                </button>
              </div>
            );
          })}
        </div>
    
        {isModalOpen && modalChatId && (
          <ChatModal
            chatId={modalChatId}
            onClose={() => {
              setIsModalOpen(false);
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
