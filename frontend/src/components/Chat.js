import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const Chat = ({ chatId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const token = localStorage.getItem('token');
  const currentUserId = localStorage.getItem('userId');

  const fetchMessages = useCallback(async () => {
    try {
      const response = await axios.get(`/api/messages/${chatId}/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }, [chatId, token]);

  useEffect(() => {
    if (chatId) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [chatId, fetchMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await axios.post(`/api/messages/${chatId}/`, {
        content: newMessage,
        chat: chatId
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-white">
        <h3 className="text-lg font-semibold">Chat</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-4 flex ${msg.sender === currentUserId ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[70%] rounded-lg px-4 py-2 ${msg.sender === currentUserId
              ? 'bg-blue-500 text-white'
              : 'bg-white border border-gray-200'
              }`}>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-white border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 p-2 border rounded"
            placeholder="Type a message..."
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <button
            onClick={handleSendMessage}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;