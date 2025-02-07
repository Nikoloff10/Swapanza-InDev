import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Chat from './Chat';
import { Cloudinary } from "@cloudinary/url-gen";
import { AdvancedImage } from '@cloudinary/react';
import { fill } from "@cloudinary/url-gen/actions/resize";

function ChatList({ logout, username }) {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const token = localStorage.getItem('token');
  const [defaultProfileImage, setDefaultProfileImage] = useState(null);

  useEffect(() => {
    console.log('Cloudinary useEffect called');
    try {
      const cld = new Cloudinary({
        cloud: {
          cloudName: 'dfxbvixpv'
        }
      });

      const image = cld.image('unisex_default_profile_picture_zovdsw');
      image.resize(fill().width(100).height(100));
      setDefaultProfileImage(image);
      console.log('defaultProfileImage set:', image);
    } catch (error) {
      console.error('Error initializing Cloudinary:', error);
    }
  }, []);

  const fetchChats = useCallback(async () => {
    try {
      const response = await axios.get('/api/chats/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const sortedChats = response.data.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
      setChats(sortedChats);
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        navigate('/login', { replace: true });
      }
      console.error('Error fetching chats:', error);
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
    } else {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchChats();
    }
  }, [token, navigate, fetchChats]);

  const searchUsers = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await axios.get(`/api/users/?search=${query}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const filteredResults = response.data.filter(user =>
        user.username !== username &&
        !chats.some(chat =>
          chat.participants.some(p => p.username === user.username)
        )
      );
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  }, [token, username, chats]);

  const handleCreateChat = async (userId) => {
    try {
      const response = await axios.post('/api/chats/create/', {
        participants: [userId]
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data) {
        setChats(prevChats => [...prevChats, response.data]);
        setSelectedChat(response.data);
        setSearchResults([]);
        setSearchQuery('');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        navigate('/login', { replace: true });
      }
    }
  };

  // Debounce the searchUsers function
  const debouncedSearchUsers = useCallback((query) => {
    searchUsers(query);
  }, [searchUsers]);

  useEffect(() => {
    if (searchQuery) {
      const timerId = setTimeout(() => {
        debouncedSearchUsers(searchQuery);
      }, 300); // 300ms delay

      return () => {
        clearTimeout(timerId); // Clear the timeout if searchQuery changes within the delay
      };
    } else {
      setSearchResults([]); // Clear results if search query is empty
    }
  }, [searchQuery, debouncedSearchUsers]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Profile Button */}
      <div className="absolute top-4 right-4">
        <button
          onClick={() => navigate('/profile')}
          className="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-colors overflow-hidden"
        >
          {defaultProfileImage && <AdvancedImage cldImg={defaultProfileImage} alt="Profile" className="w-full h-full object-cover" />}
        </button>
      </div>

      {/* Chat List Sidebar */}
      <div className="w-1/4 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Your Chats</h2>
        </div>
        <div className="p-4 border-b">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            placeholder="Search for users..."
            className="w-full p-2 border rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="overflow-y-auto flex-1">
          {chats.map((chat) => {
            const friend = chat.participants.find(p => p.username !== username);
            return (
              <div
                key={chat.id}
                onClick={() => setSelectedChat(chat)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${selectedChat?.id === chat.id ? 'bg-blue-50' : ''
                  }`}
              >
                <div className="font-medium">{friend?.username}</div>
                <div className="text-sm text-gray-500">
                  {new Date(chat.created_at).toLocaleDateString()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1">
        {selectedChat ? (
          <Chat chatId={selectedChat.id} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <h3 className="text-xl font-medium mb-2">Welcome to Swapanza Chat</h3>
              <p>Select a chat from the left or search for new friends</p>
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
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
                onClick={() => handleCreateChat(user.id)}
              >
                {user.username}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatList;