import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Route,
  Routes,
  Navigate,
  useLocation,
  Link,
} from 'react-router-dom';
import LoginForm from './components/LoginForm';
import RegistrationForm from './components/RegistrationForm';
import ChatList from './components/ChatList';
import Profile from './components/Profile';
import Home from './components/Home';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
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

function Navigation() {
  const { isAuth, username, logout } = useAuth();
  const location = useLocation();
  const path = location?.pathname || '';

  if (!isAuth) return null;

  const onChats = path.startsWith('/chats');
  const onProfile = path === '/profile' || path.startsWith('/profile/');

  return (
    <nav className="nav">
      <div className="container">
        <div className="flex-between py-4">
          <div className="nav-links">
            {!onChats && (
              <Link to="/chats" className="nav-link">
                Chats
              </Link>
            )}
            {!onProfile && (
              <Link to="/profile" className="nav-link">
                Profile
              </Link>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <span className="nav-welcome">Welcome, {username}!</span>
            <button onClick={logout} className="btn-danger text-sm">
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  const { isAuth, isLoading } = useAuth();

  // Don't render until initial token check is complete
  if (isLoading) {
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
        <Header />
        <Navigation />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/login"
              element={isAuth ? <Navigate to="/chats" replace /> : <LoginForm />}
            />
            <Route
              path="/register"
              element={isAuth ? <Navigate to="/chats" replace /> : <RegistrationForm />}
            />
            <Route
              path="/chats"
              element={isAuth ? <ChatList /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/profile"
              element={isAuth ? <Profile /> : <Navigate to="/login" replace />}
            />
            <Route
              path="/profile/:userId"
              element={isAuth ? <Profile /> : <Navigate to="/login" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </Router>
    </div>
  );
}

function Header() {
  const { isAuth } = useAuth();

  return (
    <header className="App-header">
      <div className="container">
        <div className="flex-between">
          <Link to="/" className="text-decoration-none flex items-center space-x-3">
            <img
              src="/logo.png"
              alt="Swapanza logo"
              width={40}
              height={40}
              style={{ borderRadius: '8px' }}
            />
            <h1>Swapanza</h1>
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
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
