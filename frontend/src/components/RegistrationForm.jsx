import React, { useState } from 'react';
import './styles/RegistrationForm.css';
import { useNavigate, Link } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import { toast } from 'react-toastify';

function RegistrationForm() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post('/api/users/create/', {
        username: username,
        password: password.trim(),
        email: email,
      });
      toast.success('Registration successful! Please login.');
      navigate('/login');
    } catch (error) {
      if (error.response?.data) {
        // Handle validation errors
        const errors = error.response.data;
        if (typeof errors === 'object') {
          const errorMessages = Object.values(errors).flat();
          errorMessages.forEach((msg) => toast.error(msg));
        } else {
          toast.error(error.response.data.detail || 'Registration failed');
        }
      } else {
        toast.error('Registration failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-bg flex-center py-12 auth-wrapper">
      <div className="w-full max-w-md auth-container">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Join Swapanza</h1>
          <p className="text-gray-600">Create your account and start chatting</p>
        </div>

        {/* Registration Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="form space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="input-field"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-field"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="input-field"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="divider">
            <span className="divider-text">Already have an account?</span>
          </div>

          {/* Login Link */}
          <div className="text-center">
            <Link to="/login" className="btn-secondary w-full inline-block text-center">
              Sign In
            </Link>
          </div>
        </div>

        {/* Footer Links */}
        <div className="text-center mt-6">
          <div className="flex justify-center space-x-4 text-sm text-gray-500"></div>
        </div>
      </div>
    </div>
  );
}

export default RegistrationForm;
