import React, { useState, useRef, useEffect, memo } from 'react';

function Chat({ chat, currentUserId, messages = [], sendMessage }) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!chat) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Loading chat...</h3>
        </div>
      </div>
    );
  }

  // Filter out current user's entry to get the other participant(s)
  const otherParticipants = chat.participants.filter(
    (participant) => Number(participant.id) !== Number(currentUserId)
  );
  // Use the first other participant for the chat title.
  const otherParticipant = otherParticipants[0] || { username: 'Unknown' };

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
    // Remove this unused variable:
    // const messageCountBySender = {};
    
    // Set appropriate styles based on who sent the message
    const messageWrapperStyle = isCurrentUser
      ? 'flex justify-end mb-2'  // Right-aligned for current user
      : 'flex justify-start mb-2';  // Left-aligned for other users
      
    const messageStyle = isCurrentUser
      ? 'bg-blue-500 text-white rounded-l-lg rounded-tr-lg px-4 py-2 max-w-xs break-words'  // Blue for current user
      : 'bg-gray-200 text-gray-900 rounded-r-lg rounded-tl-lg px-4 py-2 max-w-xs break-words';  // Gray for others
  
    // Get sender's username
    const senderUsername = chat.participants.find(
      (p) => Number(p.id) === Number(msg.sender)
    )?.username || 'Unknown';
  
    return (
      <div className={messageWrapperStyle}>
        <div className={messageStyle}>
          <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
          <div className="text-xs mt-1 opacity-75">
            {isCurrentUser ? 'You' : senderUsername}
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