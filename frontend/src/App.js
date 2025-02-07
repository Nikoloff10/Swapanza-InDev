import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Home from './components/Home';
import LoginForm from './components/LoginForm';
import RegistrationForm from './components/RegistrationForm';
import ChatList from './components/ChatList';
import Profile from './components/Profile';

function App() {
  const [isAuth, setIsAuth] = useState(!!localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username') || '');

  useEffect(() => {
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  const login = (token) => {
    localStorage.setItem('token', token);
    const storedUsername = localStorage.getItem('username');
    if (storedUsername) {
      setUsername(storedUsername);
    }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setIsAuth(true);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuth(false);
    setUsername('');
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={isAuth ? <Navigate to="/chats" replace /> : <Home />}
        />
        <Route
          path="/login"
          element={<LoginForm login={login} />}
        />
        <Route
          path="/register"
          element={isAuth ? <Navigate to="/chats" replace /> : <RegistrationForm />}
        />
        <Route
          path="/chats"
          element={isAuth ? <ChatList logout={logout} username={username} /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/profile"
          element={isAuth ? <Profile logout={logout} username={username} /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;