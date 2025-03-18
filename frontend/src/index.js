import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import axios from 'axios';

// Set default base URL for all axios requests
// In production, you can leave it empty if your API is served from the same domain
axios.defaults.baseURL = process.env.NODE_ENV === 'production' 
  ? '' 
  : 'http://localhost:8000';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);