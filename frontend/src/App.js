import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, Link } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import RegistrationForm from './components/RegistrationForm';
import ChatList from './components/ChatList';
import Profile from './components/Profile';
import Home from './components/Home';
import { setupTokenExpirationChecker, validateToken } from './utils/tokenUtils';
import './utils/axiosConfig';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

function ScrollToTop() {
  const { pathname } = useLocation();
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  
  return null;
}

function Navigation({ isAuth, username, logout }) {
  if (!isAuth) return null;
  
  return (
    <nav className="bg-white/90 backdrop-blur-sm border-b border-green-100">
      <div className="container">
        <div className="flex-between py-4">
          <div className="flex items-center space-x-8">
            <Link to="/chats" className="text-green-600 hover:text-green-700 font-medium transition-colors">
              💬 Chats
            </Link>
            <Link to="/profile" className="text-green-600 hover:text-green-700 font-medium transition-colors">
              👤 Profile
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-green-700 font-medium">Welcome, {username}!</span>
            <button
              onClick={logout}
              className="btn-danger text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function App() {
  const [isAuth, setIsAuth] = useState(false);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [tokenChecked, setTokenChecked] = useState(false);

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
    // Validate token on initial load
    const isTokenValid = validateToken();
    setIsAuth(isTokenValid && !!localStorage.getItem('token'));
    setUsername(localStorage.getItem('username') || '');
    setTokenChecked(true);
    
    // Set up periodic token checking
    const cleanup = setupTokenExpirationChecker(30000); // Check every 30 seconds
    
    return () => cleanup();
  }, []);

  // Don't render until initial token check is complete
  if (!tokenChecked) {
    return (
      <div className="flex-center min-h-screen bg-gradient-to-br from-green-50 to-green-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-green-700 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <ToastContainer 
        position="top-right" 
        autoClose={4000} 
        hideProgressBar={false} 
        newestOnTop 
        closeOnClick 
        pauseOnFocusLoss 
        draggable 
        pauseOnHover
        toastStyle={{
          backgroundColor: 'white',
          color: '#166534',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      />
      <Router>
        <ScrollToTop />
        <header className="App-header">
          <div className="container">
            <div className="flex-between">
              <Link to="/" className="text-decoration-none">
                <h1>🌱 Swapanza</h1>
              </Link>
              {!isAuth && (
                <div className="flex items-center space-x-4">
                  <Link to="/login" className="btn-secondary">
                    Login
                  </Link>
                  <Link to="/register" className="btn-primary">
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>
        
        <Navigation isAuth={isAuth} username={username} logout={logout} />
        
        <main className="main-content">
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
        </main>
      </Router>
    </div>
  );
}

export default App;