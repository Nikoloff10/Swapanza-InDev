import React, { useState, useEffect } from 'react';
import axios from '../utils/axiosConfig';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
import './styles/Profile.css';

function Profile() {
  const { token, userId, logout, username } = useAuth();
  const [profile, setProfile] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bio, setBio] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const { userId: profileUserId } = useParams();

  // Determine if we're viewing our own profile or someone else's
  const isOwnProfile = !profileUserId || profileUserId === String(userId);
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
          Authorization: `Bearer ${token}`,
        },
      });

      // Save to localStorage for use across the app
      localStorage.setItem('profileImageUrl', response.data.profile_image_url);

      setProfile({ ...profile, profile_image_url: response.data.profile_image_url });
      setImageFile(null);
      toast.success('Profile picture updated successfully!');
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
      <div className="page-bg flex-center">
        <div className="text-center">
          <div className="spinner spinner-large spinner-green" aria-hidden="true"></div>
          <p className="text-success font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-bg flex-center">
        <div className="card text-center">
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
    <div className="page-bg py-12 profile-page">
      <div className="container">
        <div className="max-w-2xl mx-auto profile-wrapper">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold profile-title">
              {isOwnProfile ? 'My Profile' : `${profile.username}'s Profile`}
            </h1>
            <p className="modal-text">
              {isOwnProfile ? 'Manage your account and preferences' : 'View user profile'}
            </p>
          </div>

          {/* Profile Card */}
          <div className="card profile-card">
            {/* Profile Picture Section */}
            <div className="text-center mb-8">
              <div className="relative inline-block">
                <div className="profile-avatar avatar-bg-green ring-4">
                  {profile.profile_image_url ? (
                    <img
                      src={profile.profile_image_url}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full avatar-bg-green flex items-center justify-center">
                      <span className="text-4xl font-bold">
                        {profile.username ? profile.username[0].toUpperCase() : '?'}
                      </span>
                    </div>
                  )}
                </div>

                {isOwnProfile && (
                  <div className="absolute" style={{ right: '-8px', bottom: '-8px' }}>
                    <input
                      id="profile-image-input"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{ display: 'none' }}
                      aria-hidden="true"
                    />
                    <label
                      htmlFor="profile-image-input"
                      className="upload-btn"
                      title="Upload profile picture"
                    >
                      <span style={{ marginLeft: '0.5rem', fontWeight: 600 }}>Upload Your Pic</span>
                    </label>
                  </div>
                )}
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {profile.username || username}
              </h2>

              {isOwnProfile && imageFile && (
                <div className="mt-4">
                  <button onClick={handleImageUpload} disabled={uploading} className="btn-primary">
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
                <h3 className="text-lg font-semibold">Bio</h3>
                {isOwnProfile && !editingBio && (
                  <button
                    onClick={() => setEditingBio(true)}
                    className="edit-btn"
                    aria-label="Edit bio"
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
                    <button onClick={handleUpdateBio} className="btn-primary flex-1">
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
                <div className="panel bio-panel">
                  <p className="text-muted">
                    {profile.bio ||
                      (isOwnProfile ? 'No bio yet. Click edit to add one!' : 'No bio available.')}
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
                <button onClick={logout} className="btn-danger w-full">
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
