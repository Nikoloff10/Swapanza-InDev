import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import axios from 'axios';

function ChatModal({ chatId, onClose, onMessagesRead, onNewMessage }) {
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const ws = useRef(null);
  const messagesEndRef = useRef(null);

  const [currentUserId, setCurrentUserId] = useState(Number(localStorage.getItem('userId') || 0));
  const wsRetryCount = useRef(0);
  const token = localStorage.getItem('token');

  const otherParticipant = useMemo(() => {
    if (!chat || !chat.participants || !currentUserId) return null;
    return chat.participants.find(p => Number(p.id) !== Number(currentUserId)) || null;
  }, [chat, currentUserId]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Set up WebSocket connection to chat
  const setupWebSocket = useCallback(() => {
    if (!chatId || !token) return;
    
    // Close existing websocket if open
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.close();
    }
    
    try {
      setConnectionStatus('connecting');
      const host = window.location.hostname;
      const wsUrl = `ws://${host}:8000/ws/chat/${chatId}/?token=${token}`;
      console.log(`Setting up WebSocket connection to: ${wsUrl}`);
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setConnectionStatus('connected');
        wsRetryCount.current = 0; // Reset retry count on successful connection
        
        // Call onMessagesRead when the WebSocket connection is established
        if (onMessagesRead) onMessagesRead();
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          
          if (data.type === 'chat.message') {
            // Add new message to the chat
            const message = data.message;
            console.log('New message received:', message);
            
            // Make sure message has all required fields
            if (message && message.id && message.content && message.sender) {
              setMessages((prevMessages) => {
                // Check if message already exists to avoid duplicates
                if (prevMessages.some(m => m.id === message.id)) {
                  return prevMessages;
                }
                return [...prevMessages, message];
              });
              
              // Call onMessagesRead if it's our own message
              if (Number(message.sender) === Number(currentUserId)) {
                // No need to call onMessagesRead for own messages
              } else {
                // For messages from others, call onNewMessage if provided
                if (onNewMessage) {
                  console.log('Calling onNewMessage callback');
                  onNewMessage();
                }
              }
            } else {
              console.error('Invalid message format:', message);
            }
          } else if (data.type === 'chat.messages_read') {
            // Update messages as read in the UI
            console.log('Messages marked as read by user:', data.user_id);
            // If onMessagesRead is provided, call it
            if (onMessagesRead) {
              console.log('Calling onMessagesRead callback');
              onMessagesRead();
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = (e) => {
        console.log('WebSocket closed:', e);
        setConnectionStatus('disconnected');

        // Only try to reconnect if not closing intentionally
        if (e.code !== 1000) {
          // Exponential backoff for reconnection
          const timeout = Math.min(1000 * (2 ** wsRetryCount.current), 30000);
          wsRetryCount.current += 1;
          
          console.log(`Reconnecting in ${timeout / 1000} seconds...`);
          setTimeout(() => {
            if (document.visibilityState === 'visible') {
              setupWebSocket();
            }
          }, timeout);
        }
      };

      ws.current.onerror = (e) => {
        console.error('WebSocket error:', e);
        setConnectionStatus('error');
      };
      
    } catch (error) {
      console.error('WebSocket setup error:', error);
      setConnectionStatus('error');
    }
  }, [chatId, token, currentUserId, onMessagesRead, onNewMessage]);

  // Fetch chat details
  const fetchChat = useCallback(async () => {
    if (!chatId || !token) return;

    try {
      setLoading(true);
      const response = await axios.get(`/api/chats/${chatId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setChat(response.data);
      setMessages(response.data.messages || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching chat:', error);
      setError(error.message || 'Failed to fetch chat');
      setLoading(false);
    }
  }, [chatId, token]);

  useEffect(() => {
    // Find the current user's ID from the chat participants when chat is loaded
    if (chat && chat.participants) {
      // Get current username from localStorage, which should be more reliable
      const currentUsername = localStorage.getItem('username');
      
      if (currentUsername) {
        // Find the participant with matching username
        const currentUser = chat.participants.find(p => p.username === currentUsername);
        
        if (currentUser) {
          console.log('Found current user in participants:', currentUser);
          // Set the currentUserId based on the found participant
          setCurrentUserId(Number(currentUser.id));
        } else {
          console.warn('Current username not found in chat participants');
        }
      } else {
        console.warn('No username found in localStorage');
      }
    }
  }, [chat]);

  // Initialize: fetch chat and set up WebSocket
  useEffect(() => {
    fetchChat();
    setupWebSocket();
    
    return () => {
      // Clean up WebSocket connection when component unmounts
      if (ws.current) {
        ws.current.close(1000, 'Component unmounted');
      }
    };
  }, [chatId, fetchChat, setupWebSocket]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle sending a new message
  const sendMessage = () => {
    if (!newMessage.trim() || connectionStatus !== 'connected') return;
  
    if (ws.current?.readyState === WebSocket.OPEN) {
      // Send the message through WebSocket
      ws.current.send(
        JSON.stringify({
          type: 'chat.message',
          content: newMessage.trim()
        })
      );
  
      // Clear the input field
      setNewMessage('');
    } else {
      console.error('WebSocket is not connected');
      setConnectionStatus('error');
    }
  };

  // Track the count of messages by each sender (for styling)
  

  // Render a message component with memoization
  const MemoizedMessage = memo(({ msg, isCurrentUser, chat }) => {
    // Don't add flex justify-end/start here, as it's now in the parent wrapper
    const messageStyle = isCurrentUser
      ? 'bg-blue-500 text-white rounded-l-lg rounded-tr-lg px-4 py-2 max-w-xs break-words'
      : 'bg-gray-200 text-gray-900 rounded-r-lg rounded-tl-lg px-4 py-2 max-w-xs break-words';
    
    // Get sender's username and profile image - FIXED: Always get from chat participants data
    const sender = chat.participants.find(
      (p) => Number(p.id) === Number(msg.sender)
    );
    const senderUsername = sender?.username || 'Unknown';
    
    return (
      <div className="flex items-end">
        {/* Show profile image for other users' messages */}
        {!isCurrentUser && (
          <div className="h-6 w-6 rounded-full bg-gray-300 mr-2 flex-shrink-0 overflow-hidden">
            {sender?.profile_image_url ? (
              <img 
                src={sender.profile_image_url}
                alt={senderUsername}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <span className="text-xs">{senderUsername[0]?.toUpperCase()}</span>
              </div>
            )}
          </div>
        )}
        
        <div className={messageStyle}>
          <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
          <div className="text-xs mt-1 opacity-75">
            {isCurrentUser ? 'You' : senderUsername}
          </div>
        </div>
        
        {/* Show profile image for current user's messages on the right */}
        {isCurrentUser && (
          <div className="h-6 w-6 rounded-full bg-gray-300 ml-2 flex-shrink-0 overflow-hidden">
            {/* FIXED: Use the sender object from chat participants instead of localStorage */}
            {sender?.profile_image_url ? (
              <img 
                src={sender.profile_image_url}
                alt="You"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <span className="text-xs">{senderUsername[0]?.toUpperCase() || '?'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  });

  if (loading) return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">Loading...</div>;
  if (error) return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">Error: {error}</div>;
  if (!chat) return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">Chat not found</div>;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center">
            {/* Profile image of other user */}
            {otherParticipant && (
              <div className="h-8 w-8 rounded-full bg-gray-300 mr-2 overflow-hidden">
                {otherParticipant.profile_image_url ? (
                  <img 
                    src={otherParticipant.profile_image_url}
                    alt={otherParticipant.username}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <span className="text-sm">{otherParticipant.username[0]?.toUpperCase()}</span>
                  </div>
                )}
              </div>
            )}
            <h2 className="text-xl font-semibold">
              {otherParticipant ? otherParticipant.username : 'Chat'}
            </h2>
          </div>
          <div className="flex items-center">
            <span className="mr-2 text-sm">
              {connectionStatus === 'connected' ? (
                <span className="text-green-500">●</span>
              ) : connectionStatus === 'connecting' ? (
                <span className="text-yellow-500">●</span>
              ) : (
                <span className="text-red-500">●</span>
              )}
            </span>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: '60vh' }}>
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 my-4">No messages yet</div>
          ) : (
            messages.map((msg) => {
              console.log('Message data:', {
                msgSender: msg.sender,
                msgSenderId: Number(msg.sender),
                currentUserId: currentUserId,
                isCurrentUser: Number(msg.sender) === Number(currentUserId)
              });
              const isCurrentUser = Number(msg.sender) === Number(currentUserId);
              return (
                <div 
                  key={msg.id} 
                  className={isCurrentUser ? 'flex justify-end mb-2' : 'flex justify-start mb-2'}
                >
                  <MemoizedMessage
                    msg={msg}
                    isCurrentUser={isCurrentUser}
                    chat={chat}
                  />
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="border-t p-2 flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 border rounded-l p-2"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || connectionStatus !== 'connected'}
            className={`px-4 py-2 rounded-r ${
              !newMessage.trim() || connectionStatus !== 'connected'
                ? 'bg-gray-300 text-gray-500'
                : 'bg-blue-500 text-white'
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatModal;