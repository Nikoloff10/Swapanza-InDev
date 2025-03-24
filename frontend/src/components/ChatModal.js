import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import axios from 'axios';
import SwapanzaModal from './SwapanzaModal';

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

  // Swapanza states:
  const [swapanzaDuration, setSwapanzaDuration] = useState(5);
  const [showSwapanzaOptions, setShowSwapanzaOptions] = useState(false);
  const [isSwapanzaRequested, setIsSwapanzaRequested] = useState(false);
  const [swapanzaRequestedBy, setSwapanzaRequestedBy] = useState(null);
  const [swapanzaRequestedByUsername, setSwapanzaRequestedByUsername] = useState(null);
  const [isSwapanzaActive, setIsSwapanzaActive] = useState(false);
  const [swapanzaEndTime, setSwapanzaEndTime] = useState(null);
  const [userConfirmedSwapanza, setUserConfirmedSwapanza] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [otherUserConfirmedSwapanza, setOtherUserConfirmedSwapanza] = useState(false);
  const [showSwapanzaModal, setShowSwapanzaModal] = useState(false);
  const [remainingMessages, setRemainingMessages] = useState(2);
  
  const swapanzaTimeLeftRef = useRef(null);
  // Track our sent messages that haven't been confirmed by the server yet
  const pendingMessages = useRef([]);

  const otherParticipant = useMemo(() => {
    if (!chat || !chat.participants || !currentUserId) return null;
    return chat.participants.find(p => Number(p.id) !== Number(currentUserId)) || null;
  }, [chat, currentUserId]);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Function to reset Swapanza state - define first to avoid circular dependencies
  const resetSwapanza = useCallback(() => {
    setIsSwapanzaActive(false);
    setShowSwapanzaModal(false);
    setIsSwapanzaRequested(false);
    setSwapanzaRequestedBy(null);
    setSwapanzaRequestedByUsername(null);
    setUserConfirmedSwapanza(false);
    setOtherUserConfirmedSwapanza(false);
    setRemainingMessages(2);
    setSwapanzaEndTime(null);
    
    if (swapanzaTimeLeftRef.current) {
      clearInterval(swapanzaTimeLeftRef.current);
    }
  }, []);

  // Function to start Swapanza countdown
  const startSwapanzaCountdown = useCallback((endTime) => {
    if (swapanzaTimeLeftRef.current) {
      clearInterval(swapanzaTimeLeftRef.current);
    }
    
    swapanzaTimeLeftRef.current = setInterval(() => {
      const now = new Date();
      const timeLeft = endTime - now;
      
      if (timeLeft <= 0) {
        clearInterval(swapanzaTimeLeftRef.current);
        resetSwapanza();
      }
    }, 1000);
  }, [resetSwapanza]);

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
            // Extract message from data
            const message = data.message || 
              (data.id && data.content && data.sender ? {
                id: data.id,
                content: data.content,
                sender: data.sender,
                created_at: data.timestamp || data.created_at,
                during_swapanza: data.during_swapanza,
              } : null);
            
            console.log('New message received:', message);
            
            // Make sure message has all required fields
            if (message && message.id && message.content && message.sender) {
              setMessages((prevMessages) => {
                // Check if message already exists to avoid duplicates
                if (prevMessages.some(m => m.id === message.id)) {
                  return prevMessages;
                }
          
                let updatedMessages = [...prevMessages];
                
                // If this is our own message, replace any pending message with the same content
                if (Number(message.sender) === Number(currentUserId)) {
                  // Find pending message with matching content to replace
                  const pendingIndex = updatedMessages.findIndex(
                    m => m.pending && m.content === message.content
                  );
                  
                  if (pendingIndex !== -1) {
                    // Replace the pending message with the confirmed one
                    updatedMessages[pendingIndex] = message;
                    
                    // Also remove from pending messages ref
                    const pendingRefIndex = pendingMessages.current.findIndex(
                      pm => pm.content === message.content
                    );
                    if (pendingRefIndex !== -1) {
                      pendingMessages.current.splice(pendingRefIndex, 1);
                    }
                    
                    return updatedMessages;
                  }
                }
                
                // If we didn't find a pending message to replace, just add the new message
                return [...updatedMessages, message];
              });
              
              // Update remaining messages if Swapanza is active
              if (isSwapanzaActive && message.during_swapanza && 
                  Number(message.sender) === Number(currentUserId)) {
                setRemainingMessages(prev => Math.max(0, prev - 1));
              }
              
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
          } else if (data.type === 'swapanza.request') {
            // Handle Swapanza request
            const isCurrentUserRequest = Number(data.requested_by) === Number(currentUserId);
            
            setIsSwapanzaRequested(true);
            setSwapanzaDuration(data.duration);
            setSwapanzaRequestedBy(data.requested_by);
            setSwapanzaRequestedByUsername(data.requested_by_username);
            
            // Show modal for recipient only
            if (!isCurrentUserRequest) {
              setShowSwapanzaModal(true);
            }
          } else if (data.type === 'swapanza.confirm') {
            // Handle Swapanza confirmation
            const isCurrentUser = Number(data.user_id) === Number(currentUserId);
            
            if (isCurrentUser) {
              setUserConfirmedSwapanza(true);
            } else {
              setOtherUserConfirmedSwapanza(true);
            }
          } else if (data.type === 'swapanza.activate') {
            // Handle Swapanza activation
            setIsSwapanzaActive(true);
            setShowSwapanzaModal(false);
            setIsSwapanzaRequested(false);
            setUserConfirmedSwapanza(false);
            setOtherUserConfirmedSwapanza(false);
            setRemainingMessages(2);  // Reset remaining messages
            
            // Store end time
            const endTime = new Date(data.ends_at);
            setSwapanzaEndTime(endTime);
            
            // Start countdown timer
            startSwapanzaCountdown(endTime);
          } else if (data.type === 'swapanza.expire') {
            // Handle Swapanza expiration
            resetSwapanza();
          } else if (data.type === 'error') {
            // Display error message
            console.error('Error from server:', data.message);
            alert(`Error: ${data.message}`);
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
  }, [chatId, token, currentUserId, onMessagesRead, onNewMessage, isSwapanzaActive, resetSwapanza, startSwapanzaCountdown]);

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
      
      // Check if chat has active Swapanza
      if (response.data.swapanza_active) {
        setIsSwapanzaActive(true);
        setSwapanzaDuration(response.data.swapanza_duration);
        
        // Calculate remaining messages
        const userMsgCount = response.data.swapanza_message_count?.[currentUserId] || 0;
        setRemainingMessages(Math.max(0, 2 - userMsgCount));
        
        // Set end time and start countdown
        if (response.data.swapanza_ends_at) {
          const endTime = new Date(response.data.swapanza_ends_at);
          setSwapanzaEndTime(endTime);
          startSwapanzaCountdown(endTime);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching chat:', error);
      setError(error.message || 'Failed to fetch chat');
      setLoading(false);
    }
  }, [chatId, token, currentUserId, startSwapanzaCountdown]);

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
      
      // Clear any active Swapanza timer
      if (swapanzaTimeLeftRef.current) {
        clearInterval(swapanzaTimeLeftRef.current);
      }

      // Clear pending messages on unmount
      pendingMessages.current = [];
    };
  }, [chatId, fetchChat, setupWebSocket]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Function to request a Swapanza
  const requestSwapanza = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'swapanza.request',
        duration: swapanzaDuration
      }));
      
      setShowSwapanzaOptions(false);
      setIsSwapanzaRequested(true);
      setSwapanzaRequestedBy('you');
    }
  };
  
  // Function to confirm participation in a Swapanza
  const confirmSwapanza = () => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'swapanza.confirm'
      }));
      
      setUserConfirmedSwapanza(true);
    }
  };

  // Handle sending a new message
  const sendMessage = () => {
    if (!newMessage.trim() || connectionStatus !== 'connected') return;
    
    // Apply Swapanza restrictions if active
    if (isSwapanzaActive) {
      const messageContent = newMessage.trim();
      
      // Check character limit and spaces
      if (messageContent.length > 7) {
        alert('During Swapanza, messages must be 7 characters or less');
        return;
      }
      
      if (messageContent.includes(' ')) {
        alert('During Swapanza, spaces are not allowed in messages');
        return;
      }
      
      // Check message count
      if (remainingMessages <= 0) {
        alert('You have reached your message limit during this Swapanza');
        return;
      }
    }
  
    if (ws.current?.readyState === WebSocket.OPEN) {
      const messageContent = newMessage.trim();
      
      // Create a temporary pending message
      const pendingMsg = {
        id: `pending-${Date.now()}`,
        content: messageContent,
        sender: currentUserId,
        created_at: new Date().toISOString(),
        during_swapanza: isSwapanzaActive,
        pending: true
      };
      
      // Add to pending messages
      pendingMessages.current.push(pendingMsg);
      
      // Add to displayed messages for immediate feedback
      setMessages(prevMessages => [...prevMessages, pendingMsg]);
      
      // Send through WebSocket
      ws.current.send(
        JSON.stringify({
          type: 'chat.message',
          content: messageContent
        })
      );
  
      // Clear the input field
      setNewMessage('');

      // If this is a Swapanza message, preemptively decrement count
      if (isSwapanzaActive) {
        setRemainingMessages(prev => Math.max(0, prev - 1));
      }
    } else {
      console.error('WebSocket is not connected');
      setConnectionStatus('error');
    }
  };

  // Render a message component with memoization
  const MemoizedMessage = memo(({ msg, isCurrentUser, chat }) => {
    // Check if message was sent during Swapanza
    const isDuringSwapanza = msg.during_swapanza;
    const isPending = msg.pending === true;
    
    // Add special styling for Swapanza messages
    let messageStyle = isCurrentUser
      ? `${isDuringSwapanza ? 'bg-purple-500' : 'bg-blue-500'} text-white rounded-l-lg rounded-tr-lg px-4 py-2 max-w-xs break-words`
      : `${isDuringSwapanza ? 'bg-purple-200' : 'bg-gray-200'} text-gray-900 rounded-r-lg rounded-tl-lg px-4 py-2 max-w-xs break-words`;
    
    // Add opacity for pending messages
    if (isPending) {
      messageStyle += ' opacity-70';
    }
    
    // Get sender's username and profile image
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
          <div className="text-xs mt-1 opacity-75 flex justify-between">
            <span>{isCurrentUser ? 'You' : senderUsername}</span>
            <span>
              {isPending && <span className="ml-2 text-xs italic">Sending...</span>}
              {isDuringSwapanza && (
                <span className="ml-2 text-xs font-bold">Swapanza</span>
              )}
            </span>
          </div>
        </div>
        
        {/* Show profile image for current user's messages on the right */}
        {isCurrentUser && (
          <div className="h-6 w-6 rounded-full bg-gray-300 ml-2 flex-shrink-0 overflow-hidden">
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

  // Render Swapanza section based on state
  const renderSwapanzaSection = () => {
    if (isSwapanzaActive) {
      // Show active Swapanza UI
      const timeLeft = swapanzaEndTime ? Math.max(0, Math.floor((swapanzaEndTime - new Date()) / 60000)) : 0;
      
      return (
        <div className="p-3 border-t bg-purple-100">
          <div className="flex justify-between items-center">
            <span className="text-purple-800 font-medium">Swapanza Active!</span>
            <span className="bg-purple-200 text-purple-800 px-2 py-1 rounded text-sm">
              {timeLeft} min left
            </span>
          </div>
          <p className="text-xs text-purple-700 mt-1">
            {remainingMessages}/2 messages left • Max 7 chars • No spaces
          </p>
        </div>
      );
    }
    
    if (isSwapanzaRequested) {
      // Show pending Swapanza request
      return (
        <div className="p-3 border-t bg-purple-50 text-center">
          <p className="text-sm text-purple-700">
            {swapanzaRequestedBy === 'you'
              ? `Swapanza invitation sent (${swapanzaDuration} min)`
              : `Swapanza invitation received (${swapanzaDuration} min)`
            }
          </p>
        </div>
      );
    }
    
    if (showSwapanzaOptions) {
      // Show Swapanza options form
      return (
        <div className="p-3 border-t bg-purple-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <label className="mr-2 text-sm">Duration (min):</label>
              <input
                type="number"
                min="1"
                max="60"
                value={swapanzaDuration}
                onChange={(e) => setSwapanzaDuration(Math.max(1, Math.min(60, Number(e.target.value))))}
                className="w-16 p-1 border rounded text-sm"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowSwapanzaOptions(false)}
                className="px-2 py-1 bg-gray-200 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={requestSwapanza}
                className="px-2 py-1 bg-purple-500 text-white rounded text-sm"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    // Show Swapanza button
    return (
      <div className="flex justify-center py-2 border-t">
        <button
          onClick={() => setShowSwapanzaOptions(true)}
          className="px-4 py-1 bg-purple-500 text-white rounded-full hover:bg-purple-600 text-sm"
        >
          Swapanza
        </button>
      </div>
    );
  };

  // Use the otherUserConfirmedSwapanza state to avoid ESLint warning
  const bothUsersConfirmed = userConfirmedSwapanza && otherUserConfirmedSwapanza;

  if (loading) return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">Loading...</div>;
  if (error) return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">Error: {error}</div>;
  if (!chat) return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">Chat not found</div>;

  // Combine server-returned messages with pending messages for display
  const allMessages = [...messages];

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
          {allMessages.length === 0 ? (
            <div className="text-center text-gray-500 my-4">No messages yet</div>
          ) : (
            allMessages.map((msg) => {
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
        
        {/* Swapanza section */}
        {renderSwapanzaSection()}
        
        {/* Display a message when both users confirm */}
        {bothUsersConfirmed && (
          <div className="p-2 bg-green-100 text-center text-green-800 text-sm">
            Both users have confirmed! Starting Swapanza...
          </div>
        )}
        
        <div className="border-t p-2 flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={isSwapanzaActive ? "Max 7 chars, no spaces (2 msgs)" : "Type a message..."}
            className="flex-1 border rounded-l p-2"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || connectionStatus !== 'connected' || (isSwapanzaActive && remainingMessages <= 0)}
            className={`px-4 py-2 rounded-r ${
              !newMessage.trim() || connectionStatus !== 'connected' || (isSwapanzaActive && remainingMessages <= 0)
                ? 'bg-gray-300 text-gray-500'
                : isSwapanzaActive ? 'bg-purple-500 text-white' : 'bg-blue-500 text-white'
            }`}
          >
            Send
          </button>
        </div>
      </div>
      
      {/* Swapanza Modal */}
      {showSwapanzaModal && (
        <SwapanzaModal
          isOpen={showSwapanzaModal}
          onClose={() => setShowSwapanzaModal(false)}
          onConfirm={confirmSwapanza}
          requestedBy={swapanzaRequestedBy === 'you' ? 'you' : 'other'}
          requestedByUsername={swapanzaRequestedByUsername}
          duration={swapanzaDuration}
          userConfirmed={userConfirmedSwapanza}
        />
      )}
    </div>
  );
}

export default ChatModal;