
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_URL;

function LoginForm() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${apiUrl}/api/token/`, { username, password });
      localStorage.setItem('token', response.data.access);
      localStorage.setItem('username', username);
      navigate('/');
    } catch (error) {
      setError(error.response.data.detail);
    }
  };

  const handleLoginRedirect = () => {
    navigate('/register');
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow text-center">
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <button type="submit" className="w-full bg-blue-500 text-white py-3 rounded hover:bg-blue-600 transition-colors">
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