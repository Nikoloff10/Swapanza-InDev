import React from 'react';
import PropTypes from 'prop-types';
import { FaBell } from 'react-icons/fa';
import UserAvatar from './UserAvatar';
import './styles/NotificationsDropdown.css';

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
    <div className="notifications-dropdown">
      <button
        onClick={onToggle}
        className="notif-toggle"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <FaBell className="notif-icon" />
        {totalUnread > 0 && (
          <span className="notif-badge" role="status" aria-label={`${totalUnread} unread`}>
            {totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notif-panel" role="menu" aria-label="Notifications panel">
          <div className="notif-panel-header">
            <span className="notif-panel-title">Notifications</span>
            <button onClick={onClearAll} className="notif-clear-btn">
              Clear All
            </button>
          </div>
          <div className="notif-list">
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
    <div className="notif-item" onClick={onClick} role="menuitem" tabIndex={0}>
      <div className="notif-item-row">
        <div className="notif-item-left">
          <UserAvatar username={username} profileImageUrl={profileImageUrl} size="sm" />
          <span className="notif-username">{username || 'Unknown'}</span>
        </div>
        <span
          className={`notif-pill ${isSwapanzaInvite ? 'notif-pill--swapanza' : 'notif-pill--count'}`}
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
    <div className="notif-empty">
      <p className="notif-empty-title">All caught up!</p>
      <p className="notif-empty-sub">No new messages</p>
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
