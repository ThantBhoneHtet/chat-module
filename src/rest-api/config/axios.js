import axios from 'axios';
import { toast } from 'sonner';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: 'http://localhost:8080/',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('jwtToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle JWT token expiration
    if (error.response?.status === 401) {
      const errorMessage = error.response?.data?.error;
      
      // Clear session storage
      sessionStorage.removeItem('jwtToken');
      sessionStorage.removeItem('currentUser');
      
      // Show appropriate message based on error type
      if (errorMessage === 'JWT token expired') {
        toast.error('Session expired. Please login again.');
      } else {
        toast.error('Authentication failed. Please login again.');
      }
      
      // Redirect to login page after delay so user can read the message
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    }
    return Promise.reject(error);
  }
);

export default api;