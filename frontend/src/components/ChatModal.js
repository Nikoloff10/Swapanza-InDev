import React, { useState, useEffect, useCallback } from 'react';
import Chat from './Chat';

const ChatModal = ({ chatId, onClose, onMessageSend }) => {
  const token = localStorage.getItem('token');
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const currentUserId = Number(localStorage.getItem('userId'));

  // Retrieve CSRF token from cookies.
  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  // Set fetch credentials and CSRF header on mount.
  useEffect(() => {
    // (No axios defaults to set since we're using fetch.)
  }, []);

  // Fetch chat and its messages.
  const fetchChat = useCallback(async () => {
    if (!token || !chatId) return;
    try {
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
      setMessages(fetchedChat.messages || []);
    } catch (error) {
      console.error('Error fetching chat:', error);
    }
  }, [chatId, token, currentUserId]);

  useEffect(() => {
    fetchChat();
  }, [fetchChat]);

  // Change: Use fetch instead of axios and update messages optimistically.
  const sendMessage = async (content) => {
    if (!content.trim() || !token || !chatId) return;
    const idToUse = chat ? Number(chat.id) : Number(chatId);
    try {
      const res = await fetch(`/api/chats/${idToUse}/messages/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-CSRFToken': getCookie('csrftoken')
        },
        credentials: 'include',
        body: JSON.stringify({ content })
      });
      if (!res.ok) {
        // Log response error details if available.
        const errorData = await res.text();
        throw new Error(`Server error: ${res.status} ${res.statusText}\n${errorData}`);
      }
      const newMessage = await res.json();
      // Append the new message optimistically.
      setMessages((prevMessages) => [...prevMessages, newMessage]);
      if (onMessageSend) {
        onMessageSend();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-3/4 h-3/4 flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">Chat</h2>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <Chat
            chat={chat}
            currentUserId={currentUserId}
            messages={messages}
            sendMessage={sendMessage}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatModal;