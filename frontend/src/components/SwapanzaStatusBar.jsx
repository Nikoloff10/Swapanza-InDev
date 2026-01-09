import React from 'react';
import './styles/SwapanzaStatusBar.css';
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
      <div className="swapanza-active">
        <div className="text-center">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#5b21b6' }}>
              Swapanza Active!
            </span>
          </div>

          {timeLeft !== null && (
            <div style={{ fontSize: '0.875rem', color: '#6d28d9', marginBottom: '0.5rem' }}>
              Time Left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          )}

          {swapanzaStartTime && (
            <div style={{ fontSize: '0.75rem', color: '#7c3aed', marginBottom: '0.75rem' }}>
              Started: {new Date(swapanzaStartTime).toLocaleTimeString()}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              fontSize: '0.875rem',
            }}
          >
            <div
              style={{
                background: '#fff',
                padding: '0.25rem 0.75rem',
                borderRadius: 9999,
                border: '1px solid #e9d5ff',
              }}
            >
              <span style={{ color: '#6d28d9' }}>
                You appear as: <strong>{swapanzaPartner?.username}</strong>
              </span>
            </div>
            <div
              style={{
                background: '#ede9fe',
                color: '#5b21b6',
                padding: '0.25rem 0.75rem',
                borderRadius: 9999,
                fontWeight: 600,
              }}
            >
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
      <div className="swapanza-pending">
        <div className="text-center">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              marginBottom: '0.75rem',
            }}
          >
            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#92400e' }}>
              {isCurrentUserRequester ? 'Swapanza Request Sent' : 'Swapanza Invitation'}
            </span>
          </div>

          <div style={{ fontSize: '0.875rem', color: '#92400e', marginBottom: '0.75rem' }}>
            {isCurrentUserRequester ? (
              'Waiting for partner to confirm...'
            ) : (
              <span>
                <strong>{swapanzaRequestedByUsername}</strong> invited you to Swapanza!
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
            }}
          >
            {/* Confirm button for recipient */}
            {!userConfirmedSwapanza && !isCurrentUserRequester && (
              <button onClick={onConfirm} className="btn-purple btn-sm">
                Confirm Participation
              </button>
            )}

            {/* Cancel button for requester */}
            {isCurrentUserRequester && (
              <button onClick={onCancel} className="btn-secondary btn-sm">
                Cancel Invitation
              </button>
            )}
          </div>

          {/* Confirmation status */}
          {userConfirmedSwapanza && partnerConfirmedSwapanza ? (
            <div className="status-indicator status-indicator--green">
              Both confirmed! Starting Swapanza...
            </div>
          ) : userConfirmedSwapanza ? (
            <div className="status-indicator status-indicator--blue">
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
