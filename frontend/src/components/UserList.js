import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import { toast } from 'react-toastify';
import { FaUsers, FaUser, FaEnvelope, FaSearch, FaTimes } from 'react-icons/fa';
import { Link } from 'react-router-dom';

function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [error, setError] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get('/api/users/');
      setUsers(response.data);
      setFilteredUsers(response.data);
    } catch (error) {
      console.error(error);
      setError('Failed to fetch users');
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const createChat = async (userId) => {
    try {
      const response = await axios.post('/api/chats/', { user: userId });
      toast.success('Chat started!');
      // Redirect to the chat room or update the chat list
      console.log('Chat started:', response.data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to start chat');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const filtered = users.filter(user =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen flex-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-green-700 font-medium">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 py-12">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">👥</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">User Directory</h1>
            <p className="text-gray-600">Discover and connect with other Swapanza users</p>
          </div>

          {/* Search Section */}
          <div className="card mb-6">
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search users by username or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-12"
              />
            </div>
            <div className="mt-4 text-sm text-gray-500">
              Found {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Users Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map(user => (
              <div key={user.id} className="card group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
                <div className="text-center">
                  {/* User Avatar */}
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white flex items-center justify-center mx-auto mb-4 text-2xl font-bold shadow-lg">
                    {user.username[0].toUpperCase()}
                  </div>
                  
                  {/* User Info */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{user.username}</h3>
                  
                  {user.email && (
                    <div className="flex items-center justify-center text-gray-600 mb-4">
                      <FaEnvelope className="w-4 h-4 mr-2" />
                      <span className="text-sm">{user.email}</span>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="space-y-2">
                    <button className="btn-primary w-full">
                      <FaUser className="w-4 h-4 mr-2" />
                      View Profile
                    </button>
                    <button className="btn-secondary w-full">
                      <FaEnvelope className="w-4 h-4 mr-2" />
                      Send Message
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filteredUsers.length === 0 && (
            <div className="card text-center py-16">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No users found</h3>
              <p className="text-gray-600 mb-4">
                {searchQuery ? `No users match "${searchQuery}"` : 'No users available'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="btn-primary"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserList;