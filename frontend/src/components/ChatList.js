import React, { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import ChatModal from './ChatModal';
import { FaBell } from 'react-icons/fa'; // Import bell icon

function ChatList({ logout, username }) {
  const token = localStorage.getItem('token');
  const currentUserId = Number(localStorage.getItem('userId') || 0);
  const [chats, setChats] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalChatId, setModalChatId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [showNotifications, setShowNotifications] = useState(false);

  // Get IDs of closed chats from localStorage
  const getClosedChatIds = () =>
    JSON.parse(localStorage.getItem('closedChats') || '[]').map((id) => id.toString());

  // Remove chat id from closed chats when opening it
  const removeClosedChatId = (chatId) => {
    const closed = getClosedChatIds().filter((id) => id !== chatId.toString());
    localStorage.setItem('closedChats', JSON.stringify(closed));
  };

  // Add chat id to localStorage for closed chats
  const addClosedChatId = (chatId) => {
    const closed = getClosedChatIds();
    if (!closed.includes(chatId.toString())) {
      const newClosed = [...closed, chatId.toString()];
      localStorage.setItem('closedChats', JSON.stringify(newClosed));
    }
  };

  // Fetch chats from the backend and filter out closed chats.
  const fetchChats = useCallback(async () => {
    if (!currentUserId || !token) return;
    try {
      const response = await axios.get('/api/chats/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const closedIds = getClosedChatIds();
      // Filter out chats whose id is among the closed IDs.
      const activeChats = response.data.filter(
        (chat) => !closedIds.includes(chat.id.toString())
      );
      // Also ensure that there are no duplicate chats by id.
      const unique = activeChats.reduce((acc, curr) => {
        if (!acc.find((chat) => Number(chat.id) === Number(curr.id))) {
          acc.push(curr);
        }
        return acc;
      }, []);
      setChats(unique);

      // Fetch unread message counts for each chat
      fetchUnreadCounts();
    } catch (error) {
      console.error('Error fetching chats:', error.response || error);
    }
  }, [currentUserId, token]);

  // Fetch unread message counts
  const fetchUnreadCounts = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get('/api/unread-counts/', {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUnreadCounts(response.data);
    } catch (error) {
      console.error('Error fetching unread counts:', error.response || error);
    }
  }, [token]);

  useEffect(() => {
    fetchChats();

    // Set up interval to fetch unread counts every 10 seconds
    const interval = setInterval(fetchUnreadCounts, 10000);

    return () => clearInterval(interval);
  }, [fetchChats, fetchUnreadCounts]);

  // Open chat modal; if the chat was marked as closed, remove it from closedChats.
  const openModal = (chatId) => {
    removeClosedChatId(chatId);
    setModalChatId(chatId);
    setIsModalOpen(true);
  };

  // Remove (close) a single chat and store its ID in localStorage.
  const removeChat = (chatId) => {
    addClosedChatId(chatId);
    setChats((prev) =>
      prev.filter((chat) => Number(chat.id) !== Number(chatId))
    );
  };

  // Close all chats: mark all as closed and clear the chats list.
  const closeAllChats = () => {
    chats.forEach((chat) => addClosedChatId(chat.id));
    setChats([]);
  };

  // Search for users excluding current user and those already in active chats.
  const searchUsers = useCallback(
    async (query) => {
      if (!currentUserId || !token) return;
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        const response = await axios.get('/api/users/', {
          headers: { Authorization: `Bearer ${token}` },
          params: { search: query },
        });
        const inChatIds = new Set();
        chats.forEach((chat) => {
          chat.participants.forEach((p) => {
            if (Number(p.id) !== Number(currentUserId)) {
              inChatIds.add(Number(p.id));
            }
          });
        });
        const filtered = response.data.filter(
          (user) =>
            Number(user.id) !== Number(currentUserId) &&
            !inChatIds.has(Number(user.id))
        );
        setSearchResults(filtered);
      } catch (error) {
        console.error('Error searching users:', error.response || error);
      }
    },
    [currentUserId, token, chats]
  );

  const searchTimeout = useRef(null);

  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery, chats, searchUsers]);

  useEffect(() => {
    if (searchQuery.trim()) {
      searchUsers(searchQuery);
    }
  }, [chats, searchQuery, searchUsers]);

  // Create new chat. If it already exists, reopen it
  const createChat = async (otherUserId) => {
    try {
      // First try to get the chat from the backend directly
      const response = await axios.get('/api/chats/', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Look for existing chat in ALL chats, not just active ones
      const existingChat = response.data.find(
        (chat) =>
          chat.participants.some((p) => Number(p.id) === Number(otherUserId)) &&
          chat.participants.some((p) => Number(p.id) === Number(currentUserId))
      );

      if (existingChat) {
        // Remove from closed chats if necessary
        removeClosedChatId(existingChat.id);
        // Fetch fresh data for existing chat
        const chatResponse = await axios.get(`/api/chats/${existingChat.id}/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Update chat in state with fresh data
        setChats(prevChats => {
          const chatExists = prevChats.some(c => c.id === existingChat.id);
          if (chatExists) {
            return prevChats.map(c =>
              c.id === existingChat.id ? chatResponse.data : c
            );
          } else {
            // Add to chats if it wasn't there
            return [...prevChats, chatResponse.data];
          }
        });
        openModal(existingChat.id);
        return;
      }

      // Create new chat if none exists
      const createResponse = await axios.post(
        '/api/chats/',
        { participants: [otherUserId, currentUserId] },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newChat = createResponse.data;
      setChats(prevChats => [...prevChats, newChat]);
      removeClosedChatId(newChat.id);
      openModal(newChat.id);
    } catch (error) {
      console.error('Error with chat:', error.response || error);
    }
  };

  // Calculate total unread messages
  const totalUnreadMessages = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded shadow">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Chats</h1>
        <div className="flex items-center">
          {/* Notification Bell */}
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

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl z-10 border border-gray-200">
                <div className="p-3 border-b border-gray-200 font-medium">
                  Notifications
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {Object.keys(unreadCounts).length > 0 ? (
                    Object.entries(unreadCounts).map(([chatId, count]) => {
                      const chat = chats.find(c => c.id.toString() === chatId);
                      if (!chat || count === 0) return null;

                      const otherUser = chat.participants.find(
                        p => Number(p.id) !== Number(currentUserId)
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
                              {otherUser?.username || 'Unknown'}
                            </span>
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                              {count} {count === 1 ? 'message' : 'messages'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-gray-500 text-center">No new messages</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button onClick={logout} className="px-3 py-1 bg-red-500 text-white rounded">
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
          const otherParticipants = chat.participants.filter(
            (p) => Number(p.id) !== Number(currentUserId)
          );
          const chatName = otherParticipants.length
            ? [...new Set(otherParticipants.map((p) => p.username))].join(', ')
            : 'No participants';

          // Get unread count for this chat
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
        />
      )}
    </div>
  );
}

export default ChatList;