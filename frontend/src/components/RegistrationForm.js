import React, { useState } from 'react';
import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_URL 

function RegistrationForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
        setError({ confirmPassword: ["Passwords do NOT match"] });
        return;
    }

    try {
        await axios.post(`${apiUrl}/api/users/create/`, {
            username: username,
            password: password.trim(), 
            email: email,
            confirm_password: confirmPassword.trim() 
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        window.location.href = '/login';
    } catch (error) {
        setError(error.response.data);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <ul style={{ color: 'red' }}>{Object.values(error).map(err => <li>{err[0]}</li>)}</ul>}
      <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      <button type="submit">Register</button>
    </form>
  );
}

export default RegistrationForm;