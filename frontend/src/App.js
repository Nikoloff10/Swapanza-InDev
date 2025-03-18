import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import RegistrationForm from './components/RegistrationForm';
import ChatList from './components/ChatList';
import Profile from './components/Profile';
import Home from './components/Home';

// Create a component that scrolls to top on navigation
function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
}

function App() {
  const [isAuth, setIsAuth] = useState(!!localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username') || '');

  const login = (token, username, userId) => {
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    localStorage.setItem('userId', userId);
    setIsAuth(true);
    setUsername(username);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    setIsAuth(false);
    setUsername('');
  };

  useEffect(() => {
    setIsAuth(!!localStorage.getItem('token'));
    setUsername(localStorage.getItem('username') || '');
  }, []);

  return (
    <Router>
      <ScrollToTop />
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
        <Route
          path="/profile/:userId"
          element={isAuth ? <Profile logout={logout} username={username} /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;