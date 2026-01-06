import React from 'react';
import PropTypes from 'prop-types';
import { FaTimes } from 'react-icons/fa';
import UserAvatar from './UserAvatar';

/**
 * ChatListItem - Individual chat card in the chat list
 */
function ChatListItem({ chat, currentUserId, unreadCount, onOpen, onRemove }) {
  const otherUser = chat.participants?.find((p) => Number(p.id) !== Number(currentUserId));
  const chatName = otherUser?.username || 'Unknown User';

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove(chat.id);
  };

  return (
    <div
      onClick={() => onOpen(chat.id)}
      className="card cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:-translate-y-1"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <UserAvatar
            username={chatName}
            profileImageUrl={otherUser?.profile_image_url}
            size="md"
            gradientFrom="from-red-300"
            gradientTo="to-red-500"
          />
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
            onClick={handleRemove}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors duration-200"
            title="Close chat"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

ChatListItem.propTypes = {
  chat: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    participants: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        username: PropTypes.string,
        profile_image_url: PropTypes.string,
      })
    ),
  }).isRequired,
  currentUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  unreadCount: PropTypes.number,
  onOpen: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

ChatListItem.defaultProps = {
  unreadCount: 0,
};

export default ChatListItem;
