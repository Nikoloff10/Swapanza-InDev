import React, { useState, useEffect, useRef } from 'react';
import { FaClock, FaInfoCircle, FaCheck, FaTimes } from 'react-icons/fa';
import { SWAPANZA, INTERVALS } from '../constants';
import './styles/SwapanzaModal.css';

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
        setTimeLeft((prev) => {
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
      <div className="modal-content modal-md">
        {/* Header */}
        <div className="modal-header-gradient">
          <div>
            <h2 className="modal-title-large">Swapanza Invitation</h2>
            <p className="modal-subtext">
              {requestedBy === 'you' ? (
                <>
                  You&apos;ve sent a Swapanza invitation for{' '}
                  <span className="font-semibold">{duration} minutes</span>
                </>
              ) : (
                <>
                  <span className="font-semibold">{requestedByUsername}</span> has invited you to
                  swap profiles!
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
              <div className="countdown-badge">
                <span className="text-white text-3xl font-bold">{timeLeft}</span>
              </div>
              <FaClock className="badge-icon" />
            </div>
            <p className="modal-text">Seconds to respond</p>
          </div>

          {/* Duration Info */}
          <div className="info-box--purple">
            <div className="flex items-center justify-center" style={{ gap: '0.5rem' }}>
              <FaClock className="" />
              <span className="font-medium">Duration: {duration} minutes</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={onConfirm}
              disabled={userConfirmed}
              className={`btn-confirm ${userConfirmed ? 'btn-confirmed' : ''}`}
            >
              <FaCheck />
              <span>{userConfirmed ? 'Confirmed!' : 'Confirm Participation'}</span>
            </button>

            <button onClick={onClose} className="btn-secondary">
              <FaTimes />
              <span>Cancel</span>
            </button>
          </div>

          {/* Status Message */}
          {userConfirmed && (
            <div className="status-message">
              <p className="text-sm font-medium">Waiting for the other user to confirm...</p>
            </div>
          )}

          {/* About Swapanza */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center" style={{ gap: '0.5rem', marginBottom: '0.75rem' }}>
              <FaInfoCircle className="" />
              <h3 className="modal-subtitle">About Swapanza</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600">
              <div className="flex items-start" style={{ gap: '0.5rem' }}>
                <div
                  className="w-2 h-2"
                  style={{ background: '#c4b5fd', borderRadius: '9999px', marginTop: '0.5rem' }}
                ></div>
                <span>Swap your online profiles temporarily</span>
              </div>
              <div className="flex items-start" style={{ gap: '0.5rem' }}>
                <div
                  className="w-2 h-2"
                  style={{ background: '#c4b5fd', borderRadius: '9999px', marginTop: '0.5rem' }}
                ></div>
                <span>Limited to 2 messages each during Swapanza</span>
              </div>
              <div className="flex items-start" style={{ gap: '0.5rem' }}>
                <div
                  className="w-2 h-2"
                  style={{ background: '#c4b5fd', borderRadius: '9999px', marginTop: '0.5rem' }}
                ></div>
                <span>Maximum 7 characters per message</span>
              </div>
              <div className="flex items-start" style={{ gap: '0.5rem' }}>
                <div
                  className="w-2 h-2"
                  style={{ background: '#c4b5fd', borderRadius: '9999px', marginTop: '0.5rem' }}
                ></div>
                <span>No spaces allowed in messages</span>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="warning-box">
            <p className="text-xs text-center">
              Warning: Messages will be permanently linked to your profile
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SwapanzaModal;
