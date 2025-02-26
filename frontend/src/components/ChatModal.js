import React, { useState, useCallback, useEffect, useRef } from 'react';
import Chat from './Chat';

const ChatModal = ({ chatId, onClose, onMessagesRead }) => {
  const token = localStorage.getItem('token');
  const currentUserId = Number(localStorage.getItem('userId') || 0);
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const ws = useRef(null);
  const wsRetryCount = useRef(0);
  const maxRetries = 3;

  // Initial fetch to load chat details - only once
  const fetchChat = useCallback(async () => {
    if (!token || !chatId) return;
    
    setIsLoading(true);
    try {
      console.log('Fetching chat data once on initial load');
      const res = await fetch(`/api/chats/${chatId}/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!res.ok) {
        console.error('Error fetching chat:', await res.text());
        return;
      }
      
      const fetchedChat = await res.json();
      if (
        !fetchedChat.participants ||
        !fetchedChat.participants.find(
          (participant) => Number(participant.id) === currentUserId
        )
      ) {
        console.error('Current user is not a participant of this chat.');
        return;
      }
      
      setChat(fetchedChat);
      const sortedMessages = (fetchedChat.messages || []).sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );
      setMessages(sortedMessages);
      
      // Messages are now seen
      if (onMessagesRead) onMessagesRead();
    } catch (error) {
      console.error('Error fetching chat:', error);
    } finally {
      setIsLoading(false);
    }
  }, [chatId, token, currentUserId, onMessagesRead]);

  // Set up WebSocket for real-time updates
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
          
          if (data.chat) {
            setChat(data.chat);
            const sortedMessages = (data.chat.messages || []).sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at)
            );
            setMessages(sortedMessages);
            
            // Messages are now seen
            if (onMessagesRead) onMessagesRead();
          } else if (data.message) {
            setMessages((prevMessages) => {
              const newMessages = [...prevMessages, data.message];
              return newMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            });
            
            // If the message is from another user and is now seen, notify parent
            if (data.message.sender !== currentUserId && onMessagesRead) {
              onMessagesRead();
            }
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setConnectionStatus('disconnected');
        
        // Only retry a limited number of times
        if (wsRetryCount.current < maxRetries) {
          wsRetryCount.current++;
          console.log(`WebSocket reconnecting... Attempt ${wsRetryCount.current}/${maxRetries}`);
          setTimeout(setupWebSocket, 2000); // Retry after 2 seconds
        } else {
          console.log('Max WebSocket reconnect attempts reached');
          setConnectionStatus('failed');
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      setConnectionStatus('error');
    }
  }, [chatId, token, currentUserId, onMessagesRead]);

  // Load chat data and setup WebSocket only once when component mounts
  useEffect(() => {
    fetchChat();
    setupWebSocket();
    
    // Clean up WebSocket on unmount
    return () => {
      console.log('Cleaning up WebSocket connection');
      if (ws.current) {
        ws.current.onclose = null; // Prevent reconnection attempts on unmount
        if (ws.current.readyState === WebSocket.OPEN || 
            ws.current.readyState === WebSocket.CONNECTING) {
          ws.current.close();
        }
      }
    };
  }, [fetchChat, setupWebSocket]);

  const sendMessage = async (content) => {
    if (!content.trim()) return;
    
    // If WebSocket is open, send via WebSocket
    if (ws.current?.readyState === WebSocket.OPEN) {
      try {
        console.log('Sending message via WebSocket');
        ws.current.send(JSON.stringify({
          content,
          sender: currentUserId,
        }));
        return;
      } catch (error) {
        console.error('Error sending via WebSocket:', error);
      }
    }
    
    // If WebSocket is not available, fall back to HTTP
    console.log('WebSocket not available, falling back to HTTP');
    try {
      const response = await fetch(`/api/chats/${chatId}/messages/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content,
          chat: chatId,
          sender: currentUserId
        })
      });
      
      if (response.ok) {
        const messageData = await response.json();
        setMessages(prev => [...prev, messageData].sort(
          (a, b) => new Date(a.created_at) - new Date(b.created_at)
        ));
        // Try to reconnect WebSocket after HTTP fallback
        setupWebSocket();
      } else {
        console.error('HTTP fallback failed:', await response.text());
      }
    } catch (error) {
      console.error('Error sending message via HTTP:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-3/4 h-3/4 flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center">
            <h2 className="text-xl font-semibold">Chat</h2>
            {connectionStatus !== 'connected' && (
              <span className={`ml-2 px-2 py-1 text-xs rounded-full 
                ${connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' : 
                connectionStatus === 'disconnected' ? 'bg-orange-100 text-orange-800' : 
                'bg-red-100 text-red-800'}`}>
                {connectionStatus === 'connecting' ? 'Connecting...' : 
                connectionStatus === 'disconnected' ? 'Reconnecting...' : 
                'Connection Failed'}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <p>Loading chat...</p>
            </div>
          ) : (
            <Chat
              chat={chat}
              currentUserId={currentUserId}
              messages={messages}
              sendMessage={sendMessage}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatModal;