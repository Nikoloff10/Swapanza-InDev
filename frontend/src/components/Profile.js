
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Profile = ({ logout, username }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="text-center mb-8">
        <div className="w-24 h-24 rounded-full bg-blue-500 text-white text-3xl flex items-center justify-center mx-auto mb-4">
          {username?.charAt(0)?.toUpperCase()}
        </div>
        <h2 className="text-2xl font-bold">{username}</h2>
      </div>
  
      <div className="space-y-4">
        <button 
          onClick={() => navigate('/chats')}
          className="w-full p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Back to Chats
        </button>
          
        <button 
          onClick={handleLogout}
          className="w-full p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Profile;