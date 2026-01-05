import React, { memo } from 'react';
import PropTypes from 'prop-types';

/**
 * ChatMessage - Renders a single chat message bubble
 * Handles both normal messages and Swapanza (identity-swapped) messages
 */
function ChatMessage({ message, isCurrentUser, participants, swapanzaPartner }) {
  const isDuringSwapanza = message.during_swapanza === true;
  const isPending = message.pending === true;

  // Build message bubble styles
  let messageStyle = isCurrentUser
    ? `${
        isDuringSwapanza
          ? 'bg-gradient-to-r from-purple-500 to-purple-600'
          : 'bg-gradient-to-r from-green-500 to-green-600'
      } text-white rounded-2xl rounded-tr-md px-4 py-3 max-w-xs break-words shadow-md`
    : `${
        isDuringSwapanza ? 'bg-gradient-to-r from-purple-100 to-purple-200' : 'bg-white'
      } text-gray-900 rounded-2xl rounded-tl-md px-4 py-3 max-w-xs break-words shadow-sm border border-gray-100`;

  if (isPending) {
    messageStyle += ' opacity-70';
  }

  // Determine display name and avatar
  let displayUsername;
  let profileImage;

  if (isDuringSwapanza) {
    if (isCurrentUser && swapanzaPartner) {
      // Current user's messages during Swapanza - show as partner
      displayUsername = swapanzaPartner.username;
      profileImage = swapanzaPartner.profile_image || null;
    } else if (message.apparent_sender_username) {
      // Use apparent sender info from server
      displayUsername = message.apparent_sender_username;
      profileImage = message.apparent_sender_profile_image || null;
    } else {
      // Fallback to actual sender
      const sender = participants?.find((p) => Number(p.id) === Number(message.sender));
      displayUsername = sender?.username || 'Unknown';
      profileImage = sender?.profile_image_url || null;
    }
  } else {
    // Normal messages - show actual sender
    const sender = participants?.find((p) => Number(p.id) === Number(message.sender));
    displayUsername = sender?.username || 'Unknown';
    profileImage = sender?.profile_image_url || null;
  }

  return (
    <div className="flex items-end space-x-3">
      {/* Avatar for other user's messages */}
      {!isCurrentUser && (
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md">
          {profileImage ? (
            <img src={profileImage} alt={displayUsername} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <span className="text-sm font-bold text-white">
                {displayUsername?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Message bubble */}
      <div className={messageStyle}>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</div>
        <div className="text-xs mt-2 opacity-75 flex justify-between items-center">
          <span className="font-medium">{isCurrentUser ? 'You' : displayUsername}</span>
          <div className="flex items-center space-x-2">
            {isPending && <span className="text-xs italic text-yellow-600">Sending...</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

ChatMessage.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    content: PropTypes.string.isRequired,
    sender: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    during_swapanza: PropTypes.bool,
    pending: PropTypes.bool,
    apparent_sender_username: PropTypes.string,
    apparent_sender_profile_image: PropTypes.string,
  }).isRequired,
  isCurrentUser: PropTypes.bool.isRequired,
  participants: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      username: PropTypes.string.isRequired,
      profile_image_url: PropTypes.string,
    })
  ),
  swapanzaPartner: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    username: PropTypes.string,
    profile_image: PropTypes.string,
  }),
};

// Memoize to prevent unnecessary re-renders
export default memo(ChatMessage);
