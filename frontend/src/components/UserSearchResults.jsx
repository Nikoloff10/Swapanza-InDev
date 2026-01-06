import React from 'react';
import PropTypes from 'prop-types';
import { FaPlus } from 'react-icons/fa';
import UserAvatar from './UserAvatar';

/**
 * UserSearchResults - Dropdown showing user search results
 */
function UserSearchResults({ results, onSelectUser }) {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2">
      {results.map((user) => (
        <div
          key={user.id}
          onClick={() => onSelectUser(user.id)}
          className="flex items-center justify-between p-3 bg-gray-50 hover:bg-green-50 rounded-lg cursor-pointer transition-colors duration-200 border border-gray-100"
        >
          <div className="flex items-center space-x-3">
            <UserAvatar
              username={user.username}
              profileImageUrl={user.profile_image_url}
              size="sm"
            />
            <span className="font-medium text-gray-900">{user.username}</span>
          </div>
          <FaPlus className="text-green-500 w-4 h-4" />
        </div>
      ))}
    </div>
  );
}

UserSearchResults.propTypes = {
  results: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      username: PropTypes.string.isRequired,
      profile_image_url: PropTypes.string,
    })
  ),
  onSelectUser: PropTypes.func.isRequired,
};

UserSearchResults.defaultProps = {
  results: [],
};

export default UserSearchResults;
