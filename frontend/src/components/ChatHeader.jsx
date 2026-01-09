import React from 'react';
import PropTypes from 'prop-types';
import UserAvatar from './UserAvatar';
import './styles/ChatHeader.css';

/**
 * ChatHeader - Header section of chat modal
 * Shows participant info, connection status, and action buttons
 */
function ChatHeader({
  otherParticipant,
  connectionStatus,
  isSwapanzaActive,
  onSwapanzaClick,
  onClose,
}) {
  const statusColors = {
    connected: 'bg-green-300',
    connecting: 'bg-yellow-300',
    disconnected: 'bg-red-300',
    error: 'bg-red-300',
  };

  const statusText = {
    connected: 'Connected',
    connecting: 'Connecting...',
    disconnected: 'Disconnected',
    error: 'Error',
  };

  return (
    <div className="chat-header">
      <div className="flex items-center justify-between">
        {/* Left side - Avatar and name */}
        <div className="flex items-center space-x-3">
          {otherParticipant && (
            <UserAvatar
              username={otherParticipant.username}
              profileImageUrl={otherParticipant.profile_image_url}
              size="md"
              className="chat-avatar user-avatar--clickable mr-3 ring-2"
            />
          )}
          <div>
            <h2 className="text-xl font-semibold">{otherParticipant?.username || 'Chat'}</h2>
            <div className="flex items-center space-x-2 text-sm">
              <span
                className={`w-2 h-2 rounded-full ${statusColors[connectionStatus] || statusColors.disconnected}`}
              />
              <span className="status-text">{statusText[connectionStatus] || 'Unknown'}</span>
            </div>
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center space-x-3">
          {!isSwapanzaActive && (
            <button
              onClick={onSwapanzaClick}
              className="btn-ghost btn-swapanza"
              title="Start Swapanza"
            >
              Swapanza
            </button>
          )}
          <button
            onClick={onClose}
            className="chat-close-btn"
            aria-label="Close chat"
            title="Close chat"
          >
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

ChatHeader.propTypes = {
  otherParticipant: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    username: PropTypes.string.isRequired,
    profile_image_url: PropTypes.string,
  }),
  connectionStatus: PropTypes.oneOf(['connected', 'connecting', 'disconnected', 'error'])
    .isRequired,
  isSwapanzaActive: PropTypes.bool,
  onSwapanzaClick: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default ChatHeader;
