import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import ChatModal from './ChatModal';

function ChatList({ logout, username }) {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const token = localStorage.getItem('token');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalChatId, setModalChatId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null); // Initialize to null
  const [isLoading, setIsLoading] = useState(true);



  console.log("ChatList: currentUserId:", currentUserId);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (userId) {
      setCurrentUserId(userId);
      console.log("ChatList: currentUserId loaded from localStorage:", userId);
      setIsLoading(false);
    } else {
      setIsLoading(false); // Handle the case where userId is not found
    }
  }, []);

  const fetchChats = useCallback(async () => {
    if (currentUserId) {
      try {
        const response = await axios.get('/api/chats/', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setChats(response.data);
      } catch (error) {
        console.error('Error fetching chats:', error);
      }
    }
  }, [token, currentUserId]);

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
    } else if (currentUserId) {
      fetchChats();
    }
  }, [token, navigate, fetchChats, currentUserId]);

  const searchUsers = useCallback(async (query) => {
    if (currentUserId) {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }
      console.log("Searching for:", query); // Add this line
      try {
        const response = await axios.get(`/api/users/?search=${query}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const filteredResults = response.data.filter(user =>
          user.id !== currentUserId &&
          !chats.some(chat =>
            chat.participants && Array.isArray(chat.participants) && chat.participants.some(p => p.id === user.id)
          )
        );
        setSearchResults(filteredResults);
      } catch (error) {
        console.error('Error searching users:', error);
      }
    }
  }, [token, chats, currentUserId]);

  const createChat = async (otherUserId) => {
    if (currentUserId) {
      console.log("Creating chat with otherUserId:", otherUserId);
      console.log("Creating chat with currentUserId:", currentUserId);

      if (otherUserId === currentUserId) {
        console.log("Cannot create chat with yourself.");
        return; // Prevent creating chat with yourself
      }

      try {
        const response = await axios.post('/api/chats/', {
          participants: [otherUserId, currentUserId]
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        fetchChats();
        console.log("New chat ID:", response.data.id);
        openModal(response.data.id);
      } catch (error) {
        console.error("Error creating chat:", error);
      }
    }
  };

  const openModal = (chatId) => {
    setModalChatId(chatId);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalChatId(null);
  };

  useEffect(() => {
    if (currentUserId) {
      const timerId = setTimeout(() => {
        searchUsers(searchQuery);
      }, 300);
      return () => clearTimeout(timerId);
    }
  }, [searchQuery, searchUsers, currentUserId]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (

    <div className="flex h-screen bg-gray-100">
      <div className="w-1/4 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">Your Chats</h2>
          <h1> This is user with id {currentUserId} </h1>
          <div
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full bg-gray-300 hover:bg-gray-400 cursor-pointer overflow-hidden"
          >
            <img
              src={
                localStorage.getItem('profile_image_url') ||
                "https://res.cloudinary.com/dfxbvixpv/image/upload/v1738928319/unisex_default_profile_picture_zovdsw.jpg"
              }
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div className="p-4 border-b">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for users..."
            className="w-full p-2 border rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={chat.participants && Array.isArray(chat.participants) ? () => openModal(chat.id) : null}
              className={`p-4 border-b cursor-pointer hover:bg-gray-50`}
            >
              {chat.participants && Array.isArray(chat.participants) ? (
                chat.participants.map(participant => {
                  if (participant !== currentUserId) {
                    return <div key={participant}>User {participant}</div>
                  }
                  return null;
                })
              ) : (
                <div>No participants</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {searchResults.length > 0 && (
        <div className="absolute top-20 left-1/4 w-1/4 bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="text-lg font-medium">Search Results</h3>
          </div>
          <div className="overflow-y-auto max-h-64">
            {searchResults.map((user) => (
              <div
                key={user.id}
                className="p-4 border-b hover:bg-gray-50 cursor-pointer"
                onClick={() => createChat(user.id)}
              >
                {user.username}
              </div>
            ))}
          </div>
        </div>
      )}

      {isModalOpen && (
        <ChatModal chatId={modalChatId} onClose={closeModal} />
      )}
    </div>
  );
}

export default ChatList;