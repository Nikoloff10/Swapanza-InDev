import React, { useState, useEffect, useRef } from 'react';

function SwapanzaModal({
  isOpen,
  onClose,
  onConfirm,
  requestedBy,
  requestedByUsername,
  duration,
  userConfirmed,
}) {
  const [timeLeft, setTimeLeft] = useState(30); // 30 seconds countdown
  const timerRef = useRef(null);
  
  useEffect(() => {
    if (isOpen) {
      // Reset timer when modal opens
      setTimeLeft(30);
      
      // Start countdown
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const newValue = prev - 1;
          if (newValue <= 0) {
            clearInterval(timerRef.current);
            onClose();
            return 0;
          }
          return newValue;
        });
      }, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isOpen, onClose]);
  

  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
        <h2 className="text-2xl font-bold text-center mb-4">Swapanza Invitation</h2>
        
        <p className="text-center mb-6">
          {requestedBy === 'you' ? (
            <>You've sent a Swapanza invitation for <span className="font-semibold">{duration} minutes</span>. Please confirm to participate.</>
          ) : (
            <>
              <span className="font-semibold">{requestedByUsername}</span> has invited you to swap profiles for <span className="font-semibold">{duration} minutes</span>!
            </>
          )}
        </p>
        
        <div className="flex justify-center mb-6">
          <div className="h-24 w-24 rounded-full bg-purple-600 flex items-center justify-center">
            <span className="text-white text-4xl font-bold">{timeLeft}</span>
          </div>
        </div>
        
        {/* Always show the confirm button for both sender and recipient */}
        <button
          onClick={onConfirm}
          disabled={userConfirmed}
          className={`w-full p-3 rounded-lg ${
            userConfirmed 
              ? 'bg-green-500 text-white cursor-not-allowed' 
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {userConfirmed ? 'Confirmed!' : 'Confirm Participation'}
        </button>
        
        {/* Show cancel button for both users */}
        <button
          onClick={onClose}
          className="w-full mt-2 p-3 rounded-lg bg-gray-300 hover:bg-gray-400"
        >
          Cancel
        </button>
        
        {userConfirmed && (
          <p className="text-center text-sm mt-2 text-gray-500">
            Waiting for the other user to confirm...
          </p>
        )}
        
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="font-medium text-purple-800 mb-2">About Swapanza</h3>
          <ul className="text-sm text-gray-600 space-y-1 pl-4 list-disc">
            <li>Swap your online profiles temporarily</li>
            <li>Limited to 2 messages each during Swapanza</li>
            <li>Maximum 7 characters per message</li>
            <li>No spaces allowed in messages</li>
            <li>Messages will be permanently linked to your profile</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default SwapanzaModal;