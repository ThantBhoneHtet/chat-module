import api from '../config/axios';
import { jwtDecode } from 'jwt-decode';

/**
 * Authentication API service
 */
export const authAPI = {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @param {string} userData.email - User email
   * @param {string} userData.password - User password
   * @param {string} userData.firstName - User first name
   * @param {string} userData.lastName - User last name
   * @returns {Promise} JWT response
   */
  signup: async (userData) => {
    const response = await api.post('/api/auth/signup', userData);
    return response.data;
  },

  /**
   * Sign in existing user
   * @param {Object} credentials - Login credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @returns {Promise} JWT response
   */
  signin: async (credentials) => {
    const response = await api.post('/api/auth/signin', credentials);
    return response.data;
  },

  /**
   * Get current user info using JWT token
   * Decodes JWT to extract email, then fetches user details
   * @returns {Promise} User data
   */
  getCurrentUser: async () => {
    try {
      // Get JWT token from session storage
      const token = sessionStorage.getItem('jwtToken');
      if (!token) {
        throw new Error('No JWT token found');
      }

      // Decode JWT to extract email (subject)
      const decoded = jwtDecode(token);
      const email = decoded.sub;

      if (!email) {
        throw new Error('Email not found in JWT token');
      }

      // Fetch user details from backend using email
      const response = await api.get(`/api/users/email/${email}`);
      return response.data;
    } catch (error) {
      console.error('Error getting current user:', error);
      throw error;
    }
  }
};
