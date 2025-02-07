import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const Chat = ({ chatId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [switchRequested, setSwitchRequested] = useState(false);
  const [switchTimer, setSwitchTimer] = useState(5);
  const [isSwitched, setIsSwitched] = useState(false);
  const [waitingForOtherUser, setWaitingForOtherUser] = useState(false);
  const [switchDurationTimer, setSwitchDurationTimer] = useState(300); // 5 minutes in seconds
  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');

  // Fetch messages when chat changes
  const fetchMessages = useCallback(async () => {
    if (chatId) {
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
    }
  }, [chatId, token]);

  useEffect(() => {
    if (chatId) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [chatId, fetchMessages]);

  // Handle switch duration countdown
  useEffect(() => {
    let timer;
    if (isSwitched) {
      timer = setInterval(() => {
        setSwitchDurationTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsSwitched(false);
            return 300;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSwitched]);


  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    // Validate message during switch state
    if (isSwitched) {
      if (newMessage.split(' ').length > 1 || newMessage.length > 15) {
        alert('During switch, messages must be single words with max 15 characters');
        return;
      }
    }

    try {
      await axios.post('/api/messages/create/', {
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

  const handleSwitchRequest = async () => {
    setSwitchRequested(true);
    let countdown = 5;
    const timer = setInterval(() => {
      countdown -= 1;
      setSwitchTimer(countdown);
      if (countdown === 0) {
        clearInterval(timer);
        setSwitchRequested(false);
      }
    }, 1000);

    try {
      await axios.patch(`/api/chats/${chatId}/switch/`, {
        action: 'request'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Error requesting switch:', error);
      setSwitchRequested(false);
    }
  };

  const handleSwitchAccept = async () => {
    try {
      const response = await axios.patch(`/api/chats/${chatId}/switch/`, {
        action: 'accept'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.data.message === "Switch activated") {
        setIsSwitched(true);
        setSwitchRequested(false);
        setWaitingForOtherUser(false);
        setSwitchDurationTimer(300); // Reset to 5 minutes
      } else {
        setWaitingForOtherUser(true);
      }
    } catch (error) {
      console.error('Error accepting switch:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="p-4 border-b bg-white">
        <h3 className="text-lg font-semibold">Chat</h3>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-4 flex ${msg.sender === username ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[70%] rounded-lg px-4 py-2 ${msg.sender === username
              ? 'bg-blue-500 text-white'
              : 'bg-white border border-gray-200'
              }`}>
              <div className="text-sm opacity-75">{msg.sender}</div>
              <div>{msg.content}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Switch status */}
      {isSwitched && (
        <div className="p-4 bg-blue-100 text-center">
          <p className="text-lg">Switch Active - Time Remaining:</p>
          <p className="text-3xl font-bold text-blue-600">
            {Math.floor(switchDurationTimer / 60)}:{String(switchDurationTimer % 60).padStart(2, '0')}
          </p>
        </div>
      )}

      {/* Switch request UI */}
      {switchRequested && !isSwitched && (
        <div className="p-4 bg-yellow-100">
          {waitingForOtherUser ? (
            <div className="text-center">
              <div className="text-lg mb-2">Waiting for other user to accept...</div>
              <div className="animate-pulse bg-yellow-500 h-2 rounded-full" />
            </div>
          ) : (
            <div className="text-center">
              <div className="text-4xl font-bold mb-2 text-yellow-600">
                {switchTimer}
              </div>
              <p className="mb-4 text-lg">Seconds to accept switch!</p>
              <button
                onClick={handleSwitchAccept}
                className="px-6 py-3 bg-green-500 text-white text-lg rounded-lg hover:bg-green-600 transform hover:scale-105 transition-all"
              >
                Accept Switch
              </button>
              <div className="w-full bg-gray-200 h-2 mt-4 rounded-full">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${(switchTimer / 5) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message input area */}
      <div className="p-4 bg-white border-t">
        <div className="flex gap-2">
          {!switchRequested && !isSwitched && (
            <button
              onClick={handleSwitchRequest}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Switch Lives
            </button>
          )}
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 p-2 border rounded"
            placeholder={isSwitched ? "Max 15 chars, one word only" : "Type a message..."}
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