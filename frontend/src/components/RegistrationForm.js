import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function RegistrationForm() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError({ confirmPassword: ["Passwords do NOT match"] });
      return;
    }

    try {
      await axios.post(
        `${apiUrl}/api/users/create/`,
        {
          username: username,
          password: password.trim(),
          email: email,
          confirm_password: confirmPassword.trim()
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      navigate('/login');
    } catch (error) {
      setError(error.response.data);
    }
  };

  const handleLoginRedirect = () => {
    navigate('/login');
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow text-center">
      {error && (
        <ul className="text-red-500 mb-4">
          {Object.values(error).map((err, index) => (
            <li key={index}>{err[0]}</li>
          ))}
        </ul>
      )}
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
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
      <input
        type="password"
        placeholder="Confirm Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        className="w-full p-3 mb-4 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <button type="submit" className="w-full bg-green-500 text-white py-3 rounded hover:bg-green-600 transition-colors">
        Register
      </button>
      <p className="mt-4">
        or&nbsp;
        <button type="button" onClick={handleLoginRedirect} className="text-blue-500 hover:underline">
          Login
        </button>
      </p>
    </form>
  );
}

export default RegistrationForm;