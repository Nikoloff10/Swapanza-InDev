import React from 'react';
import PropTypes from 'prop-types';

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
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-xl',
  };

  const baseClasses = `rounded-full bg-gradient-to-br ${gradientFrom} ${gradientTo} text-white flex items-center justify-center font-bold overflow-hidden`;
  const interactiveClasses = onClick ? 'cursor-pointer ring-2 ring-white shadow-lg' : '';

  return (
    <div
      className={`${baseClasses} ${sizeClasses[size]} ${interactiveClasses} ${className}`}
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
