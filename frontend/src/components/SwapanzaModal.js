import React, { useState, useEffect, useRef } from 'react';
import { FaClock, FaInfoCircle, FaCheck, FaTimes } from 'react-icons/fa';
import { SWAPANZA, INTERVALS } from '../constants';

function SwapanzaModal({
  isOpen,
  onClose,
  onConfirm,
  requestedBy,
  requestedByUsername,
  duration,
  userConfirmed,
}) {
  const [timeLeft, setTimeLeft] = useState(SWAPANZA.INVITE_TIMEOUT_SECONDS);
  const timerRef = useRef(null);
  
  useEffect(() => {
    if (isOpen) {
      // Reset timer when modal opens
      setTimeLeft(SWAPANZA.INVITE_TIMEOUT_SECONDS);
      
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
      }, INTERVALS.COUNTDOWN_TICK_MS);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Swapanza Invitation</h2>
            <p className="text-purple-100">
              {requestedBy === 'you' ? (
                <>You&apos;ve sent a Swapanza invitation for <span className="font-semibold">{duration} minutes</span></>
              ) : (
                <>
                  <span className="font-semibold">{requestedByUsername}</span> has invited you to swap profiles!
                </>
              )}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Timer */}
          <div className="text-center mb-6">
            <div className="relative inline-block">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center shadow-lg">
                <span className="text-white text-3xl font-bold">{timeLeft}</span>
              </div>
              <FaClock className="absolute -top-2 -right-2 text-purple-600 bg-white rounded-full p-1 w-5 h-5" />
            </div>
            <p className="text-sm text-gray-600 mt-2">Seconds to respond</p>
          </div>

          {/* Duration Info */}
          <div className="bg-purple-50 rounded-lg p-4 mb-6 text-center">
            <div className="flex items-center justify-center space-x-2 text-purple-700">
              <FaClock className="w-4 h-4" />
              <span className="font-medium">Duration: {duration} minutes</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={onConfirm}
              disabled={userConfirmed}
              className={`w-full p-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2 ${
                userConfirmed 
                  ? 'bg-green-500 text-white cursor-not-allowed' 
                  : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-lg transform hover:-translate-y-0.5'
              }`}
            >
              <FaCheck className="w-4 h-4" />
              <span>{userConfirmed ? 'Confirmed!' : 'Confirm Participation'}</span>
            </button>
            
            <button
              onClick={onClose}
              className="w-full p-4 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <FaTimes className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>

          {/* Status Message */}
          {userConfirmed && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-sm text-green-700 font-medium">
                ✅ Waiting for the other user to confirm...
              </p>
            </div>
          )}

          {/* About Swapanza */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center space-x-2 mb-3">
              <FaInfoCircle className="text-purple-600 w-5 h-5" />
              <h3 className="font-semibold text-gray-900">About Swapanza</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <span>Swap your online profiles temporarily</span>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <span>Limited to 2 messages each during Swapanza</span>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <span>Maximum 7 characters per message</span>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0"></div>
                <span>No spaces allowed in messages</span>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800 text-center">
              ⚠️ Messages will be permanently linked to your profile
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SwapanzaModal;