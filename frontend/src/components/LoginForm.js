import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function LoginForm({ login }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLoginRedirect = () => {
    navigate('/register');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await axios.post('/api/token/', {
        username,
        password
      });

      const token = response.data.access;

      // Fetch user details from /api/profile/
      const profileResponse = await axios.get('/api/profile/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const userId = profileResponse.data.id; // Extract user ID from profile

      localStorage.setItem('token', token);
      localStorage.setItem('username', username);
      localStorage.setItem('userId', userId); // Store the user ID
      console.log("LoginForm: userId set to localStorage:", userId);
      login(token, username);

      navigate('/chats', { replace: true });

    } catch (error) {
      setError(error.response?.data?.detail || 'Login failed');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow text-center">
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        required
        className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
        className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      <button
        type="submit"
        className="w-full bg-blue-500 text-white py-3 rounded hover:bg-blue-600 transition-colors"
      >
        Login
      </button>
      <p className="mt-4">
        or&nbsp;
        <button type="button" onClick={handleLoginRedirect} className="text-blue-500 hover:underline">
          Register
        </button>
      </p>
    </form>
  );
}

export default LoginForm;