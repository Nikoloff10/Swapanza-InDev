import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';

function Profile({ logout, username }) {
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bio, setBio] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
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
      setImageFile(null);
      toast.success('Profile picture updated successfully! 🎉');
      setUploading(false);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image. Please try again.');
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
      setEditingBio(false);
      toast.success('Bio updated successfully!');
    } catch (error) {
      console.error('Error updating bio:', error);
      toast.error('Failed to update bio. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-green-700 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="card text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Profile</h2>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <Link to="/chats" className="btn-primary">
            Back to Chats
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 py-12">
      <div className="container">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isOwnProfile ? 'My Profile' : `${profile.username}'s Profile`}
            </h1>
            <p className="text-gray-600">
              {isOwnProfile ? 'Manage your account and preferences' : 'View user profile'}
            </p>
          </div>

          {/* Profile Card */}
          <div className="card">
            {/* Profile Picture Section */}
            <div className="text-center mb-8">
              <div className="relative inline-block">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-300 to-green-500 text-white flex items-center justify-center mx-auto mb-4 overflow-hidden ring-4 ring-white shadow-lg">
                  {profile.profile_image_url ? (
                    <img
                      src={profile.profile_image_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-green-300 to-green-500 flex items-center justify-center">
                      <span className="text-4xl font-bold">
                        {profile.username ? profile.username[0].toUpperCase() : '?'}
                      </span>
                    </div>
                  )}
                </div>
                
                {isOwnProfile && (
                  <div className="absolute -bottom-2 -right-2">
                    <label className="cursor-pointer bg-green-400 hover:bg-green-500 text-white p-3 rounded-full shadow-lg transition-colors flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      <input
                        type="file" 
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{profile.username || username}</h2>
              
              {isOwnProfile && imageFile && (
                <div className="mt-4">
                  <button 
                    onClick={handleImageUpload}
                    disabled={uploading}
                    className="btn-primary"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      'Save New Picture'
                    )}
                  </button>
                </div>
              )}
            </div>
            
            {/* Bio Section */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Bio</h3>
                {isOwnProfile && !editingBio && (
                  <button
                    onClick={() => setEditingBio(true)}
                    className="text-green-600 hover:text-green-700 text-sm font-medium"
                  >
                    Edit
                  </button>
                )}
              </div>
              
              {isOwnProfile && editingBio ? (
                <div className="space-y-4">
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="input-field h-24 resize-none"
                    placeholder="Tell us about yourself..."
                  ></textarea>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleUpdateBio}
                      className="btn-primary flex-1"
                    >
                      Save Bio
                    </button>
                    <button
                      onClick={() => {
                        setEditingBio(false);
                        setBio(profile.bio || '');
                      }}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-gray-700">
                    {profile.bio || (isOwnProfile ? 'No bio yet. Click edit to add one!' : 'No bio available.')}
                  </p>
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="space-y-3">
              <Link to="/chats" className="btn-primary w-full text-center">
                Back to Chats
              </Link>
              
              {isOwnProfile && (
                <button
                  onClick={logout}
                  className="btn-danger w-full"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;