import React, { useState, useRef, useEffect, memo, useMemo } from 'react';
import MemoizedMessage from './MemoizedMessage';
function Chat({ chat, currentUserId, messages = [], sendMessage }) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Compute the other participant using useMemo
  const otherParticipant = useMemo(() => {
    if (!chat || !chat.participants) return { username: 'Unknown' };
    
    // Filter out current user to get other participants
    const otherParticipants = chat.participants.filter(
      participant => Number(participant.id) !== Number(currentUserId)
    );
    
    // Use the first other participant or default to unknown
    return otherParticipants[0] || { username: 'Unknown' };
  }, [chat, currentUserId]);

  if (!chat) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Loading chat...</h3>
        </div>
      </div>
    );
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessage(newMessage);
      setNewMessage('');
    }
  };

  // Group messages by sender to track sequences
  

  // Memoize the message rendering
  const MemoizedMessage = memo(({ msg, isCurrentUser, chat }) => {
    // Always use the message's during_swapanza property directly
    const isDuringSwapanza = msg.during_swapanza === true;
    const isPending = msg.pending === true;
  
    let messageStyle = isCurrentUser
      ? `${
          isDuringSwapanza ? "bg-purple-500" : "bg-blue-500"
        } text-white rounded-l-lg rounded-tr-lg px-4 py-2 max-w-xs break-words`
      : `${
          isDuringSwapanza ? "bg-purple-200" : "bg-gray-200"
        } text-gray-900 rounded-r-lg rounded-tl-lg px-4 py-2 max-w-xs break-words`;
  
    if (isPending) {
      messageStyle += " opacity-70";
    }
  
    // Determine which user to show based on message attributes
    let displayUsername, profileImage;
  
    if (isDuringSwapanza) {
      if (msg.apparent_sender) {
        // Use the apparent_sender from the message itself
        const apparentSender = chat.participants.find(
          (p) => Number(p.id) === Number(msg.apparent_sender)
        );
        displayUsername = apparentSender?.username || "Unknown";
        profileImage = apparentSender?.profile_image_url || null;
      } else {
        // Default to the actual sender (fallback)
        const sender = chat.participants.find(
          (p) => Number(p.id) === Number(msg.sender)
        );
        displayUsername = sender?.username || "Unknown";
        profileImage = sender?.profile_image_url || null;
      }
    } else {
      // For normal messages, show the actual sender
      const sender = chat.participants.find(
        (p) => Number(p.id) === Number(msg.sender)
      );
      displayUsername = sender?.username || "Unknown";
      profileImage = sender?.profile_image_url || null;
    }
  
    return (
      <div className="flex items-end">
        {!isCurrentUser && (
          <div className="h-6 w-6 rounded-full bg-gray-300 mr-2 flex-shrink-0 overflow-hidden">
            {profileImage ? (
              <img
                src={profileImage}
                alt={displayUsername}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <span className="text-xs">
                  {displayUsername[0]?.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        )}
  
        <div className={messageStyle}>
          <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
          <div className="text-xs mt-1 opacity-75 flex justify-between">
            <span>{isCurrentUser ? "You" : displayUsername}</span>
            <span>
              {isPending && (
                <span className="ml-2 text-xs italic">Sending...</span>
              )}
              {isDuringSwapanza && (
                <span className="ml-2 text-xs font-bold">Swapanza</span>
              )}
            </span>
          </div>
        </div>
      </div>
    );
  });

  
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        {/* Display chat title using first non-current participant */}
        <h3 className="text-lg font-semibold">
          Chat with {otherParticipant.username}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.map((msg, index) => {
          const isCurrentUser = Number(msg.sender) === Number(currentUserId);
          return (
            <div
              key={index}
              className={`mb-4 flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
            >
              <MemoizedMessage
                msg={msg}
                isCurrentUser={isCurrentUser}
                chat={chat}
              />
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 p-2 border rounded"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default Chat;