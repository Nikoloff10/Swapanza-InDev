import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';

function Profile({ logout, username }) {
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bio, setBio] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const { userId: profileUserId } = useParams();
  
  // Determine if we're viewing our own profile or someone else's
  const isOwnProfile = !profileUserId || profileUserId === userId;
  const targetUserId = isOwnProfile ? userId : profileUserId;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`/api/profile/${targetUserId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProfile(response.data);
        setBio(response.data.bio || '');
        
        // Save profile image URL to localStorage for use across the app
        if (response.data.profile_image_url && isOwnProfile) {
          localStorage.setItem('profileImageUrl', response.data.profile_image_url);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching profile:', error);
        setError(error);
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token, targetUserId, isOwnProfile]);

  const handleImageChange = (e) => {
    setImageFile(e.target.files[0]);
  };

  const handleImageUpload = async () => {
    if (!imageFile) return;

    const formData = new FormData();
    formData.append('profile_image', imageFile);

    setUploading(true);
    try {
      
      const response = await axios.post(`/api/profile/${userId}/upload-image/`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`
          
        },
      });
      
      // Save to localStorage for use across the app
      localStorage.setItem('profileImageUrl', response.data.profile_image_url);
      
      setProfile({ ...profile, profile_image_url: response.data.profile_image_url });
      setUploading(false);
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploading(false);
    }
  };

  const handleUpdateBio = async () => {
    try {
      const response = await axios.put(
        `/api/profile/${userId}/`,  
        { bio },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      setProfile({ ...profile, bio: response.data.bio });
    } catch (error) {
      console.error('Error updating bio:', error);
    }
  };

  if (loading) return <div className="text-center mt-8">Loading profile...</div>;
  if (error) return <div className="text-center mt-8 text-red-500">Error: {error.message}</div>;

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded shadow-lg mt-8">
      <h1 className="text-2xl font-bold text-center mb-6">
        {isOwnProfile ? 'My Profile' : `${profile.username}'s Profile`}
      </h1>
      
      <div className="flex flex-col items-center mb-6">
        {/* Circular profile picture */}
        <div className="w-32 h-32 rounded-full bg-blue-500 text-white flex items-center justify-center mx-auto mb-4 overflow-hidden">
          {profile.profile_image_url ? (
            <img
              src={profile.profile_image_url}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-300 flex items-center justify-center">
              <span className="text-2xl">
                {profile.username ? profile.username[0].toUpperCase() : '?'}
              </span>
            </div>
          )}
        </div>
        
        <h2 className="text-xl font-bold mb-2">{profile.username || username}</h2>
        
        {isOwnProfile && (
          <div className="mt-4 w-full">
            <label className="block text-sm font-medium text-gray-700">Change Profile Picture</label>
            <input
              type="file" 
              accept="image/*"
              onChange={handleImageChange}
              className="mt-1 p-2 w-full border rounded-md"
            />
            <button 
              onClick={handleImageUpload}
              disabled={!imageFile || uploading}
              className="mt-2 w-full p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
            >
              {uploading ? 'Uploading...' : 'Upload Image'}
            </button>
          </div>
        )}
      </div>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700">Bio</label>
        {isOwnProfile ? (
          <>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-1 p-2 w-full border rounded-md h-24"
              placeholder="Tell us about yourself..."
            ></textarea>
            <button
              onClick={handleUpdateBio}
              className="mt-2 w-full p-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              Update Bio
            </button>
          </>
        ) : (
          <div className="mt-1 p-2 w-full border rounded-md h-24 bg-gray-50">
            {profile.bio || 'No bio available.'}
          </div>
        )}
      </div>
      
      <div className="space-y-3">
        {/* Back to Home button */}
        <Link to="/"
          className="block w-full p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-center"
        >
          Back to Home
        </Link>
        
        {/* Back to Chats button */}
        <Link to="/chats"
          className="block w-full p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-center"
        >
          Back to Chats
        </Link>
        
        {isOwnProfile && (
          <button
            onClick={logout}
            className="w-full p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Logout
          </button>
        )}
      </div>
    </div>
  );
}

export default Profile;