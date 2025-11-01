import api from '../config/axios';

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
   * @returns {Promise} User data
   */
  getCurrentUser: async () => {
    const response = await api.get('/api/auth/user/me');
    return response.data;
  }
};
