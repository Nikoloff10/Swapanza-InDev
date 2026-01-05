import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from '../utils/axiosConfig';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await axios.post('/api/token/', {
        username,
        password,
      });

      const token = response.data.access;

      const profileResponse = await axios.get('/api/profile/', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const userId = profileResponse.data.id;
      login(token, username, userId);

      toast.success(`Welcome back, ${username}!`);
      navigate('/chats', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex-center bg-gradient-to-br from-green-50 to-green-100 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your Swapanza account</p>
        </div>

        {/* Login Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
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
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
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
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">New to Swapanza?</span>
            </div>
          </div>

          {/* Register Link */}
          <div className="text-center">
            <Link to="/register" className="btn-secondary w-full inline-block text-center">
              Create Account
            </Link>
          </div>
        </div>

        {/* Footer Links */}
        <div className="text-center mt-6">
          <div className="flex justify-center space-x-4 text-sm text-gray-500">
            <Link to="/" className="hover:text-green-600 transition-colors">
              Back to Home
            </Link>
            <span>•</span>
            <button className="hover:text-green-600 transition-colors">Forgot Password?</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginForm;
