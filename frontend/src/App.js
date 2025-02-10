import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import RegistrationForm from './components/RegistrationForm';
import ChatList from './components/ChatList';
import Profile from './components/Profile';
import Home from './components/Home';

function App() {
  const [isAuth, setIsAuth] = useState(!!localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username') || '');

  const login = (token, username) => {
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    setIsAuth(true);
    setUsername(username);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setIsAuth(false);
    setUsername('');
  };

  useEffect(() => {
    setIsAuth(!!localStorage.getItem('token'));
    setUsername(localStorage.getItem('username') || '');
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/login"
          element={isAuth ? <Navigate to="/chats" replace /> : <LoginForm login={login} />}
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