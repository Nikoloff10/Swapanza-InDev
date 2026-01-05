import React from 'react';
import PropTypes from 'prop-types';

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
    <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-t-xl flex-shrink-0">
      <div className="flex items-center justify-between">
        {/* Left side - Avatar and name */}
        <div className="flex items-center space-x-3">
          {otherParticipant && (
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm mr-3 overflow-hidden ring-2 ring-white/30">
              {otherParticipant.profile_image_url ? (
                <img
                  src={otherParticipant.profile_image_url}
                  alt={otherParticipant.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <span className="text-sm font-bold">
                    {otherParticipant.username[0]?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold">{otherParticipant?.username || 'Chat'}</h2>
            <div className="flex items-center space-x-2 text-sm">
              <span
                className={`w-2 h-2 rounded-full ${statusColors[connectionStatus] || statusColors.disconnected}`}
              />
              <span className="text-green-100">{statusText[connectionStatus] || 'Unknown'}</span>
            </div>
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center space-x-3">
          {!isSwapanzaActive && (
            <button
              onClick={onSwapanzaClick}
              className="px-4 py-2 text-sm bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors duration-200 backdrop-blur-sm"
              title="Start Swapanza"
            >
              Swapanza
            </button>
          )}
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors duration-200"
            aria-label="Close chat"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
