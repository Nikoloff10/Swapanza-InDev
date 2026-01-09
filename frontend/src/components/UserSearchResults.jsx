import React from 'react';
import PropTypes from 'prop-types';
import { FaPlus } from 'react-icons/fa';
import UserAvatar from './UserAvatar';
import './styles/UserSearchResults.css';

/**
 * UserSearchResults - Dropdown showing user search results
 */
function UserSearchResults({ results, onSelectUser }) {
  if (!results || results.length === 0) {
    return null;
  }

  return (
    <div className="user-search-results">
      {results.map((user) => (
        <div key={user.id} onClick={() => onSelectUser(user.id)} className="user-search-item">
          <div className="user-search-item-left">
            <UserAvatar
              username={user.username}
              profileImageUrl={user.profile_image_url}
              size="sm"
            />
            <span className="user-search-username">{user.username}</span>
          </div>
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
