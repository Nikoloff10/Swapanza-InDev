import React from 'react';
import PropTypes from 'prop-types';
import './styles/UserAvatar.css';

/**
 * UserAvatar - Reusable avatar component
 * Displays user profile image or initial letter
 */
function UserAvatar({
  username,
  profileImageUrl,
  size = 'md',
  onClick,
  className = '',
  gradientFrom = 'from-green-400',
  gradientTo = 'to-green-600',
}) {
  const sizeClasses = {
    sm: 'user-avatar--sm',
    md: 'user-avatar--md',
    lg: 'user-avatar--lg',
  };

  const interactiveClasses = onClick ? 'user-avatar--clickable' : '';

  // Map some common gradient tokens to CSS color variables
  const gradientMap = {
    'from-green-400': 'var(--primary-400)',
    'to-green-600': 'var(--primary-600)',
    'from-green-300': 'var(--primary-300)',
    'to-green-500': 'var(--primary-500)',
    'from-purple-400': 'var(--accent-purple)',
    'to-purple-600': 'var(--accent-purple)',
    'from-yellow-50': 'rgba(255,249,231,1)',
    'to-yellow-100': 'rgba(254,243,199,1)',
  };

  const colorFrom = gradientMap[gradientFrom] || 'var(--primary-400)';
  const colorTo = gradientMap[gradientTo] || 'var(--primary-600)';

  const style = { background: `linear-gradient(135deg, ${colorFrom}, ${colorTo})` };

  return (
    <div
      className={`user-avatar ${sizeClasses[size]} ${interactiveClasses} ${className}`}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {profileImageUrl ? (
        <img
          src={profileImageUrl}
          alt={username || 'User'}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{username ? username[0].toUpperCase() : '?'}</span>
      )}
    </div>
  );
}

UserAvatar.propTypes = {
  username: PropTypes.string,
  profileImageUrl: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  onClick: PropTypes.func,
  className: PropTypes.string,
  gradientFrom: PropTypes.string,
  gradientTo: PropTypes.string,
};

export default UserAvatar;
