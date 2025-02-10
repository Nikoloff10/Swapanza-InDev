import React from 'react';
import Chat from './Chat';

const ChatModal = ({ chatId, onClose }) => {
  console.log("ChatModal rendered with chatId:", chatId);
  return (
    <div className="fixed top-0 left-0 w-full h-full bg-gray-500 bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-4 w-3/4 h-3/4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Chat</h2>
          <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">
            Close
          </button>
        </div>
        <div className="h-full">
          <Chat chatId={chatId} />
        </div>
      </div>
    </div>
  );
};

export default ChatModal;