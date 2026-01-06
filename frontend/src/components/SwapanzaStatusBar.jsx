import React from 'react';
import PropTypes from 'prop-types';

/**
 * SwapanzaStatusBar - Shows Swapanza status (active session or pending invite)
 */
function SwapanzaStatusBar({
  isSwapanzaActive,
  swapanzaEndTime,
  swapanzaStartTime,
  swapanzaPartner,
  timeLeft,
  remainingMessages,
  isSwapanzaRequested,
  swapanzaRequestedBy,
  swapanzaRequestedByUsername,
  currentUserId,
  userConfirmedSwapanza,
  partnerConfirmedSwapanza,
  onConfirm,
  onCancel,
}) {
  // Active Swapanza session
  if (isSwapanzaActive && swapanzaEndTime) {
    return (
      <div className="border-t p-4 bg-gradient-to-r from-purple-50 to-purple-100">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <span className="text-lg font-bold text-purple-800">Swapanza Active!</span>
          </div>

          {timeLeft !== null && (
            <div className="text-sm text-purple-700 mb-2">
              Time Left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          )}

          {swapanzaStartTime && (
            <div className="text-xs text-purple-600 mb-3">
              Started: {new Date(swapanzaStartTime).toLocaleTimeString()}
            </div>
          )}

          <div className="flex items-center justify-center space-x-4 text-sm">
            <div className="bg-white px-3 py-1 rounded-full border border-purple-200">
              <span className="text-purple-800">
                You appear as: <strong>{swapanzaPartner?.username}</strong>
              </span>
            </div>
            <div className="bg-purple-200 text-purple-800 px-3 py-1 rounded-full font-medium">
              Messages left: {remainingMessages}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Pending Swapanza request
  if (isSwapanzaRequested && swapanzaRequestedByUsername) {
    const isCurrentUserRequester = Number(swapanzaRequestedBy) === Number(currentUserId);

    return (
      <div className="border-t p-4 bg-gradient-to-r from-yellow-50 to-yellow-100">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-3">
            <span className="text-lg font-bold text-yellow-800">
              {isCurrentUserRequester ? 'Swapanza Request Sent' : 'Swapanza Invitation'}
            </span>
          </div>

          <div className="text-sm text-yellow-700 mb-3">
            {isCurrentUserRequester ? (
              'Waiting for partner to confirm...'
            ) : (
              <span>
                <strong>{swapanzaRequestedByUsername}</strong> invited you to Swapanza!
              </span>
            )}
          </div>

          <div className="flex items-center justify-center space-x-3">
            {/* Confirm button for recipient */}
            {!userConfirmedSwapanza && !isCurrentUserRequester && (
              <button
                onClick={onConfirm}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors duration-200 shadow-md"
              >
                Confirm Participation
              </button>
            )}

            {/* Cancel button for requester */}
            {isCurrentUserRequester && (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-gray-200 text-gray-800 text-sm rounded-lg hover:bg-gray-300 transition-colors duration-200"
              >
                Cancel Invitation
              </button>
            )}
          </div>

          {/* Confirmation status */}
          {userConfirmedSwapanza && partnerConfirmedSwapanza ? (
            <div className="mt-3 bg-green-100 text-green-800 px-3 py-2 rounded-lg text-sm inline-block">
              Both confirmed! Starting Swapanza...
            </div>
          ) : userConfirmedSwapanza ? (
            <div className="mt-3 bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-sm inline-block">
              Waiting for partner confirmation...
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return null;
}

SwapanzaStatusBar.propTypes = {
  isSwapanzaActive: PropTypes.bool,
  swapanzaEndTime: PropTypes.instanceOf(Date),
  swapanzaStartTime: PropTypes.instanceOf(Date),
  swapanzaPartner: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    username: PropTypes.string,
    profile_image: PropTypes.string,
  }),
  timeLeft: PropTypes.number,
  remainingMessages: PropTypes.number,
  isSwapanzaRequested: PropTypes.bool,
  swapanzaRequestedBy: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  swapanzaRequestedByUsername: PropTypes.string,
  currentUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  userConfirmedSwapanza: PropTypes.bool,
  partnerConfirmedSwapanza: PropTypes.bool,
  onConfirm: PropTypes.func,
  onCancel: PropTypes.func,
};

export default SwapanzaStatusBar;
