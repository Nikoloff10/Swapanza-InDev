import React, { memo } from 'react';
import PropTypes from 'prop-types';
import UserAvatar from './UserAvatar';

import './styles/ChatMessage.css';

/**
 * ChatMessage - Renders a single chat message bubble
 * Handles both normal messages and Swapanza (identity-swapped) messages
 */
function ChatMessage({ message, isCurrentUser, participants, swapanzaPartner }) {
  const isDuringSwapanza = message.during_swapanza === true;
  const isPending = message.pending === true;

  // Format timestamp as hh:mm
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Build message bubble styles (semantic classes)
  let messageStyle = 'msg-bubble';

  if (isCurrentUser) {
    messageStyle += isDuringSwapanza ? ' msg-sent-swapanza' : ' msg-sent';
  } else {
    messageStyle += isDuringSwapanza ? ' msg-received-swapanza' : ' msg-received';
  }

  if (isPending) {
    messageStyle += ' msg-pending';
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
        <UserAvatar
          username={displayUsername}
          profileImageUrl={profileImage}
          size="sm"
          className="avatar-bg-green shadow-md"
        />
      )}

      {/* Message bubble */}
      <div className={messageStyle}>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</div>
        <div className="text-xs mt-2 opacity-75 flex justify-between items-center gap-4">
          <span className="font-medium">{isCurrentUser ? 'You' : displayUsername}</span>
          <div className="flex items-center space-x-2">
            {isPending && <span className="text-xs italic text-yellow-600">Sending...</span>}
            {!isPending && message.created_at && (
              <span className="text-xs">{formatTime(message.created_at)}</span>
            )}
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
    created_at: PropTypes.string,
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
