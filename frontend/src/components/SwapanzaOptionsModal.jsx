import React, { useRef } from 'react';
import './styles/SwapanzaOptionsModal.css';
import PropTypes from 'prop-types';
import { SWAPANZA } from '../constants';
import useClickOutside from '../hooks/useClickOutside';

/**
 * SwapanzaOptionsModal - Modal to configure and start a Swapanza session
 */
function SwapanzaOptionsModal({ isOpen, duration, onDurationChange, onStart, onClose }) {
  const modalRef = useRef(null);
  useClickOutside(modalRef, onClose);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      data-modal-root
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="modal-content modal-md"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="modal-subtitle mb-4">Start Swapanza</h3>

          <p className="modal-text mb-6">
            Swap identities with your chat partner for the specified duration. During Swapanza, each
            user can send up to {SWAPANZA.MESSAGE_LIMIT} messages of max 7 characters with no
            spaces.
          </p>

          <div className="mb-6">
            <label className="label mb-2">Duration (minutes)</label>
            <select
              value={duration}
              onChange={(e) => onDurationChange(Number(e.target.value))}
              className="input-field"
            >
              {SWAPANZA.DURATION_OPTIONS.map((mins) => (
                <option key={mins} value={mins}>
                  {mins} minutes
                </option>
              ))}
            </select>
          </div>

          <div className="modal-footer">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={onStart} className="btn-confirm flex-1">
              Start Swapanza
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

SwapanzaOptionsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  duration: PropTypes.number.isRequired,
  onDurationChange: PropTypes.func.isRequired,
  onStart: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default SwapanzaOptionsModal;
