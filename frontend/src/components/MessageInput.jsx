import React from 'react';
import PropTypes from 'prop-types';
import './styles/MessageInput.css';

/**
 * MessageInput - Chat message input field with send button
 */
function MessageInput({
  value,
  onChange,
  onSend,
  disabled,
  isSwapanzaActive,
  remainingMessages,
  connectionStatus,
}) {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const isSendDisabled =
    !value.trim() ||
    connectionStatus !== 'connected' ||
    (isSwapanzaActive && remainingMessages <= 0) ||
    disabled;

  // Button styling based on state
  const buttonClass = isSendDisabled
    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
    : isSwapanzaActive
      ? 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-lg transform hover:-translate-y-0.5'
      : 'btn-primary';

  return (
    <div className="message-input-wrapper">
      <div className="flex space-x-3">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isSwapanzaActive ? 'Max 7 chars, no spaces (2 msgs)' : 'Type a message...'}
          className="input-field flex-1"
          disabled={disabled}
        />
        <button
          onClick={onSend}
          disabled={isSendDisabled}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${buttonClass}`}
        >
          Send
        </button>
      </div>
    </div>
  );
}

MessageInput.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onSend: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  isSwapanzaActive: PropTypes.bool,
  remainingMessages: PropTypes.number,
  connectionStatus: PropTypes.string.isRequired,
};

MessageInput.defaultProps = {
  disabled: false,
  isSwapanzaActive: false,
  remainingMessages: 2,
};

export default MessageInput;
