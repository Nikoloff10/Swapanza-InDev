import React from 'react';
import PropTypes from 'prop-types';
import { FaBell } from 'react-icons/fa';
import UserAvatar from './UserAvatar';

/**
 * NotificationsDropdown - Notification bell with dropdown panel
 */
function NotificationsDropdown({
  isOpen,
  onToggle,
  unreadCounts,
  chats,
  currentUserId,
  totalUnread,
  onOpenChat,
  onClearAll,
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="p-3 bg-green-100 hover:bg-green-200 rounded-full transition-colors duration-200 relative"
      >
        <FaBell className="text-green-600 w-4 h-4" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl z-20 border border-gray-100">
          <div className="p-4 border-b border-gray-100 font-semibold flex justify-between items-center">
            <span className="text-gray-900">Notifications</span>
            <button
              onClick={onClearAll}
              className="text-sm text-green-600 hover:text-green-700 font-medium"
            >
              Clear All
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {Object.keys(unreadCounts).length > 0 ? (
              Object.entries(unreadCounts).map(([chatId, count]) => {
                const chat = chats.find((c) => c.id.toString() === chatId);
                const otherUser = chat?.participants?.find(
                  (p) => Number(p.id) !== Number(currentUserId)
                );
                const isSwapanzaInvite = count === -1;

                return (
                  <NotificationItem
                    key={chatId}
                    chatId={chatId}
                    username={otherUser?.username}
                    profileImageUrl={otherUser?.profile_image_url}
                    count={count}
                    isSwapanzaInvite={isSwapanzaInvite}
                    onClick={() => onOpenChat(Number(chatId))}
                  />
                );
              })
            ) : (
              <EmptyNotifications />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual notification item
 */
function NotificationItem({ username, profileImageUrl, count, isSwapanzaInvite, onClick }) {
  return (
    <div
      className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors duration-200"
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <UserAvatar username={username} profileImageUrl={profileImageUrl} size="sm" />
          <span className="font-medium text-gray-900">{username || 'Unknown'}</span>
        </div>
        <span
          className={`${
            isSwapanzaInvite ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
          } text-xs font-medium px-3 py-1 rounded-full`}
        >
          {isSwapanzaInvite ? 'Swapanza' : `${count} new`}
        </span>
      </div>
    </div>
  );
}

/**
 * Empty state for notifications
 */
function EmptyNotifications() {
  return (
    <div className="p-8 text-center text-gray-500">
      <p className="font-medium">All caught up!</p>
      <p className="text-sm">No new messages</p>
    </div>
  );
}

NotificationsDropdown.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  unreadCounts: PropTypes.object.isRequired,
  chats: PropTypes.array.isRequired,
  currentUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  totalUnread: PropTypes.number.isRequired,
  onOpenChat: PropTypes.func.isRequired,
  onClearAll: PropTypes.func.isRequired,
};

NotificationItem.propTypes = {
  username: PropTypes.string,
  profileImageUrl: PropTypes.string,
  count: PropTypes.number.isRequired,
  isSwapanzaInvite: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
};

export default NotificationsDropdown;
