import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import App from './App.jsx';
import './index.css';

// Automatically set axios baseURL based on current pathname (subfolder support)
const currentPath = window.location.pathname;
if (currentPath.includes('/TheSSBuddyWMS')) {
  axios.defaults.baseURL = '/TheSSBuddyWMS';
} else {
  axios.defaults.baseURL = '';
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
