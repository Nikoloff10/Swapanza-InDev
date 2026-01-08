import React, { useState, useCallback } from 'react';
import axios from '../utils/axiosConfig';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaSearch, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import { useChatListData } from '../hooks/useChatListData';
import { useUserSearch } from '../hooks/useUserSearch';

import ChatModal from './ChatModal';
import ChatListItem from './ChatListItem';
import UserSearchResults from './UserSearchResults';
import NotificationsDropdown from './NotificationsDropdown';
import UserAvatar from './UserAvatar';

function ChatList() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  // Chat list data hook
  const {
    chats,
    unreadCounts,
    currentUserProfile,
    totalUnreadMessages,
    currentUserId,
    username,
    fetchChats,
    fetchUnreadCounts,
    removeChat,
    closeAllChats,
    resetAllNotifications,
    reopenChat,
    addChat,
  } = useChatListData();

  // Search hook
  const { searchQuery, setSearchQuery, searchResults, clearSearch } = useUserSearch(
    token,
    currentUserId
  );

  // Modal state
  const [modalChatId, setModalChatId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasPendingSwapanzaInvite, setHasPendingSwapanzaInvite] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleProfileClick = () => {
    navigate('/profile');
  };

  // Open chat modal
  const openModal = useCallback((chatId) => {
    setModalChatId(chatId);
    setIsModalOpen(true);
  }, []);

  // Enhanced open: sets pending invite flag and removes chat from closed ids if needed
  const openModalEnhanced = useCallback(
    (chatId) => {
      setModalChatId(chatId);
      setIsModalOpen(true);

      const isInvite = unreadCounts[chatId] === -1;
      setHasPendingSwapanzaInvite(!!isInvite);

      reopenChat(chatId);
    },
    [unreadCounts, reopenChat]
  );

  // Create a chat with a user
  const createChat = useCallback(
    async (otherUserId) => {
      try {
        // Check for existing chat with this user
        let existingChat = chats.find((chat) =>
          chat.participants.some((participant) => Number(participant.id) === Number(otherUserId))
        );

        // If not found in visible chats, check on the server
        if (!existingChat) {
          try {
            const response = await axios.get(`/api/chats/find-by-user/${otherUserId}/`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            if (response.data && response.data.id) {
              existingChat = response.data;

              // Remove from closed chats if it was closed
              reopenChat(existingChat.id);

              // Add to visible chats if not already there
              addChat(existingChat);
            }
          } catch (error) {
            // Chat doesn't exist on server yet
          }
        }

        if (existingChat) {
          clearSearch();
          openModalEnhanced(existingChat.id);
          return;
        }

        // Create a new chat
        const response = await axios.post(
          '/api/chats/',
          { participants: [otherUserId] },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        addChat(response.data);
        clearSearch();
        openModalEnhanced(response.data.id);
      } catch (error) {
        console.error('Error creating chat:', error);
        toast.error('Error creating chat');
      }
    },
    [token, chats, openModalEnhanced, reopenChat, addChat, clearSearch]
  );

  // Handle when messages are read
  const handleMessagesRead = useCallback(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Handle new message
  const handleNewMessage = useCallback(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Close modal handler
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setHasPendingSwapanzaInvite(false);
    fetchChats();
    fetchUnreadCounts();
  }, [fetchChats, fetchUnreadCounts]);

  // Handle notification click
  const handleNotificationClick = useCallback(
    (chatId) => {
      openModal(chatId);
      setShowNotifications(false);
    },
    [openModal]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="container py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="card mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {/* Profile Picture */}
                <UserAvatar
                  username={username}
                  profileImageUrl={currentUserProfile?.profile_image_url}
                  size="md"
                  onClick={handleProfileClick}
                />

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
                <NotificationsDropdown
                  isOpen={showNotifications}
                  onToggle={() => setShowNotifications(!showNotifications)}
                  unreadCounts={unreadCounts}
                  chats={chats}
                  currentUserId={currentUserId}
                  totalUnread={totalUnreadMessages}
                  onOpenChat={handleNotificationClick}
                  onClearAll={resetAllNotifications}
                />

                {/* Logout Button */}
                <button onClick={logout} className="btn-danger">
                  Logout
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
                  onClick={clearSearch}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <FaTimes className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Results */}
            <UserSearchResults results={searchResults} onSelectUser={createChat} />
          </div>

          {/* Actions */}
          {chats.length > 0 && (
            <div className="mb-6">
              <button onClick={closeAllChats} className="w-full btn-secondary">
                Close All Chats
              </button>
            </div>
          )}

          {/* Chat List */}
          <div className="space-y-3">
            {chats.length > 0 ? (
              chats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  currentUserId={currentUserId}
                  unreadCount={unreadCounts[chat.id] || 0}
                  onOpen={openModal}
                  onRemove={removeChat}
                />
              ))
            ) : (
              <div className="card text-center py-12">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No chats yet</h3>
                <p className="text-gray-600 mb-4">
                  Search for users above to start your first conversation!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && modalChatId && (
        <ChatModal
          chatId={modalChatId}
          hasPendingSwapanzaInvite={hasPendingSwapanzaInvite}
          onClose={handleCloseModal}
          onMessagesRead={handleMessagesRead}
          onNewMessage={handleNewMessage}
        />
      )}
    </div>
  );
}

export default ChatList;
