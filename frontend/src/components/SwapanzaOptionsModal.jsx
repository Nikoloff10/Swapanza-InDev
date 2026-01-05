import React from 'react';
import PropTypes from 'prop-types';
import { SWAPANZA } from '../constants';

/**
 * SwapanzaOptionsModal - Modal to configure and start a Swapanza session
 */
function SwapanzaOptionsModal({ isOpen, duration, onDurationChange, onStart, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Start Swapanza</h3>

          <p className="mb-6 text-gray-600">
            Swap identities with your chat partner for the specified duration. During Swapanza, each
            user can send up to {SWAPANZA.MESSAGE_LIMIT} messages of max 7 characters with no
            spaces.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duration (minutes)
            </label>
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

          <div className="flex space-x-3">
            <button onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={onStart} className="btn-primary flex-1">
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
