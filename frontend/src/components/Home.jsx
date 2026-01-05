import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

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
      description:
        'Wanna chat with the whole crew or just couple of friends? You can do it the entertaining way.',
    },
    {
      title: 'Swapanza Sessions',
      description:
        'Unique identity-swapping experiences for enhanced privacy and fun interactions.',
    },
    {
      title: 'Modern Interface',
      description:
        'Beautiful-ish, responsive design that works (almost)seamlessly across all devices.',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-green-50 via-white to-green-50">
        <div className="container">
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-8">
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                Welcome to <span className="text-gradient">Swapanza</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Experience the future of social interaction with our innovative chat platform.
                Connect, chat, and explore new ways to communicate.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login" className="btn-primary text-lg px-8 py-4">
                Get Started
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
      <section className="py-20 bg-gray-50">
        <div className="container">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Ready to Start Your Journey?</h2>
            <p className="text-lg text-gray-600 mb-8">
              Join the fun, the more people to mess with - the better.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
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

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">Swapanza</h3>
            <p className="text-gray-400 mb-6">
              Built to respect your privacy and entertain your soul.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
