import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Profile = ({ logout, username }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get('/api/profile/', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setProfile(response.data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, [token]);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  if (!profile) {
    return <div>Loading profile...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <div className="text-center mb-8">
        <div className="w-24 h-24 rounded-full bg-blue-500 text-white flex items-center justify-center mx-auto mb-4 overflow-hidden">
          {profile.profile_image_url ? (
            <img
              src={profile.profile_image_url}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src="https://res.cloudinary.com/dfxbvixpv/image/upload/v1738928319/unisex_default_profile_picture_zovdsw.jpg" // Replace with the actual path to your default image
              alt="Default Profile"
              className="w-full h-full object-cover"
            />
          )}
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