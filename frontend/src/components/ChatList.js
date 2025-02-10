import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import ChatModal from './ChatModal';

function ChatList({ logout, username }) {
  const token = localStorage.getItem('token');
  const currentUserId = Number(localStorage.getItem('userId') || 0);
  const [chats, setChats] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalChatId, setModalChatId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get IDs of closed chats stored in localStorage.
  const getClosedChatIds = () =>
    JSON.parse(localStorage.getItem('closedChats') || '[]').map((id) =>
      id.toString()
    );

  // Update closed chats list in localStorage.
  const addClosedChatId = (chatId) => {
    const closed = getClosedChatIds();
    if (!closed.includes(chatId.toString())) {
      const newClosed = [...closed, chatId.toString()];
      localStorage.setItem('closedChats', JSON.stringify(newClosed));
    }
  };

  // Fetch chats and filter out closed ones.
  const fetchChats = useCallback(async () => {
    if (!currentUserId || !token) return;
    try {
      const response = await axios.get('/api/chats/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const closedIds = getClosedChatIds();
      const activeChats = response.data.filter(
        (chat) => !closedIds.includes(chat.id.toString())
      );
      setChats(activeChats);
    } catch (error) {
      console.error('Error fetching chats:', error.response || error);
    }
  }, [currentUserId, token]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Open chat modal.
  const openModal = (chatId) => {
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

  // Close all recent chats.
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
            if (Number(p.id) === Number(currentUserId)) return;
            inChatIds.add(Number(p.id));
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

  // Update search results whenever the chats or the search query is changed.
  useEffect(() => {
    if (searchQuery.trim()) {
      searchUsers(searchQuery);
    }
  }, [chats, searchQuery, searchUsers]);

  // Create new chat.
  const createChat = async (otherUserId) => {
    try {
      // Check if a chat already exists.
      const existingChat = chats.find(
        (chat) =>
          chat.participants.some((p) => Number(p.id) === Number(otherUserId)) &&
          chat.participants.some((p) => Number(p.id) === Number(currentUserId))
      );
      if (existingChat) {
        openModal(existingChat.id);
        fetchChats();
        return;
      }
    } catch (error) {
      console.error('Error checking for existing chat:', error.response || error);
    }
    try {
      // Create a new chat.
      const createResponse = await axios.post(
        '/api/chats/',
        { participants: [otherUserId, currentUserId] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchChats();
      openModal(createResponse.data.id);
    } catch (error) {
      console.error('Error creating chat:', error.response || error);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 bg-white rounded shadow">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Chats</h1>
        <button onClick={logout} className="px-3 py-1 bg-red-500 text-white rounded">
          Logout
        </button>
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

      {/* Button to close all recent chats at once */}
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
          return (
            <div
              key={chat.id}
              onClick={() => openModal(chat.id)}
              className="p-4 border rounded cursor-pointer hover:bg-gray-100 flex justify-between items-center"
            >
              <span>{chatName}</span>
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
            fetchChats();
          }}
          onMessageSend={fetchChats}
        />
      )}
    </div>
  );
}

export default ChatList;