import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './styles/Home.css';

const Home = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (token) {
      navigate('/chats');
    }
  }, [token, navigate]);

  const features = [
    {
      title: 'It is fun (at least it is supposed to be)',
      description: 'Wanna chat with your friends? You can do it the entertaining way.',
    },
    {
      title: 'Swapanza Sessions',
      description: 'Unique identity-swapping experiences for fun interactions.',
    },
    {
      title: 'Modern Interface',
      description:
        'Beautiful-ish, responsive design that works (almost)seamlessly across all devices.',
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="container">
            <div className="hero-text">
              <div className="mb-8">
                <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                  Welcome to <span className="text-gradient">Swapanza</span>
                </h1>
                <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                  Experience another side of social interaction with our chat platform. Connect,
                  chat, and explore new ways to communicate.
                </p>
              </div>

              <div className="hero-buttons">
                <Link to="/login" className="btn-primary text-lg px-8 py-4">
                  Login
                </Link>
                <Link to="/register" className="btn-secondary text-lg px-8 py-4">
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-white">
          <div className="container">
            <h2 className="section-title">Why Choose Swapanza?</h2>
            <div className="grid-layout">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="card text-center group hover:scale-105 transition-transform duration-300"
                >
                  <div className="text-5xl mb-4">{feature.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gray-50 cta-section">
          <div className="container">
            <div className="cta-content">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Ready to Start Your Swapanza?
              </h2>
              <p className="text-lg text-gray-600 mb-8">
                Join the fun, the more people to mess with - the better.
              </p>
              <div className="hero-buttons">
                <Link to="/register" className="btn-primary text-lg px-8 py-4">
                  Register
                </Link>
                <Link to="/login" className="btn-secondary text-lg px-8 py-4">
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer mt-auto">
        <div className="container">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">Swapanza</h3>
            <p className="text-gray-400 mb-6">Built to entertain.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
